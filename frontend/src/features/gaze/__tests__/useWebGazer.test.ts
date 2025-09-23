/**
 * Tests for useWebGazer hook.
 */
import { renderHook, act } from '@testing-library/react'
import { useWebGazer } from '../useWebGazer'

// Mock WebGazer
const mockWebGazer = {
  begin: jest.fn().mockResolvedValue(undefined),
  end: jest.fn(),
  showVideoPreview: jest.fn().mockReturnThis(),
  showPredictionPoints: jest.fn().mockReturnThis(),
  setGazeListener: jest.fn(),
  isReady: jest.fn().mockReturnValue(true),
  getVideoElement: jest.fn().mockReturnValue(null)
}

// Mock global WebGazer
Object.defineProperty(window, 'webgazer', {
  value: mockWebGazer,
  writable: true
})

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    })
  },
  writable: true
})

describe('useWebGazer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWebGazer())

    expect(result.current.isInitialized).toBe(false)
    expect(result.current.isCalibrated).toBe(false)
    expect(result.current.isTracking).toBe(false)
    expect(result.current.hasPermission).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.confidence).toBe(0)
    expect(result.current.gazePoint).toBe(null)
  })

  it('should initialize WebGazer when initialize is called', async () => {
    const { result } = renderHook(() => useWebGazer())

    await act(async () => {
      await result.current.initialize()
    })

    expect(mockWebGazer.begin).toHaveBeenCalled()
    expect(mockWebGazer.showVideoPreview).toHaveBeenCalledWith(false)
    expect(mockWebGazer.showPredictionPoints).toHaveBeenCalledWith(false)
    expect(result.current.isInitialized).toBe(true)
    expect(result.current.hasPermission).toBe(true)
  })

  it('should handle camera permission denial', async () => {
    const mockGetUserMedia = jest.fn().mockRejectedValue(new Error('Permission denied'))
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true
    })

    const { result } = renderHook(() => useWebGazer())

    await act(async () => {
      await result.current.initialize()
    })

    expect(result.current.hasPermission).toBe(false)
    expect(result.current.error).toContain('Camera permission denied')
  })

  it('should start and stop tracking', async () => {
    const { result } = renderHook(() => useWebGazer())

    // Initialize first
    await act(async () => {
      await result.current.initialize()
    })

    // Start tracking
    act(() => {
      result.current.startTracking()
    })

    expect(mockWebGazer.setGazeListener).toHaveBeenCalled()
    expect(result.current.isTracking).toBe(true)

    // Stop tracking
    act(() => {
      result.current.stopTracking()
    })

    expect(result.current.isTracking).toBe(false)
  })

  it('should end WebGazer session', async () => {
    const { result } = renderHook(() => useWebGazer())

    // Initialize first
    await act(async () => {
      await result.current.initialize()
    })

    // End session
    act(() => {
      result.current.end()
    })

    expect(mockWebGazer.end).toHaveBeenCalled()
    expect(result.current.isTracking).toBe(false)
    expect(result.current.isCalibrated).toBe(false)
  })

  it('should handle gaze point updates', async () => {
    const onGazePoint = jest.fn()
    const { result } = renderHook(() => useWebGazer({ onGazePoint }))

    // Initialize and start tracking
    await act(async () => {
      await result.current.initialize()
    })

    act(() => {
      result.current.startTracking()
    })

    // Simulate gaze listener callback
    const gazeListener = mockWebGazer.setGazeListener.mock.calls[0][0]
    act(() => {
      gazeListener({ x: 100, y: 200 })
    })

    expect(result.current.gazePoint).toBeDefined()
    expect(result.current.gazePoint?.x).toBeCloseTo(100 / window.innerWidth)
    expect(result.current.gazePoint?.y).toBeCloseTo(200 / window.innerHeight)
  })

  it('should filter low confidence gaze points', async () => {
    const onGazePoint = jest.fn()
    const { result } = renderHook(() => useWebGazer({ 
      onGazePoint, 
      minConfidence: 0.8 
    }))

    // Initialize and start tracking
    await act(async () => {
      await result.current.initialize()
    })

    act(() => {
      result.current.startTracking()
    })

    // Simulate gaze listener callback with low confidence
    const gazeListener = mockWebGazer.setGazeListener.mock.calls[0][0]
    act(() => {
      gazeListener({ x: 100, y: 200 })
    })

    // Should not call onGazePoint for low confidence
    expect(onGazePoint).not.toHaveBeenCalled()
  })
})
