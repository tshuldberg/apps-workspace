'use client'

import { useState, useMemo } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpreadDataPoint {
  timestamp: number
  frontPrice: number
  backPrice: number
  spread: number
}

export interface SpreadBands {
  mean: number
  upper1sd: number
  lower1sd: number
  upper2sd: number
  lower2sd: number
}

export interface FuturesSpreadProps {
  frontSymbol: string
  backSymbol: string
  data: SpreadDataPoint[]
  bands?: SpreadBands
  isLoading?: boolean
  onEntryClick?: (price: number, direction: 'long' | 'short') => void
  className?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatPrice(price: number): string {
  return price.toFixed(2)
}

// ── Contango/Backwardation Indicator ────────────────────────────────────────

function MarketStructureIndicator({ spread }: { spread: number }) {
  const isContango = spread < 0
  const label = isContango ? 'Contango' : 'Backwardation'
  const color = isContango ? 'text-trading-red' : 'text-trading-green'
  const bgColor = isContango ? 'bg-trading-red/10' : 'bg-trading-green/10'

  return (
    <div className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5', bgColor)}>
      <div className={cn('flex items-center gap-1', color)}>
        {/* Arrow */}
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {isContango ? (
            <polyline points="7 13 12 18 17 13" />
          ) : (
            <polyline points="7 11 12 6 17 11" />
          )}
          <line x1="12" y1={isContango ? '6' : '18'} x2="12" y2={isContango ? '18' : '6'} />
        </svg>
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <span className="font-mono text-xs tabular-nums text-text-muted">
        {formatPrice(Math.abs(spread))}
      </span>
    </div>
  )
}

// ── Spread Line Chart ───────────────────────────────────────────────────────

function SpreadLineChart({
  data,
  bands,
  className,
}: {
  data: SpreadDataPoint[]
  bands?: SpreadBands
  className?: string
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const { svgPoints, yMin, yMax, yRange } = useMemo(() => {
    if (data.length === 0) return { svgPoints: '', yMin: 0, yMax: 0, yRange: 1 }

    const spreads = data.map((d) => d.spread)
    let min = Math.min(...spreads)
    let max = Math.max(...spreads)

    // Include bands in range if present
    if (bands) {
      min = Math.min(min, bands.lower2sd)
      max = Math.max(max, bands.upper2sd)
    }

    const range = max - min || 1
    const padding = range * 0.1
    const yMin = min - padding
    const yMax = max + padding
    const yRange = yMax - yMin

    const width = 100
    const height = 100

    const points = data
      .map((d, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((d.spread - yMin) / yRange) * height
        return `${x},${y}`
      })
      .join(' ')

    return { svgPoints: points, yMin, yMax, yRange }
  }, [data, bands])

  if (data.length < 2) {
    return (
      <div className={cn('flex items-center justify-center py-16', className)}>
        <span className="text-sm text-text-muted">Insufficient data for spread chart</span>
      </div>
    )
  }

  const width = 100
  const height = 100

  // Band y-positions
  const bandYs = bands
    ? {
        mean: height - ((bands.mean - yMin) / yRange) * height,
        upper1: height - ((bands.upper1sd - yMin) / yRange) * height,
        lower1: height - ((bands.lower1sd - yMin) / yRange) * height,
        upper2: height - ((bands.upper2sd - yMin) / yRange) * height,
        lower2: height - ((bands.lower2sd - yMin) / yRange) * height,
      }
    : null

  // Zero line
  const zeroY = height - ((0 - yMin) / yRange) * height

  return (
    <div className={cn('relative', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-64 w-full overflow-visible rounded-lg border border-border bg-navy-dark"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - rect.left) / rect.width
          const idx = Math.round(x * (data.length - 1))
          setHoveredIndex(Math.max(0, Math.min(data.length - 1, idx)))
        }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* 2-sigma bands */}
        {bandYs && (
          <rect
            x="0"
            y={bandYs.upper2}
            width={width}
            height={bandYs.lower2 - bandYs.upper2}
            fill="rgba(59, 130, 246, 0.05)"
          />
        )}

        {/* 1-sigma bands */}
        {bandYs && (
          <rect
            x="0"
            y={bandYs.upper1}
            width={width}
            height={bandYs.lower1 - bandYs.upper1}
            fill="rgba(59, 130, 246, 0.1)"
          />
        )}

        {/* Mean line */}
        {bandYs && (
          <line
            x1="0"
            y1={bandYs.mean}
            x2={width}
            y2={bandYs.mean}
            stroke="#3b82f6"
            strokeWidth="0.3"
            strokeDasharray="1 1"
          />
        )}

        {/* Zero line */}
        {zeroY >= 0 && zeroY <= height && (
          <line
            x1="0"
            y1={zeroY}
            x2={width}
            y2={zeroY}
            stroke="#94a3b8"
            strokeWidth="0.2"
            strokeDasharray="2 2"
          />
        )}

        {/* Spread line */}
        <polyline
          points={svgPoints}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="0.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Fill under the line to zero */}
        {data.length > 0 && (
          <polygon
            points={`0,${zeroY} ${svgPoints} ${width},${zeroY}`}
            fill="url(#spreadGradient)"
          />
        )}

        <defs>
          <linearGradient id="spreadGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Hover crosshair */}
        {hoveredIndex !== null && (
          <line
            x1={(hoveredIndex / (data.length - 1)) * width}
            y1="0"
            x2={(hoveredIndex / (data.length - 1)) * width}
            y2={height}
            stroke="#94a3b8"
            strokeWidth="0.2"
            strokeDasharray="1 1"
          />
        )}
      </svg>

      {/* Hover tooltip */}
      {hoveredIndex !== null && data[hoveredIndex] && (
        <div className="absolute right-2 top-2 rounded border border-border bg-navy-dark p-2 text-xs shadow-lg">
          <div className="mb-1 font-mono text-[10px] text-text-muted">
            {formatDate(data[hoveredIndex]!.timestamp)}
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between gap-4">
              <span className="text-text-muted">Front:</span>
              <span className="font-mono tabular-nums text-text-primary">
                {formatPrice(data[hoveredIndex]!.frontPrice)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-text-muted">Back:</span>
              <span className="font-mono tabular-nums text-text-primary">
                {formatPrice(data[hoveredIndex]!.backPrice)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-0.5">
              <span className="text-text-muted">Spread:</span>
              <span
                className={cn(
                  'font-mono font-semibold tabular-nums',
                  data[hoveredIndex]!.spread >= 0 ? 'text-trading-green' : 'text-trading-red',
                )}
              >
                {formatPrice(data[hoveredIndex]!.spread)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Date axis */}
      <div className="mt-1 flex justify-between">
        <span className="font-mono text-[9px] tabular-nums text-text-muted">
          {formatDate(data[0]!.timestamp)}
        </span>
        <span className="font-mono text-[9px] tabular-nums text-text-muted">
          {formatDate(data[data.length - 1]!.timestamp)}
        </span>
      </div>

      {/* Y-axis labels */}
      <div className="absolute bottom-4 left-1 top-0 flex flex-col justify-between py-2">
        <span className="font-mono text-[8px] tabular-nums text-text-muted">
          {formatPrice(yMax)}
        </span>
        <span className="font-mono text-[8px] tabular-nums text-text-muted">
          {formatPrice(yMin)}
        </span>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function FuturesSpread({
  frontSymbol,
  backSymbol,
  data,
  bands,
  isLoading = false,
  onEntryClick,
  className,
}: FuturesSpreadProps) {
  const currentSpread = data.length > 0 ? data[data.length - 1]!.spread : 0
  const prevSpread = data.length > 1 ? data[data.length - 2]!.spread : 0
  const spreadChange = currentSpread - prevSpread

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-text-primary">{frontSymbol}</span>
          <span className="text-xs text-text-muted">-</span>
          <span className="font-mono text-sm font-semibold text-text-primary">{backSymbol}</span>
        </div>

        <MarketStructureIndicator spread={currentSpread} />

        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted">Spread:</span>
          <span className="font-mono font-bold tabular-nums text-text-primary">
            {formatPrice(currentSpread)}
          </span>
          <span
            className={cn(
              'font-mono tabular-nums',
              spreadChange >= 0 ? 'text-trading-green' : 'text-trading-red',
            )}
          >
            ({spreadChange >= 0 ? '+' : ''}{formatPrice(spreadChange)})
          </span>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <span className="text-sm text-text-muted">Loading spread data...</span>
        </div>
      ) : (
        <SpreadLineChart data={data} bands={bands} />
      )}

      {/* Spread trading entry widget */}
      {onEntryClick && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-navy-dark p-3">
          <span className="text-xs font-medium text-text-muted">Trade Spread:</span>
          <button
            type="button"
            onClick={() => onEntryClick(currentSpread, 'long')}
            className="rounded bg-trading-green/10 px-3 py-1.5 text-xs font-semibold text-trading-green transition-colors hover:bg-trading-green/20"
          >
            Long Spread (Buy Front / Sell Back)
          </button>
          <button
            type="button"
            onClick={() => onEntryClick(currentSpread, 'short')}
            className="rounded bg-trading-red/10 px-3 py-1.5 text-xs font-semibold text-trading-red transition-colors hover:bg-trading-red/20"
          >
            Short Spread (Sell Front / Buy Back)
          </button>

          {/* Band context */}
          {bands && (
            <div className="ml-auto flex items-center gap-2 text-[10px]">
              <span className="text-text-muted">Range:</span>
              <span className="font-mono tabular-nums text-text-secondary">
                {formatPrice(bands.lower2sd)} — {formatPrice(bands.upper2sd)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
