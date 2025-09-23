/**
 * Offline queue hook for gaze data.
 * 
 * Manages offline storage and queuing of gaze data when network is unavailable.
 * Uses IndexedDB for persistent storage and automatic flushing when back online.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { get, set, del, keys } from 'idb-keyval'

export interface OfflineQueueState {
  isOffline: boolean
  queue: any[]
  queueSize: number
  lastFlushTime: number
}

export interface OfflineQueueConfig {
  maxQueueSize?: number
  flushInterval?: number
  onFlush?: (items: any[]) => Promise<void>
  onError?: (error: string) => void
}

const DEFAULT_CONFIG: OfflineQueueConfig = {
  maxQueueSize: 1000,
  flushInterval: 5000,
}

const QUEUE_KEY = 'gaze-offline-queue'
const METADATA_KEY = 'gaze-queue-metadata'

export function useOfflineQueue(config: Partial<OfflineQueueConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  const [state, setState] = useState<OfflineQueueState>({
    isOffline: false,
    queue: [],
    queueSize: 0,
    lastFlushTime: 0,
  })

  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isFlushingRef = useRef<boolean>(false)

  // Check online status
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOffline: false }))
    }

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOffline: true }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check
    setState(prev => ({ ...prev, isOffline: !navigator.onLine }))

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load queue from IndexedDB on mount
  useEffect(() => {
    loadQueue()
  }, [])

  // Load queue from IndexedDB
  const loadQueue = useCallback(async () => {
    try {
      const [queueData, metadata] = await Promise.all([
        get(QUEUE_KEY),
        get(METADATA_KEY)
      ])

      if (queueData && Array.isArray(queueData)) {
        setState(prev => ({
          ...prev,
          queue: queueData,
          queueSize: queueData.length,
          lastFlushTime: metadata?.lastFlushTime || 0
        }))
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error)
      finalConfig.onError?.('Failed to load offline queue')
    }
  }, [finalConfig])

  // Save queue to IndexedDB
  const saveQueue = useCallback(async (queue: any[]) => {
    try {
      await set(QUEUE_KEY, queue)
      await set(METADATA_KEY, {
        lastFlushTime: Date.now(),
        queueSize: queue.length
      })
    } catch (error) {
      console.error('Failed to save offline queue:', error)
      finalConfig.onError?.('Failed to save offline queue')
    }
  }, [finalConfig])

  // Add item to queue
  const push = useCallback((item: any) => {
    setState(prev => {
      const newQueue = [...prev.queue, item]
      
      // Limit queue size
      if (newQueue.length > finalConfig.maxQueueSize!) {
        newQueue.splice(0, newQueue.length - finalConfig.maxQueueSize!)
      }

      // Save to IndexedDB
      saveQueue(newQueue)

      return {
        ...prev,
        queue: newQueue,
        queueSize: newQueue.length
      }
    })
  }, [finalConfig.maxQueueSize, saveQueue])

  // Flush queue
  const flush = useCallback(async () => {
    if (isFlushingRef.current || state.queue.length === 0) {
      return
    }

    isFlushingRef.current = true

    try {
      const itemsToFlush = [...state.queue]
      
      if (finalConfig.onFlush) {
        await finalConfig.onFlush(itemsToFlush)
      }

      // Clear queue after successful flush
      setState(prev => ({
        ...prev,
        queue: [],
        queueSize: 0,
        lastFlushTime: Date.now()
      }))

      await saveQueue([])
    } catch (error) {
      console.error('Failed to flush offline queue:', error)
      finalConfig.onError?.('Failed to flush offline queue')
    } finally {
      isFlushingRef.current = false
    }
  }, [state.queue, finalConfig, saveQueue])

  // Auto-flush when back online
  useEffect(() => {
    if (!state.isOffline && state.queue.length > 0) {
      flush()
    }
  }, [state.isOffline, state.queue.length, flush])

  // Auto-flush on interval
  useEffect(() => {
    if (state.isOffline || state.queue.length === 0) {
      return
    }

    flushTimeoutRef.current = setTimeout(() => {
      flush()
    }, finalConfig.flushInterval)

    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current)
      }
    }
  }, [state.isOffline, state.queue.length, finalConfig.flushInterval, flush])

  // Clear queue
  const clear = useCallback(async () => {
    setState(prev => ({
      ...prev,
      queue: [],
      queueSize: 0
    }))

    try {
      await del(QUEUE_KEY)
      await del(METADATA_KEY)
    } catch (error) {
      console.error('Failed to clear offline queue:', error)
      finalConfig.onError?.('Failed to clear offline queue')
    }
  }, [finalConfig])

  // Get queue statistics
  const getStats = useCallback(() => {
    return {
      queueSize: state.queueSize,
      isOffline: state.isOffline,
      lastFlushTime: state.lastFlushTime,
      oldestItem: state.queue.length > 0 ? state.queue[0] : null,
      newestItem: state.queue.length > 0 ? state.queue[state.queue.length - 1] : null
    }
  }, [state])

  return {
    ...state,
    push,
    flush,
    clear,
    getStats,
  }
}
