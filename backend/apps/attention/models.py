"""
Attention tracking models for gaze data, feature extraction, and interventions.
"""
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator

User = get_user_model()


class Session(models.Model):
    """
    A learning session with gaze tracking.
    
    Represents one continuous learning session with a user and optionally a lesson.
    """
    TRANSPORT_CHOICES = [
        ('ws', 'WebSocket'),
        ('rest', 'REST API'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attention_sessions')
    lesson_id = models.CharField(max_length=100, null=True, blank=True, help_text="Optional lesson identifier")
    
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    
    device_info = models.JSONField(default=dict, help_text="Browser/device information")
    transport_used = models.CharField(
        max_length=8, 
        choices=TRANSPORT_CHOICES, 
        default='ws',
        help_text="Primary transport method used"
    )
    
    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', '-started_at']),
        ]
    
    def __str__(self):
        return f"Session {self.id} - {self.user.email} ({self.started_at})"
    
    @property
    def duration_seconds(self):
        """Calculate session duration in seconds."""
        if self.ended_at:
            return (self.ended_at - self.started_at).total_seconds()
        return None


class GazeSample(models.Model):
    """
    Raw gaze sample with normalized coordinates.
    
    Stores individual gaze points with confidence scores and zone mapping.
    Coordinates are normalized to [0,1] range.
    """
    ZONE_CHOICES = [
        ('question', 'Question Area'),
        ('options', 'Answer Options'),
        ('hint', 'Hint Area'),
        ('navigation', 'Navigation'),
        ('offscreen', 'Off Screen'),
        ('other', 'Other'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='gaze_samples')
    
    # Timestamps
    ts_ms = models.BigIntegerField(help_text="Client timestamp in milliseconds since epoch")
    server_ts = models.DateTimeField(auto_now_add=True, help_text="Server timestamp")
    
    # Normalized coordinates [0,1]
    x = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Normalized x coordinate [0,1]"
    )
    y = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Normalized y coordinate [0,1]"
    )
    
    # Confidence and metadata
    confidence = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Gaze tracking confidence [0,1]"
    )
    zone = models.CharField(
        max_length=32, 
        choices=ZONE_CHOICES, 
        null=True, 
        blank=True,
        help_text="UI zone where gaze was detected"
    )
    dropped = models.BooleanField(
        default=False,
        help_text="True if sample was filtered due to low confidence"
    )
    
    class Meta:
        ordering = ['session', 'ts_ms']
        indexes = [
            models.Index(fields=['session', 'ts_ms']),
            models.Index(fields=['session', 'zone']),
        ]
    
    def __str__(self):
        return f"GazeSample {self.id} - ({self.x:.3f}, {self.y:.3f}) conf={self.confidence:.3f}"


class FeatureWindow(models.Model):
    """
    Rolling feature window for gaze analysis.
    
    Contains aggregated features computed over a time window (e.g., 2-5 seconds).
    """
    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='feature_windows')
    
    # Time window boundaries
    start_ms = models.BigIntegerField(help_text="Window start time in milliseconds")
    end_ms = models.BigIntegerField(help_text="Window end time in milliseconds")
    
    # Aggregated features
    features = models.JSONField(
        help_text="Computed features: fixations, dispersion, dwell times, etc."
    )
    
    class Meta:
        ordering = ['session', 'start_ms']
        indexes = [
            models.Index(fields=['session', 'start_ms']),
        ]
        unique_together = ['session', 'start_ms']
    
    def __str__(self):
        return f"FeatureWindow {self.id} - {self.start_ms}-{self.end_ms}ms"


class AttentionEvent(models.Model):
    """
    Discrete attention events detected from gaze patterns.
    
    Represents specific attention states like confusion, inattention, etc.
    """
    EVENT_KIND_CHOICES = [
        ('on_task', 'On Task'),
        ('inattention', 'Inattention'),
        ('confusion', 'Confusion'),
        ('fatigue', 'Fatigue'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='attention_events')
    
    # Event timing
    ts_ms = models.BigIntegerField(help_text="Event timestamp in milliseconds")
    
    # Event details
    kind = models.CharField(
        max_length=16, 
        choices=EVENT_KIND_CHOICES,
        help_text="Type of attention event"
    )
    score = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Confidence score [0,1]"
    )
    meta = models.JSONField(
        default=dict,
        help_text="Additional metadata: detector reasons, thresholds, etc."
    )
    
    class Meta:
        ordering = ['session', 'ts_ms']
        indexes = [
            models.Index(fields=['session', 'ts_ms']),
            models.Index(fields=['session', 'kind']),
        ]
    
    def __str__(self):
        return f"AttentionEvent {self.id} - {self.kind} (score={self.score:.3f})"


class Intervention(models.Model):
    """
    Interventions taken during a session.
    
    Records adaptive interventions triggered by attention events.
    """
    INTERVENTION_TYPE_CHOICES = [
        ('show_hint', 'Show Hint'),
        ('simplify', 'Simplify Content'),
        ('pause', 'Pause Session'),
        ('increase_difficulty', 'Increase Difficulty'),
        ('focus_nudge', 'Focus Nudge'),
        ('break_suggestion', 'Break Suggestion'),
    ]
    
    APPLIED_BY_CHOICES = [
        ('rule', 'Rule Engine'),
        ('manual', 'Manual'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='interventions')
    
    # Timing
    ts_ms = models.BigIntegerField(help_text="Intervention timestamp in milliseconds")
    
    # Intervention details
    type = models.CharField(
        max_length=24, 
        choices=INTERVENTION_TYPE_CHOICES,
        help_text="Type of intervention"
    )
    reason = models.JSONField(
        default=dict,
        help_text="Reasoning: event references, rationale, etc."
    )
    applied_by = models.CharField(
        max_length=8,
        choices=APPLIED_BY_CHOICES,
        help_text="How the intervention was triggered"
    )
    
    class Meta:
        ordering = ['session', 'ts_ms']
        indexes = [
            models.Index(fields=['session', 'ts_ms']),
        ]
    
    def __str__(self):
        return f"Intervention {self.id} - {self.type} by {self.applied_by}"


class UserBaseline(models.Model):
    """
    User-specific baseline metrics for attention detection.
    
    Stores adaptive baselines computed from user's historical data.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='attention_baseline')
    
    # Baseline metrics
    baseline_dispersion = models.FloatField(
        default=0.1,
        help_text="Baseline gaze dispersion"
    )
    baseline_blink_rate = models.FloatField(
        default=0.05,
        help_text="Baseline blink proxy rate"
    )
    baseline_fixation_duration = models.FloatField(
        default=300.0,
        help_text="Baseline fixation duration in ms"
    )
    
    # Metadata
    computed_at = models.DateTimeField(auto_now=True)
    sample_count = models.IntegerField(
        default=0,
        help_text="Number of samples used for baseline computation"
    )
    
    class Meta:
        ordering = ['-computed_at']
    
    def __str__(self):
        return f"Baseline for {self.user.email} (computed: {self.computed_at})"
