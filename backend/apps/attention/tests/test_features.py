"""
Tests for feature extraction.
"""
import pytest
import numpy as np
from django.test import TestCase
from django.contrib.auth import get_user_model

from apps.attention.features import (
    extract_features, _extract_window_features,
    _detect_fixations, _detect_saccades,
    _calculate_dispersion, _calculate_zone_dwell
)

User = get_user_model()


class FeatureExtractionTest(TestCase):
    """Test feature extraction functions."""
    
    def test_calculate_dispersion(self):
        """Test dispersion calculation."""
        # Test with known coordinates
        x_coords = np.array([0.5, 0.6, 0.4, 0.5])
        y_coords = np.array([0.5, 0.5, 0.5, 0.5])
        
        dispersion = _calculate_dispersion(x_coords, y_coords)
        self.assertGreater(dispersion, 0)
        self.assertIsInstance(dispersion, float)
    
    def test_calculate_zone_dwell(self):
        """Test zone dwell calculation."""
        zones = ['question', 'question', 'options', 'question']
        timestamps = np.array([1000, 2000, 3000, 4000])
        
        dwell = _calculate_zone_dwell(zones, timestamps)
        
        self.assertIn('question', dwell)
        self.assertIn('options', dwell)
        self.assertGreater(dwell['question'], dwell['options'])
    
    def test_detect_fixations(self):
        """Test fixation detection."""
        # Create test data with a clear fixation
        timestamps = np.array([1000, 1100, 1200, 1300, 1400])
        x_coords = np.array([0.5, 0.51, 0.49, 0.5, 0.51])
        y_coords = np.array([0.5, 0.5, 0.5, 0.5, 0.5])
        confidences = np.array([0.8, 0.8, 0.8, 0.8, 0.8])
        
        fixations = _detect_fixations(timestamps, x_coords, y_coords, confidences)
        
        self.assertIsInstance(fixations, list)
        # Should detect at least one fixation
        self.assertGreaterEqual(len(fixations), 1)
        
        if fixations:
            fixation = fixations[0]
            self.assertIn('start_ms', fixation)
            self.assertIn('end_ms', fixation)
            self.assertIn('duration', fixation)
            self.assertIn('center_x', fixation)
            self.assertIn('center_y', fixation)
    
    def test_detect_saccades(self):
        """Test saccade detection."""
        # Create test data with a clear saccade
        timestamps = np.array([1000, 1010, 1020, 1030, 1040])
        x_coords = np.array([0.1, 0.3, 0.5, 0.7, 0.9])
        y_coords = np.array([0.5, 0.5, 0.5, 0.5, 0.5])
        
        saccades = _detect_saccades(timestamps, x_coords, y_coords)
        
        self.assertIsInstance(saccades, list)
        # Should detect at least one saccade
        self.assertGreaterEqual(len(saccades), 1)
        
        if saccades:
            saccade = saccades[0]
            self.assertIn('start_ms', saccade)
            self.assertIn('end_ms', saccade)
            self.assertIn('start_x', saccade)
            self.assertIn('end_x', saccade)
            self.assertIn('max_speed', saccade)
    
    def test_extract_window_features(self):
        """Test window feature extraction."""
        # Create test data
        timestamps = np.array([1000, 1100, 1200, 1300, 1400])
        x_coords = np.array([0.5, 0.51, 0.49, 0.5, 0.51])
        y_coords = np.array([0.5, 0.5, 0.5, 0.5, 0.5])
        confidences = np.array([0.8, 0.8, 0.8, 0.8, 0.8])
        zones = ['question', 'question', 'question', 'question', 'question']
        
        features = _extract_window_features(
            timestamps, x_coords, y_coords, confidences, zones
        )
        
        self.assertIsInstance(features, dict)
        self.assertIn('sample_count', features)
        self.assertIn('duration_ms', features)
        self.assertIn('avg_confidence', features)
        self.assertIn('fixation_count', features)
        self.assertIn('saccade_count', features)
        self.assertIn('dispersion', features)
        self.assertIn('dwell', features)
        self.assertIn('blink_proxy', features)
        self.assertIn('offscreen_ratio', features)
        
        # Check feature types
        self.assertIsInstance(features['sample_count'], int)
        self.assertIsInstance(features['duration_ms'], int)
        self.assertIsInstance(features['avg_confidence'], float)
        self.assertIsInstance(features['fixation_count'], int)
        self.assertIsInstance(features['saccade_count'], int)
        self.assertIsInstance(features['dispersion'], float)
        self.assertIsInstance(features['dwell'], dict)
        self.assertIsInstance(features['blink_proxy'], float)
        self.assertIsInstance(features['offscreen_ratio'], float)
    
    def test_empty_data(self):
        """Test feature extraction with empty data."""
        # Test with empty arrays
        timestamps = np.array([])
        x_coords = np.array([])
        y_coords = np.array([])
        confidences = np.array([])
        zones = []
        
        features = _extract_window_features(
            timestamps, x_coords, y_coords, confidences, zones
        )
        
        self.assertIsInstance(features, dict)
        self.assertEqual(features['sample_count'], 0)
        self.assertEqual(features['duration_ms'], 0)
        self.assertEqual(features['avg_confidence'], 0)
        self.assertEqual(features['fixation_count'], 0)
        self.assertEqual(features['saccade_count'], 0)
        self.assertEqual(features['dispersion'], 0)
        self.assertEqual(features['blink_proxy'], 0)
        self.assertEqual(features['offscreen_ratio'], 0)
