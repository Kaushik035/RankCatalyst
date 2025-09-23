"""
Utility functions for attention tracking.
"""
import json
import logging
import uuid
from typing import Dict, Any, Optional
from django.utils import timezone

logger = logging.getLogger(__name__)


class JsonFormatter(logging.Formatter):
    """JSON formatter for structured logging."""
    
    def format(self, record):
        """Format log record as JSON."""
        log_entry = {
            'timestamp': timezone.now().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }
        
        # Add correlation ID if available
        if hasattr(record, 'correlation_id'):
            log_entry['correlation_id'] = record.correlation_id
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        return json.dumps(log_entry)


def generate_correlation_id() -> str:
    """Generate a unique correlation ID for request tracking."""
    return str(uuid.uuid4())


def normalize_coordinates(x: float, y: float, viewport_width: int, viewport_height: int) -> tuple[float, float]:
    """
    Normalize pixel coordinates to [0,1] range.
    
    Args:
        x: X coordinate in pixels
        y: Y coordinate in pixels
        viewport_width: Viewport width in pixels
        viewport_height: Viewport height in pixels
        
    Returns:
        Tuple of normalized (x, y) coordinates
    """
    # Clamp coordinates to viewport bounds
    x = max(0, min(x, viewport_width))
    y = max(0, min(y, viewport_height))
    
    # Normalize to [0,1]
    norm_x = x / viewport_width
    norm_y = y / viewport_height
    
    return norm_x, norm_y


def denormalize_coordinates(norm_x: float, norm_y: float, viewport_width: int, viewport_height: int) -> tuple[int, int]:
    """
    Convert normalized coordinates back to pixel coordinates.
    
    Args:
        norm_x: Normalized x coordinate [0,1]
        norm_y: Normalized y coordinate [0,1]
        viewport_width: Viewport width in pixels
        viewport_height: Viewport height in pixels
        
    Returns:
        Tuple of pixel (x, y) coordinates
    """
    # Clamp normalized coordinates
    norm_x = max(0, min(norm_x, 1))
    norm_y = max(0, min(norm_y, 1))
    
    # Convert to pixels
    x = int(norm_x * viewport_width)
    y = int(norm_y * viewport_height)
    
    return x, y


def calculate_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate Euclidean distance between two points."""
    return ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5


def calculate_velocity(x1: float, y1: float, x2: float, y2: float, time_diff_ms: float) -> float:
    """
    Calculate velocity between two points.
    
    Args:
        x1, y1: First point coordinates
        x2, y2: Second point coordinates
        time_diff_ms: Time difference in milliseconds
        
    Returns:
        Velocity in normalized units per second
    """
    if time_diff_ms <= 0:
        return 0
    
    distance = calculate_distance(x1, y1, x2, y2)
    velocity = distance / (time_diff_ms / 1000)  # Convert to per second
    
    return velocity


def smooth_coordinates(coordinates: list, window_size: int = 3) -> list:
    """
    Apply simple moving average smoothing to coordinates.
    
    Args:
        coordinates: List of (x, y) coordinate tuples
        window_size: Size of smoothing window
        
    Returns:
        List of smoothed coordinates
    """
    if len(coordinates) < window_size:
        return coordinates
    
    smoothed = []
    for i in range(len(coordinates)):
        start_idx = max(0, i - window_size // 2)
        end_idx = min(len(coordinates), i + window_size // 2 + 1)
        
        window_coords = coordinates[start_idx:end_idx]
        avg_x = sum(coord[0] for coord in window_coords) / len(window_coords)
        avg_y = sum(coord[1] for coord in window_coords) / len(window_coords)
        
        smoothed.append((avg_x, avg_y))
    
    return smoothed


def detect_zone_from_coordinates(x: float, y: float, zones: Dict[str, Dict[str, float]]) -> Optional[str]:
    """
    Detect which zone a coordinate falls into.
    
    Args:
        x: X coordinate [0,1]
        y: Y coordinate [0,1]
        zones: Dict mapping zone names to bounding boxes
        
    Returns:
        Zone name or None if not in any zone
    """
    for zone_name, bounds in zones.items():
        if (bounds['x1'] <= x <= bounds['x2'] and 
            bounds['y1'] <= y <= bounds['y2']):
            return zone_name
    
    return None


def validate_gaze_sample(x: float, y: float, confidence: float) -> bool:
    """
    Validate a gaze sample.
    
    Args:
        x: X coordinate [0,1]
        y: Y coordinate [0,1]
        confidence: Confidence score [0,1]
        
    Returns:
        True if sample is valid
    """
    # Check coordinate bounds
    if not (0 <= x <= 1 and 0 <= y <= 1):
        return False
    
    # Check confidence bounds
    if not (0 <= confidence <= 1):
        return False
    
    # Check for NaN or infinite values
    if not (isinstance(x, (int, float)) and isinstance(y, (int, float)) and isinstance(confidence, (int, float))):
        return False
    
    return True


def calculate_session_metrics(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate session-level metrics from gaze data.
    
    Args:
        session_data: Dict containing session gaze data
        
    Returns:
        Dict with calculated metrics
    """
    samples = session_data.get('samples', [])
    if not samples:
        return {}
    
    # Basic statistics
    total_samples = len(samples)
    valid_samples = [s for s in samples if s.get('confidence', 0) > 0.5]
    valid_ratio = len(valid_samples) / total_samples if total_samples > 0 else 0
    
    # Confidence statistics
    confidences = [s.get('confidence', 0) for s in samples]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
    
    # Zone distribution
    zones = [s.get('zone', 'unknown') for s in samples]
    zone_counts = {}
    for zone in zones:
        zone_counts[zone] = zone_counts.get(zone, 0) + 1
    
    # Time statistics
    timestamps = [s.get('ts_ms', 0) for s in samples]
    if timestamps:
        duration_ms = max(timestamps) - min(timestamps)
        sample_rate = total_samples / (duration_ms / 1000) if duration_ms > 0 else 0
    else:
        duration_ms = 0
        sample_rate = 0
    
    return {
        'total_samples': total_samples,
        'valid_samples': len(valid_samples),
        'valid_ratio': valid_ratio,
        'avg_confidence': avg_confidence,
        'zone_distribution': zone_counts,
        'duration_ms': duration_ms,
        'sample_rate': sample_rate
    }


def format_timestamp(timestamp_ms: int) -> str:
    """Format timestamp in milliseconds to readable string."""
    from datetime import datetime
    dt = datetime.fromtimestamp(timestamp_ms / 1000)
    return dt.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]


def parse_timestamp(timestamp_str: str) -> int:
    """Parse timestamp string to milliseconds."""
    from datetime import datetime
    dt = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S.%f')
    return int(dt.timestamp() * 1000)
