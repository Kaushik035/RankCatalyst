"""
WebSocket URL routing for attention tracking.
"""
from django.urls import path

from . import consumers

websocket_urlpatterns = [
    path('ws/gaze/<uuid:session_id>/', consumers.GazeConsumer.as_asgi()),
    path('ws/session/', consumers.SessionConsumer.as_asgi()),
]
