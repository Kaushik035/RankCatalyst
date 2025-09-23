"""
Development settings for RankCatalyst.

These settings are used for local development.
"""
from .base import *

# Development-specific overrides
DEBUG = True

# Allow all hosts in development
ALLOWED_HOSTS = ["*"]

# CORS settings for development
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Email backend for development
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Logging for development
LOGGING["handlers"]["console"]["formatter"] = "verbose"
LOGGING["root"]["level"] = "DEBUG"

# Disable some security features in development
SECURE_BROWSER_XSS_FILTER = False
SECURE_CONTENT_TYPE_NOSNIFF = False
X_FRAME_OPTIONS = "SAMEORIGIN"

# Development-specific gaze settings
GAZE_SAMPLE_MAX_HZ = 30  # Lower for development
GAZE_BATCH_MS = 500  # Longer batches for development
