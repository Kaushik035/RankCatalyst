"""
Tests for attention tracking serializers.
"""
import pytest
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.attention.serializers import (
    GazeBatchSerializer, SessionStartSerializer, 
    InterventionDecisionSerializer
)

User = get_user_model()


class GazeBatchSerializerTest(TestCase):
    """Test GazeBatchSerializer."""
    
    def test_valid_gaze_batch(self):
        """Test valid gaze batch data."""
        data = {
            'client_timebase_ms': 1234567890,
            'samples': [
                {'t': 0, 'x': 0.5, 'y': 0.5, 'c': 0.8, 'zone': 'question'},
                {'t': 100, 'x': 0.6, 'y': 0.4, 'c': 0.7, 'zone': 'options'}
            ]
        }
        
        serializer = GazeBatchSerializer(data=data)
        self.assertTrue(serializer.is_valid())
    
    def test_invalid_coordinates(self):
        """Test invalid coordinate values."""
        data = {
            'client_timebase_ms': 1234567890,
            'samples': [
                {'t': 0, 'x': 1.5, 'y': 0.5, 'c': 0.8}  # x > 1.0
            ]
        }
        
        serializer = GazeBatchSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('samples', serializer.errors)
    
    def test_too_many_samples(self):
        """Test batch size limit."""
        data = {
            'client_timebase_ms': 1234567890,
            'samples': [{'t': i, 'x': 0.5, 'y': 0.5, 'c': 0.8} for i in range(513)]  # > 512
        }
        
        serializer = GazeBatchSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('samples', serializer.errors)


class SessionStartSerializerTest(TestCase):
    """Test SessionStartSerializer."""
    
    def test_valid_session_start(self):
        """Test valid session start data."""
        data = {
            'lesson_id': '123e4567-e89b-12d3-a456-426614174000',
            'device_info': {'browser': 'Chrome', 'os': 'Windows'},
            'preferred_transport': 'ws'
        }
        
        serializer = SessionStartSerializer(data=data)
        self.assertTrue(serializer.is_valid())
    
    def test_minimal_session_start(self):
        """Test minimal session start data."""
        data = {
            'device_info': {}
        }
        
        serializer = SessionStartSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['preferred_transport'], 'ws')


class InterventionDecisionSerializerTest(TestCase):
    """Test InterventionDecisionSerializer."""
    
    def test_valid_intervention_decision(self):
        """Test valid intervention decision data."""
        data = {
            'session_id': '123e4567-e89b-12d3-a456-426614174000',
            'context': {
                'recent_window_ms': 60000,
                'last_outcome': 'correct',
                'user_feedback': 'too_easy'
            }
        }
        
        serializer = InterventionDecisionSerializer(data=data)
        self.assertTrue(serializer.is_valid())
    
    def test_invalid_context_key(self):
        """Test invalid context key."""
        data = {
            'session_id': '123e4567-e89b-12d3-a456-426614174000',
            'context': {
                'invalid_key': 'value'
            }
        }
        
        serializer = InterventionDecisionSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('context', serializer.errors)
