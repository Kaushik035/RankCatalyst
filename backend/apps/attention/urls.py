"""
URL routing for attention tracking API.
"""
from django.urls import path

from . import views

app_name = 'attention'

urlpatterns = [
    # Health check
    path('health/', views.HealthView.as_view(), name='health'),
    
    # Session management
    path('sessions/start/', views.SessionStartView.as_view(), name='session_start'),
    path('sessions/<uuid:session_id>/end/', views.SessionEndView.as_view(), name='session_end'),
    path('sessions/<uuid:session_id>/gaze-batch/', views.GazeBatchView.as_view(), name='gaze_batch'),
    path('sessions/<uuid:session_id>/timeline/', views.SessionTimelineView.as_view(), name='session_timeline'),
    
    # Session listing and details
    path('sessions/', views.SessionListView.as_view(), name='session_list'),
    path('sessions/<uuid:session_id>/', views.SessionDetailView.as_view(), name='session_detail'),
    
    # Interventions
    path('interventions/decide/', views.InterventionDecisionView.as_view(), name='intervention_decision'),
    
    # Metrics
    path('metrics/', views.MetricsView.as_view(), name='metrics'),
]
