"""
Business logic services for attention tracking.
"""
import time
import logging
from typing import Dict, List, Any, Optional
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.core.cache import cache

from .models import (
    Session, GazeSample, FeatureWindow, AttentionEvent, 
    Intervention, UserBaseline
)
from .features import extract_features
from .detectors import detect_attention_events
from .interventions import decide_intervention

logger = logging.getLogger(__name__)


def process_gaze_batch(session: Session, batch_data: Dict[str, Any]) -> Dict[str, int]:
    """
    Process a batch of gaze samples.
    
    Args:
        session: The session to add samples to
        batch_data: Batch data with client_timebase_ms and samples
        
    Returns:
        Dict with accepted, dropped, and last_ts_ms counts
    """
    client_timebase_ms = batch_data['client_timebase_ms']
    samples = batch_data['samples']
    
    accepted = 0
    dropped = 0
    last_ts_ms = 0
    
    with transaction.atomic():
        for sample_data in samples:
            # Calculate absolute timestamp
            ts_ms = client_timebase_ms + sample_data['t']
            last_ts_ms = max(last_ts_ms, ts_ms)
            
            # Check confidence threshold
            confidence = sample_data['c']
            if confidence < settings.ATTENTION_MIN_CONF:
                dropped += 1
                continue
            
            # Create gaze sample
            GazeSample.objects.create(
                session=session,
                ts_ms=ts_ms,
                x=sample_data['x'],
                y=sample_data['y'],
                confidence=confidence,
                zone=sample_data.get('zone'),
                dropped=False
            )
            accepted += 1
    
    logger.info(
        f"Processed gaze batch for session {session.id}: "
        f"accepted={accepted}, dropped={dropped}"
    )
    
    return {
        'accepted': accepted,
        'dropped': dropped,
        'last_ts_ms': last_ts_ms
    }


def get_session_timeline(session: Session, downsample_ms: int = 500) -> Dict[str, Any]:
    """
    Get timeline data for a session with downsampling.
    
    Args:
        session: The session to get timeline for
        downsample_ms: Downsampling interval in milliseconds
        
    Returns:
        Dict with events, interventions, and summary
    """
    # Get events and interventions
    events = AttentionEvent.objects.filter(session=session).order_by('ts_ms')
    interventions = Intervention.objects.filter(session=session).order_by('ts_ms')
    
    # Downsample events if needed
    if downsample_ms > 0:
        events = _downsample_events(events, downsample_ms)
    
    # Create summary
    summary = {
        'session_duration_ms': None,
        'total_gaze_samples': session.gaze_samples.count(),
        'total_events': events.count(),
        'total_interventions': interventions.count(),
        'event_types': {},
        'intervention_types': {}
    }
    
    if session.ended_at:
        duration = (session.ended_at - session.started_at).total_seconds() * 1000
        summary['session_duration_ms'] = int(duration)
    
    # Count event types
    for event in events:
        event_type = event.kind
        summary['event_types'][event_type] = summary['event_types'].get(event_type, 0) + 1
    
    # Count intervention types
    for intervention in interventions:
        intervention_type = intervention.type
        summary['intervention_types'][intervention_type] = summary['intervention_types'].get(intervention_type, 0) + 1
    
    return {
        'events': events,
        'interventions': interventions,
        'summary': summary
    }


def _downsample_events(events, downsample_ms: int):
    """Downsample events by grouping them into time buckets."""
    if not events.exists():
        return events
    
    # Group events into time buckets
    buckets = {}
    for event in events:
        bucket_key = (event.ts_ms // downsample_ms) * downsample_ms
        if bucket_key not in buckets:
            buckets[bucket_key] = []
        buckets[bucket_key].append(event)
    
    # Select representative event from each bucket
    downsampled_events = []
    for bucket_key in sorted(buckets.keys()):
        bucket_events = buckets[bucket_key]
        # Select the event with highest score
        representative = max(bucket_events, key=lambda e: e.score)
        downsampled_events.append(representative)
    
    return downsampled_events


def get_or_create_user_baseline(user) -> UserBaseline:
    """
    Get or create user baseline metrics.
    
    Args:
        user: The user to get baseline for
        
    Returns:
        UserBaseline instance
    """
    baseline, created = UserBaseline.objects.get_or_create(
        user=user,
        defaults={
            'baseline_dispersion': 0.1,
            'baseline_blink_rate': 0.05,
            'baseline_fixation_duration': 300.0,
            'sample_count': 0
        }
    )
    
    if created:
        logger.info(f"Created new baseline for user {user.email}")
    
    return baseline


def update_user_baseline(user, new_samples: List[Dict[str, Any]]):
    """
    Update user baseline with new sample data.
    
    Args:
        user: The user to update baseline for
        new_samples: List of new gaze samples
    """
    baseline = get_or_create_user_baseline(user)
    
    if not new_samples:
        return
    
    # Calculate new metrics from samples
    dispersions = []
    blink_indicators = []
    fixation_durations = []
    
    for sample in new_samples:
        # Calculate dispersion (simplified)
        if 'x' in sample and 'y' in sample:
            # This is a simplified calculation - in practice you'd need
            # to calculate dispersion over time windows
            pass
        
        # Calculate blink proxy (low confidence periods)
        if sample.get('confidence', 1.0) < 0.4:
            blink_indicators.append(1)
        else:
            blink_indicators.append(0)
    
    # Update baseline with exponential moving average
    alpha = 0.1  # Learning rate
    
    if dispersions:
        new_dispersion = sum(dispersions) / len(dispersions)
        baseline.baseline_dispersion = (
            (1 - alpha) * baseline.baseline_dispersion + 
            alpha * new_dispersion
        )
    
    if blink_indicators:
        new_blink_rate = sum(blink_indicators) / len(blink_indicators)
        baseline.baseline_blink_rate = (
            (1 - alpha) * baseline.baseline_blink_rate + 
            alpha * new_blink_rate
        )
    
    baseline.sample_count += len(new_samples)
    baseline.save()
    
    logger.info(f"Updated baseline for user {user.email}")


def cleanup_old_data():
    """
    Clean up old gaze samples and features based on retention settings.
    
    This should be run as a periodic task.
    """
    from datetime import timedelta
    
    # Calculate cutoff dates
    gaze_cutoff = timezone.now() - timedelta(days=settings.RETAIN_RAW_GAZE_DAYS)
    feature_cutoff = timezone.now() - timedelta(days=settings.RETAIN_FEATURE_DAYS)
    
    # Delete old gaze samples
    old_gaze_count = GazeSample.objects.filter(
        server_ts__lt=gaze_cutoff
    ).count()
    
    if old_gaze_count > 0:
        GazeSample.objects.filter(server_ts__lt=gaze_cutoff).delete()
        logger.info(f"Deleted {old_gaze_count} old gaze samples")
    
    # Delete old feature windows
    old_feature_count = FeatureWindow.objects.filter(
        session__started_at__lt=feature_cutoff
    ).count()
    
    if old_feature_count > 0:
        FeatureWindow.objects.filter(
            session__started_at__lt=feature_cutoff
        ).delete()
        logger.info(f"Deleted {old_feature_count} old feature windows")
    
    return {
        'gaze_samples_deleted': old_gaze_count,
        'feature_windows_deleted': old_feature_count
    }


def get_session_statistics(session: Session) -> Dict[str, Any]:
    """
    Get comprehensive statistics for a session.
    
    Args:
        session: The session to analyze
        
    Returns:
        Dict with session statistics
    """
    gaze_samples = session.gaze_samples.all()
    events = session.attention_events.all()
    interventions = session.interventions.all()
    
    # Basic counts
    total_samples = gaze_samples.count()
    dropped_samples = gaze_samples.filter(dropped=True).count()
    
    # Confidence statistics
    confidences = list(gaze_samples.values_list('confidence', flat=True))
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
    
    # Zone distribution
    zone_counts = {}
    for sample in gaze_samples:
        zone = sample.zone or 'unknown'
        zone_counts[zone] = zone_counts.get(zone, 0) + 1
    
    # Event statistics
    event_counts = {}
    for event in events:
        event_counts[event.kind] = event_counts.get(event.kind, 0) + 1
    
    # Intervention statistics
    intervention_counts = {}
    for intervention in interventions:
        intervention_counts[intervention.type] = intervention_counts.get(intervention.type, 0) + 1
    
    return {
        'session_id': str(session.id),
        'duration_seconds': session.duration_seconds,
        'total_samples': total_samples,
        'dropped_samples': dropped_samples,
        'sample_quality': {
            'avg_confidence': avg_confidence,
            'drop_rate': dropped_samples / total_samples if total_samples > 0 else 0
        },
        'zone_distribution': zone_counts,
        'event_counts': event_counts,
        'intervention_counts': intervention_counts,
        'started_at': session.started_at.isoformat(),
        'ended_at': session.ended_at.isoformat() if session.ended_at else None
    }
