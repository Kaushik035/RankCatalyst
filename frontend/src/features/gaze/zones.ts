/**
 * Zone detection utility for gaze tracking.
 * 
 * Detects UI zones based on DOM elements with data-zone attributes.
 * Caches bounding rectangles for performance and invalidates on resize/scroll.
 */
import { useCallback, useEffect, useState } from 'react'

export interface Zone {
  id: string
  name: string
  bounds: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
  element: HTMLElement
}

export interface ZoneDetectionState {
  zones: Zone[]
  isReady: boolean
  lastUpdate: number
}

// Cache for zone bounds
const zoneCache = new Map<string, Zone>()
let lastCacheUpdate = 0
const CACHE_TTL = 1000 // 1 second

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

// Detect zones from DOM
export function detectZones(): Zone[] {
  const zones: Zone[] = []
  const elements = document.querySelectorAll('[data-zone]')
  
  elements.forEach((element) => {
    if (element instanceof HTMLElement) {
      const zoneName = element.dataset.zone
      if (!zoneName) return
      
      const rect = element.getBoundingClientRect()
      const zone: Zone = {
        id: `${zoneName}-${element.id || Math.random().toString(36).substr(2, 9)}`,
        name: zoneName,
        bounds: {
          x1: rect.left / window.innerWidth,
          y1: rect.top / window.innerHeight,
          x2: rect.right / window.innerWidth,
          y2: rect.bottom / window.innerHeight,
        },
        element
      }
      
      zones.push(zone)
    }
  })
  
  return zones
}

// Get zone at coordinates
export function getZoneAt(x: number, y: number, zones: Zone[]): Zone | null {
  for (const zone of zones) {
    if (
      x >= zone.bounds.x1 &&
      x <= zone.bounds.x2 &&
      y >= zone.bounds.y1 &&
      y <= zone.bounds.y2
    ) {
      return zone
    }
  }
  
  return null
}

// Check if coordinates are offscreen
export function isOffscreen(x: number, y: number): boolean {
  return x < 0 || x > 1 || y < 0 || y > 1
}

// Check if document is hidden
export function isDocumentHidden(): boolean {
  return document.visibilityState === 'hidden'
}

// Hook for zone detection
export function useZoneDetection() {
  const [state, setState] = useState<ZoneDetectionState>({
    zones: [],
    isReady: false,
    lastUpdate: 0,
  })

  const updateZones = useCallback(() => {
    const zones = detectZones()
    const now = Date.now()
    
    setState(prev => ({
      ...prev,
      zones,
      isReady: true,
      lastUpdate: now
    }))
    
    // Update cache
    zoneCache.clear()
    zones.forEach(zone => {
      zoneCache.set(zone.id, zone)
    })
    lastCacheUpdate = now
  }, [])

  // Debounced update function
  const debouncedUpdate = useCallback(
    debounce(updateZones, 100),
    [updateZones]
  )

  // Update zones on mount
  useEffect(() => {
    updateZones()
  }, [updateZones])

  // Update zones on resize and scroll
  useEffect(() => {
    const handleResize = () => debouncedUpdate()
    const handleScroll = () => debouncedUpdate()
    
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [debouncedUpdate])

  // Update zones when DOM changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      debouncedUpdate()
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-zone']
    })
    
    return () => {
      observer.disconnect()
    }
  }, [debouncedUpdate])

  return {
    ...state,
    updateZones,
    getZoneAt: (x: number, y: number) => getZoneAt(x, y, state.zones),
    isOffscreen,
    isDocumentHidden,
  }
}

// Utility function to get zone from coordinates
export function getZoneFromCoordinates(
  x: number, 
  y: number, 
  zones: Zone[]
): string | null {
  // Check if offscreen
  if (isOffscreen(x, y)) {
    return 'offscreen'
  }
  
  // Check if document is hidden
  if (isDocumentHidden()) {
    return 'offscreen'
  }
  
  // Find zone
  const zone = getZoneAt(x, y, zones)
  return zone ? zone.name : 'other'
}

// Utility function to get cached zone
export function getCachedZone(x: number, y: number): string | null {
  const now = Date.now()
  
  // Check cache validity
  if (now - lastCacheUpdate > CACHE_TTL) {
    return null
  }
  
  // Find zone in cache
  for (const zone of zoneCache.values()) {
    if (
      x >= zone.bounds.x1 &&
      x <= zone.bounds.x2 &&
      y >= zone.bounds.y1 &&
      y <= zone.bounds.y2
    ) {
      return zone.name
    }
  }
  
  return null
}

// Utility function to clear zone cache
export function clearZoneCache(): void {
  zoneCache.clear()
  lastCacheUpdate = 0
}
