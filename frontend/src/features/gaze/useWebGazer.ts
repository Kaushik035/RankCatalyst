/**
 * WebGazer integration hook for gaze tracking.
 * 
 * This hook manages WebGazer initialization, calibration, and gaze data collection.
 * It handles camera permissions, confidence filtering, and error states.
 */
import { useState, useEffect, useCallback, useRef } from 'react'

// Declare WebGazer global type
declare global {
  interface Window {
    webgazer: {
      begin(): Promise<void>
      end(): void
      showVideoPreview(show: boolean): void
      showPredictionPoints(show: boolean): void
      setGazeListener(callback: (data: { x: number; y: number }) => void): void
      isReady(): boolean
      getVideoElement(): HTMLVideoElement | null
    }
  }
}

export interface GazePoint {
  x: number
  y: number
  confidence: number
  timestamp: number
}

export interface WebGazerState {
  isInitialized: boolean
  isCalibrated: boolean
  isTracking: boolean
  hasPermission: boolean
  error: string | null
  confidence: number
  gazePoint: GazePoint | null
}

export interface WebGazerConfig {
  minConfidence: number
  sampleRate: number
  onGazePoint?: (point: GazePoint) => void
  onError?: (error: string) => void
}

const DEFAULT_CONFIG: WebGazerConfig = {
  minConfidence: 0.6,
  sampleRate: 60,
}

export function useWebGazer(config: Partial<WebGazerConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  const [state, setState] = useState<WebGazerState>({
    isInitialized: false,
    isCalibrated: false,
    isTracking: false,
    hasPermission: false,
    error: null,
    confidence: 0,
    gazePoint: null,
  })

  const gazeListenerRef = useRef<((data: { x: number; y: number }) => void) | null>(null)
  const lastGazeTimeRef = useRef<number>(0)
  const isInitializingRef = useRef<boolean>(false)

  // Load WebGazer script
  useEffect(() => {
    if (typeof window === 'undefined' || window.webgazer) {
      setState(prev => ({ ...prev, isInitialized: true }))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://webgazer.cs.brown.edu/webgazer.js'
    script.async = true
    
    script.onload = () => {
      setState(prev => ({ ...prev, isInitialized: true }))
    }
    
    script.onerror = () => {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load WebGazer library' 
      }))
    }

    document.head.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  // Initialize WebGazer
  const initialize = useCallback(async () => {
    if (!window.webgazer || isInitializingRef.current) {
      return
    }

    isInitializingRef.current = true
    setState(prev => ({ ...prev, error: null }))

    try {
      // Check camera permissions
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      })
      
      // Stop the stream as WebGazer will create its own
      stream.getTracks().forEach(track => track.stop())
      
      setState(prev => ({ ...prev, hasPermission: true }))

      // Initialize WebGazer
      await window.webgazer.begin()
      
      // Configure WebGazer
      window.webgazer.showVideoPreview(false)
      window.webgazer.showPredictionPoints(false)

      setState(prev => ({ ...prev, isInitialized: true }))
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({ 
        ...prev, 
        error: `Camera permission denied: ${errorMessage}`,
        hasPermission: false
      }))
      finalConfig.onError?.(errorMessage)
    } finally {
      isInitializingRef.current = false
    }
  }, [finalConfig])

  // Start tracking
  const startTracking = useCallback(() => {
    if (!window.webgazer || !state.isInitialized) {
      return
    }

    // Set up gaze listener
    gazeListenerRef.current = (data: { x: number; y: number }) => {
      const now = Date.now()
      
      // Throttle based on sample rate
      const minInterval = 1000 / finalConfig.sampleRate
      if (now - lastGazeTimeRef.current < minInterval) {
        return
      }
      
      lastGazeTimeRef.current = now

      // Normalize coordinates to [0,1] range
      const normalizedX = data.x / window.innerWidth
      const normalizedY = data.y / window.innerHeight

      // Create gaze point
      const gazePoint: GazePoint = {
        x: Math.max(0, Math.min(1, normalizedX)),
        y: Math.max(0, Math.min(1, normalizedY)),
        confidence: 0.8, // WebGazer doesn't provide confidence, use default
        timestamp: now
      }

      setState(prev => ({ 
        ...prev, 
        gazePoint,
        confidence: gazePoint.confidence
      }))

      // Call callback if confidence is sufficient
      if (gazePoint.confidence >= finalConfig.minConfidence) {
        finalConfig.onGazePoint?.(gazePoint)
      }
    }

    window.webgazer.setGazeListener(gazeListenerRef.current)
    setState(prev => ({ ...prev, isTracking: true }))
  }, [state.isInitialized, finalConfig])

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (window.webgazer) {
      window.webgazer.setGazeListener(() => {})
    }
    
    gazeListenerRef.current = null
    setState(prev => ({ ...prev, isTracking: false, gazePoint: null }))
  }, [])

  // End WebGazer session
  const end = useCallback(() => {
    if (window.webgazer) {
      window.webgazer.end()
    }
    
    setState(prev => ({ 
      ...prev, 
      isTracking: false, 
      isCalibrated: false,
      gazePoint: null 
    }))
  }, [])

  // Check if document is hidden (for offscreen detection)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && state.isTracking) {
        // Mark as offscreen
        setState(prev => ({ 
          ...prev, 
          gazePoint: prev.gazePoint ? { ...prev.gazePoint, confidence: 0 } : null
        }))
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [state.isTracking])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.webgazer) {
        window.webgazer.end()
      }
    }
  }, [])

  return {
    ...state,
    initialize,
    startTracking,
    stopTracking,
    end,
  }
}
