"""
Heuristic attention detectors for gaze patterns.
"""
import logging
from typing import List, Dict, Any, Optional
from django.conf import settings

from .models import FeatureWindow, AttentionEvent, UserBaseline

logger = logging.getLogger(__name__)


def detect_attention_events(session_id: str) -> List[AttentionEvent]:
    """
    Detect attention events from recent feature windows.
    
    Args:
        session_id: Session ID to analyze
        
    Returns:
        List of detected AttentionEvent objects
    """
    # Get recent feature windows (last 2-3 windows)
    recent_windows = FeatureWindow.objects.filter(
        session_id=session_id
    ).order_by('-start_ms')[:3]
    
    if len(recent_windows) < 1:
        return []
    
    # Get user baseline
    session = recent_windows[0].session
    baseline = _get_user_baseline(session.user)
    
    events = []
    
    # Detect different types of attention events
    events.extend(_detect_on_task(recent_windows, baseline))
    events.extend(_detect_inattention(recent_windows, baseline))
    events.extend(_detect_confusion(recent_windows, baseline))
    events.extend(_detect_fatigue(recent_windows, baseline))
    
    return events


def _get_user_baseline(user) -> UserBaseline:
    """Get or create user baseline."""
    from .models import UserBaseline
    
    baseline, created = UserBaseline.objects.get_or_create(
        user=user,
        defaults={
            'baseline_dispersion': 0.1,
            'baseline_blink_rate': 0.05,
            'baseline_fixation_duration': 300.0,
            'sample_count': 0
        }
    )
    
    return baseline


def _detect_on_task(windows: List[FeatureWindow], baseline: UserBaseline) -> List[AttentionEvent]:
    """
    Detect on-task attention state.
    
    On-task if:
    - offscreen_ratio < 0.2
    - dispersion < baseline_dispersion * 1.2
    - fixation_count >= 2
    """
    events = []
    
    for window in windows:
        features = window.features
        
        # Check criteria
        offscreen_ratio = features.get('offscreen_ratio', 1.0)
        dispersion = features.get('dispersion', 1.0)
        fixation_count = features.get('fixation_count', 0)
        
        # Apply thresholds
        if (offscreen_ratio < 0.2 and 
            dispersion < baseline.baseline_dispersion * 1.2 and 
            fixation_count >= 2):
            
            # Calculate confidence score
            confidence = _calculate_on_task_confidence(
                offscreen_ratio, dispersion, fixation_count, baseline
            )
            
            if confidence > 0.6:  # Minimum confidence threshold
                event = AttentionEvent(
                    session=window.session,
                    ts_ms=window.end_ms,
                    kind='on_task',
                    score=confidence,
                    meta={
                        'offscreen_ratio': offscreen_ratio,
                        'dispersion': dispersion,
                        'fixation_count': fixation_count,
                        'baseline_dispersion': baseline.baseline_dispersion,
                        'detector': 'on_task_heuristic'
                    }
                )
                events.append(event)
    
    return events


def _detect_inattention(windows: List[FeatureWindow], baseline: UserBaseline) -> List[AttentionEvent]:
    """
    Detect inattention state.
    
    Inattention if:
    - offscreen_ratio > OFFSCREEN_THRESHOLD OR
    - dispersion > baseline_dispersion * 1.5 AND fixation_count == 0
    """
    events = []
    
    for window in windows:
        features = window.features
        
        # Check criteria
        offscreen_ratio = features.get('offscreen_ratio', 0.0)
        dispersion = features.get('dispersion', 0.0)
        fixation_count = features.get('fixation_count', 0)
        
        # Apply thresholds
        is_offscreen = offscreen_ratio > settings.OFFSCREEN_THRESHOLD
        is_scattered = (dispersion > baseline.baseline_dispersion * 1.5 and 
                       fixation_count == 0)
        
        if is_offscreen or is_scattered:
            # Calculate confidence score
            confidence = _calculate_inattention_confidence(
                offscreen_ratio, dispersion, fixation_count, baseline
            )
            
            if confidence > 0.6:  # Minimum confidence threshold
                event = AttentionEvent(
                    session=window.session,
                    ts_ms=window.end_ms,
                    kind='inattention',
                    score=confidence,
                    meta={
                        'offscreen_ratio': offscreen_ratio,
                        'dispersion': dispersion,
                        'fixation_count': fixation_count,
                        'baseline_dispersion': baseline.baseline_dispersion,
                        'trigger': 'offscreen' if is_offscreen else 'scattered',
                        'detector': 'inattention_heuristic'
                    }
                )
                events.append(event)
    
    return events


def _detect_confusion(windows: List[FeatureWindow], baseline: UserBaseline) -> List[AttentionEvent]:
    """
    Detect confusion state.
    
    Confusion if:
    - long_fixation_ms >= 1500 on same zone (question or single option) AND
    - dwell[zone] rising across consecutive windows OR re_read_count >= 2
    """
    events = []
    
    if len(windows) < 2:
        return events
    
    # Sort windows by time
    sorted_windows = sorted(windows, key=lambda w: w.start_ms)
    
    for i, window in enumerate(sorted_windows):
        features = window.features
        
        # Check criteria
        long_fixation_ms = features.get('long_fixation_ms', 0)
        dwell = features.get('dwell', {})
        
        # Find dominant zone
        dominant_zone = max(dwell.items(), key=lambda x: x[1])[0] if dwell else None
        
        # Check for long fixations on question/option zones
        is_long_fixation = (long_fixation_ms >= 1500 and 
                           dominant_zone in ['question', 'options'])
        
        if is_long_fixation:
            # Check for increasing dwell time (re-reading)
            re_read_count = 0
            if i > 0:
                prev_dwell = sorted_windows[i-1].features.get('dwell', {})
                if dominant_zone in prev_dwell and dominant_zone in dwell:
                    if dwell[dominant_zone] > prev_dwell[dominant_zone]:
                        re_read_count = 1
            
            # Check for multiple long fixations (re-read pattern)
            if i >= 2:
                prev_window = sorted_windows[i-1]
                prev_long_fixation = prev_window.features.get('long_fixation_ms', 0)
                if prev_long_fixation >= 1500:
                    re_read_count += 1
            
            if re_read_count >= 1:  # At least one re-read indicator
                # Calculate confidence score
                confidence = _calculate_confusion_confidence(
                    long_fixation_ms, re_read_count, dominant_zone
                )
                
                if confidence > 0.6:  # Minimum confidence threshold
                    event = AttentionEvent(
                        session=window.session,
                        ts_ms=window.end_ms,
                        kind='confusion',
                        score=confidence,
                        meta={
                            'long_fixation_ms': long_fixation_ms,
                            're_read_count': re_read_count,
                            'dominant_zone': dominant_zone,
                            'dwell_ratio': dwell.get(dominant_zone, 0),
                            'detector': 'confusion_heuristic'
                        }
                    )
                    events.append(event)
    
    return events


def _detect_fatigue(windows: List[FeatureWindow], baseline: UserBaseline) -> List[AttentionEvent]:
    """
    Detect fatigue state.
    
    Fatigue if:
    - blink_proxy > (baseline_blink + delta) for >= 2 consecutive windows
    """
    events = []
    
    if len(windows) < 2:
        return events
    
    # Sort windows by time
    sorted_windows = sorted(windows, key=lambda w: w.start_ms)
    
    # Check for consecutive high blink rates
    consecutive_high_blink = 0
    max_consecutive = 0
    
    for window in sorted_windows:
        features = window.features
        blink_proxy = features.get('blink_proxy', 0)
        
        # Check if blink rate is significantly above baseline
        blink_threshold = baseline.baseline_blink_rate + 0.1  # 10% increase
        
        if blink_proxy > blink_threshold:
            consecutive_high_blink += 1
            max_consecutive = max(max_consecutive, consecutive_high_blink)
        else:
            consecutive_high_blink = 0
    
    # If we have 2+ consecutive windows with high blink rate
    if max_consecutive >= 2:
        # Use the last window with high blink rate
        last_high_blink_window = None
        for window in reversed(sorted_windows):
            features = window.features
            blink_proxy = features.get('blink_proxy', 0)
            blink_threshold = baseline.baseline_blink_rate + 0.1
            
            if blink_proxy > blink_threshold:
                last_high_blink_window = window
                break
        
        if last_high_blink_window:
            # Calculate confidence score
            confidence = _calculate_fatigue_confidence(
                max_consecutive, last_high_blink_window.features.get('blink_proxy', 0), baseline
            )
            
            if confidence > 0.6:  # Minimum confidence threshold
                event = AttentionEvent(
                    session=last_high_blink_window.session,
                    ts_ms=last_high_blink_window.end_ms,
                    kind='fatigue',
                    score=confidence,
                    meta={
                        'consecutive_high_blink_windows': max_consecutive,
                        'blink_proxy': last_high_blink_window.features.get('blink_proxy', 0),
                        'baseline_blink_rate': baseline.baseline_blink_rate,
                        'detector': 'fatigue_heuristic'
                    }
                )
                events.append(event)
    
    return events


def _calculate_on_task_confidence(
    offscreen_ratio: float, 
    dispersion: float, 
    fixation_count: int, 
    baseline: UserBaseline
) -> float:
    """Calculate confidence score for on-task detection."""
    # Normalize metrics to [0, 1] range
    offscreen_score = max(0, 1 - offscreen_ratio / 0.2)  # Better if lower
    dispersion_score = max(0, 1 - dispersion / (baseline.baseline_dispersion * 1.2))  # Better if lower
    fixation_score = min(1, fixation_count / 5)  # Better if higher, cap at 5
    
    # Weighted average
    confidence = (offscreen_score * 0.4 + dispersion_score * 0.3 + fixation_score * 0.3)
    return min(1.0, max(0.0, confidence))


def _calculate_inattention_confidence(
    offscreen_ratio: float, 
    dispersion: float, 
    fixation_count: int, 
    baseline: UserBaseline
) -> float:
    """Calculate confidence score for inattention detection."""
    # Offscreen component
    offscreen_score = min(1, offscreen_ratio / settings.OFFSCREEN_THRESHOLD)
    
    # Scattered attention component
    dispersion_ratio = dispersion / baseline.baseline_dispersion
    scattered_score = min(1, (dispersion_ratio - 1.5) / 1.0) if dispersion_ratio > 1.5 else 0
    no_fixation_score = 1 if fixation_count == 0 else 0
    
    # Take the maximum of the two indicators
    confidence = max(offscreen_score, scattered_score * no_fixation_score)
    return min(1.0, max(0.0, confidence))


def _calculate_confusion_confidence(
    long_fixation_ms: float, 
    re_read_count: int, 
    dominant_zone: str
) -> float:
    """Calculate confidence score for confusion detection."""
    # Long fixation component
    fixation_score = min(1, (long_fixation_ms - 1500) / 1000)  # Scale from 1500ms to 2500ms
    
    # Re-read component
    re_read_score = min(1, re_read_count / 2)  # Scale from 0 to 2 re-reads
    
    # Zone relevance
    zone_score = 1 if dominant_zone in ['question', 'options'] else 0.5
    
    # Weighted average
    confidence = (fixation_score * 0.5 + re_read_score * 0.3 + zone_score * 0.2)
    return min(1.0, max(0.0, confidence))


def _calculate_fatigue_confidence(
    consecutive_windows: int, 
    blink_proxy: float, 
    baseline: UserBaseline
) -> float:
    """Calculate confidence score for fatigue detection."""
    # Consecutive windows component
    consecutive_score = min(1, (consecutive_windows - 2) / 3)  # Scale from 2 to 5 windows
    
    # Blink rate component
    blink_ratio = blink_proxy / baseline.baseline_blink_rate
    blink_score = min(1, (blink_ratio - 1) / 2)  # Scale from 1x to 3x baseline
    
    # Weighted average
    confidence = (consecutive_score * 0.6 + blink_score * 0.4)
    return min(1.0, max(0.0, confidence))
