"""
Serializers for attention tracking API endpoints.
"""
from rest_framework import serializers
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import Session, GazeSample, FeatureWindow, AttentionEvent, Intervention


class SessionStartSerializer(serializers.Serializer):
    """Serializer for starting a new attention session."""
    lesson_id = serializers.UUIDField(required=False, allow_null=True)
    device_info = serializers.JSONField(default=dict)
    preferred_transport = serializers.ChoiceField(
        choices=['ws', 'rest'], 
        default='ws'
    )


class SessionStartResponseSerializer(serializers.Serializer):
    """Response serializer for session start."""
    session_id = serializers.UUIDField()
    ws_url = serializers.URLField()
    batch_ms = serializers.IntegerField()


class GazeSampleSerializer(serializers.Serializer):
    """Serializer for individual gaze samples."""
    t = serializers.IntegerField(min_value=0, help_text="Offset from clientTimebaseMs in milliseconds")
    x = serializers.FloatField(min_value=0.0, max_value=1.0, help_text="Normalized x coordinate [0,1]")
    y = serializers.FloatField(min_value=0.0, max_value=1.0, help_text="Normalized y coordinate [0,1]")
    c = serializers.FloatField(min_value=0.0, max_value=1.0, help_text="Confidence [0,1]")
    zone = serializers.CharField(max_length=32, required=False, allow_null=True)


class GazeBatchSerializer(serializers.Serializer):
    """Serializer for batch gaze data ingestion."""
    client_timebase_ms = serializers.IntegerField(help_text="Client timestamp base in milliseconds")
    samples = GazeSampleSerializer(many=True, max_length=512)
    
    def validate_samples(self, value):
        """Validate that samples array is not too large."""
        if len(value) > 512:
            raise ValidationError("Maximum 512 samples per batch")
        return value


class GazeBatchResponseSerializer(serializers.Serializer):
    """Response serializer for gaze batch ingestion."""
    accepted = serializers.IntegerField()
    dropped = serializers.IntegerField()
    last_ts_ms = serializers.IntegerField()


class AttentionEventSerializer(serializers.ModelSerializer):
    """Serializer for attention events."""
    class Meta:
        model = AttentionEvent
        fields = ['id', 'ts_ms', 'kind', 'score', 'meta']


class InterventionSerializer(serializers.ModelSerializer):
    """Serializer for interventions."""
    class Meta:
        model = Intervention
        fields = ['id', 'ts_ms', 'type', 'reason', 'applied_by']


class TimelineSerializer(serializers.Serializer):
    """Serializer for session timeline data."""
    events = AttentionEventSerializer(many=True)
    interventions = InterventionSerializer(many=True)
    summary = serializers.JSONField()


class InterventionDecisionSerializer(serializers.Serializer):
    """Serializer for intervention decision requests."""
    session_id = serializers.UUIDField()
    context = serializers.JSONField(default=dict)
    
    def validate_context(self, value):
        """Validate context structure."""
        allowed_keys = ['recent_window_ms', 'last_outcome', 'user_feedback']
        for key in value.keys():
            if key not in allowed_keys:
                raise ValidationError(f"Invalid context key: {key}")
        return value


class InterventionSuggestionSerializer(serializers.Serializer):
    """Serializer for intervention suggestions."""
    type = serializers.CharField()
    reason = serializers.JSONField()
    confidence = serializers.FloatField(min_value=0.0, max_value=1.0)


class InterventionDecisionResponseSerializer(serializers.Serializer):
    """Response serializer for intervention decisions."""
    suggestions = InterventionSuggestionSerializer(many=True)
    policy_version = serializers.CharField()


class SessionSerializer(serializers.ModelSerializer):
    """Serializer for session details."""
    duration_seconds = serializers.ReadOnlyField()
    gaze_sample_count = serializers.SerializerMethodField()
    attention_event_count = serializers.SerializerMethodField()
    intervention_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Session
        fields = [
            'id', 'user', 'lesson', 'started_at', 'ended_at', 
            'duration_seconds', 'device_info', 'transport_used',
            'gaze_sample_count', 'attention_event_count', 'intervention_count'
        ]
        read_only_fields = ['id', 'started_at', 'user']
    
    def get_gaze_sample_count(self, obj):
        """Get count of gaze samples for this session."""
        return obj.gaze_samples.count()
    
    def get_attention_event_count(self, obj):
        """Get count of attention events for this session."""
        return obj.attention_events.count()
    
    def get_intervention_count(self, obj):
        """Get count of interventions for this session."""
        return obj.interventions.count()


class FeatureWindowSerializer(serializers.ModelSerializer):
    """Serializer for feature windows."""
    class Meta:
        model = FeatureWindow
        fields = ['id', 'start_ms', 'end_ms', 'features']


class GazeSampleDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for gaze samples."""
    class Meta:
        model = GazeSample
        fields = [
            'id', 'ts_ms', 'server_ts', 'x', 'y', 
            'confidence', 'zone', 'dropped'
        ]
        read_only_fields = ['id', 'server_ts']


class SessionDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for sessions with related data."""
    gaze_samples = GazeSampleDetailSerializer(many=True, read_only=True)
    feature_windows = FeatureWindowSerializer(many=True, read_only=True)
    attention_events = AttentionEventSerializer(many=True, read_only=True)
    interventions = InterventionSerializer(many=True, read_only=True)
    duration_seconds = serializers.ReadOnlyField()
    
    class Meta:
        model = Session
        fields = [
            'id', 'user', 'lesson', 'started_at', 'ended_at',
            'duration_seconds', 'device_info', 'transport_used',
            'gaze_samples', 'feature_windows', 'attention_events', 'interventions'
        ]
        read_only_fields = ['id', 'started_at', 'user']
