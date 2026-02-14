'use client'

import { useMemo } from 'react'
import { cn } from '../lib/utils.js'

export interface DayPnL {
  date: string // YYYY-MM-DD
  pnl: number
  tradeCount: number
}

export interface CalendarHeatmapProps {
  data: DayPnL[]
  weeks?: number
  onDayClick?: (date: string) => void
  className?: string
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getIntensityClass(pnl: number, maxAbs: number): string {
  if (pnl === 0 || maxAbs === 0) return 'bg-border'
  const ratio = Math.abs(pnl) / maxAbs
  if (pnl > 0) {
    if (ratio > 0.75) return 'bg-trading-green'
    if (ratio > 0.5) return 'bg-trading-green/75'
    if (ratio > 0.25) return 'bg-trading-green/50'
    return 'bg-trading-green/25'
  } else {
    if (ratio > 0.75) return 'bg-trading-red'
    if (ratio > 0.5) return 'bg-trading-red/75'
    if (ratio > 0.25) return 'bg-trading-red/50'
    return 'bg-trading-red/25'
  }
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export function CalendarHeatmap({ data, weeks = 26, onDayClick, className }: CalendarHeatmapProps) {
  const { grid, monthLabels, maxAbs } = useMemo(() => {
    const pnlMap = new Map<string, DayPnL>()
    let maxAbsVal = 0
    for (const d of data) {
      pnlMap.set(d.date, d)
      maxAbsVal = Math.max(maxAbsVal, Math.abs(d.pnl))
    }

    // Build grid: weeks x 7 days
    const today = new Date()
    const endDay = new Date(today)
    endDay.setDate(endDay.getDate() - endDay.getDay() + 6) // End of current week (Saturday)
    const startDay = new Date(endDay)
    startDay.setDate(startDay.getDate() - (weeks * 7) + 1)

    const gridData: (DayPnL | null)[][] = []
    const months: { label: string; col: number }[] = []
    let lastMonth = -1

    const cursor = new Date(startDay)
    for (let week = 0; week < weeks; week++) {
      const weekCol: (DayPnL | null)[] = []
      for (let day = 0; day < 7; day++) {
        if (cursor > today) {
          weekCol.push(null)
        } else {
          const key = cursor.toISOString().slice(0, 10)
          weekCol.push(pnlMap.get(key) ?? { date: key, pnl: 0, tradeCount: 0 })
        }

        if (cursor.getMonth() !== lastMonth && cursor <= today) {
          lastMonth = cursor.getMonth()
          months.push({ label: MONTH_NAMES[lastMonth], col: week })
        }

        cursor.setDate(cursor.getDate() + 1)
      }
      gridData.push(weekCol)
    }

    return { grid: gridData, monthLabels: months, maxAbs: maxAbsVal }
  }, [data, weeks])

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Month labels */}
      <div className="flex" style={{ paddingLeft: 28 }}>
        {monthLabels.map((m, i) => (
          <span
            key={`${m.label}-${i}`}
            className="text-[10px] text-text-muted"
            style={{
              position: 'relative',
              left: m.col * 14,
              width: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {m.label}
          </span>
        ))}
      </div>

      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5" style={{ width: 24 }}>
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="flex h-[12px] items-center">
              <span className="text-[10px] text-text-muted">{label}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-0.5">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                <div
                  key={`${wi}-${di}`}
                  className={cn(
                    'h-[12px] w-[12px] rounded-sm transition-colors',
                    day === null
                      ? 'bg-transparent'
                      : getIntensityClass(day.pnl, maxAbs),
                    day !== null && day.tradeCount > 0 && 'cursor-pointer hover:ring-1 hover:ring-text-muted',
                  )}
                  title={
                    day
                      ? `${day.date}: ${formatCurrency(day.pnl)} (${day.tradeCount} trade${day.tradeCount !== 1 ? 's' : ''})`
                      : undefined
                  }
                  onClick={() => day && day.tradeCount > 0 && onDayClick?.(day.date)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 self-end">
        <span className="text-[10px] text-text-muted">Loss</span>
        <div className="h-[10px] w-[10px] rounded-sm bg-trading-red" />
        <div className="h-[10px] w-[10px] rounded-sm bg-trading-red/50" />
        <div className="h-[10px] w-[10px] rounded-sm bg-border" />
        <div className="h-[10px] w-[10px] rounded-sm bg-trading-green/50" />
        <div className="h-[10px] w-[10px] rounded-sm bg-trading-green" />
        <span className="text-[10px] text-text-muted">Profit</span>
      </div>
    </div>
  )
}
