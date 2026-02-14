'use client'

import { useState, useMemo } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CurrencyStrengthData {
  currency: string
  /** Normalized strength 0-100 */
  strength: number
  /** Change from previous period */
  change: number
}

export type StrengthPeriod = '1D' | '1W' | '1M'

export interface CurrencyStrengthMeterProps {
  data: CurrencyStrengthData[]
  period?: StrengthPeriod
  onPeriodChange?: (period: StrengthPeriod) => void
  isLoading?: boolean
  className?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const PERIODS: { value: StrengthPeriod; label: string }[] = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
]

/** Map a 0-100 strength value to a color class */
function getStrengthColor(strength: number): string {
  if (strength >= 80) return 'bg-trading-green'
  if (strength >= 65) return 'bg-emerald-500'
  if (strength >= 50) return 'bg-yellow-500'
  if (strength >= 35) return 'bg-orange-500'
  if (strength >= 20) return 'bg-trading-red'
  return 'bg-red-700'
}

function getStrengthTextColor(strength: number): string {
  if (strength >= 65) return 'text-trading-green'
  if (strength >= 35) return 'text-yellow-500'
  return 'text-trading-red'
}

/** Currency flag emoji/label mapping */
const CURRENCY_FLAGS: Record<string, string> = {
  USD: 'US',
  EUR: 'EU',
  GBP: 'GB',
  JPY: 'JP',
  AUD: 'AU',
  CAD: 'CA',
  CHF: 'CH',
  NZD: 'NZ',
}

// ── Component ───────────────────────────────────────────────────────────────

export function CurrencyStrengthMeter({
  data,
  period = '1D',
  onPeriodChange,
  isLoading = false,
  className,
}: CurrencyStrengthMeterProps) {
  const [sortBy, setSortBy] = useState<'strength' | 'name'>('strength')

  const sorted = useMemo(() => {
    const clone = [...data]
    if (sortBy === 'strength') {
      clone.sort((a, b) => b.strength - a.strength)
    } else {
      clone.sort((a, b) => a.currency.localeCompare(b.currency))
    }
    return clone
  }, [data, sortBy])

  return (
    <div className={cn('rounded-lg border border-border bg-navy-dark', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Currency Strength
          </h3>
          <button
            type="button"
            onClick={() => setSortBy(sortBy === 'strength' ? 'name' : 'strength')}
            className="text-[10px] text-text-muted hover:text-text-secondary"
          >
            Sort: {sortBy === 'strength' ? 'Strength' : 'A-Z'}
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-0 rounded border border-border">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPeriodChange?.(p.value)}
              className={cn(
                'px-2 py-1 text-[10px] font-medium transition-colors',
                period === p.value
                  ? 'bg-accent text-text-primary'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bars */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-text-muted">Calculating strength...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item) => (
              <div key={item.currency} className="group">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">
                      {CURRENCY_FLAGS[item.currency] ?? ''}
                    </span>
                    <span className="font-mono text-xs font-semibold text-text-primary">
                      {item.currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Change indicator */}
                    <span
                      className={cn(
                        'font-mono text-[10px] tabular-nums',
                        item.change > 0
                          ? 'text-trading-green'
                          : item.change < 0
                            ? 'text-trading-red'
                            : 'text-text-muted',
                      )}
                    >
                      {item.change > 0 ? '+' : ''}
                      {item.change.toFixed(1)}
                    </span>
                    {/* Strength value */}
                    <span
                      className={cn(
                        'font-mono text-xs font-semibold tabular-nums',
                        getStrengthTextColor(item.strength),
                      )}
                    >
                      {item.strength.toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Strength bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-navy-black">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      getStrengthColor(item.strength),
                    )}
                    style={{ width: `${item.strength}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
