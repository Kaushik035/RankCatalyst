"""
Intervention decision engine with rule-based policies.
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from .models import Session, AttentionEvent, Intervention

logger = logging.getLogger(__name__)


def decide_intervention(session: Session, context: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Decide on interventions based on session context and recent events.
    
    Args:
        session: The session to analyze
        context: Context including recent_window_ms, last_outcome, user_feedback
        
    Returns:
        List of intervention suggestions
    """
    suggestions = []
    
    # Get recent events
    recent_window_ms = context.get('recent_window_ms', 60000)  # Default 1 minute
    recent_events = _get_recent_events(session, recent_window_ms)
    
    # Get last outcome and user feedback
    last_outcome = context.get('last_outcome')
    user_feedback = context.get('user_feedback')
    
    # Apply intervention rules
    suggestions.extend(_check_confusion_rule(recent_events))
    suggestions.extend(_check_difficulty_rule(session, recent_events, last_outcome))
    suggestions.extend(_check_inattention_rule(recent_events))
    suggestions.extend(_check_fatigue_rule(recent_events))
    suggestions.extend(_check_user_feedback_rule(user_feedback))
    
    # Sort by confidence and return top suggestions
    suggestions.sort(key=lambda x: x['confidence'], reverse=True)
    
    # Limit to top 3 suggestions
    return suggestions[:3]


def _get_recent_events(session: Session, window_ms: int) -> List[AttentionEvent]:
    """Get recent attention events within the specified window."""
    cutoff_time = datetime.now() - timedelta(milliseconds=window_ms)
    
    return AttentionEvent.objects.filter(
        session=session,
        ts_ms__gte=int(cutoff_time.timestamp() * 1000)
    ).order_by('-ts_ms')


def _check_confusion_rule(recent_events: List[AttentionEvent]) -> List[Dict[str, Any]]:
    """
    Check for confusion intervention rule.
    
    Rule: Confusion >= 2 in last 60s → show_hint (confidence 0.8)
    """
    suggestions = []
    
    # Count confusion events in last 60 seconds
    confusion_events = [e for e in recent_events if e.kind == 'confusion']
    
    if len(confusion_events) >= 2:
        # Calculate average confidence
        avg_confidence = sum(e.score for e in confusion_events) / len(confusion_events)
        
        suggestion = {
            'type': 'show_hint',
            'reason': {
                'kind': 'confusion',
                'score': avg_confidence,
                'event_count': len(confusion_events),
                'rule': 'confusion_threshold'
            },
            'confidence': min(0.8, avg_confidence)
        }
        suggestions.append(suggestion)
    
    return suggestions


def _check_difficulty_rule(
    session: Session, 
    recent_events: List[AttentionEvent], 
    last_outcome: Optional[str]
) -> List[Dict[str, Any]]:
    """
    Check for difficulty adjustment rule.
    
    Rule: On-task for > 5 min & last 3 outcomes=correct → increase_difficulty (0.7)
    """
    suggestions = []
    
    # Check if user has been on-task for extended period
    on_task_events = [e for e in recent_events if e.kind == 'on_task']
    
    if len(on_task_events) >= 3:  # At least 3 on-task events (roughly 5+ minutes)
        # Check if last outcome was correct
        if last_outcome == 'correct':
            # Calculate average on-task confidence
            avg_confidence = sum(e.score for e in on_task_events) / len(on_task_events)
            
            suggestion = {
                'type': 'increase_difficulty',
                'reason': {
                    'kind': 'on_task',
                    'score': avg_confidence,
                    'event_count': len(on_task_events),
                    'last_outcome': last_outcome,
                    'rule': 'difficulty_increase'
                },
                'confidence': min(0.7, avg_confidence)
            }
            suggestions.append(suggestion)
    
    return suggestions


def _check_inattention_rule(recent_events: List[AttentionEvent]) -> List[Dict[str, Any]]:
    """
    Check for inattention intervention rule.
    
    Rule: Inattention spikes twice in 90s → pause suggestion with focus nudge (0.6)
    """
    suggestions = []
    
    # Count inattention events
    inattention_events = [e for e in recent_events if e.kind == 'inattention']
    
    if len(inattention_events) >= 2:
        # Check if events are clustered (spikes)
        if _are_events_clustered(inattention_events, window_ms=30000):  # 30 second clusters
            # Calculate average confidence
            avg_confidence = sum(e.score for e in inattention_events) / len(inattention_events)
            
            suggestion = {
                'type': 'focus_nudge',
                'reason': {
                    'kind': 'inattention',
                    'score': avg_confidence,
                    'event_count': len(inattention_events),
                    'rule': 'inattention_spike'
                },
                'confidence': min(0.6, avg_confidence)
            }
            suggestions.append(suggestion)
    
    return suggestions


def _check_fatigue_rule(recent_events: List[AttentionEvent]) -> List[Dict[str, Any]]:
    """
    Check for fatigue intervention rule.
    
    Rule: Fatigue detected → break suggestion (0.5)
    """
    suggestions = []
    
    # Check for fatigue events
    fatigue_events = [e for e in recent_events if e.kind == 'fatigue']
    
    if fatigue_events:
        # Use the most recent fatigue event
        latest_fatigue = max(fatigue_events, key=lambda e: e.ts_ms)
        
        suggestion = {
            'type': 'break_suggestion',
            'reason': {
                'kind': 'fatigue',
                'score': latest_fatigue.score,
                'event_count': len(fatigue_events),
                'rule': 'fatigue_detection'
            },
            'confidence': min(0.5, latest_fatigue.score)
        }
        suggestions.append(suggestion)
    
    return suggestions


def _check_user_feedback_rule(user_feedback: Optional[str]) -> List[Dict[str, Any]]:
    """
    Check for user feedback-based interventions.
    
    Rule: User feedback "too_easy" → increase_difficulty, "too_hard" → simplify
    """
    suggestions = []
    
    if user_feedback == 'too_easy':
        suggestion = {
            'type': 'increase_difficulty',
            'reason': {
                'kind': 'user_feedback',
                'feedback': user_feedback,
                'rule': 'user_feedback_easy'
            },
            'confidence': 0.9  # High confidence for direct user feedback
        }
        suggestions.append(suggestion)
    
    elif user_feedback == 'too_hard':
        suggestion = {
            'type': 'simplify',
            'reason': {
                'kind': 'user_feedback',
                'feedback': user_feedback,
                'rule': 'user_feedback_hard'
            },
            'confidence': 0.9  # High confidence for direct user feedback
        }
        suggestions.append(suggestion)
    
    return suggestions


def _are_events_clustered(events: List[AttentionEvent], window_ms: int = 30000) -> bool:
    """
    Check if events are clustered within a time window.
    
    Args:
        events: List of attention events
        window_ms: Time window in milliseconds
        
    Returns:
        True if events are clustered
    """
    if len(events) < 2:
        return False
    
    # Sort events by timestamp
    sorted_events = sorted(events, key=lambda e: e.ts_ms)
    
    # Check for clusters
    for i in range(len(sorted_events) - 1):
        current_event = sorted_events[i]
        next_event = sorted_events[i + 1]
        
        # If two events are within the window, consider it clustered
        if next_event.ts_ms - current_event.ts_ms <= window_ms:
            return True
    
    return False


def apply_intervention(
    session: Session, 
    intervention_type: str, 
    reason: Dict[str, Any], 
    applied_by: str = 'rule'
) -> Intervention:
    """
    Apply an intervention and record it.
    
    Args:
        session: The session to apply intervention to
        intervention_type: Type of intervention
        reason: Reasoning for the intervention
        applied_by: Who/what applied the intervention
        
    Returns:
        Created Intervention object
    """
    intervention = Intervention.objects.create(
        session=session,
        ts_ms=int(datetime.now().timestamp() * 1000),
        type=intervention_type,
        reason=reason,
        applied_by=applied_by
    )
    
    logger.info(
        f"Applied intervention {intervention_type} to session {session.id} "
        f"by {applied_by}: {reason}"
    )
    
    return intervention


def get_intervention_history(session: Session, limit: int = 10) -> List[Intervention]:
    """
    Get intervention history for a session.
    
    Args:
        session: The session to get history for
        limit: Maximum number of interventions to return
        
    Returns:
        List of recent interventions
    """
    return Intervention.objects.filter(
        session=session
    ).order_by('-ts_ms')[:limit]


def get_intervention_effectiveness(session: Session) -> Dict[str, Any]:
    """
    Analyze intervention effectiveness for a session.
    
    Args:
        session: The session to analyze
        
    Returns:
        Dict with effectiveness metrics
    """
    interventions = Intervention.objects.filter(session=session)
    
    if not interventions.exists():
        return {'total_interventions': 0}
    
    # Count by type
    type_counts = {}
    for intervention in interventions:
        intervention_type = intervention.type
        type_counts[intervention_type] = type_counts.get(intervention_type, 0) + 1
    
    # Analyze effectiveness (simplified - in practice you'd need more sophisticated metrics)
    effectiveness = {}
    for intervention_type, count in type_counts.items():
        # This is a placeholder - real effectiveness would require outcome tracking
        effectiveness[intervention_type] = {
            'count': count,
            'effectiveness_score': 0.7  # Placeholder
        }
    
    return {
        'total_interventions': interventions.count(),
        'by_type': type_counts,
        'effectiveness': effectiveness
    }
