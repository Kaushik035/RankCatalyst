"""
Celery tasks for attention tracking background processing.
"""
import logging
from celery import shared_task
from django.conf import settings
from django.core.cache import cache

from .models import Session, FeatureWindow, AttentionEvent
from .features import extract_features
from .detectors import detect_attention_events
from .services import cleanup_old_data

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def process_feature_extraction(self, session_id: str):
    """
    Extract features from gaze samples for a session.
    
    Args:
        session_id: Session ID to process
        
    Returns:
        Number of feature windows created
    """
    try:
        # Check if session exists and is active
        session = Session.objects.get(id=session_id)
        if session.ended_at:
            logger.info(f"Session {session_id} has ended, skipping feature extraction")
            return 0
        
        # Acquire lock to prevent overlapping processing
        lock_key = f"attn:lock:features:{session_id}"
        if not cache.add(lock_key, "locked", timeout=30):
            logger.info(f"Feature extraction already in progress for session {session_id}")
            return 0
        
        try:
            # Extract features
            feature_windows = extract_features(session_id)
            
            # Save feature windows
            created_count = 0
            for window in feature_windows:
                window.save()
                created_count += 1
            
            logger.info(f"Created {created_count} feature windows for session {session_id}")
            return created_count
            
        finally:
            # Release lock
            cache.delete(lock_key)
            
    except Session.DoesNotExist:
        logger.warning(f"Session {session_id} not found for feature extraction")
        return 0
    except Exception as e:
        logger.error(f"Error in feature extraction for session {session_id}: {e}")
        raise


@shared_task(bind=True)
def process_attention_detection(self, session_id: str):
    """
    Detect attention events from feature windows.
    
    Args:
        session_id: Session ID to process
        
    Returns:
        Number of attention events created
    """
    try:
        # Check if session exists and is active
        session = Session.objects.get(id=session_id)
        if session.ended_at:
            logger.info(f"Session {session_id} has ended, skipping attention detection")
            return 0
        
        # Acquire lock to prevent overlapping processing
        lock_key = f"attn:lock:detection:{session_id}"
        if not cache.add(lock_key, "locked", timeout=30):
            logger.info(f"Attention detection already in progress for session {session_id}")
            return 0
        
        try:
            # Detect attention events
            events = detect_attention_events(session_id)
            
            # Save events
            created_count = 0
            for event in events:
                event.save()
                created_count += 1
                
                # Send event to WebSocket group
                from channels.layers import get_channel_layer
                channel_layer = get_channel_layer()
                
                if channel_layer:
                    import asyncio
                    asyncio.create_task(channel_layer.group_send(
                        f'gaze_{session_id}',
                        {
                            'type': 'attention_event',
                            'event': {
                                'ts_ms': event.ts_ms,
                                'kind': event.kind,
                                'score': event.score,
                                'meta': event.meta
                            }
                        }
                    ))
            
            logger.info(f"Created {created_count} attention events for session {session_id}")
            return created_count
            
        finally:
            # Release lock
            cache.delete(lock_key)
            
    except Session.DoesNotExist:
        logger.warning(f"Session {session_id} not found for attention detection")
        return 0
    except Exception as e:
        logger.error(f"Error in attention detection for session {session_id}: {e}")
        raise


@shared_task(bind=True)
def process_intervention_decision(self, session_id: str):
    """
    Decide on interventions for a session.
    
    Args:
        session_id: Session ID to process
        
    Returns:
        Number of interventions created
    """
    try:
        # Check if session exists and is active
        session = Session.objects.get(id=session_id)
        if session.ended_at:
            logger.info(f"Session {session_id} has ended, skipping intervention decision")
            return 0
        
        # Acquire lock to prevent overlapping processing
        lock_key = f"attn:lock:intervention:{session_id}"
        if not cache.add(lock_key, "locked", timeout=30):
            logger.info(f"Intervention decision already in progress for session {session_id}")
            return 0
        
        try:
            # Get intervention suggestions
            from .interventions import decide_intervention
            suggestions = decide_intervention(session, {'recent_window_ms': 60000})
            
            # Apply top suggestion if confidence is high enough
            created_count = 0
            if suggestions and suggestions[0]['confidence'] > 0.7:
                top_suggestion = suggestions[0]
                
                # Create intervention
                from .interventions import apply_intervention
                intervention = apply_intervention(
                    session=session,
                    intervention_type=top_suggestion['type'],
                    reason=top_suggestion['reason'],
                    applied_by='rule'
                )
                created_count = 1
                
                # Send intervention to WebSocket group
                from channels.layers import get_channel_layer
                channel_layer = get_channel_layer()
                
                if channel_layer:
                    import asyncio
                    asyncio.create_task(channel_layer.group_send(
                        f'gaze_{session_id}',
                        {
                            'type': 'intervention',
                            'action': {
                                'type': intervention.type,
                                'reason': intervention.reason
                            }
                        }
                    ))
            
            logger.info(f"Created {created_count} interventions for session {session_id}")
            return created_count
            
        finally:
            # Release lock
            cache.delete(lock_key)
            
    except Session.DoesNotExist:
        logger.warning(f"Session {session_id} not found for intervention decision")
        return 0
    except Exception as e:
        logger.error(f"Error in intervention decision for session {session_id}: {e}")
        raise


@shared_task(bind=True)
def cleanup_old_attention_data(self):
    """
    Clean up old gaze samples and feature data.
    
    This task should be run periodically (e.g., daily).
    
    Returns:
        Dict with cleanup statistics
    """
    try:
        logger.info("Starting cleanup of old attention data")
        
        # Clean up old data
        stats = cleanup_old_data()
        
        logger.info(f"Cleanup completed: {stats}")
        return stats
        
    except Exception as e:
        logger.error(f"Error in cleanup task: {e}")
        raise


@shared_task(bind=True)
def process_session_pipeline(self, session_id: str):
    """
    Process the complete attention pipeline for a session.
    
    This task runs the feature extraction, attention detection, and intervention
    decision pipeline in sequence.
    
    Args:
        session_id: Session ID to process
        
    Returns:
        Dict with processing results
    """
    try:
        logger.info(f"Starting attention pipeline for session {session_id}")
        
        # Run feature extraction
        feature_count = process_feature_extraction.delay(session_id).get()
        
        # Run attention detection
        event_count = process_attention_detection.delay(session_id).get()
        
        # Run intervention decision
        intervention_count = process_intervention_decision.delay(session_id).get()
        
        result = {
            'session_id': session_id,
            'feature_windows_created': feature_count,
            'attention_events_created': event_count,
            'interventions_created': intervention_count
        }
        
        logger.info(f"Attention pipeline completed for session {session_id}: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error in attention pipeline for session {session_id}: {e}")
        raise


@shared_task(bind=True)
def update_user_baseline(self, user_id: int, sample_data: list):
    """
    Update user baseline with new sample data.
    
    Args:
        user_id: User ID to update baseline for
        sample_data: List of new gaze samples
        
    Returns:
        Success status
    """
    try:
        from django.contrib.auth import get_user_model
        from .services import update_user_baseline
        
        User = get_user_model()
        user = User.objects.get(id=user_id)
        
        # Update baseline
        update_user_baseline(user, sample_data)
        
        logger.info(f"Updated baseline for user {user.email}")
        return True
        
    except Exception as e:
        logger.error(f"Error updating baseline for user {user_id}: {e}")
        raise
