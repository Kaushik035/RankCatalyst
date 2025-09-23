"""
Signal handlers for attention tracking.
"""
import logging
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Session, GazeSample, AttentionEvent
from .tasks import process_session_pipeline

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Session)
def session_created(sender, instance, created, **kwargs):
    """Handle session creation."""
    if created:
        logger.info(f"New session created: {instance.id}")
        # Could trigger initial setup tasks here


@receiver(post_save, sender=GazeSample)
def gaze_sample_created(sender, instance, created, **kwargs):
    """Handle gaze sample creation."""
    if created:
        # Trigger feature extraction if we have enough samples
        # This is a simple trigger - in practice you might want more sophisticated logic
        sample_count = instance.session.gaze_samples.count()
        
        # Trigger pipeline every 100 samples
        if sample_count % 100 == 0:
            process_session_pipeline.delay(str(instance.session.id))


@receiver(post_save, sender=AttentionEvent)
def attention_event_created(sender, instance, created, **kwargs):
    """Handle attention event creation."""
    if created:
        logger.info(f"Attention event created: {instance.kind} for session {instance.session.id}")
        # Could trigger intervention decisions here
