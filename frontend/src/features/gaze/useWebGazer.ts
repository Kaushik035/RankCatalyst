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

  // Initialize WebGazer with camera permission
  const initialize = useCallback(async (): Promise<boolean> => {
    if (!window.webgazer || isInitializingRef.current) {
      return false
    }

    isInitializingRef.current = true
    setState(prev => ({ ...prev, error: null }))

    try {
      console.log('Initializing WebGazer with camera access...')
      
      // First, explicitly request camera permission
      console.log('Requesting camera permission explicitly...')
      console.log('Navigator.mediaDevices available:', !!navigator.mediaDevices)
      console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia)
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          } 
        })
        
        console.log('Camera permission granted, stream received')
        // Stop the stream as WebGazer will create its own
        stream.getTracks().forEach(track => track.stop())
        
        console.log('Setting hasPermission to true before WebGazer initialization')
        setState(prev => ({ 
          ...prev, 
          hasPermission: true
        }))
      } catch (permissionError) {
        console.log('Camera permission request failed:', permissionError)
        throw permissionError
      }
      
      // Now initialize WebGazer
      console.log('Initializing WebGazer...')
      try {
        await window.webgazer.begin()
        console.log('WebGazer.begin() completed successfully')
      } catch (webgazerError) {
        console.log('WebGazer.begin() failed:', webgazerError)
        throw webgazerError
      }
      
      // Configure WebGazer (enable for debugging)
      window.webgazer.showVideoPreview(true)  // Show camera feed
      window.webgazer.showPredictionPoints(true)  // Show gaze cursor

      console.log('Setting isInitialized to true')
      setState(prev => ({ 
        ...prev, 
        isInitialized: true
      }))
      
      console.log('WebGazer initialized successfully with camera access')
      return true
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.log('WebGazer initialization error:', errorMessage)
      
      let userFriendlyMessage = 'Failed to initialize WebGazer.'
      if (errorMessage.includes('Permission denied') || errorMessage.includes('denied')) {
        userFriendlyMessage = 'Camera access has been denied. Please allow camera access in your browser settings and refresh the page.'
      } else if (errorMessage.includes('NotFoundError')) {
        userFriendlyMessage = 'No camera found. Please connect a camera and try again.'
      } else if (errorMessage.includes('NotAllowedError')) {
        userFriendlyMessage = 'Camera access was blocked. Please allow camera access and try again.'
      }
      
      setState(prev => ({ 
        ...prev, 
        error: userFriendlyMessage,
        hasPermission: false
      }))
      finalConfig.onError?.(userFriendlyMessage)
      return false
    } finally {
      isInitializingRef.current = false
    }
  }, [finalConfig])


  // Start tracking
  const startTracking = useCallback(() => {
    console.log('startTracking called, webgazer:', !!window.webgazer, 'isInitialized:', state.isInitialized)
    if (!window.webgazer || !state.isInitialized) {
      console.log('Cannot start tracking - missing webgazer or not initialized')
      return
    }

    // Set up gaze listener
    gazeListenerRef.current = (data: { x: number; y: number }) => {
      const now = Date.now()
      
      console.log('🎯 WebGazer gaze data received:', data)
      
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

    console.log('Setting up gaze listener...')
    window.webgazer.setGazeListener(gazeListenerRef.current)
    console.log('Gaze listener set, updating state to tracking=true')
    
    // Test if gaze listener is working
    setTimeout(() => {
      console.log('🔍 Testing gaze listener after 2 seconds...')
      console.log('WebGazer ready:', window.webgazer.isReady())
      console.log('Gaze listener set:', !!gazeListenerRef.current)
      
      // Check if WebGazer has any error messages
      try {
        const videoElement = window.webgazer.getVideoElement()
        console.log('Video element:', videoElement)
        if (videoElement) {
          console.log('Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight)
          console.log('Video playing:', !videoElement.paused)
        }
      } catch (error) {
        console.log('Error checking video element:', error)
      }
      
      // If no gaze data after 5 seconds, try to force WebGazer to start
      setTimeout(() => {
        console.log('🚨 No gaze data received after 5 seconds, checking WebGazer status...')
        console.log('WebGazer ready:', window.webgazer.isReady())
        console.log('Attempting to restart WebGazer...')
        
        // Try to restart WebGazer
        try {
          window.webgazer.end()
          setTimeout(() => {
            window.webgazer.begin().then(() => {
              console.log('WebGazer restarted successfully')
              if (gazeListenerRef.current) {
                window.webgazer.setGazeListener(gazeListenerRef.current)
              }
            }).catch((error) => {
              console.log('Failed to restart WebGazer:', error)
            })
          }, 1000)
        } catch (error) {
          console.log('Error restarting WebGazer:', error)
        }
      }, 3000)
    }, 2000)
    
    // Check WebGazer's internal state
    console.log('WebGazer state check:')
    console.log('- isReady:', window.webgazer.isReady())
    console.log('- isCalibrated:', (window.webgazer as any).isCalibrated?.())
    console.log('- isTracking:', (window.webgazer as any).isTracking?.())
    
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
    try {
      if (window.webgazer) {
        window.webgazer.end()
      }
    } catch (error) {
      console.log('Error during WebGazer end:', error)
      // Continue with state update even if end() fails
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

  // Monitor face detection when tracking
  useEffect(() => {
    if (!state.isTracking) return

    const faceCheckInterval = setInterval(() => {
      if (window.webgazer && window.webgazer.isReady()) {
        try {
          // Check if WebGazer can detect faces
          const faceDetector = (window.webgazer as any).getFaceDetector?.()
          const faceDetected = faceDetector?.isDetecting?.()
          console.log('Face detection status:', faceDetected)
        } catch (error) {
          console.log('Face detection check failed:', error)
        }
      }
    }, 3000) // Check every 3 seconds

    return () => clearInterval(faceCheckInterval)
  }, [state.isTracking])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (window.webgazer) {
          window.webgazer.end()
        }
      } catch (error) {
        console.log('Error during WebGazer cleanup:', error)
        // Ignore cleanup errors
      }
    }
  }, [])

  // Reset WebGazer state
  const reset = useCallback(() => {
    try {
      if (window.webgazer) {
        console.log('Calling WebGazer.end()...')
        window.webgazer.end()
        console.log('WebGazer.end() completed')
      }
    } catch (error) {
      console.log('Error calling WebGazer.end():', error)
      // Continue with reset even if end() fails
    }
    
    setState(prev => ({
      ...prev,
      isInitialized: false,
      hasPermission: false,
      isTracking: false,
      error: null
    }))
    
    console.log('WebGazer state reset completed')
  }, [])

  return {
    ...state,
    initialize,
    reset,
    startTracking,
    stopTracking,
    end,
  }
}
