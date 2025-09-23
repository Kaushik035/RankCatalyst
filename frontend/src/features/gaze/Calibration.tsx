/**
 * Calibration component for WebGazer gaze tracking.
 * 
 * Implements a 9-point calibration grid with dwell time requirements.
 * Each point requires 500ms of dwell at sufficient confidence.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { GazePoint } from './useWebGazer'

export interface CalibrationPoint {
  id: number
  x: number
  y: number
  completed: boolean
  dwellTime: number
  requiredDwellTime: number
}

export interface CalibrationResult {
  points: CalibrationPoint[]
  isComplete: boolean
  accuracy: number
}

interface CalibrationProps {
  onComplete: (result: CalibrationResult) => void
  onCancel: () => void
  gazePoint: GazePoint | null
  isTracking: boolean
}

const CALIBRATION_POINTS = [
  { id: 1, x: 0.2, y: 0.2 },   // Top-left
  { id: 2, x: 0.5, y: 0.2 },   // Top-center
  { id: 3, x: 0.8, y: 0.2 },   // Top-right
  { id: 4, x: 0.2, y: 0.5 },   // Middle-left
  { id: 5, x: 0.5, y: 0.5 },   // Center
  { id: 6, x: 0.8, y: 0.5 },   // Middle-right
  { id: 7, x: 0.2, y: 0.8 },   // Bottom-left
  { id: 8, x: 0.5, y: 0.8 },   // Bottom-center
  { id: 9, x: 0.8, y: 0.8 },   // Bottom-right
]

const REQUIRED_DWELL_TIME = 500 // milliseconds
const DWELL_THRESHOLD = 0.1 // distance threshold for dwell detection

export function Calibration({ onComplete, onCancel, gazePoint, isTracking }: CalibrationProps) {
  const [currentPointIndex, setCurrentPointIndex] = useState(0)
  const [points, setPoints] = useState<CalibrationPoint[]>(
    CALIBRATION_POINTS.map(point => ({
      ...point,
      completed: false,
      dwellTime: 0,
      requiredDwellTime: REQUIRED_DWELL_TIME
    }))
  )
  const [isActive, setIsActive] = useState(false)
  const [dwellStartTime, setDwellStartTime] = useState<number | null>(null)

  const currentPoint = points[currentPointIndex]

  // Start calibration when tracking begins
  useEffect(() => {
    if (isTracking && !isActive) {
      setIsActive(true)
      setCurrentPointIndex(0)
    }
  }, [isTracking, isActive])

  // Handle gaze point updates
  useEffect(() => {
    if (!isActive || !gazePoint || !currentPoint) {
      return
    }

    const distance = Math.sqrt(
      Math.pow(gazePoint.x - currentPoint.x, 2) + 
      Math.pow(gazePoint.y - currentPoint.y, 2)
    )

    // Check if gaze is within threshold
    if (distance <= DWELL_THRESHOLD && gazePoint.confidence >= 0.6) {
      if (dwellStartTime === null) {
        setDwellStartTime(Date.now())
      } else {
        const dwellTime = Date.now() - dwellStartTime
        setPoints(prev => prev.map(point => 
          point.id === currentPoint.id 
            ? { ...point, dwellTime }
            : point
        ))

        // Check if dwell time is sufficient
        if (dwellTime >= REQUIRED_DWELL_TIME) {
          // Mark point as completed
          setPoints(prev => prev.map(point => 
            point.id === currentPoint.id 
              ? { ...point, completed: true, dwellTime }
              : point
          ))

          // Move to next point
          if (currentPointIndex < CALIBRATION_POINTS.length - 1) {
            setCurrentPointIndex(prev => prev + 1)
            setDwellStartTime(null)
          } else {
            // Calibration complete
            const completedPoints = points.filter(p => p.completed)
            const accuracy = completedPoints.length / CALIBRATION_POINTS.length
            
            onComplete({
              points: points.map(p => ({ ...p, completed: p.id <= currentPoint.id })),
              isComplete: true,
              accuracy
            })
          }
        }
      }
    } else {
      // Reset dwell timer if gaze moves away
      setDwellStartTime(null)
      setPoints(prev => prev.map(point => 
        point.id === currentPoint.id 
          ? { ...point, dwellTime: 0 }
          : point
      ))
    }
  }, [gazePoint, currentPoint, isActive, dwellStartTime, currentPointIndex, onComplete, points])

  // Calculate progress
  const progress = (currentPointIndex + (currentPoint?.completed ? 1 : 0)) / CALIBRATION_POINTS.length

  if (!isActive) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-neutral-900 rounded-lg p-8 max-w-md mx-4">
          <h2 className="text-xl font-semibold mb-4">Gaze Calibration</h2>
          <p className="text-neutral-300 mb-6">
            Look at each point for 500ms to calibrate your gaze tracking.
            Make sure you're in good lighting and your face is visible.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setIsActive(true)}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded"
            >
              Start Calibration
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="relative w-full h-full">
        {/* Progress bar */}
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="bg-neutral-800 rounded-full h-2">
            <div 
              className="bg-brand-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="text-white text-sm mt-2">
            Point {currentPointIndex + 1} of {CALIBRATION_POINTS.length}
          </p>
        </div>

        {/* Calibration points */}
        {CALIBRATION_POINTS.map((point, index) => {
          const pointData = points.find(p => p.id === point.id)
          const isCurrent = index === currentPointIndex
          const isCompleted = pointData?.completed || false
          const isUpcoming = index > currentPointIndex

          return (
            <div
              key={point.id}
              className={`absolute w-4 h-4 rounded-full transition-all duration-300 ${
                isCurrent 
                  ? 'bg-orange-500 shadow-lg shadow-orange-500/50 scale-150' 
                  : isCompleted 
                    ? 'bg-green-500' 
                    : isUpcoming 
                      ? 'bg-neutral-600' 
                      : 'bg-neutral-500'
              }`}
              style={{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {/* Dwell progress ring */}
              {isCurrent && pointData && (
                <div className="absolute inset-0 rounded-full border-2 border-white opacity-50">
                  <div 
                    className="absolute inset-0 rounded-full border-2 border-white transition-all duration-100"
                    style={{
                      clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos((pointData.dwellTime / REQUIRED_DWELL_TIME) * 2 * Math.PI - Math.PI/2)}% ${50 + 50 * Math.sin((pointData.dwellTime / REQUIRED_DWELL_TIME) * 2 * Math.PI - Math.PI/2)}%)`
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 right-4 text-center">
          <p className="text-white text-lg">
            {currentPoint && !currentPoint.completed 
              ? `Look at the orange dot for ${Math.ceil((REQUIRED_DWELL_TIME - (currentPoint.dwellTime || 0)) / 1000)}s`
              : 'Calibration complete!'
            }
          </p>
        </div>

        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
