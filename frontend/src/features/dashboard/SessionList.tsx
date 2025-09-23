/**
 * Session list component for the attention dashboard.
 * 
 * Displays a list of user's attention tracking sessions with
 * basic statistics and navigation to detailed views.
 */
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export interface SessionSummary {
  id: string
  startedAt: string
  endedAt?: string
  duration: number
  totalSamples: number
  avgConfidence: number
  attentionEvents: number
  interventions: number
  lessonId?: string
  lessonTitle?: string
}

export interface SessionListProps {
  onSessionSelect?: (sessionId: string) => void
}

export function SessionList({ onSessionSelect }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'recent' | 'completed'>('all')
  const [sortBy, setSortBy] = useState<'startedAt' | 'duration' | 'confidence'>('startedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Load sessions
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/attention/sessions/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to load sessions: ${response.statusText}`)
      }

      const data = await response.json()
      setSessions(data.results || data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    switch (filter) {
      case 'recent':
        return Date.now() - new Date(session.startedAt).getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
      case 'completed':
        return session.endedAt !== undefined
      default:
        return true
    }
  })

  // Sort sessions
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    let aValue: any, bValue: any

    switch (sortBy) {
      case 'startedAt':
        aValue = new Date(a.startedAt).getTime()
        bValue = new Date(b.startedAt).getTime()
        break
      case 'duration':
        aValue = a.duration
        bValue = b.duration
        break
      case 'confidence':
        aValue = a.avgConfidence
        bValue = b.avgConfidence
        break
      default:
        return 0
    }

    if (sortOrder === 'asc') {
      return aValue - bValue
    } else {
      return bValue - aValue
    }
  })

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500'
    if (confidence >= 0.6) return 'text-yellow-500'
    return 'text-red-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-neutral-300">Loading sessions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4">
          <h3 className="text-red-400 font-medium mb-2">Error Loading Sessions</h3>
          <p className="text-red-300 text-sm">{error}</p>
          <button
            onClick={loadSessions}
            className="mt-3 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Attention Sessions</h2>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm"
          >
            <option value="all">All Sessions</option>
            <option value="recent">Recent (7 days)</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm"
          >
            <option value="startedAt">Start Time</option>
            <option value="duration">Duration</option>
            <option value="confidence">Confidence</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm hover:bg-neutral-700"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {sortedSessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-400 mb-4">No sessions found</p>
          <Link
            to="/attention/session"
            className="inline-block px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded"
          >
            Start New Session
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedSessions.map((session) => (
            <div
              key={session.id}
              className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium">
                      {session.lessonTitle || 'Untitled Session'}
                    </h3>
                    <span className="text-xs text-neutral-400">
                      {session.id.slice(0, 8)}
                    </span>
                    {!session.endedAt && (
                      <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded">
                        Active
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-neutral-400">Started:</span>
                      <p className="text-white">{formatDate(session.startedAt)}</p>
                    </div>
                    <div>
                      <span className="text-neutral-400">Duration:</span>
                      <p className="text-white">{formatDuration(session.duration)}</p>
                    </div>
                    <div>
                      <span className="text-neutral-400">Confidence:</span>
                      <p className={getConfidenceColor(session.avgConfidence)}>
                        {Math.round(session.avgConfidence * 100)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-neutral-400">Events:</span>
                      <p className="text-white">
                        {session.attentionEvents} events, {session.interventions} interventions
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Link
                    to={`/attention/sessions/${session.id}`}
                    className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-sm"
                  >
                    View Details
                  </Link>
                  {onSessionSelect && (
                    <button
                      onClick={() => onSessionSelect(session.id)}
                      className="px-3 py-1 bg-brand-600 hover:bg-brand-700 rounded text-sm"
                    >
                      Select
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
