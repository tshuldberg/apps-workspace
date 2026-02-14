'use client'

import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface EarningsEventData {
  id: string
  symbol: string
  companyName: string
  reportDate: string | Date
  quarter: string
  estimatedEps?: string | null
  actualEps?: string | null
  estimatedRevenue?: string | null
  actualRevenue?: string | null
}

export interface EarningsCalendarProps {
  events: EarningsEventData[]
  isLoading?: boolean
  onSymbolClick?: (symbol: string) => void
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  className?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function getMarketTiming(date: string | Date): 'BMO' | 'AMC' {
  const d = typeof date === 'string' ? new Date(date) : date
  // Before 12:00 PM = Before Market Open, after = After Market Close
  return d.getHours() < 12 ? 'BMO' : 'AMC'
}

function formatRevenue(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
  if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  return `$${num.toFixed(2)}`
}

// ── Component ───────────────────────────────────────────────────────────────

export function EarningsCalendar({
  events,
  isLoading = false,
  onSymbolClick,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
}: EarningsCalendarProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-text-muted">From</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="h-8 rounded border border-border bg-navy-dark px-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <label className="text-xs text-text-muted">To</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="h-8 rounded border border-border bg-navy-dark px-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <span className="text-xs text-text-muted">
          {events.length} {events.length === 1 ? 'report' : 'reports'}
        </span>
      </div>

      {/* Earnings list */}
      {events.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-navy-dark">
                <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  Date
                </th>
                <th className="hidden px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted sm:table-cell">
                  Timing
                </th>
                <th className="hidden px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted sm:table-cell">
                  Quarter
                </th>
                <th className="hidden px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted md:table-cell">
                  Est. EPS
                </th>
                <th className="hidden px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted md:table-cell">
                  Act. EPS
                </th>
                <th className="hidden px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted lg:table-cell">
                  Est. Revenue
                </th>
                <th className="hidden px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted lg:table-cell">
                  Act. Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const timing = getMarketTiming(event.reportDate)
                const epsMatch =
                  event.actualEps && event.estimatedEps
                    ? parseFloat(event.actualEps) >= parseFloat(event.estimatedEps)
                    : null
                const revMatch =
                  event.actualRevenue && event.estimatedRevenue
                    ? parseFloat(event.actualRevenue) >= parseFloat(event.estimatedRevenue)
                    : null

                return (
                  <tr
                    key={event.id}
                    className="border-b border-border transition-colors hover:bg-navy-mid"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => onSymbolClick?.(event.symbol)}
                          className="font-mono text-sm font-semibold text-accent hover:underline"
                        >
                          {event.symbol}
                        </button>
                        <span className="text-xs text-text-muted">
                          {event.companyName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-secondary">
                        {formatDate(event.reportDate)}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          timing === 'BMO'
                            ? 'bg-yellow-500/15 text-yellow-500'
                            : 'bg-accent/15 text-accent',
                        )}
                      >
                        {timing === 'BMO' ? 'Before Open' : 'After Close'}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="text-xs text-text-muted">{event.quarter}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-right md:table-cell">
                      <span className="font-mono text-xs tabular-nums text-text-muted">
                        {event.estimatedEps ? `$${event.estimatedEps}` : '--'}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right md:table-cell">
                      <span
                        className={cn(
                          'font-mono text-xs font-semibold tabular-nums',
                          epsMatch === true
                            ? 'text-trading-green'
                            : epsMatch === false
                              ? 'text-trading-red'
                              : 'text-text-muted',
                        )}
                      >
                        {event.actualEps ? `$${event.actualEps}` : '--'}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right lg:table-cell">
                      <span className="font-mono text-xs tabular-nums text-text-muted">
                        {event.estimatedRevenue
                          ? formatRevenue(event.estimatedRevenue)
                          : '--'}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right lg:table-cell">
                      <span
                        className={cn(
                          'font-mono text-xs font-semibold tabular-nums',
                          revMatch === true
                            ? 'text-trading-green'
                            : revMatch === false
                              ? 'text-trading-red'
                              : 'text-text-muted',
                        )}
                      >
                        {event.actualRevenue
                          ? formatRevenue(event.actualRevenue)
                          : '--'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <span className="text-sm text-text-muted">
            {isLoading ? 'Loading earnings events...' : 'No earnings reports in this range'}
          </span>
        </div>
      )}
    </div>
  )
}
