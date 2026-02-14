'use client'

import { useMemo, useEffect, useState } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ForexSessionData {
  name: string
  timezone: string
  openET: string
  closeET: string
  isOpen: boolean
}

export interface SessionOverlap {
  name: string
  sessions: string[]
  openET: string
  closeET: string
}

export interface ForexSessionsProps {
  sessions: ForexSessionData[]
  overlaps?: SessionOverlap[]
  className?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const SESSION_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  Sydney: {
    bg: 'bg-indigo-500/20',
    border: 'border-indigo-500/50',
    glow: 'shadow-indigo-500/30',
  },
  Tokyo: {
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/50',
    glow: 'shadow-rose-500/30',
  },
  London: {
    bg: 'bg-sky-500/20',
    border: 'border-sky-500/50',
    glow: 'shadow-sky-500/30',
  },
  'New York': {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/50',
    glow: 'shadow-emerald-500/30',
  },
}

const SESSION_DESCRIPTIONS: Record<string, string> = {
  Sydney: 'Low volatility, AUD/NZD pairs active. Sets the tone for Asian trading.',
  Tokyo: 'Moderate volatility, JPY pairs most active. BOJ decisions move markets.',
  London: 'Highest volume session. EUR/GBP pairs dominate. Major economic releases.',
  'New York': 'Second highest volume. USD pairs active. Fed events, NFP days.',
}

const HOURS_IN_DAY = 24
const TIMELINE_START = 0 // Midnight ET

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeToHours(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! + m! / 60
}

function formatTime12(time: string): string {
  const [h] = time.split(':').map(Number)
  const hour = h! % 12 || 12
  const ampm = h! < 12 ? 'AM' : 'PM'
  return `${hour}${ampm}`
}

/** Calculate the left position and width percentage for a session bar */
function getSessionBar(openET: string, closeET: string): { left: number; width: number } {
  const open = timeToHours(openET)
  const close = timeToHours(closeET)

  const left = (open / HOURS_IN_DAY) * 100

  let duration: number
  if (close > open) {
    duration = close - open
  } else {
    // Overnight session
    duration = HOURS_IN_DAY - open + close
  }

  const width = (duration / HOURS_IN_DAY) * 100
  return { left, width }
}

function getCurrentTimePosition(): number {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hours = et.getHours() + et.getMinutes() / 60
  return (hours / HOURS_IN_DAY) * 100
}

// ── Component ───────────────────────────────────────────────────────────────

export function ForexSessions({
  sessions,
  overlaps,
  className,
}: ForexSessionsProps) {
  const [currentTimePos, setCurrentTimePos] = useState(getCurrentTimePosition)

  // Update current time position every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimePos(getCurrentTimePosition())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const defaultOverlaps: SessionOverlap[] = useMemo(
    () =>
      overlaps ?? [
        { name: 'Tokyo-London', sessions: ['Tokyo', 'London'], openET: '03:00', closeET: '04:00' },
        { name: 'London-New York', sessions: ['London', 'New York'], openET: '08:00', closeET: '12:00' },
        { name: 'Sydney-Tokyo', sessions: ['Sydney', 'Tokyo'], openET: '19:00', closeET: '02:00' },
      ],
    [overlaps],
  )

  const hourMarkers = useMemo(
    () => Array.from({ length: HOURS_IN_DAY }, (_, i) => i),
    [],
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Timeline header */}
      <div className="rounded-lg border border-border bg-navy-dark p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Forex Trading Sessions (ET)
          </h3>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-trading-green" />
            <span className="text-[10px] text-text-muted">
              {sessions.filter((s) => s.isOpen).length} session{sessions.filter((s) => s.isOpen).length !== 1 ? 's' : ''} active
            </span>
          </div>
        </div>

        {/* Hour scale */}
        <div className="relative mb-1 h-4">
          {hourMarkers.map((h) => (
            <div
              key={h}
              className="absolute top-0 text-[8px] text-text-muted"
              style={{ left: `${(h / HOURS_IN_DAY) * 100}%`, transform: 'translateX(-50%)' }}
            >
              {h % 3 === 0 ? formatTime12(`${h}:00`) : ''}
            </div>
          ))}
        </div>

        {/* Session bars */}
        <div className="space-y-2">
          {sessions.map((session) => {
            const bar = getSessionBar(session.openET, session.closeET)
            const colors = SESSION_COLORS[session.name] ?? {
              bg: 'bg-gray-500/20',
              border: 'border-gray-500/50',
              glow: 'shadow-gray-500/30',
            }

            return (
              <div key={session.name} className="relative h-8">
                {/* Background rail */}
                <div className="absolute inset-0 rounded bg-navy-black/50" />

                {/* Session bar */}
                <div
                  className={cn(
                    'absolute inset-y-0 flex items-center rounded border px-2 transition-all',
                    colors.bg,
                    colors.border,
                    session.isOpen && `shadow-md ${colors.glow}`,
                  )}
                  style={{
                    left: `${bar.left}%`,
                    width: `${Math.min(bar.width, 100 - bar.left)}%`,
                  }}
                >
                  <span
                    className={cn(
                      'text-[10px] font-semibold',
                      session.isOpen ? 'text-text-primary' : 'text-text-muted',
                    )}
                  >
                    {session.name}
                  </span>
                </div>

                {/* Wrap-around bar for overnight sessions */}
                {bar.left + bar.width > 100 && (
                  <div
                    className={cn(
                      'absolute inset-y-0 flex items-center rounded border px-2',
                      colors.bg,
                      colors.border,
                      session.isOpen && `shadow-md ${colors.glow}`,
                    )}
                    style={{
                      left: '0%',
                      width: `${bar.left + bar.width - 100}%`,
                    }}
                  />
                )}

                {/* Current time marker */}
                <div
                  className="absolute top-0 h-full w-px bg-accent"
                  style={{ left: `${currentTimePos}%` }}
                />
              </div>
            )
          })}
        </div>

        {/* Current time marker label */}
        <div className="relative mt-1 h-4">
          <div
            className="absolute flex items-center gap-1"
            style={{ left: `${currentTimePos}%`, transform: 'translateX(-50%)' }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-[10px] font-medium text-accent">Now</span>
          </div>
        </div>
      </div>

      {/* Overlap zones */}
      <div className="rounded-lg border border-border bg-navy-dark p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-primary">
          Overlap Zones (High Volatility)
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {defaultOverlaps.map((overlap) => {
            // Check if overlap is currently active
            const isActive = sessions
              .filter((s) => overlap.sessions.includes(s.name))
              .every((s) => s.isOpen)

            return (
              <div
                key={overlap.name}
                className={cn(
                  'rounded-lg border px-3 py-2',
                  isActive
                    ? 'border-yellow-500/50 bg-yellow-500/10'
                    : 'border-border bg-navy-black/50',
                )}
              >
                <div className="flex items-center gap-2">
                  {isActive && (
                    <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
                  )}
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isActive ? 'text-yellow-500' : 'text-text-muted',
                    )}
                  >
                    {overlap.name}
                  </span>
                </div>
                <span className="font-mono text-[10px] tabular-nums text-text-muted">
                  {formatTime12(overlap.openET)} - {formatTime12(overlap.closeET)} ET
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Session details */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {sessions.map((session) => {
          const colors = SESSION_COLORS[session.name]
          const description = SESSION_DESCRIPTIONS[session.name]

          return (
            <div
              key={session.name}
              className={cn(
                'rounded-lg border p-3',
                session.isOpen
                  ? `${colors?.border ?? 'border-border'} ${colors?.bg ?? 'bg-navy-dark'}`
                  : 'border-border bg-navy-dark',
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">
                  {session.name}
                </span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-medium',
                    session.isOpen
                      ? 'bg-trading-green/20 text-trading-green'
                      : 'bg-text-muted/10 text-text-muted',
                  )}
                >
                  {session.isOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
              <div className="mb-1.5 font-mono text-[10px] tabular-nums text-text-muted">
                {formatTime12(session.openET)} - {formatTime12(session.closeET)} ET
              </div>
              {description && (
                <p className="text-[10px] leading-relaxed text-text-muted">
                  {description}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
