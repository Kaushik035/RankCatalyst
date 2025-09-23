"""
Feature extraction from gaze data using rolling windows.
"""
import numpy as np
from typing import List, Dict, Any, Tuple
from django.conf import settings

from .models import GazeSample, FeatureWindow


def extract_features(session_id: str, window_ms: int = 3000, step_ms: int = 1000) -> List[FeatureWindow]:
    """
    Extract features from gaze samples using rolling windows.
    
    Args:
        session_id: Session ID to extract features for
        window_ms: Window size in milliseconds
        step_ms: Step size in milliseconds
        
    Returns:
        List of FeatureWindow objects created
    """
    # Get all gaze samples for the session
    samples = GazeSample.objects.filter(
        session_id=session_id,
        dropped=False
    ).order_by('ts_ms')
    
    if not samples.exists():
        return []
    
    # Convert to numpy arrays for efficient processing
    timestamps = np.array([s.ts_ms for s in samples])
    x_coords = np.array([s.x for s in samples])
    y_coords = np.array([s.y for s in samples])
    confidences = np.array([s.confidence for s in samples])
    zones = [s.zone for s in samples]
    
    # Find time range
    min_time = timestamps.min()
    max_time = timestamps.max()
    
    # Generate window boundaries
    windows = []
    start_time = min_time
    while start_time < max_time:
        end_time = start_time + window_ms
        
        # Find samples in this window
        mask = (timestamps >= start_time) & (timestamps < end_time)
        if not np.any(mask):
            start_time += step_ms
            continue
        
        # Extract features for this window
        window_features = _extract_window_features(
            timestamps[mask],
            x_coords[mask],
            y_coords[mask],
            confidences[mask],
            [zones[i] for i in range(len(zones)) if mask[i]]
        )
        
        # Create FeatureWindow object
        feature_window = FeatureWindow(
            session_id=session_id,
            start_ms=int(start_time),
            end_ms=int(end_time),
            features=window_features
        )
        windows.append(feature_window)
        
        start_time += step_ms
    
    return windows


def _extract_window_features(
    timestamps: np.ndarray,
    x_coords: np.ndarray,
    y_coords: np.ndarray,
    confidences: np.ndarray,
    zones: List[str]
) -> Dict[str, Any]:
    """
    Extract features for a single time window.
    
    Args:
        timestamps: Array of timestamps
        x_coords: Array of x coordinates
        y_coords: Array of y coordinates
        confidences: Array of confidence values
        zones: List of zone names
        
    Returns:
        Dict of extracted features
    """
    if len(timestamps) == 0:
        return {}
    
    features = {}
    
    # Basic statistics
    features['sample_count'] = len(timestamps)
    features['duration_ms'] = int(timestamps[-1] - timestamps[0]) if len(timestamps) > 1 else 0
    features['avg_confidence'] = float(np.mean(confidences))
    
    # Fixation detection using I-DT algorithm
    fixations = _detect_fixations(timestamps, x_coords, y_coords, confidences)
    features['fixation_count'] = len(fixations)
    features['avg_fixation_duration_ms'] = float(np.mean([f['duration'] for f in fixations])) if fixations else 0
    features['long_fixation_ms'] = float(max([f['duration'] for f in fixations])) if fixations else 0
    
    # Saccade detection
    saccades = _detect_saccades(timestamps, x_coords, y_coords)
    features['saccade_count'] = len(saccades)
    features['saccade_rate'] = len(saccades) / (features['duration_ms'] / 1000) if features['duration_ms'] > 0 else 0
    
    # Dispersion
    features['dispersion'] = _calculate_dispersion(x_coords, y_coords)
    
    # Zone dwell times
    features['dwell'] = _calculate_zone_dwell(zones, timestamps)
    
    # Blink proxy (low confidence periods)
    features['blink_proxy'] = _calculate_blink_proxy(confidences, timestamps)
    
    # Offscreen ratio
    features['offscreen_ratio'] = _calculate_offscreen_ratio(zones)
    
    return features


def _detect_fixations(
    timestamps: np.ndarray,
    x_coords: np.ndarray,
    y_coords: np.ndarray,
    confidences: np.ndarray,
    dispersion_threshold: float = 0.12,
    min_duration_ms: int = 100
) -> List[Dict[str, Any]]:
    """
    Detect fixations using I-DT (Identification by Dispersion Threshold) algorithm.
    
    Args:
        timestamps: Array of timestamps
        x_coords: Array of x coordinates
        y_coords: Array of y coordinates
        confidences: Array of confidence values
        dispersion_threshold: Maximum dispersion for fixation
        min_duration_ms: Minimum fixation duration
        
    Returns:
        List of fixation dictionaries
    """
    fixations = []
    
    if len(timestamps) < 2:
        return fixations
    
    # Calculate time differences
    time_diffs = np.diff(timestamps)
    
    # Find potential fixation points (high confidence)
    high_conf_mask = confidences > 0.7
    if not np.any(high_conf_mask):
        return fixations
    
    # Group consecutive high-confidence points
    groups = []
    current_group = []
    
    for i, is_high_conf in enumerate(high_conf_mask):
        if is_high_conf:
            current_group.append(i)
        else:
            if len(current_group) >= 2:  # Need at least 2 points
                groups.append(current_group)
            current_group = []
    
    # Don't forget the last group
    if len(current_group) >= 2:
        groups.append(current_group)
    
    # Check each group for fixation criteria
    for group in groups:
        if len(group) < 2:
            continue
        
        # Calculate dispersion
        group_x = x_coords[group]
        group_y = y_coords[group]
        group_times = timestamps[group]
        
        dispersion = (np.max(group_x) - np.min(group_x)) + (np.max(group_y) - np.min(group_y))
        
        # Check duration
        duration = group_times[-1] - group_times[0]
        
        if dispersion <= dispersion_threshold and duration >= min_duration_ms:
            # Calculate fixation center
            center_x = np.mean(group_x)
            center_y = np.mean(group_y)
            avg_confidence = np.mean(confidences[group])
            
            fixations.append({
                'start_ms': int(group_times[0]),
                'end_ms': int(group_times[-1]),
                'duration': int(duration),
                'center_x': float(center_x),
                'center_y': float(center_y),
                'dispersion': float(dispersion),
                'confidence': float(avg_confidence)
            })
    
    return fixations


def _detect_saccades(
    timestamps: np.ndarray,
    x_coords: np.ndarray,
    y_coords: np.ndarray,
    velocity_threshold: float = 0.5
) -> List[Dict[str, Any]]:
    """
    Detect saccades based on velocity thresholds.
    
    Args:
        timestamps: Array of timestamps
        x_coords: Array of x coordinates
        y_coords: Array of y coordinates
        velocity_threshold: Velocity threshold for saccade detection
        
    Returns:
        List of saccade dictionaries
    """
    saccades = []
    
    if len(timestamps) < 2:
        return saccades
    
    # Calculate velocities
    time_diffs = np.diff(timestamps) / 1000.0  # Convert to seconds
    x_velocities = np.diff(x_coords) / time_diffs
    y_velocities = np.diff(y_coords) / time_diffs
    
    # Calculate speed
    speeds = np.sqrt(x_velocities**2 + y_velocities**2)
    
    # Find saccade points
    saccade_mask = speeds > velocity_threshold
    
    # Group consecutive saccade points
    groups = []
    current_group = []
    
    for i, is_saccade in enumerate(saccade_mask):
        if is_saccade:
            current_group.append(i)
        else:
            if len(current_group) >= 2:  # Need at least 2 points
                groups.append(current_group)
            current_group = []
    
    # Don't forget the last group
    if len(current_group) >= 2:
        groups.append(current_group)
    
    # Create saccade objects
    for group in groups:
        if len(group) < 2:
            continue
        
        start_idx = group[0]
        end_idx = group[-1] + 1  # +1 because we're using diff indices
        
        saccades.append({
            'start_ms': int(timestamps[start_idx]),
            'end_ms': int(timestamps[end_idx]),
            'start_x': float(x_coords[start_idx]),
            'start_y': float(y_coords[start_idx]),
            'end_x': float(x_coords[end_idx]),
            'end_y': float(y_coords[end_idx]),
            'max_speed': float(np.max(speeds[group])),
            'avg_speed': float(np.mean(speeds[group]))
        })
    
    return saccades


def _calculate_dispersion(x_coords: np.ndarray, y_coords: np.ndarray) -> float:
    """Calculate gaze dispersion."""
    if len(x_coords) < 2:
        return 0.0
    
    # Calculate standard deviation of coordinates
    x_std = np.std(x_coords)
    y_std = np.std(y_coords)
    
    # Return combined dispersion
    return float(x_std + y_std)


def _calculate_zone_dwell(zones: List[str], timestamps: np.ndarray) -> Dict[str, float]:
    """Calculate dwell time for each zone."""
    if not zones or len(timestamps) < 2:
        return {}
    
    # Calculate time spent in each zone
    zone_times = {}
    total_time = timestamps[-1] - timestamps[0]
    
    if total_time == 0:
        return {}
    
    for i, zone in enumerate(zones):
        if zone is None:
            zone = 'unknown'
        
        if i < len(timestamps) - 1:
            time_in_zone = timestamps[i + 1] - timestamps[i]
        else:
            time_in_zone = 0
        
        zone_times[zone] = zone_times.get(zone, 0) + time_in_zone
    
    # Convert to ratios
    zone_ratios = {}
    for zone, time_in_zone in zone_times.items():
        zone_ratios[zone] = time_in_zone / total_time
    
    return zone_ratios


def _calculate_blink_proxy(confidences: np.ndarray, timestamps: np.ndarray) -> float:
    """Calculate blink proxy based on low confidence periods."""
    if len(confidences) == 0:
        return 0.0
    
    # Count low confidence periods
    low_conf_mask = confidences < 0.4
    low_conf_count = np.sum(low_conf_mask)
    
    return float(low_conf_count / len(confidences))


def _calculate_offscreen_ratio(zones: List[str]) -> float:
    """Calculate ratio of time spent offscreen."""
    if not zones:
        return 0.0
    
    offscreen_count = sum(1 for zone in zones if zone == 'offscreen')
    return float(offscreen_count / len(zones))
