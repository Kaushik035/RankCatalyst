/**
 * Hook for managing adaptive interventions.
 * 
 * Handles intervention decisions, WebSocket subscriptions, and UI actions.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { InterventionEngine, Intervention, InterventionContext, AttentionEvent } from './policy'
import { useWebSocket } from '../gaze/ws'

export interface InterventionState {
  currentIntervention: Intervention | null
  interventionHistory: Intervention[]
  isProcessing: boolean
  lastUpdate: number
}

export interface InterventionConfig {
  sessionId: string
  onIntervention?: (intervention: Intervention) => void
  onError?: (error: string) => void
}

export function useInterventions(config: InterventionConfig) {
  const [state, setState] = useState<InterventionState>({
    currentIntervention: null,
    interventionHistory: [],
    isProcessing: false,
    lastUpdate: 0
  })

  const engineRef = useRef<InterventionEngine>(new InterventionEngine())
  const attentionEventsRef = useRef<AttentionEvent[]>([])
  const lastOutcomeRef = useRef<'correct' | 'wrong' | undefined>()
  const userFeedbackRef = useRef<'too_easy' | 'too_hard' | undefined>()
  const sessionStartTimeRef = useRef<number>(Date.now())

  // WebSocket connection for real-time interventions
  const { isConnected, send: wsSend } = useWebSocket({
    url: `ws://localhost:8000/ws/gaze/${config.sessionId}/`,
    onMessage: handleWebSocketMessage,
    onError: config.onError
  })

  // Handle WebSocket messages
  function handleWebSocketMessage(message: any) {
    if (message.type === 'intervention') {
      const intervention: Intervention = {
        type: message.action.type,
        reason: message.action.reason,
        confidence: message.action.confidence || 0.7,
        priority: 'medium',
        metadata: message.action.metadata
      }
      
      setState(prev => ({
        ...prev,
        currentIntervention: intervention,
        interventionHistory: [...prev.interventionHistory, intervention],
        lastUpdate: Date.now()
      }))
      
      config.onIntervention?.(intervention)
    }
  }

  // Add attention event
  const addAttentionEvent = useCallback((event: AttentionEvent) => {
    attentionEventsRef.current.push(event)
    
    // Keep only recent events (last 5 minutes)
    const cutoff = Date.now() - 300000
    attentionEventsRef.current = attentionEventsRef.current.filter(e => e.timestamp >= cutoff)
    
    // Trigger intervention evaluation
    evaluateInterventions()
  }, [])

  // Set last outcome
  const setLastOutcome = useCallback((outcome: 'correct' | 'wrong') => {
    lastOutcomeRef.current = outcome
    evaluateInterventions()
  }, [])

  // Set user feedback
  const setUserFeedback = useCallback((feedback: 'too_easy' | 'too_hard') => {
    userFeedbackRef.current = feedback
    evaluateInterventions()
  }, [])

  // Evaluate interventions
  const evaluateInterventions = useCallback(() => {
    if (state.isProcessing) return

    setState(prev => ({ ...prev, isProcessing: true }))

    try {
      const context: InterventionContext = {
        recentEvents: attentionEventsRef.current,
        lastOutcome: lastOutcomeRef.current,
        userFeedback: userFeedbackRef.current,
        sessionDuration: Date.now() - sessionStartTimeRef.current,
        currentDifficulty: 0.5 // This would come from the learning system
      }

      const intervention = engineRef.current.getTopIntervention(context)
      
      if (intervention) {
        setState(prev => ({
          ...prev,
          currentIntervention: intervention,
          interventionHistory: [...prev.interventionHistory, intervention],
          lastUpdate: Date.now()
        }))
        
        config.onIntervention?.(intervention)
        
        // Send intervention to backend
        if (isConnected) {
          wsSend({
            type: 'intervention_applied',
            intervention: {
              type: intervention.type,
              reason: intervention.reason,
              confidence: intervention.confidence,
              metadata: intervention.metadata
            }
          })
        }
      }
    } catch (error) {
      config.onError?.(error instanceof Error ? error.message : 'Intervention evaluation failed')
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }))
    }
  }, [state.isProcessing, config, isConnected, wsSend])

  // Apply intervention
  const applyIntervention = useCallback((intervention: Intervention) => {
    setState(prev => ({
      ...prev,
      currentIntervention: intervention,
      interventionHistory: [...prev.interventionHistory, intervention],
      lastUpdate: Date.now()
    }))
    
    config.onIntervention?.(intervention)
  }, [config])

  // Dismiss current intervention
  const dismissIntervention = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentIntervention: null
    }))
  }, [])

  // Get intervention statistics
  const getStats = useCallback(() => {
    const history = state.interventionHistory
    const typeCounts: Record<string, number> = {}
    const priorityCounts: Record<string, number> = {}
    
    for (const intervention of history) {
      typeCounts[intervention.type] = (typeCounts[intervention.type] || 0) + 1
      priorityCounts[intervention.priority] = (priorityCounts[intervention.priority] || 0) + 1
    }
    
    return {
      totalInterventions: history.length,
      typeCounts,
      priorityCounts,
      lastIntervention: history.length > 0 ? history[history.length - 1] : null,
      averageConfidence: history.length > 0 
        ? history.reduce((sum, i) => sum + i.confidence, 0) / history.length 
        : 0
    }
  }, [state.interventionHistory])

  // Clear intervention history
  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentIntervention: null,
      interventionHistory: []
    }))
    
    engineRef.current.clearHistory()
    attentionEventsRef.current = []
    lastOutcomeRef.current = undefined
    userFeedbackRef.current = undefined
    sessionStartTimeRef.current = Date.now()
  }, [])

  // Update policy
  const updatePolicy = useCallback((policy: any) => {
    engineRef.current.updatePolicy(policy)
  }, [])

  // Get policy info
  const getPolicyInfo = useCallback(() => {
    return engineRef.current.getPolicyInfo()
  }, [])

  // Auto-evaluate interventions periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (attentionEventsRef.current.length > 0) {
        evaluateInterventions()
      }
    }, 10000) // Every 10 seconds

    return () => clearInterval(interval)
  }, [evaluateInterventions])

  return {
    ...state,
    addAttentionEvent,
    setLastOutcome,
    setUserFeedback,
    applyIntervention,
    dismissIntervention,
    getStats,
    clearHistory,
    updatePolicy,
    getPolicyInfo
  }
}
