"""
API views for attention tracking.
"""
import uuid
import time
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, RetrieveAPIView

from .models import Session, GazeSample, AttentionEvent, Intervention
from .serializers import (
    SessionStartSerializer, SessionStartResponseSerializer,
    GazeBatchSerializer, GazeBatchResponseSerializer,
    TimelineSerializer, InterventionDecisionSerializer,
    InterventionDecisionResponseSerializer,
    SessionSerializer, SessionDetailSerializer
)
from .services import (
    process_gaze_batch, get_session_timeline, 
    decide_intervention, get_or_create_user_baseline
)


class HealthView(APIView):
    """Health check endpoint."""
    
    def get(self, request):
        """Return health status of the attention service."""
        try:
            # Check database connection
            Session.objects.count()
            
            # Check Redis connection
            cache.set('health_check', 'ok', 10)
            cache.get('health_check')
            
            return Response({
                'status': 'healthy',
                'timestamp': timezone.now().isoformat(),
                'services': {
                    'database': 'ok',
                    'redis': 'ok',
                    'attention_service': 'ok'
                }
            })
        except Exception as e:
            return Response({
                'status': 'unhealthy',
                'timestamp': timezone.now().isoformat(),
                'error': str(e)
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class SessionStartView(APIView):
    """Start a new attention tracking session."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Create a new session and return connection details."""
        serializer = SessionStartSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        # Create new session
        session = Session.objects.create(
            user=request.user,
            lesson_id=data.get('lesson_id'),
            device_info=data.get('device_info', {}),
            transport_used=data.get('preferred_transport', 'ws')
        )
        
        # Generate WebSocket URL
        ws_url = f"ws://{request.get_host()}/ws/gaze/{session.id}/"
        
        response_data = {
            'session_id': session.id,
            'ws_url': ws_url,
            'batch_ms': settings.GAZE_BATCH_MS
        }
        
        response_serializer = SessionStartResponseSerializer(response_data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class SessionEndView(APIView):
    """End an attention tracking session."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, session_id):
        """Mark session as ended."""
        try:
            session = Session.objects.get(
                id=session_id, 
                user=request.user,
                ended_at__isnull=True
            )
        except Session.DoesNotExist:
            return Response(
                {'error': 'Session not found or already ended'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        session.ended_at = timezone.now()
        session.save()
        
        return Response({'status': 'session_ended'})


class GazeBatchView(APIView):
    """Ingest gaze data batch."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, session_id):
        """Process a batch of gaze samples."""
        # Check idempotency
        idempotency_key = request.headers.get('Idempotency-Key')
        if idempotency_key:
            cache_key = f"gaze_batch:{session_id}:{idempotency_key}"
            if cache.get(cache_key):
                return Response({
                    'accepted': 0,
                    'dropped': 0,
                    'last_ts_ms': 0
                })
        
        try:
            session = Session.objects.get(
                id=session_id, 
                user=request.user,
                ended_at__isnull=True
            )
        except Session.DoesNotExist:
            return Response(
                {'error': 'Session not found or ended'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = GazeBatchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        # Process the batch
        result = process_gaze_batch(session, data)
        
        # Cache idempotency key
        if idempotency_key:
            cache.set(cache_key, True, 600)  # 10 minutes
        
        response_serializer = GazeBatchResponseSerializer(result)
        return Response(response_serializer.data)


class SessionTimelineView(APIView):
    """Get session timeline with downsampled data."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, session_id):
        """Return timeline data for a session."""
        try:
            session = Session.objects.get(
                id=session_id, 
                user=request.user
            )
        except Session.DoesNotExist:
            return Response(
                {'error': 'Session not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        downsample_ms = int(request.query_params.get('downsampleMs', 500))
        
        timeline_data = get_session_timeline(session, downsample_ms)
        
        serializer = TimelineSerializer(timeline_data)
        return Response(serializer.data)


class InterventionDecisionView(APIView):
    """Get intervention suggestions for a session."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Decide on interventions based on session context."""
        serializer = InterventionDecisionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        try:
            session = Session.objects.get(
                id=data['session_id'], 
                user=request.user
            )
        except Session.DoesNotExist:
            return Response(
                {'error': 'Session not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get intervention suggestions
        suggestions = decide_intervention(session, data['context'])
        
        response_data = {
            'suggestions': suggestions,
            'policy_version': 'v1'
        }
        
        response_serializer = InterventionDecisionResponseSerializer(response_data)
        return Response(response_serializer.data)


class SessionListView(ListAPIView):
    """List user's attention sessions."""
    permission_classes = [IsAuthenticated]
    serializer_class = SessionSerializer
    
    def get_queryset(self):
        """Return sessions for the current user."""
        return Session.objects.filter(user=self.request.user)


class SessionDetailView(RetrieveAPIView):
    """Get detailed session information."""
    permission_classes = [IsAuthenticated]
    serializer_class = SessionDetailSerializer
    
    def get_queryset(self):
        """Return sessions for the current user."""
        return Session.objects.filter(user=self.request.user)


class MetricsView(APIView):
    """Basic metrics endpoint."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Return basic attention tracking metrics."""
        user = request.user
        
        # Get basic counts
        total_sessions = Session.objects.filter(user=user).count()
        active_sessions = Session.objects.filter(user=user, ended_at__isnull=True).count()
        total_gaze_samples = GazeSample.objects.filter(session__user=user).count()
        total_attention_events = AttentionEvent.objects.filter(session__user=user).count()
        total_interventions = Intervention.objects.filter(session__user=user).count()
        
        # Get recent activity (last 24 hours)
        from django.utils import timezone
        from datetime import timedelta
        
        recent_cutoff = timezone.now() - timedelta(hours=24)
        recent_sessions = Session.objects.filter(
            user=user, 
            started_at__gte=recent_cutoff
        ).count()
        
        return Response({
            'total_sessions': total_sessions,
            'active_sessions': active_sessions,
            'recent_sessions_24h': recent_sessions,
            'total_gaze_samples': total_gaze_samples,
            'total_attention_events': total_attention_events,
            'total_interventions': total_interventions,
            'timestamp': timezone.now().isoformat()
        })
