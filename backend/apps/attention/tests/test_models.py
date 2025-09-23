"""
Tests for attention tracking models.
"""
import pytest
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from apps.attention.models import Session, GazeSample, FeatureWindow, AttentionEvent, Intervention

User = get_user_model()


class SessionModelTest(TestCase):
    """Test Session model."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
    
    def test_create_session(self):
        """Test creating a session."""
        session = Session.objects.create(
            user=self.user,
            device_info={'browser': 'Chrome', 'os': 'Windows'},
            transport_used='ws'
        )
        
        self.assertEqual(session.user, self.user)
        self.assertEqual(session.transport_used, 'ws')
        self.assertIsNotNone(session.started_at)
        self.assertIsNone(session.ended_at)
        self.assertIsNone(session.duration_seconds)
    
    def test_session_duration(self):
        """Test session duration calculation."""
        session = Session.objects.create(
            user=self.user,
            device_info={},
            transport_used='ws'
        )
        
        # Initially no duration
        self.assertIsNone(session.duration_seconds)
        
        # End session
        from django.utils import timezone
        session.ended_at = timezone.now()
        session.save()
        
        # Should have duration
        self.assertIsNotNone(session.duration_seconds)
        self.assertGreater(session.duration_seconds, 0)


class GazeSampleModelTest(TestCase):
    """Test GazeSample model."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.session = Session.objects.create(
            user=self.user,
            device_info={},
            transport_used='ws'
        )
    
    def test_create_gaze_sample(self):
        """Test creating a gaze sample."""
        sample = GazeSample.objects.create(
            session=self.session,
            ts_ms=1234567890,
            x=0.5,
            y=0.5,
            confidence=0.8,
            zone='question'
        )
        
        self.assertEqual(sample.session, self.session)
        self.assertEqual(sample.x, 0.5)
        self.assertEqual(sample.y, 0.5)
        self.assertEqual(sample.confidence, 0.8)
        self.assertEqual(sample.zone, 'question')
        self.assertFalse(sample.dropped)
    
    def test_gaze_sample_validation(self):
        """Test gaze sample coordinate validation."""
        # Valid coordinates
        sample = GazeSample.objects.create(
            session=self.session,
            ts_ms=1234567890,
            x=0.0,
            y=1.0,
            confidence=0.5
        )
        self.assertEqual(sample.x, 0.0)
        self.assertEqual(sample.y, 1.0)
        
        # Invalid coordinates should raise validation error
        with self.assertRaises(ValidationError):
            sample = GazeSample(
                session=self.session,
                ts_ms=1234567890,
                x=1.5,  # Invalid: > 1.0
                y=0.5,
                confidence=0.5
            )
            sample.full_clean()


class FeatureWindowModelTest(TestCase):
    """Test FeatureWindow model."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.session = Session.objects.create(
            user=self.user,
            device_info={},
            transport_used='ws'
        )
    
    def test_create_feature_window(self):
        """Test creating a feature window."""
        features = {
            'fixation_count': 5,
            'dispersion': 0.1,
            'avg_confidence': 0.8
        }
        
        window = FeatureWindow.objects.create(
            session=self.session,
            start_ms=1000,
            end_ms=4000,
            features=features
        )
        
        self.assertEqual(window.session, self.session)
        self.assertEqual(window.start_ms, 1000)
        self.assertEqual(window.end_ms, 4000)
        self.assertEqual(window.features, features)


class AttentionEventModelTest(TestCase):
    """Test AttentionEvent model."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.session = Session.objects.create(
            user=self.user,
            device_info={},
            transport_used='ws'
        )
    
    def test_create_attention_event(self):
        """Test creating an attention event."""
        event = AttentionEvent.objects.create(
            session=self.session,
            ts_ms=1234567890,
            kind='on_task',
            score=0.8,
            meta={'detector': 'test', 'confidence': 0.8}
        )
        
        self.assertEqual(event.session, self.session)
        self.assertEqual(event.kind, 'on_task')
        self.assertEqual(event.score, 0.8)
        self.assertEqual(event.meta['detector'], 'test')


class InterventionModelTest(TestCase):
    """Test Intervention model."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='testpass123'
        )
        self.session = Session.objects.create(
            user=self.user,
            device_info={},
            transport_used='ws'
        )
    
    def test_create_intervention(self):
        """Test creating an intervention."""
        intervention = Intervention.objects.create(
            session=self.session,
            ts_ms=1234567890,
            type='show_hint',
            reason={'event': 'confusion', 'confidence': 0.8},
            applied_by='rule'
        )
        
        self.assertEqual(intervention.session, self.session)
        self.assertEqual(intervention.type, 'show_hint')
        self.assertEqual(intervention.applied_by, 'rule')
        self.assertEqual(intervention.reason['event'], 'confusion')
