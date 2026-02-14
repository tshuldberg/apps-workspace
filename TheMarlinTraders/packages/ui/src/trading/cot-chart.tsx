'use client'

import { useState, useMemo } from 'react'
import { cn } from '../lib/utils.js'
import type { COTData } from '@marlin/shared'

// ── Types ────────────────────────────────────────────────────────────────────

export interface COTChartProps {
  data: COTData[]
  cotIndex: number
  symbol: string
  isLoading?: boolean
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  className?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ── COT Index Gauge ─────────────────────────────────────────────────────────

function COTIndexGauge({ value, className }: { value: number; className?: string }) {
  const clamped = clamp(value, 0, 100)
  const color = clamped >= 70 ? 'text-trading-green' : clamped <= 30 ? 'text-trading-red' : 'text-yellow-400'
  const label = clamped >= 70 ? 'Bullish' : clamped <= 30 ? 'Bearish' : 'Neutral'
  const barWidth = `${clamped}%`

  return (
    <div className={cn('rounded-lg border border-border bg-navy-dark p-4', className)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">COT Index (52-week)</span>
        <span className={cn('font-mono text-lg font-bold tabular-nums', color)}>
          {clamped.toFixed(0)}
        </span>
      </div>
      {/* Bar */}
      <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-navy-mid">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            clamped >= 70 ? 'bg-trading-green' : clamped <= 30 ? 'bg-trading-red' : 'bg-yellow-400',
          )}
          style={{ width: barWidth }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>Bearish</span>
        <span className={cn('font-medium', color)}>{label}</span>
        <span>Bullish</span>
      </div>
    </div>
  )
}

// ── Position Breakdown Tooltip ──────────────────────────────────────────────

function PositionTooltip({
  data,
  className,
}: {
  data: COTData
  className?: string
}) {
  const commercialNet = data.commercialLong - data.commercialShort
  const nonCommercialNet = data.nonCommercialLong - data.nonCommercialShort
  const nonReportableNet = data.nonReportableLong - data.nonReportableShort

  return (
    <div className={cn('rounded border border-border bg-navy-dark p-3 text-xs', className)}>
      <div className="mb-2 font-mono text-[10px] text-text-muted">
        {formatDate(data.reportDate)}
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-[10px] text-text-muted">
            <th className="pb-1 text-left font-medium">Category</th>
            <th className="pb-1 text-right font-medium">Long</th>
            <th className="pb-1 text-right font-medium">Short</th>
            <th className="pb-1 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-0.5 text-blue-400">Commercial</td>
            <td className="py-0.5 text-right font-mono tabular-nums text-text-secondary">
              {formatNumber(data.commercialLong)}
            </td>
            <td className="py-0.5 text-right font-mono tabular-nums text-text-secondary">
              {formatNumber(data.commercialShort)}
            </td>
            <td className={cn('py-0.5 text-right font-mono tabular-nums', commercialNet >= 0 ? 'text-trading-green' : 'text-trading-red')}>
              {formatNumber(commercialNet)}
            </td>
          </tr>
          <tr>
            <td className="py-0.5 text-orange-400">Non-Commercial</td>
            <td className="py-0.5 text-right font-mono tabular-nums text-text-secondary">
              {formatNumber(data.nonCommercialLong)}
            </td>
            <td className="py-0.5 text-right font-mono tabular-nums text-text-secondary">
              {formatNumber(data.nonCommercialShort)}
            </td>
            <td className={cn('py-0.5 text-right font-mono tabular-nums', nonCommercialNet >= 0 ? 'text-trading-green' : 'text-trading-red')}>
              {formatNumber(nonCommercialNet)}
            </td>
          </tr>
          <tr>
            <td className="py-0.5 text-gray-400">Non-Reportable</td>
            <td className="py-0.5 text-right font-mono tabular-nums text-text-secondary">
              {formatNumber(data.nonReportableLong)}
            </td>
            <td className="py-0.5 text-right font-mono tabular-nums text-text-secondary">
              {formatNumber(data.nonReportableShort)}
            </td>
            <td className={cn('py-0.5 text-right font-mono tabular-nums', nonReportableNet >= 0 ? 'text-trading-green' : 'text-trading-red')}>
              {formatNumber(nonReportableNet)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Stacked Bar Chart ───────────────────────────────────────────────────────

function COTStackedChart({ data, className }: { data: COTData[]; className?: string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const chartData = useMemo(() => {
    if (data.length === 0) return []

    // Find max total for scale
    const maxTotal = Math.max(
      ...data.map((d) =>
        Math.max(
          d.commercialLong + d.nonCommercialLong + d.nonReportableLong,
          d.commercialShort + d.nonCommercialShort + d.nonReportableShort,
        ),
      ),
    )

    return data.map((d) => ({
      data: d,
      longPcts: {
        commercial: (d.commercialLong / maxTotal) * 100,
        nonCommercial: (d.nonCommercialLong / maxTotal) * 100,
        nonReportable: (d.nonReportableLong / maxTotal) * 100,
      },
      shortPcts: {
        commercial: (d.commercialShort / maxTotal) * 100,
        nonCommercial: (d.nonCommercialShort / maxTotal) * 100,
        nonReportable: (d.nonReportableShort / maxTotal) * 100,
      },
      netNonCommercial: d.nonCommercialLong - d.nonCommercialShort,
    }))
  }, [data])

  // Net position line overlay scaling
  const netValues = chartData.map((d) => d.netNonCommercial)
  const netMax = Math.max(1, Math.max(...netValues.map(Math.abs)))

  if (chartData.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <span className="text-sm text-text-muted">No COT data available</span>
      </div>
    )
  }

  const barWidth = Math.max(2, Math.min(12, 600 / chartData.length))

  return (
    <div className={cn('relative', className)}>
      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-sm bg-blue-400" />
          <span className="text-text-muted">Commercial</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-sm bg-orange-400" />
          <span className="text-text-muted">Non-Commercial</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-sm bg-gray-400" />
          <span className="text-text-muted">Non-Reportable</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-4 bg-accent" />
          <span className="text-text-muted">Net Position (Non-Commercial)</span>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative h-48 w-full overflow-hidden rounded-lg border border-border bg-navy-dark p-2">
        {/* Zero line */}
        <div className="absolute left-0 right-0 top-1/2 border-t border-border/50" />

        {/* Bars */}
        <div className="flex h-full items-end justify-between gap-px">
          {chartData.map((bar, i) => {
            const totalLong = bar.longPcts.commercial + bar.longPcts.nonCommercial + bar.longPcts.nonReportable
            const totalShort = bar.shortPcts.commercial + bar.shortPcts.nonCommercial + bar.shortPcts.nonReportable

            return (
              <div
                key={bar.data.reportDate}
                className="group relative flex flex-1 flex-col items-center justify-end"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Long side (top half) */}
                <div className="flex w-full flex-col-reverse items-center" style={{ height: '50%' }}>
                  <div
                    className="w-full rounded-t-[1px] bg-blue-400/80"
                    style={{ height: `${bar.longPcts.commercial}%` }}
                  />
                  <div
                    className="w-full bg-orange-400/80"
                    style={{ height: `${bar.longPcts.nonCommercial}%` }}
                  />
                  <div
                    className="w-full bg-gray-400/60"
                    style={{ height: `${bar.longPcts.nonReportable}%` }}
                  />
                </div>

                {/* Short side (bottom half) */}
                <div className="flex w-full flex-col items-center" style={{ height: '50%' }}>
                  <div
                    className="w-full bg-blue-400/40"
                    style={{ height: `${bar.shortPcts.commercial}%` }}
                  />
                  <div
                    className="w-full bg-orange-400/40"
                    style={{ height: `${bar.shortPcts.nonCommercial}%` }}
                  />
                  <div
                    className="w-full rounded-b-[1px] bg-gray-400/30"
                    style={{ height: `${bar.shortPcts.nonReportable}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Net position line overlay (SVG) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full p-2">
          <polyline
            points={chartData
              .map((bar, i) => {
                const x = (i / (chartData.length - 1)) * 100
                const y = 50 - (bar.netNonCommercial / netMax) * 45
                return `${x}%,${y}%`
              })
              .join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Hovered tooltip */}
      {hoveredIndex !== null && chartData[hoveredIndex] && (
        <PositionTooltip
          data={chartData[hoveredIndex]!.data}
          className="absolute right-2 top-12 z-10 shadow-lg"
        />
      )}

      {/* Date axis labels */}
      <div className="mt-1 flex justify-between">
        {data.length > 0 && (
          <>
            <span className="font-mono text-[9px] tabular-nums text-text-muted">
              {formatDate(data[0]!.reportDate)}
            </span>
            <span className="font-mono text-[9px] tabular-nums text-text-muted">
              {formatDate(data[data.length - 1]!.reportDate)}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function COTChart({
  data,
  cotIndex,
  symbol,
  isLoading = false,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
}: COTChartProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with date range */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-text-muted">
          COT Report: <span className="font-semibold text-text-primary">{symbol}</span>
        </span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="h-7 rounded border border-border bg-navy-dark px-2 font-mono text-[11px] tabular-nums text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <span className="text-xs text-text-muted">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="h-7 rounded border border-border bg-navy-dark px-2 font-mono text-[11px] tabular-nums text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* COT Index Gauge */}
      <COTIndexGauge value={cotIndex} />

      {/* Chart */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-text-muted">Loading COT data...</span>
        </div>
      ) : (
        <COTStackedChart data={data} />
      )}

      {/* Latest report details */}
      {data.length > 0 && (
        <PositionTooltip data={data[data.length - 1]!} className="w-full" />
      )}
    </div>
  )
}
