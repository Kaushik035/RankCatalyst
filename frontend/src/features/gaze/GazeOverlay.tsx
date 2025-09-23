/**
 * Gaze overlay HUD component.
 * 
 * Displays real-time gaze tracking information including:
 * - Crosshair showing current gaze position
 * - Confidence bar
 * - Attention state indicator
 * - Network status
 * - Performance metrics
 */
import React, { useState, useEffect } from 'react'
import { GazePoint } from './useWebGazer'

export interface AttentionState {
  kind: 'on_task' | 'inattention' | 'confusion' | 'fatigue' | 'unknown'
  score: number
  confidence: number
}

export interface NetworkStatus {
  type: 'ws' | 'rest' | 'offline'
  connected: boolean
  latency?: number
}

export interface GazeOverlayProps {
  gazePoint: GazePoint | null
  confidence: number
  attentionState: AttentionState
  networkStatus: NetworkStatus
  isTracking: boolean
  showOverlay: boolean
  onToggleOverlay: () => void
  fps?: number
  sampleRate?: number
}

export function GazeOverlay({
  gazePoint,
  confidence,
  attentionState,
  networkStatus,
  isTracking,
  showOverlay,
  onToggleOverlay,
  fps = 0,
  sampleRate = 0
}: GazeOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false)

  // Get attention state color
  const getAttentionColor = (kind: AttentionState['kind']) => {
    switch (kind) {
      case 'on_task': return 'text-green-500'
      case 'inattention': return 'text-red-500'
      case 'confusion': return 'text-yellow-500'
      case 'fatigue': return 'text-blue-500'
      default: return 'text-neutral-500'
    }
  }

  // Get network status color
  const getNetworkColor = (status: NetworkStatus) => {
    if (!status.connected) return 'text-red-500'
    switch (status.type) {
      case 'ws': return 'text-green-500'
      case 'rest': return 'text-yellow-500'
      case 'offline': return 'text-red-500'
      default: return 'text-neutral-500'
    }
  }

  // Get confidence color
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'text-green-500'
    if (conf >= 0.6) return 'text-yellow-500'
    return 'text-red-500'
  }

  if (!showOverlay) {
    return (
      <button
        onClick={onToggleOverlay}
        className="fixed top-4 right-4 z-40 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-white text-sm"
      >
        Show HUD
      </button>
    )
  }

  return (
    <>
      {/* Gaze crosshair */}
      {gazePoint && isTracking && (
        <div
          className="fixed pointer-events-none z-30"
          style={{
            left: `${gazePoint.x * 100}%`,
            top: `${gazePoint.y * 100}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="relative">
            {/* Horizontal line */}
            <div className="absolute w-8 h-0.5 bg-orange-500 opacity-80 -left-4 -top-0.5" />
            {/* Vertical line */}
            <div className="absolute w-0.5 h-8 bg-orange-500 opacity-80 -left-0.5 -top-4" />
            {/* Center dot */}
            <div className="w-2 h-2 bg-orange-500 rounded-full opacity-90" />
          </div>
        </div>
      )}

      {/* HUD Panel */}
      <div className={`fixed top-4 right-4 z-40 bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg transition-all duration-300 ${
        isMinimized ? 'w-12 h-12' : 'w-64'
      }`}>
        {isMinimized ? (
          <button
            onClick={() => setIsMinimized(false)}
            className="w-full h-full flex items-center justify-center text-white hover:bg-neutral-800 rounded-lg"
          >
            <div className="w-3 h-3 bg-orange-500 rounded-full" />
          </button>
        ) : (
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Gaze HUD</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={onToggleOverlay}
                  className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Status indicators */}
            <div className="space-y-2 text-xs">
              {/* Tracking status */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Tracking</span>
                <div className={`flex items-center gap-1 ${isTracking ? 'text-green-500' : 'text-red-500'}`}>
                  <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>{isTracking ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              {/* Confidence */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Confidence</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1 bg-neutral-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        confidence >= 0.8 ? 'bg-green-500' : 
                        confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${confidence * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs ${getConfidenceColor(confidence)}`}>
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
              </div>

              {/* Attention state */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Attention</span>
                <div className={`flex items-center gap-1 ${getAttentionColor(attentionState.kind)}`}>
                  <div className={`w-2 h-2 rounded-full ${
                    attentionState.kind === 'on_task' ? 'bg-green-500' :
                    attentionState.kind === 'inattention' ? 'bg-red-500' :
                    attentionState.kind === 'confusion' ? 'bg-yellow-500' :
                    attentionState.kind === 'fatigue' ? 'bg-blue-500' : 'bg-neutral-500'
                  }`} />
                  <span className="capitalize">{attentionState.kind.replace('_', ' ')}</span>
                  <span className="text-neutral-400">({Math.round(attentionState.score * 100)}%)</span>
                </div>
              </div>

              {/* Network status */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Network</span>
                <div className={`flex items-center gap-1 ${getNetworkColor(networkStatus)}`}>
                  <div className={`w-2 h-2 rounded-full ${
                    networkStatus.connected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="uppercase">{networkStatus.type}</span>
                  {networkStatus.latency && (
                    <span className="text-neutral-400">({networkStatus.latency}ms)</span>
                  )}
                </div>
              </div>

              {/* Performance metrics */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">FPS</span>
                <span className="text-white">{fps}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Rate</span>
                <span className="text-white">{sampleRate} Hz</span>
              </div>

              {/* Gaze coordinates */}
              {gazePoint && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Position</span>
                  <span className="text-white text-xs">
                    ({Math.round(gazePoint.x * 100)}%, {Math.round(gazePoint.y * 100)}%)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
