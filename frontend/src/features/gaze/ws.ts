/**
 * WebSocket hook for real-time communication.
 * 
 * Manages WebSocket connections with automatic reconnection,
 * keepalive, and message handling.
 */
import { useState, useEffect, useRef, useCallback } from 'react'

export interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  latency: number
}

export interface WebSocketMessage {
  type: string
  [key: string]: any
}

export interface WebSocketConfig {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  keepaliveInterval?: number
  onMessage?: (message: WebSocketMessage) => void
  onError?: (error: string) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

const DEFAULT_CONFIG: WebSocketConfig = {
  url: '',
  reconnectInterval: 1000,
  maxReconnectAttempts: 5,
  keepaliveInterval: 20000,
}

export function useWebSocket(config: Partial<WebSocketConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    latency: 0,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const keepaliveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef<number>(0)
  const pingTimeRef = useRef<number>(0)

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      const ws = new WebSocket(finalConfig.url)
      wsRef.current = ws

      ws.onopen = () => {
        setState(prev => ({ 
          ...prev, 
          isConnected: true, 
          isConnecting: false, 
          error: null 
        }))
        reconnectAttemptsRef.current = 0
        finalConfig.onConnect?.()
        
        // Start keepalive
        startKeepalive()
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          
          // Handle pong for latency calculation
          if (message.type === 'pong') {
            const latency = Date.now() - pingTimeRef.current
            setState(prev => ({ ...prev, latency }))
          }
          
          finalConfig.onMessage?.(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        setState(prev => ({ 
          ...prev, 
          isConnected: false, 
          isConnecting: false 
        }))
        finalConfig.onDisconnect?.()
        
        // Attempt reconnection if not a clean close
        if (event.code !== 1000 && reconnectAttemptsRef.current < finalConfig.maxReconnectAttempts!) {
          scheduleReconnect()
        }
      }

      ws.onerror = (error) => {
        const errorMessage = 'WebSocket connection error'
        setState(prev => ({ 
          ...prev, 
          error: errorMessage, 
          isConnecting: false 
        }))
        finalConfig.onError?.(errorMessage)
      }

    } catch (error) {
      const errorMessage = 'Failed to create WebSocket connection'
      setState(prev => ({ 
        ...prev, 
        error: errorMessage, 
        isConnecting: false 
      }))
      finalConfig.onError?.(errorMessage)
    }
  }, [finalConfig])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (keepaliveTimeoutRef.current) {
      clearTimeout(keepaliveTimeoutRef.current)
      keepaliveTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect')
      wsRef.current = null
    }

    setState(prev => ({ 
      ...prev, 
      isConnected: false, 
      isConnecting: false 
    }))
  }, [])

  // Send message
  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected')
    }
  }, [])

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    reconnectAttemptsRef.current++
    const delay = Math.min(
      finalConfig.reconnectInterval! * Math.pow(2, reconnectAttemptsRef.current - 1),
      30000 // Max 30 seconds
    )

    reconnectTimeoutRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [connect, finalConfig.reconnectInterval])

  // Start keepalive
  const startKeepalive = useCallback(() => {
    if (keepaliveTimeoutRef.current) {
      clearTimeout(keepaliveTimeoutRef.current)
    }

    keepaliveTimeoutRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        pingTimeRef.current = Date.now()
        send({ type: 'ping' })
        startKeepalive()
      }
    }, finalConfig.keepaliveInterval)
  }, [send, finalConfig.keepaliveInterval])

  // Auto-connect on mount
  useEffect(() => {
    if (finalConfig.url) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [finalConfig.url, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    ...state,
    connect,
    disconnect,
    send,
  }
}
