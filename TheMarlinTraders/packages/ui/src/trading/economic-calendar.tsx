'use client'

import { useMemo } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface EconomicEventData {
  id: string
  name: string
  description?: string | null
  eventDate: string | Date
  impact: 'low' | 'medium' | 'high'
  actual?: string | null
  forecast?: string | null
  previous?: string | null
  country: string
}

export interface EconomicCalendarProps {
  events: EconomicEventData[]
  isLoading?: boolean
  className?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getDateKey(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

function getGroupLabel(dateKey: string): string {
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = tomorrow.toISOString().slice(0, 10)

  if (dateKey === todayKey) return 'Today'
  if (dateKey === tomorrowKey) return 'Tomorrow'

  const d = new Date(dateKey + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getCountdown(date: string | Date): string | null {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diffMs = d.getTime() - now

  if (diffMs <= 0) return null

  const diffMin = Math.floor(diffMs / (1000 * 60))
  const diffHr = Math.floor(diffMin / 60)
  const remainMin = diffMin % 60

  if (diffHr > 24) return null
  if (diffHr > 0) return `${diffHr}h ${remainMin}m`
  return `${remainMin}m`
}

function isWithinNextHour(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diffMs = d.getTime() - now
  return diffMs > 0 && diffMs <= 3600000
}

const IMPACT_COLORS: Record<string, { dot: string; bg: string }> = {
  high: { dot: 'bg-trading-red', bg: 'bg-trading-red/10' },
  medium: { dot: 'bg-yellow-500', bg: 'bg-yellow-500/10' },
  low: { dot: 'bg-trading-green', bg: 'bg-trading-green/10' },
}

// ── Component ───────────────────────────────────────────────────────────────

export function EconomicCalendar({
  events,
  isLoading = false,
  className,
}: EconomicCalendarProps) {
  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, EconomicEventData[]>()
    for (const event of events) {
      const key = getDateKey(event.eventDate)
      const existing = groups.get(key) ?? []
      existing.push(event)
      groups.set(key, existing)
    }
    // Sort by date key
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [events])

  return (
    <div className={cn('space-y-6', className)}>
      {groupedEvents.length > 0 ? (
        groupedEvents.map(([dateKey, dayEvents]) => (
          <div key={dateKey}>
            {/* Date group header */}
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                {getGroupLabel(dateKey)}
              </h3>
              <div className="flex-1 border-t border-border" />
              <span className="font-mono text-[10px] tabular-nums text-text-muted">
                {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
              </span>
            </div>

            {/* Events table */}
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-navy-dark">
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Time
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Impact
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Event
                    </th>
                    <th className="hidden px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted sm:table-cell">
                      Actual
                    </th>
                    <th className="hidden px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted sm:table-cell">
                      Forecast
                    </th>
                    <th className="hidden px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted md:table-cell">
                      Previous
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dayEvents.map((event) => {
                    const countdown = getCountdown(event.eventDate)
                    const upcoming = isWithinNextHour(event.eventDate)
                    const colors = IMPACT_COLORS[event.impact] ?? IMPACT_COLORS.low!

                    return (
                      <tr
                        key={event.id}
                        className={cn(
                          'border-b border-border transition-colors',
                          upcoming && 'bg-accent/5',
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs tabular-nums text-text-secondary">
                              {formatTime(event.eventDate)}
                            </span>
                            {countdown && (
                              <span
                                className={cn(
                                  'font-mono text-[10px] tabular-nums',
                                  upcoming ? 'text-accent font-semibold' : 'text-text-muted',
                                )}
                              >
                                in {countdown}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div
                              className={cn('h-2.5 w-2.5 rounded-full', colors.dot)}
                            />
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[10px] font-medium capitalize',
                                colors.bg,
                                event.impact === 'high'
                                  ? 'text-trading-red'
                                  : event.impact === 'medium'
                                    ? 'text-yellow-500'
                                    : 'text-trading-green',
                              )}
                            >
                              {event.impact}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-text-muted">
                              {event.country}
                            </span>
                            <span className="text-sm text-text-primary">
                              {event.name}
                            </span>
                          </div>
                        </td>
                        <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                          <span
                            className={cn(
                              'font-mono text-xs tabular-nums',
                              event.actual
                                ? 'font-semibold text-text-primary'
                                : 'text-text-muted',
                            )}
                          >
                            {event.actual ?? '--'}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                          <span className="font-mono text-xs tabular-nums text-text-muted">
                            {event.forecast ?? '--'}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2.5 text-right md:table-cell">
                          <span className="font-mono text-xs tabular-nums text-text-muted">
                            {event.previous ?? '--'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <span className="text-sm text-text-muted">
            {isLoading ? 'Loading economic events...' : 'No economic events in this range'}
          </span>
        </div>
      )}
    </div>
  )
}
