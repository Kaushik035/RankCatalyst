/**
 * Session management component for gaze tracking.
 * 
 * Orchestrates the complete gaze tracking session including:
 * - Session initialization
 * - Calibration flow
 * - Real-time tracking
 * - Data transmission
 * - Session analytics
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useWebGazer, GazePoint } from './useWebGazer'
import { useGazeStream } from './useGazeStream'
import { useZoneDetection } from './zones'
import { Calibration, CalibrationResult } from './Calibration'
import { GazeOverlay, AttentionState, NetworkStatus } from './GazeOverlay'

export interface SessionConfig {
  lessonId?: string
  deviceInfo: Record<string, any>
  onSessionEnd: (sessionId: string, analytics: SessionAnalytics) => void
  onError: (error: string) => void
}

export interface SessionAnalytics {
  sessionId: string
  duration: number
  totalSamples: number
  droppedSamples: number
  avgConfidence: number
  attentionEvents: number
  interventions: number
  calibrationAccuracy: number
}

export interface SessionState {
  sessionId: string | null
  isActive: boolean
  isCalibrated: boolean
  showOverlay: boolean
  attentionState: AttentionState
  networkStatus: NetworkStatus
}

export function GazeSession({ lessonId, deviceInfo, onSessionEnd, onError }: SessionConfig) {
  const [state, setState] = useState<SessionState>({
    sessionId: null,
    isActive: false,
    isCalibrated: false,
    showOverlay: true,
    attentionState: {
      kind: 'unknown',
      score: 0,
      confidence: 0
    },
    networkStatus: {
      type: 'offline',
      connected: false
    }
  })

  const [analytics, setAnalytics] = useState<SessionAnalytics>({
    sessionId: '',
    duration: 0,
    totalSamples: 0,
    droppedSamples: 0,
    avgConfidence: 0,
    attentionEvents: 0,
    interventions: 0,
    calibrationAccuracy: 0
  })

  const [showCalibration, setShowCalibration] = useState(false)
  const sessionStartTimeRef = useRef<number>(0)

  // WebGazer hook
  const {
    isInitialized,
    isCalibrated: webgazerCalibrated,
    isTracking,
    hasPermission,
    error: webgazerError,
    confidence,
    gazePoint,
    initialize,
    startTracking,
    stopTracking,
    end: endWebGazer
  } = useWebGazer({
    minConfidence: 0.6,
    sampleRate: 60,
    onGazePoint: handleGazePoint,
    onError: onError
  })

  // Gaze stream hook
  const {
    isStreaming,
    sampleCount,
    batchCount,
    droppedSamples,
    networkStatus,
    latency,
    fps,
    processGazePoint,
    startStreaming,
    stopStreaming
  } = useGazeStream({
    maxSampleRate: 60,
    batchInterval: 300,
    maxBatchSize: 512,
    sessionId: state.sessionId || '',
    onError: onError
  })

  // Zone detection hook
  const { zones, isReady: zonesReady, getZoneAt } = useZoneDetection()

  // Handle gaze point updates
  function handleGazePoint(point: GazePoint) {
    if (!state.isActive) return

    // Detect zone
    const zone = getZoneAt(point.x, point.y)
    const zoneName = zone ? zone.name : 'other'

    // Update gaze point with zone
    const gazePointWithZone = { ...point, zone: zoneName }

    // Process through stream
    processGazePoint(gazePointWithZone)

    // Update analytics
    setAnalytics(prev => ({
      ...prev,
      totalSamples: prev.totalSamples + 1,
      avgConfidence: (prev.avgConfidence * (prev.totalSamples - 1) + point.confidence) / prev.totalSamples
    }))
  }

  // Start session
  const startSession = useCallback(async () => {
    try {
      // Initialize WebGazer
      if (!isInitialized) {
        await initialize()
      }

      if (!hasPermission) {
        onError('Camera permission required for gaze tracking')
        return
      }

      // Create session on backend
      const response = await fetch('/api/attention/sessions/start/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          lessonId,
          deviceInfo,
          preferredTransport: 'ws'
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.statusText}`)
      }

      const sessionData = await response.json()
      
      setState(prev => ({
        ...prev,
        sessionId: sessionData.sessionId,
        isActive: true
      }))

      setAnalytics(prev => ({
        ...prev,
        sessionId: sessionData.sessionId
      }))

      sessionStartTimeRef.current = Date.now()

      // Show calibration
      setShowCalibration(true)

    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to start session')
    }
  }, [isInitialized, hasPermission, initialize, lessonId, deviceInfo, onError])

  // Handle calibration completion
  const handleCalibrationComplete = useCallback((result: CalibrationResult) => {
    setShowCalibration(false)
    setState(prev => ({ ...prev, isCalibrated: true }))
    
    setAnalytics(prev => ({
      ...prev,
      calibrationAccuracy: result.accuracy
    }))

    // Start tracking
    startTracking()
    startStreaming()
  }, [startTracking, startStreaming])

  // Handle calibration cancellation
  const handleCalibrationCancel = useCallback(() => {
    setShowCalibration(false)
    endSession()
  }, [])

  // End session
  const endSession = useCallback(async () => {
    if (!state.sessionId) return

    try {
      // Stop tracking
      stopTracking()
      stopStreaming()
      endWebGazer()

      // Calculate session duration
      const duration = Date.now() - sessionStartTimeRef.current

      // Update analytics
      setAnalytics(prev => ({
        ...prev,
        duration
      }))

      // End session on backend
      await fetch(`/api/attention/sessions/${state.sessionId}/end/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      })

      // Call completion callback
      onSessionEnd(state.sessionId, analytics)

      // Reset state
      setState(prev => ({
        ...prev,
        sessionId: null,
        isActive: false,
        isCalibrated: false
      }))

    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to end session')
    }
  }, [state.sessionId, stopTracking, stopStreaming, endWebGazer, onSessionEnd, analytics, onError])

  // Update network status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      networkStatus: {
        type: networkStatus,
        connected: networkStatus !== 'offline',
        latency
      }
    }))
  }, [networkStatus, latency])

  // Update analytics
  useEffect(() => {
    setAnalytics(prev => ({
      ...prev,
      droppedSamples
    }))
  }, [droppedSamples])

  // Handle WebSocket messages for attention events
  useEffect(() => {
    // This would be handled by the WebSocket hook in a real implementation
    // For now, we'll simulate attention state updates
    const interval = setInterval(() => {
      if (state.isActive && isTracking) {
        // Simulate attention state based on gaze patterns
        const newAttentionState: AttentionState = {
          kind: confidence > 0.8 ? 'on_task' : 'inattention',
          score: confidence,
          confidence: confidence
        }
        
        setState(prev => ({
          ...prev,
          attentionState: newAttentionState
        }))

        setAnalytics(prev => ({
          ...prev,
          attentionEvents: prev.attentionEvents + 1
        }))
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [state.isActive, isTracking, confidence])

  // Handle errors
  useEffect(() => {
    if (webgazerError) {
      onError(webgazerError)
    }
  }, [webgazerError, onError])

  // Render session UI
  if (!state.isActive) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Gaze Tracking Session</h2>
          <p className="text-neutral-300 mb-6">
            Start a gaze tracking session to monitor your attention and learning patterns.
          </p>
          <button
            onClick={startSession}
            disabled={!isInitialized || !hasPermission}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-600 disabled:cursor-not-allowed rounded-lg text-white font-medium"
          >
            {!isInitialized ? 'Initializing...' : 
             !hasPermission ? 'Camera Permission Required' : 
             'Start Session'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      {/* Calibration overlay */}
      {showCalibration && (
        <Calibration
          onComplete={handleCalibrationComplete}
          onCancel={handleCalibrationCancel}
          gazePoint={gazePoint}
          isTracking={isTracking}
        />
      )}

      {/* Gaze overlay HUD */}
      <GazeOverlay
        gazePoint={gazePoint}
        confidence={confidence}
        attentionState={state.attentionState}
        networkStatus={state.networkStatus}
        isTracking={isTracking}
        showOverlay={state.showOverlay}
        onToggleOverlay={() => setState(prev => ({ ...prev, showOverlay: !prev.showOverlay }))}
        fps={fps}
        sampleRate={60}
      />

      {/* Session content */}
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Learning Session</h1>
            <button
              onClick={endSession}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
            >
              End Session
            </button>
          </div>

          {/* Session content would go here */}
          <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800">
            <h2 className="text-lg font-medium mb-4">Session Content</h2>
            <p className="text-neutral-300">
              This is where the learning content would be displayed.
              The gaze tracking system is monitoring your attention and will provide
              adaptive interventions based on your gaze patterns.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
