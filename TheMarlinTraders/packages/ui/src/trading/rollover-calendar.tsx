'use client'

import { useState, useMemo } from 'react'
import { cn } from '../lib/utils.js'
import type { RolloverCalendar as RolloverCalendarData, RolloverEntry } from '@marlin/shared'

// ── Types ────────────────────────────────────────────────────────────────────

export interface RolloverCalendarProps {
  calendars: RolloverCalendarData[]
  isLoading?: boolean
  onContractClick?: (symbol: string, month: string) => void
  className?: string
}

type ViewMode = 'calendar' | 'list'

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  const diffMs = target.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function getUrgencyColor(daysLeft: number): {
  dot: string
  text: string
  bg: string
  label: string
} {
  if (daysLeft <= 5) {
    return { dot: 'bg-trading-red', text: 'text-trading-red', bg: 'bg-trading-red/10', label: 'Imminent' }
  }
  if (daysLeft <= 15) {
    return { dot: 'bg-yellow-500', text: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Approaching' }
  }
  return { dot: 'bg-trading-green', text: 'text-trading-green', bg: 'bg-trading-green/10', label: 'Safe' }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMonthYear(month: string): string {
  if (month.length !== 6) return month
  const year = month.slice(0, 4)
  const m = parseInt(month.slice(4), 10)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m - 1]} ${year}`
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`
  return vol.toString()
}

// ── Flattened Entry ─────────────────────────────────────────────────────────

interface FlatEntry {
  symbol: string
  entry: RolloverEntry
  daysToRollover: number
}

// ── Calendar Grid View ──────────────────────────────────────────────────────

function CalendarGridView({
  calendars,
  onContractClick,
}: {
  calendars: RolloverCalendarData[]
  onContractClick?: (symbol: string, month: string) => void
}) {
  return (
    <div className="space-y-4">
      {calendars.map((cal) => (
        <div key={cal.symbol} className="rounded-lg border border-border bg-navy-dark">
          <div className="border-b border-border px-4 py-2">
            <span className="font-mono text-sm font-semibold text-text-primary">{cal.symbol}</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4">
            {cal.contracts.map((entry) => {
              const days = daysUntil(entry.lastTradingDate)
              const urgency = getUrgencyColor(days)

              return (
                <div
                  key={entry.month}
                  role="button"
                  tabIndex={0}
                  onClick={() => onContractClick?.(cal.symbol, entry.month)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onContractClick?.(cal.symbol, entry.month)
                  }}
                  className="cursor-pointer bg-navy-dark p-3 transition-colors hover:bg-navy-mid"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', urgency.dot)} />
                    <span className="font-mono text-xs font-semibold text-text-primary">
                      {formatMonthYear(entry.month)}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Last Trade:</span>
                      <span className="font-mono tabular-nums text-text-secondary">
                        {formatDate(entry.lastTradingDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">1st Notice:</span>
                      <span className="font-mono tabular-nums text-text-secondary">
                        {formatDate(entry.firstNoticeDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Days Left:</span>
                      <span className={cn('font-mono font-semibold tabular-nums', urgency.text)}>
                        {days > 0 ? days : 'Expired'}
                      </span>
                    </div>
                    {entry.volume > 0 && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Volume:</span>
                        <span className="font-mono tabular-nums text-text-secondary">
                          {formatVolume(entry.volume)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── List View ───────────────────────────────────────────────────────────────

function ListSortedView({
  entries,
  onContractClick,
}: {
  entries: FlatEntry[]
  onContractClick?: (symbol: string, month: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-navy-dark">
            <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Status
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Symbol
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Contract
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Days to Rollover
            </th>
            <th className="hidden px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted sm:table-cell">
              Last Trade Date
            </th>
            <th className="hidden px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted md:table-cell">
              1st Notice
            </th>
            <th className="hidden px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted lg:table-cell">
              Volume
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const urgency = getUrgencyColor(entry.daysToRollover)

            return (
              <tr
                key={`${entry.symbol}-${entry.entry.month}`}
                role="button"
                tabIndex={0}
                onClick={() => onContractClick?.(entry.symbol, entry.entry.month)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onContractClick?.(entry.symbol, entry.entry.month)
                }}
                className="cursor-pointer border-b border-border transition-colors hover:bg-navy-mid"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className={cn('h-2.5 w-2.5 rounded-full', urgency.dot)} />
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        urgency.bg,
                        urgency.text,
                      )}
                    >
                      {urgency.label}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs font-semibold text-text-primary">
                    {entry.symbol}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs text-text-secondary">
                    {formatMonthYear(entry.entry.month)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={cn('font-mono text-xs font-semibold tabular-nums', urgency.text)}>
                    {entry.daysToRollover > 0 ? entry.daysToRollover : 'Expired'}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                  <span className="font-mono text-xs tabular-nums text-text-muted">
                    {formatDate(entry.entry.lastTradingDate)}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 text-right md:table-cell">
                  <span className="font-mono text-xs tabular-nums text-text-muted">
                    {formatDate(entry.entry.firstNoticeDate)}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 text-right lg:table-cell">
                  <span className="font-mono text-xs tabular-nums text-text-muted">
                    {entry.entry.volume > 0 ? formatVolume(entry.entry.volume) : '-'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {entries.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-text-muted">No upcoming rollovers</span>
        </div>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function RolloverCalendar({
  calendars,
  isLoading = false,
  onContractClick,
  className,
}: RolloverCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Flatten and sort by nearest rollover for list view
  const sortedEntries = useMemo(() => {
    const flat: FlatEntry[] = []
    for (const cal of calendars) {
      for (const entry of cal.contracts) {
        flat.push({
          symbol: cal.symbol,
          entry,
          daysToRollover: daysUntil(entry.lastTradingDate),
        })
      }
    }
    return flat
      .filter((e) => e.daysToRollover > -7) // Include recently expired
      .sort((a, b) => a.daysToRollover - b.daysToRollover)
  }, [calendars])

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-16', className)}>
        <span className="text-sm text-text-muted">Loading rollover calendar...</span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-muted">View:</span>
        {(['list', 'calendar'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={cn(
              'rounded px-2.5 py-1 text-xs transition-colors',
              viewMode === mode
                ? 'bg-accent text-text-primary'
                : 'text-text-muted hover:bg-navy-light hover:text-text-secondary',
            )}
          >
            {mode === 'list' ? 'List' : 'Calendar'}
          </button>
        ))}

        {/* Summary stats */}
        <div className="ml-auto flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-trading-red" />
            <span className="text-text-muted">
              {sortedEntries.filter((e) => e.daysToRollover <= 5 && e.daysToRollover > 0).length} imminent
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="text-text-muted">
              {sortedEntries.filter((e) => e.daysToRollover > 5 && e.daysToRollover <= 15).length} approaching
            </span>
          </div>
        </div>
      </div>

      {/* View content */}
      {viewMode === 'list' ? (
        <ListSortedView entries={sortedEntries} onContractClick={onContractClick} />
      ) : (
        <CalendarGridView calendars={calendars} onContractClick={onContractClick} />
      )}
    </div>
  )
}
