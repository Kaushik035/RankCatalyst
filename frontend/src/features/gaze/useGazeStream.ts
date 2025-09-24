/**
 * Gaze streaming hook for real-time data transmission.
 * 
 * Manages gaze data sampling, batching, and transmission to the backend.
 * Handles offline queuing, WebSocket fallback, and rate limiting.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { GazePoint } from './useWebGazer'
import { useWebSocket } from './ws'
import { useOfflineQueue } from './offlineQueue'
import { useAuthStore } from '@/features/auth/store'

export interface GazeStreamConfig {
  maxSampleRate: number
  batchInterval: number
  maxBatchSize: number
  sessionId: string
  onError?: (error: string) => void
}

export interface GazeStreamState {
  isStreaming: boolean
  sampleCount: number
  batchCount: number
  droppedSamples: number
  networkStatus: 'ws' | 'rest' | 'offline'
  latency: number
  fps: number
}

const DEFAULT_CONFIG: GazeStreamConfig = {
  maxSampleRate: 60,
  batchInterval: 300,
  maxBatchSize: 512,
  sessionId: '',
}

export function useGazeStream(config: Partial<GazeStreamConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const { accessToken } = useAuthStore()
  
  const [state, setState] = useState<GazeStreamState>({
    isStreaming: false,
    sampleCount: 0,
    batchCount: 0,
    droppedSamples: 0,
    networkStatus: 'offline',
    latency: 0,
    fps: 0,
  })

  const batchRef = useRef<GazePoint[]>([])
  const lastBatchTimeRef = useRef<number>(0)
  const fpsCounterRef = useRef<number>(0)
  const fpsTimeRef = useRef<number>(Date.now())
  const clientTimebaseRef = useRef<number>(Date.now())

  // WebSocket connection
  const { 
    isConnected: wsConnected, 
    send: wsSend, 
    latency: wsLatency 
  } = useWebSocket(`ws://localhost:8000/ws/gaze/${finalConfig.sessionId}/`)

  // Offline queue for fallback
  const { 
    isOffline, 
    queue: offlineQueue, 
    flush: flushOfflineQueue 
  } = useOfflineQueue()

  // Update network status
  useEffect(() => {
    if (wsConnected && !isOffline) {
      setState(prev => ({ 
        ...prev, 
        networkStatus: 'ws',
        latency: wsLatency 
      }))
    } else if (!isOffline) {
      setState(prev => ({ 
        ...prev, 
        networkStatus: 'rest',
        latency: 0 
      }))
    } else {
      setState(prev => ({ 
        ...prev, 
        networkStatus: 'offline',
        latency: 0 
      }))
    }
  }, [wsConnected, isOffline, wsLatency])

  // FPS calculation
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const timeDiff = now - fpsTimeRef.current
      
      if (timeDiff >= 1000) {
        const fps = (fpsCounterRef.current * 1000) / timeDiff
        setState(prev => ({ ...prev, fps: Math.round(fps) }))
        
        fpsCounterRef.current = 0
        fpsTimeRef.current = now
      }
    }, 100)

    return () => clearInterval(interval)
  }, [])

  // Process gaze point
  const processGazePoint = useCallback((gazePoint: GazePoint) => {
    if (!state.isStreaming) return

    // Rate limiting
    const now = Date.now()
    const timeSinceLastSample = now - lastBatchTimeRef.current
    const minInterval = 1000 / finalConfig.maxSampleRate

    if (timeSinceLastSample < minInterval) {
      setState(prev => ({ ...prev, droppedSamples: prev.droppedSamples + 1 }))
      return
    }

    lastBatchTimeRef.current = now
    fpsCounterRef.current++

    // Add to batch
    batchRef.current.push(gazePoint)
    setState(prev => ({ ...prev, sampleCount: prev.sampleCount + 1 }))

    // Check if batch is ready
    const timeSinceLastBatch = now - (lastBatchTimeRef.current || 0)
    const shouldFlush = 
      batchRef.current.length >= finalConfig.maxBatchSize ||
      timeSinceLastBatch >= finalConfig.batchInterval

    if (shouldFlush) {
      flushBatch()
    }
  }, [state.isStreaming, finalConfig])

  // Flush batch to backend
  const flushBatch = useCallback(async () => {
    if (batchRef.current.length === 0) return

    const batch = [...batchRef.current]
    batchRef.current = []

    // Prepare batch data
    const batchData = {
      clientTimebaseMs: clientTimebaseRef.current,
      samples: batch.map(point => ({
        t: point.timestamp - clientTimebaseRef.current,
        x: point.x,
        y: point.y,
        c: point.confidence,
        zone: detectZone(point.x, point.y)
      }))
    }

    try {
      if (wsConnected && !isOffline) {
        // Send via WebSocket
        wsSend({
          type: 'gaze_samples',
          clientTimebaseMs: batchData.clientTimebaseMs,
          samples: batchData.samples
        })
      } else if (!isOffline) {
        // Send via REST API
        await sendBatchViaREST(batchData)
      } else {
        // Queue for offline
        offlineQueue.push(batchData)
      }

      setState(prev => ({ ...prev, batchCount: prev.batchCount + 1 }))
    } catch (error) {
      console.error('Failed to send batch:', error)
      // Fallback to offline queue
      offlineQueue.push(batchData)
    }
  }, [wsConnected, isOffline, wsSend, offlineQueue, finalConfig.sessionId])

  // Send batch via REST API
  const sendBatchViaREST = useCallback(async (batchData: any) => {
    const response = await fetch(`http://localhost:8000/api/attention/sessions/${finalConfig.sessionId}/gaze-batch/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(batchData)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }, [finalConfig.sessionId, accessToken])

  // Start streaming
  const startStreaming = useCallback(() => {
    setState(prev => ({ ...prev, isStreaming: true }))
    clientTimebaseRef.current = Date.now()
    lastBatchTimeRef.current = Date.now()
  }, [])

  // Stop streaming
  const stopStreaming = useCallback(() => {
    setState(prev => ({ ...prev, isStreaming: false }))
    
    // Flush remaining batch
    if (batchRef.current.length > 0) {
      flushBatch()
    }
  }, [flushBatch])

  // Flush offline queue when back online
  useEffect(() => {
    if (!isOffline && offlineQueue.length > 0) {
      flushOfflineQueue()
    }
  }, [isOffline, offlineQueue.length, flushOfflineQueue])

  // Auto-flush batch on interval
  useEffect(() => {
    if (!state.isStreaming) return

    const interval = setInterval(() => {
      if (batchRef.current.length > 0) {
        // Call flushBatch directly without dependency issues
        const batch = [...batchRef.current]
        batchRef.current = []

        // Prepare batch data
        const batchData = {
          clientTimebaseMs: clientTimebaseRef.current,
          samples: batch.map(point => ({
            t: point.timestamp - clientTimebaseRef.current,
            x: point.x,
            y: point.y,
            c: point.confidence,
            zone: detectZone(point.x, point.y)
          }))
        }

        // Send batch (simplified to avoid dependency issues)
        if (wsConnected && !isOffline) {
          wsSend({
            type: 'gaze_samples',
            clientTimebaseMs: batchData.clientTimebaseMs,
            samples: batchData.samples
          })
        } else if (!isOffline) {
          // Send via REST API
          fetch(`http://localhost:8000/api/attention/sessions/${finalConfig.sessionId}/gaze-batch/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
              'Idempotency-Key': crypto.randomUUID()
            },
            body: JSON.stringify(batchData)
          }).catch(error => {
            console.error('Failed to send batch:', error)
            // Fallback to offline queue
            offlineQueue.push(batchData)
          })
        } else {
          // Queue for offline
          offlineQueue.push(batchData)
        }

        setState(prev => ({ ...prev, batchCount: prev.batchCount + 1 }))
      }
    }, finalConfig.batchInterval)

    return () => clearInterval(interval)
  }, [state.isStreaming, finalConfig.batchInterval, wsConnected, isOffline, wsSend, offlineQueue, finalConfig.sessionId, accessToken])

  return {
    ...state,
    processGazePoint,
    startStreaming,
    stopStreaming,
  }
}

// Simple zone detection based on coordinates
function detectZone(x: number, y: number): string {
  // This is a simplified zone detection
  // In practice, you'd use DOM element detection
  if (y < 0.3) return 'navigation'
  if (y > 0.7) return 'options'
  if (x < 0.3 || x > 0.7) return 'other'
  return 'question'
}
