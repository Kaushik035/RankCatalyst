/**
 * Session detail component for viewing individual session analytics.
 * 
 * Displays comprehensive session data including timeline charts,
 * attention events, interventions, and export functionality.
 */
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export interface SessionDetail {
  id: string
  startedAt: string
  endedAt?: string
  duration: number
  totalSamples: number
  avgConfidence: number
  attentionEvents: AttentionEvent[]
  interventions: Intervention[]
  timeline: TimelineData[]
  summary: SessionSummary
}

export interface AttentionEvent {
  id: string
  tsMs: number
  kind: 'on_task' | 'inattention' | 'confusion' | 'fatigue'
  score: number
  meta: Record<string, any>
}

export interface Intervention {
  id: string
  tsMs: number
  type: string
  reason: Record<string, any>
  appliedBy: string
}

export interface TimelineData {
  timestamp: number
  confidence: number
  attention: string
  intervention?: string
}

export interface SessionSummary {
  sessionDurationMs: number
  totalGazeSamples: number
  totalEvents: number
  totalInterventions: number
  eventTypes: Record<string, number>
  interventionTypes: Record<string, number>
}

export function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'events' | 'interventions'>('overview')

  // Load session data
  useEffect(() => {
    if (sessionId) {
      loadSessionData(sessionId)
    }
  }, [sessionId])

  const loadSessionData = async (id: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/attention/sessions/${id}/timeline/?downsampleMs=1000`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.statusText}`)
      }

      const data = await response.json()
      setSession(data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }

  // Export session data
  const exportSession = () => {
    if (!session) return

    const exportData = {
      sessionId: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      duration: session.duration,
      summary: session.summary,
      attentionEvents: session.attentionEvents,
      interventions: session.interventions
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session-${session.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Format timestamp
  const formatTimestamp = (tsMs: number) => {
    const date = new Date(tsMs)
    return date.toLocaleTimeString()
  }

  // Get event color
  const getEventColor = (kind: string) => {
    switch (kind) {
      case 'on_task': return '#10b981'
      case 'inattention': return '#ef4444'
      case 'confusion': return '#f59e0b'
      case 'fatigue': return '#3b82f6'
      default: return '#6b7280'
    }
  }

  // Get intervention color
  const getInterventionColor = (type: string) => {
    switch (type) {
      case 'show_hint': return '#8b5cf6'
      case 'simplify': return '#06b6d4'
      case 'increase_difficulty': return '#f97316'
      case 'focus_nudge': return '#84cc16'
      case 'break_suggestion': return '#ec4899'
      default: return '#6b7280'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-neutral-300">Loading session details...</p>
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="p-8">
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4">
          <h3 className="text-red-400 font-medium mb-2">Error Loading Session</h3>
          <p className="text-red-300 text-sm">{error || 'Session not found'}</p>
          <Link
            to="/attention/sessions"
            className="inline-block mt-3 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Back to Sessions
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Session Details</h2>
          <p className="text-neutral-400 text-sm">
            {session.id} • {new Date(session.startedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportSession}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded"
          >
            Export Data
          </button>
          <Link
            to="/attention/sessions"
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded"
          >
            Back to Sessions
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <h3 className="text-sm text-neutral-400 mb-1">Duration</h3>
          <p className="text-xl font-semibold">
            {Math.floor(session.duration / 1000 / 60)}m {Math.floor((session.duration / 1000) % 60)}s
          </p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <h3 className="text-sm text-neutral-400 mb-1">Gaze Samples</h3>
          <p className="text-xl font-semibold">{session.totalSamples.toLocaleString()}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <h3 className="text-sm text-neutral-400 mb-1">Avg Confidence</h3>
          <p className="text-xl font-semibold">{Math.round(session.avgConfidence * 100)}%</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <h3 className="text-sm text-neutral-400 mb-1">Interventions</h3>
          <p className="text-xl font-semibold">{session.interventions.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-800 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'timeline', label: 'Timeline' },
            { id: 'events', label: 'Events' },
            { id: 'interventions', label: 'Interventions' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Event Types Chart */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Attention Events</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={Object.entries(session.summary.eventTypes).map(([type, count]) => ({ type, count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="type" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Intervention Types Chart */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Interventions</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={Object.entries(session.summary.interventionTypes).map(([type, count]) => ({ type, count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="type" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">Timeline</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={session.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp" 
                stroke="#9ca3af"
                tickFormatter={formatTimestamp}
              />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              <Line type="monotone" dataKey="confidence" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-4">
          {session.attentionEvents.map((event) => (
            <div
              key={event.id}
              className="bg-neutral-900 border border-neutral-800 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getEventColor(event.kind) }}
                  />
                  <span className="font-medium capitalize">{event.kind.replace('_', ' ')}</span>
                  <span className="text-sm text-neutral-400">
                    {formatTimestamp(event.tsMs)}
                  </span>
                </div>
                <span className="text-sm text-neutral-400">
                  Score: {Math.round(event.score * 100)}%
                </span>
              </div>
              {Object.keys(event.meta).length > 0 && (
                <div className="mt-2 text-sm text-neutral-300">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(event.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'interventions' && (
        <div className="space-y-4">
          {session.interventions.map((intervention) => (
            <div
              key={intervention.id}
              className="bg-neutral-900 border border-neutral-800 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getInterventionColor(intervention.type) }}
                  />
                  <span className="font-medium capitalize">{intervention.type.replace('_', ' ')}</span>
                  <span className="text-sm text-neutral-400">
                    {formatTimestamp(intervention.tsMs)}
                  </span>
                </div>
                <span className="text-sm text-neutral-400">
                  By: {intervention.appliedBy}
                </span>
              </div>
              <div className="mt-2 text-sm text-neutral-300">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(intervention.reason, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
