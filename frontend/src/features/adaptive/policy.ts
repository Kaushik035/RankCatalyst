/**
 * Intervention policy engine for adaptive learning.
 * 
 * Implements rule-based intervention decisions based on attention events
 * and learning context.
 */
export interface InterventionContext {
  recentEvents: AttentionEvent[]
  lastOutcome?: 'correct' | 'wrong'
  userFeedback?: 'too_easy' | 'too_hard'
  sessionDuration: number
  currentDifficulty: number
}

export interface AttentionEvent {
  kind: 'on_task' | 'inattention' | 'confusion' | 'fatigue'
  score: number
  timestamp: number
  confidence: number
}

export interface Intervention {
  type: 'show_hint' | 'simplify' | 'pause' | 'increase_difficulty' | 'focus_nudge' | 'break_suggestion'
  reason: string
  confidence: number
  priority: 'low' | 'medium' | 'high'
  metadata?: Record<string, any>
}

export interface InterventionPolicy {
  name: string
  version: string
  rules: InterventionRule[]
}

export interface InterventionRule {
  id: string
  name: string
  condition: (context: InterventionContext) => boolean
  action: (context: InterventionContext) => Intervention
  priority: number
  cooldown: number // milliseconds
}

// Default intervention policy
export const DEFAULT_POLICY: InterventionPolicy = {
  name: 'Default Attention Policy',
  version: 'v1.0',
  rules: [
    {
      id: 'confusion_hint',
      name: 'Show Hint on Confusion',
      condition: (context) => {
        const confusionEvents = context.recentEvents.filter(e => e.kind === 'confusion')
        return confusionEvents.length >= 2 && 
               confusionEvents.every(e => e.score > 0.7)
      },
      action: (context) => ({
        type: 'show_hint',
        reason: 'Multiple confusion events detected',
        confidence: 0.8,
        priority: 'high',
        metadata: { eventCount: context.recentEvents.length }
      }),
      priority: 1,
      cooldown: 30000 // 30 seconds
    },
    {
      id: 'inattention_focus',
      name: 'Focus Nudge on Inattention',
      condition: (context) => {
        const inattentionEvents = context.recentEvents.filter(e => e.kind === 'inattention')
        return inattentionEvents.length >= 3 && 
               inattentionEvents.every(e => e.score > 0.6)
      },
      action: (context) => ({
        type: 'focus_nudge',
        reason: 'Sustained inattention detected',
        confidence: 0.7,
        priority: 'medium',
        metadata: { eventCount: context.recentEvents.length }
      }),
      priority: 2,
      cooldown: 20000 // 20 seconds
    },
    {
      id: 'fatigue_break',
      name: 'Break Suggestion on Fatigue',
      condition: (context) => {
        const fatigueEvents = context.recentEvents.filter(e => e.kind === 'fatigue')
        return fatigueEvents.length >= 2 && 
               context.sessionDuration > 300000 && // 5 minutes
               fatigueEvents.every(e => e.score > 0.6)
      },
      action: (context) => ({
        type: 'break_suggestion',
        reason: 'Fatigue detected after extended session',
        confidence: 0.6,
        priority: 'medium',
        metadata: { 
          sessionDuration: context.sessionDuration,
          eventCount: context.recentEvents.length 
        }
      }),
      priority: 3,
      cooldown: 60000 // 1 minute
    },
    {
      id: 'difficulty_increase',
      name: 'Increase Difficulty on Success',
      condition: (context) => {
        const onTaskEvents = context.recentEvents.filter(e => e.kind === 'on_task')
        return onTaskEvents.length >= 5 && 
               context.lastOutcome === 'correct' &&
               context.currentDifficulty < 0.8
      },
      action: (context) => ({
        type: 'increase_difficulty',
        reason: 'Consistent on-task behavior with correct answers',
        confidence: 0.7,
        priority: 'low',
        metadata: { 
          onTaskCount: onTaskEvents.length,
          currentDifficulty: context.currentDifficulty 
        }
      }),
      priority: 4,
      cooldown: 120000 // 2 minutes
    },
    {
      id: 'difficulty_decrease',
      name: 'Simplify on Difficulty',
      condition: (context) => {
        const confusionEvents = context.recentEvents.filter(e => e.kind === 'confusion')
        return confusionEvents.length >= 3 && 
               context.lastOutcome === 'wrong' &&
               context.currentDifficulty > 0.3
      },
      action: (context) => ({
        type: 'simplify',
        reason: 'Multiple confusion events with incorrect answers',
        confidence: 0.8,
        priority: 'high',
        metadata: { 
          confusionCount: confusionEvents.length,
          currentDifficulty: context.currentDifficulty 
        }
      }),
      priority: 5,
      cooldown: 45000 // 45 seconds
    },
    {
      id: 'user_feedback_easy',
      name: 'Increase Difficulty on User Feedback',
      condition: (context) => context.userFeedback === 'too_easy',
      action: (context) => ({
        type: 'increase_difficulty',
        reason: 'User reported content too easy',
        confidence: 0.9,
        priority: 'high',
        metadata: { userFeedback: context.userFeedback }
      }),
      priority: 6,
      cooldown: 0 // No cooldown for user feedback
    },
    {
      id: 'user_feedback_hard',
      name: 'Simplify on User Feedback',
      condition: (context) => context.userFeedback === 'too_hard',
      action: (context) => ({
        type: 'simplify',
        reason: 'User reported content too hard',
        confidence: 0.9,
        priority: 'high',
        metadata: { userFeedback: context.userFeedback }
      }),
      priority: 7,
      cooldown: 0 // No cooldown for user feedback
    }
  ]
}

// Intervention engine class
export class InterventionEngine {
  private policy: InterventionPolicy
  private lastInterventions: Map<string, number> = new Map()

  constructor(policy: InterventionPolicy = DEFAULT_POLICY) {
    this.policy = policy
  }

  // Evaluate context and return interventions
  evaluate(context: InterventionContext): Intervention[] {
    const interventions: Intervention[] = []
    const now = Date.now()

    // Sort rules by priority
    const sortedRules = [...this.policy.rules].sort((a, b) => a.priority - b.priority)

    for (const rule of sortedRules) {
      // Check cooldown
      const lastIntervention = this.lastInterventions.get(rule.id)
      if (lastIntervention && (now - lastIntervention) < rule.cooldown) {
        continue
      }

      // Check condition
      if (rule.condition(context)) {
        const intervention = rule.action(context)
        interventions.push(intervention)
        
        // Record intervention time
        this.lastInterventions.set(rule.id, now)
      }
    }

    // Sort by priority and confidence
    return interventions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const aPriority = priorityOrder[a.priority]
      const bPriority = priorityOrder[b.priority]
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority
      }
      
      return b.confidence - a.confidence
    })
  }

  // Get top intervention
  getTopIntervention(context: InterventionContext): Intervention | null {
    const interventions = this.evaluate(context)
    return interventions.length > 0 ? interventions[0] : null
  }

  // Update policy
  updatePolicy(policy: InterventionPolicy): void {
    this.policy = policy
    this.lastInterventions.clear()
  }

  // Get policy info
  getPolicyInfo(): { name: string; version: string; ruleCount: number } {
    return {
      name: this.policy.name,
      version: this.policy.version,
      ruleCount: this.policy.rules.length
    }
  }

  // Clear intervention history
  clearHistory(): void {
    this.lastInterventions.clear()
  }
}

// Utility functions
export function createInterventionContext(
  recentEvents: AttentionEvent[],
  options: Partial<InterventionContext> = {}
): InterventionContext {
  return {
    recentEvents,
    lastOutcome: options.lastOutcome,
    userFeedback: options.userFeedback,
    sessionDuration: options.sessionDuration || 0,
    currentDifficulty: options.currentDifficulty || 0.5
  }
}

export function filterRecentEvents(
  events: AttentionEvent[],
  windowMs: number = 60000
): AttentionEvent[] {
  const cutoff = Date.now() - windowMs
  return events.filter(event => event.timestamp >= cutoff)
}

export function getEventCounts(events: AttentionEvent[]): Record<string, number> {
  const counts: Record<string, number> = {}
  
  for (const event of events) {
    counts[event.kind] = (counts[event.kind] || 0) + 1
  }
  
  return counts
}

export function calculateAttentionScore(events: AttentionEvent[]): number {
  if (events.length === 0) return 0.5
  
  const weights = {
    on_task: 1.0,
    inattention: -0.8,
    confusion: -0.6,
    fatigue: -0.4
  }
  
  let weightedSum = 0
  let totalWeight = 0
  
  for (const event of events) {
    const weight = weights[event.kind] || 0
    weightedSum += weight * event.score
    totalWeight += Math.abs(weight)
  }
  
  return totalWeight > 0 ? Math.max(0, Math.min(1, 0.5 + weightedSum / totalWeight)) : 0.5
}
