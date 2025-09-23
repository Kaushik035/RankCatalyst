"""
Admin configuration for attention tracking models.
"""
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe

from .models import (
    Session, GazeSample, FeatureWindow, AttentionEvent, 
    Intervention, UserBaseline
)


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'lesson_id', 'started_at', 'ended_at', 'duration_display', 'transport_used']
    list_filter = ['transport_used', 'started_at', 'ended_at']
    search_fields = ['user__email', 'id']
    readonly_fields = ['id', 'started_at']
    date_hierarchy = 'started_at'
    
    def duration_display(self, obj):
        """Display session duration in a readable format."""
        duration = obj.duration_seconds
        if duration is None:
            return "Ongoing"
        if duration < 60:
            return f"{duration:.1f}s"
        elif duration < 3600:
            return f"{duration/60:.1f}m"
        else:
            return f"{duration/3600:.1f}h"
    duration_display.short_description = "Duration"


@admin.register(GazeSample)
class GazeSampleAdmin(admin.ModelAdmin):
    list_display = ['id', 'session_link', 'ts_ms', 'coordinates', 'confidence', 'zone', 'dropped']
    list_filter = ['zone', 'dropped', 'session__started_at']
    search_fields = ['session__id', 'session__user__email']
    readonly_fields = ['id', 'server_ts']
    date_hierarchy = 'server_ts'
    
    def session_link(self, obj):
        """Link to session admin page."""
        url = reverse('admin:attention_session_change', args=[obj.session.id])
        return format_html('<a href="{}">{}</a>', url, str(obj.session.id)[:8])
    session_link.short_description = "Session"
    
    def coordinates(self, obj):
        """Display coordinates in a compact format."""
        return f"({obj.x:.3f}, {obj.y:.3f})"
    coordinates.short_description = "Coordinates"


@admin.register(FeatureWindow)
class FeatureWindowAdmin(admin.ModelAdmin):
    list_display = ['id', 'session_link', 'time_window', 'feature_summary']
    list_filter = ['session__started_at']
    search_fields = ['session__id', 'session__user__email']
    readonly_fields = ['id']
    
    def session_link(self, obj):
        """Link to session admin page."""
        url = reverse('admin:attention_session_change', args=[obj.session.id])
        return format_html('<a href="{}">{}</a>', url, str(obj.session.id)[:8])
    session_link.short_description = "Session"
    
    def time_window(self, obj):
        """Display time window in a readable format."""
        return f"{obj.start_ms}-{obj.end_ms}ms"
    time_window.short_description = "Time Window"
    
    def feature_summary(self, obj):
        """Display a summary of key features."""
        features = obj.features
        if not features:
            return "No features"
        
        summary = []
        if 'fixation_count' in features:
            summary.append(f"Fixations: {features['fixation_count']}")
        if 'dispersion' in features:
            summary.append(f"Dispersion: {features['dispersion']:.3f}")
        if 'offscreen_ratio' in features:
            summary.append(f"Offscreen: {features['offscreen_ratio']:.1%}")
        
        return ", ".join(summary)
    feature_summary.short_description = "Features"


@admin.register(AttentionEvent)
class AttentionEventAdmin(admin.ModelAdmin):
    list_display = ['id', 'session_link', 'ts_ms', 'kind', 'score', 'meta_summary']
    list_filter = ['kind', 'session__started_at']
    search_fields = ['session__id', 'session__user__email']
    readonly_fields = ['id']
    
    def session_link(self, obj):
        """Link to session admin page."""
        url = reverse('admin:attention_session_change', args=[obj.session.id])
        return format_html('<a href="{}">{}</a>', url, str(obj.session.id)[:8])
    session_link.short_description = "Session"
    
    def meta_summary(self, obj):
        """Display a summary of metadata."""
        if not obj.meta:
            return "No metadata"
        
        summary = []
        for key, value in obj.meta.items():
            if isinstance(value, (int, float)):
                summary.append(f"{key}: {value}")
            elif isinstance(value, str) and len(value) < 20:
                summary.append(f"{key}: {value}")
        
        return ", ".join(summary[:3])  # Show first 3 items
    meta_summary.short_description = "Metadata"


@admin.register(Intervention)
class InterventionAdmin(admin.ModelAdmin):
    list_display = ['id', 'session_link', 'ts_ms', 'type', 'applied_by', 'reason_summary']
    list_filter = ['type', 'applied_by', 'session__started_at']
    search_fields = ['session__id', 'session__user__email']
    readonly_fields = ['id']
    
    def session_link(self, obj):
        """Link to session admin page."""
        url = reverse('admin:attention_session_change', args=[obj.session.id])
        return format_html('<a href="{}">{}</a>', url, str(obj.session.id)[:8])
    session_link.short_description = "Session"
    
    def reason_summary(self, obj):
        """Display a summary of the reason."""
        if not obj.reason:
            return "No reason"
        
        if 'kind' in obj.reason:
            return f"Triggered by: {obj.reason['kind']}"
        return str(obj.reason)[:50] + "..." if len(str(obj.reason)) > 50 else str(obj.reason)
    reason_summary.short_description = "Reason"


@admin.register(UserBaseline)
class UserBaselineAdmin(admin.ModelAdmin):
    list_display = ['user', 'baseline_dispersion', 'baseline_blink_rate', 'baseline_fixation_duration', 'sample_count', 'computed_at']
    list_filter = ['computed_at']
    search_fields = ['user__email']
    readonly_fields = ['computed_at']
    
    def get_readonly_fields(self, request, obj=None):
        """Make all fields readonly for existing objects."""
        if obj:  # editing an existing object
            return self.readonly_fields + ['user']
        return self.readonly_fields
