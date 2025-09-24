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
import { useAuthStore } from '@/features/auth/store'

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
  const { accessToken } = useAuthStore()
  
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
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const sessionStartTimeRef = useRef<number>(0)

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

  // Handle gaze point updates - using ref to avoid dependency issues
  const handleGazePointRef = useRef<(point: GazePoint) => void>()
  
  // Update the ref function when dependencies change
  useEffect(() => {
    handleGazePointRef.current = (point: GazePoint) => {
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
  }, [state.isActive])

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
    reset: resetWebGazer,
    startTracking,
    stopTracking,
    end: endWebGazer
  } = useWebGazer({
    minConfidence: 0.6,
    sampleRate: 60,
    onGazePoint: (point) => handleGazePointRef.current?.(point),
    onError: onError
  })

  // Start session
  const startSession = useCallback(async () => {
    try {
      console.log('Starting gaze session...')
      setIsRequestingPermission(true)
      
      // Always reset and reinitialize WebGazer to ensure fresh start
      console.log('Resetting WebGazer for fresh start...')
      try {
        resetWebGazer()
        console.log('WebGazer reset completed')
      } catch (error) {
        console.log('Error during WebGazer reset:', error)
        // Continue anyway, the state will be reset
      }
      
      // Wait a moment for reset to complete
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Initialize WebGazer with camera permission
      console.log('Initializing WebGazer with camera access...')
      const permissionGranted = await initialize()
      console.log('WebGazer initialized, permission granted:', permissionGranted)

      // Wait for WebGazer to initialize
      await new Promise(resolve => setTimeout(resolve, 500))

      console.log('Checking permission status:', hasPermission)
      console.log('WebGazer initialized status:', isInitialized)
      console.log('Permission granted from initialize:', permissionGranted)
      
      // Check if WebGazer has permission
      if (!permissionGranted) {
        console.log('Camera permission denied. Please allow camera access in your browser settings.')
        onError('Camera permission required for gaze tracking. Please allow camera access and try again.')
        return
      }

      // Create session on backend
      const response = await fetch('http://localhost:8000/api/attention/sessions/start/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
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

      // Start WebGazer tracking first
      console.log('Starting WebGazer tracking...')
      startTracking()
      
      // Wait a moment for tracking to start
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      console.log('WebGazer tracking started, showing calibration')
      // Show calibration
      setShowCalibration(true)

    } catch (error) {
      console.error('Session start error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start session'
      onError(errorMessage)
    } finally {
      setIsRequestingPermission(false)
    }
  }, [initialize, resetWebGazer, lessonId, deviceInfo, onError, accessToken])

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
      await fetch(`http://localhost:8000/api/attention/sessions/${state.sessionId}/end/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
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
  }, [state.sessionId, stopTracking, stopStreaming, endWebGazer, analytics, onSessionEnd, onError])

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
  }, [endSession])

  // Update network status - simplified to avoid loops
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

  // Update analytics - simplified to avoid loops
  useEffect(() => {
    setAnalytics(prev => ({
      ...prev,
      droppedSamples
    }))
  }, [droppedSamples])

  // Handle errors - simplified to avoid loops
  useEffect(() => {
    if (webgazerError) {
      onError(webgazerError)
    }
  }, [webgazerError])

  // Render session UI
  if (!state.isActive) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Gaze Tracking Session</h2>
          <p className="text-neutral-300 mb-4">
            Start a gaze tracking session to monitor your attention and learning patterns.
          </p>
          <p className="text-sm text-neutral-400 mb-6">
            Camera permission is required for gaze tracking. You'll be prompted to allow camera access when you start the session.
          </p>
          <div className="flex flex-col items-center gap-3">
          <button
            onClick={startSession}
            disabled={isRequestingPermission}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-600 disabled:cursor-not-allowed rounded-lg text-white font-medium"
          >
            {isRequestingPermission ? 'Requesting Camera Permission...' :
             'Start Gaze Session'}
          </button>
            
            {webgazerError && (
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white text-sm"
              >
                Refresh Page & Retry
              </button>
            )}
          </div>
          
          {webgazerError && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{webgazerError}</p>
              <div className="text-red-300 text-xs mt-2">
                <p className="font-medium">To fix this issue:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Click the camera icon in your browser's address bar</li>
                  <li>Select "Allow" for camera access</li>
                  <li>Refresh this page and try again</li>
                  <li>If the issue persists, check your browser's site settings</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      {/* Custom gaze cursor overlay */}
      {gazePoint && isTracking && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: `${gazePoint.x * window.innerWidth}px`,
            top: `${gazePoint.y * window.innerHeight}px`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="w-6 h-6 border-2 border-red-500 rounded-full bg-red-500/20 flex items-center justify-center">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          </div>
          <div className="text-xs text-red-500 mt-1 text-center">
            {Math.round(gazePoint.confidence * 100)}%
          </div>
        </div>
      )}

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