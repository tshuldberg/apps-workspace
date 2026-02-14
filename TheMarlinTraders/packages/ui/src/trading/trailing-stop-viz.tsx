'use client'

import { useMemo } from 'react'
import { cn } from '../lib/utils.js'

export interface TrailingStopPoint {
  /** Timestamp (ms) */
  time: number
  /** Asset price at this point */
  price: number
  /** Trailing stop level at this point */
  stopLevel: number
}

export interface TrailingStopVizProps {
  /** Symbol being tracked */
  symbol: string
  /** Side of the trailing stop */
  side: 'buy' | 'sell'
  /** Historical trail path data */
  trailPath: TrailingStopPoint[]
  /** Current trail distance (absolute) */
  currentTrailDistance: number
  /** Activation price (if applicable) */
  activationPrice?: number
  /** Whether the trailing stop is currently active (price past activation) */
  isActivated?: boolean
  /** P&L if stop triggers at the current level */
  projectedPnL?: number
  /** Average entry price for P&L calculation */
  entryPrice?: number
  className?: string
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function TrailingStopViz({
  symbol,
  side,
  trailPath,
  currentTrailDistance,
  activationPrice,
  isActivated = true,
  projectedPnL,
  entryPrice,
  className,
}: TrailingStopVizProps) {
  // Chart dimensions
  const width = 320
  const height = 160
  const padding = { top: 10, right: 10, bottom: 20, left: 50 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  // Compute scales
  const { pricePath, stopPath, yMin, yMax, xMin, xMax } = useMemo(() => {
    if (trailPath.length === 0) {
      return { pricePath: '', stopPath: '', yMin: 0, yMax: 100, xMin: 0, xMax: 1 }
    }

    const prices = trailPath.map((p) => p.price)
    const stops = trailPath.map((p) => p.stopLevel)
    const allPrices = [...prices, ...stops]
    if (activationPrice) allPrices.push(activationPrice)

    const yMinVal = Math.min(...allPrices) * 0.998
    const yMaxVal = Math.max(...allPrices) * 1.002
    const xMinVal = trailPath[0]!.time
    const xMaxVal = trailPath[trailPath.length - 1]!.time

    const xRange = xMaxVal - xMinVal || 1
    const yRange = yMaxVal - yMinVal || 1

    function toX(time: number): number {
      return padding.left + ((time - xMinVal) / xRange) * chartW
    }

    function toY(price: number): number {
      return padding.top + chartH - ((price - yMinVal) / yRange) * chartH
    }

    const pricePathStr = trailPath
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.time)},${toY(p.price)}`)
      .join(' ')

    const stopPathStr = trailPath
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.time)},${toY(p.stopLevel)}`)
      .join(' ')

    return {
      pricePath: pricePathStr,
      stopPath: stopPathStr,
      yMin: yMinVal,
      yMax: yMaxVal,
      xMin: xMinVal,
      xMax: xMaxVal,
    }
  }, [trailPath, activationPrice, chartW, chartH, padding.left, padding.top])

  // Current values
  const currentPrice = trailPath.length > 0 ? trailPath[trailPath.length - 1]!.price : 0
  const currentStop = trailPath.length > 0 ? trailPath[trailPath.length - 1]!.stopLevel : 0

  return (
    <div className={cn('flex flex-col rounded-panel border border-border bg-navy-dark', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-primary">Trailing Stop</span>
          <span className="font-mono text-xs text-text-muted">{symbol}</span>
        </div>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
            isActivated ? 'bg-trading-green/20 text-trading-green' : 'bg-text-muted/20 text-text-muted',
          )}
        >
          {isActivated ? 'Active' : 'Waiting'}
        </span>
      </div>

      {/* Mini chart */}
      <div className="px-2 py-1">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const yPos = padding.top + chartH * (1 - pct)
            const priceLabel = (yMin + (yMax - yMin) * pct).toFixed(2)
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={padding.left + chartW}
                  y2={yPos}
                  stroke="#1e293b"
                  strokeWidth="0.5"
                />
                <text
                  x={padding.left - 4}
                  y={yPos + 3}
                  textAnchor="end"
                  className="fill-text-muted"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {priceLabel}
                </text>
              </g>
            )
          })}

          {/* Activation price line */}
          {activationPrice && (
            <line
              x1={padding.left}
              y1={padding.top + chartH - ((activationPrice - yMin) / (yMax - yMin || 1)) * chartH}
              x2={padding.left + chartW}
              y2={padding.top + chartH - ((activationPrice - yMin) / (yMax - yMin || 1)) * chartH}
              stroke="#3b82f6"
              strokeWidth="1"
              strokeDasharray="4 2"
              opacity="0.6"
            />
          )}

          {/* Fill area between price and stop */}
          {trailPath.length >= 2 && (
            <path
              d={`${pricePath} ${trailPath
                .slice()
                .reverse()
                .map(
                  (p, i) =>
                    `${i === 0 ? 'L' : 'L'}${
                      padding.left +
                      ((p.time - xMin) / (xMax - xMin || 1)) * chartW
                    },${
                      padding.top +
                      chartH -
                      ((p.stopLevel - yMin) / (yMax - yMin || 1)) * chartH
                    }`,
                )
                .join(' ')} Z`}
              fill={side === 'sell' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)'}
            />
          )}

          {/* Price line */}
          {pricePath && (
            <path
              d={pricePath}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1.5"
            />
          )}

          {/* Stop level line */}
          {stopPath && (
            <path
              d={stopPath}
              fill="none"
              stroke={side === 'sell' ? '#ef4444' : '#22c55e'}
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          )}

          {/* Current stop level dot */}
          {trailPath.length > 0 && (
            <circle
              cx={padding.left + chartW}
              cy={
                padding.top +
                chartH -
                ((currentStop - yMin) / (yMax - yMin || 1)) * chartH
              }
              r="3"
              fill={side === 'sell' ? '#ef4444' : '#22c55e'}
            />
          )}
        </svg>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border px-3 py-2">
        <div className="text-[10px] text-text-muted">Current Price</div>
        <div className="text-right font-mono text-[11px] tabular-nums text-text-primary">
          {formatCurrency(currentPrice)}
        </div>

        <div className="text-[10px] text-text-muted">Stop Level</div>
        <div
          className={cn(
            'text-right font-mono text-[11px] tabular-nums',
            side === 'sell' ? 'text-trading-red' : 'text-trading-green',
          )}
        >
          {formatCurrency(currentStop)}
        </div>

        <div className="text-[10px] text-text-muted">Trail Distance</div>
        <div className="text-right font-mono text-[11px] tabular-nums text-text-secondary">
          {formatCurrency(currentTrailDistance)}
        </div>

        {activationPrice !== undefined && (
          <>
            <div className="text-[10px] text-text-muted">Activation</div>
            <div className="text-right font-mono text-[11px] tabular-nums text-accent">
              {formatCurrency(activationPrice)}
            </div>
          </>
        )}

        {projectedPnL !== undefined && entryPrice !== undefined && (
          <>
            <div className="text-[10px] text-text-muted">P&L if Stopped</div>
            <div
              className={cn(
                'text-right font-mono text-[11px] font-semibold tabular-nums',
                projectedPnL >= 0 ? 'text-trading-green' : 'text-trading-red',
              )}
            >
              {formatCurrency(projectedPnL)}{' '}
              <span className="text-[9px] font-normal">
                ({formatPercent(((currentStop - entryPrice) / entryPrice) * 100)})
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
