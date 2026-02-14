'use client'

import { useState, useMemo } from 'react'
import { cn } from '../lib/utils.js'
import type { ExpectedMove } from '@marlin/shared'

export type StdDevLevel = '1' | '2'

export interface ExpectedMoveOverlayProps {
  currentPrice: number
  expectedMove1?: ExpectedMove | null // 1 std dev (68%)
  expectedMove2?: ExpectedMove | null // 2 std dev (95%)
  /** Chart coordinate transforms — parent chart provides these */
  priceToY: (price: number) => number
  dateToX: (date: string) => number
  currentDateX: number
  chartWidth: number
  chartHeight: number
  className?: string
}

export function ExpectedMoveOverlay({
  currentPrice,
  expectedMove1,
  expectedMove2,
  priceToY,
  dateToX,
  currentDateX,
  chartWidth,
  chartHeight,
  className,
}: ExpectedMoveOverlayProps) {
  const [stdDev, setStdDev] = useState<StdDevLevel>('1')

  const activeMove = stdDev === '2' ? expectedMove2 : expectedMove1
  if (!activeMove) return null

  const upperY = priceToY(activeMove.upperBound)
  const lowerY = priceToY(activeMove.lowerBound)
  const priceY = priceToY(currentPrice)
  const expX = dateToX(activeMove.expiration)

  const rectX = currentDateX
  const rectWidth = Math.max(10, expX - currentDateX)
  const rectY = Math.min(upperY, lowerY)
  const rectHeight = Math.abs(lowerY - upperY)

  const moveAmount = (activeMove.upperBound - currentPrice).toFixed(2)
  const pctProb = (activeMove.probability * 100).toFixed(0)

  return (
    <g className={cn('pointer-events-none', className)}>
      {/* Shaded expected move region */}
      <rect
        x={rectX}
        y={rectY}
        width={rectWidth}
        height={rectHeight}
        fill="rgba(59, 130, 246, 0.06)"
        stroke="rgba(59, 130, 246, 0.2)"
        strokeWidth={1}
        strokeDasharray="4 2"
        rx={2}
      />

      {/* Upper bound line */}
      <line
        x1={rectX}
        y1={upperY}
        x2={rectX + rectWidth}
        y2={upperY}
        stroke="#22c55e"
        strokeWidth={1}
        strokeDasharray="6 3"
        opacity={0.7}
      />

      {/* Lower bound line */}
      <line
        x1={rectX}
        y1={lowerY}
        x2={rectX + rectWidth}
        y2={lowerY}
        stroke="#ef4444"
        strokeWidth={1}
        strokeDasharray="6 3"
        opacity={0.7}
      />

      {/* Upper bound label */}
      <text
        x={rectX + rectWidth + 4}
        y={upperY + 3}
        fill="#22c55e"
        fontSize={9}
        fontFamily="monospace"
      >
        ${activeMove.upperBound.toFixed(2)}
      </text>

      {/* Lower bound label */}
      <text
        x={rectX + rectWidth + 4}
        y={lowerY + 3}
        fill="#ef4444"
        fontSize={9}
        fontFamily="monospace"
      >
        ${activeMove.lowerBound.toFixed(2)}
      </text>

      {/* Center probability label */}
      <text
        x={rectX + rectWidth / 2}
        y={(upperY + lowerY) / 2 + 4}
        fill="#94a3b8"
        fontSize={9}
        fontFamily="system-ui"
        textAnchor="middle"
      >
        {pctProb}% within +/-${moveAmount}
      </text>
    </g>
  )
}

/**
 * Standalone expected move widget (not an SVG overlay).
 * Shows the expected move as a self-contained card.
 */
export interface ExpectedMoveCardProps {
  currentPrice: number
  expectedMove1?: ExpectedMove | null
  expectedMove2?: ExpectedMove | null
  className?: string
}

export function ExpectedMoveCard({
  currentPrice,
  expectedMove1,
  expectedMove2,
  className,
}: ExpectedMoveCardProps) {
  const [stdDev, setStdDev] = useState<StdDevLevel>('1')
  const activeMove = stdDev === '2' ? expectedMove2 : expectedMove1

  if (!activeMove) {
    return (
      <div className={cn('rounded-lg border border-border bg-navy-dark p-3 text-xs text-text-muted', className)}>
        No expected move data available
      </div>
    )
  }

  const upMove = activeMove.upperBound - currentPrice
  const downMove = currentPrice - activeMove.lowerBound
  const pctProb = (activeMove.probability * 100).toFixed(0)
  const pctMove = ((upMove / currentPrice) * 100).toFixed(1)

  return (
    <div className={cn('rounded-lg border border-border bg-navy-dark', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Expected Move
        </span>
        <div className="flex gap-1">
          {(['1', '2'] as StdDevLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setStdDev(level)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] transition-colors',
                stdDev === level
                  ? 'bg-accent text-text-primary'
                  : 'text-text-muted hover:bg-navy-light hover:text-text-secondary',
              )}
            >
              {level} StdDev ({level === '1' ? '68%' : '95%'})
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Upper bound */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted">Upper</span>
          <span className="font-mono text-xs font-semibold tabular-nums text-trading-green">
            ${activeMove.upperBound.toFixed(2)} (+${upMove.toFixed(2)})
          </span>
        </div>

        {/* Current price */}
        <div className="my-2 flex items-center justify-between border-y border-border/30 py-1.5">
          <span className="text-[10px] text-text-muted">Current</span>
          <span className="font-mono text-xs font-bold tabular-nums text-text-primary">
            ${currentPrice.toFixed(2)}
          </span>
        </div>

        {/* Lower bound */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted">Lower</span>
          <span className="font-mono text-xs font-semibold tabular-nums text-trading-red">
            ${activeMove.lowerBound.toFixed(2)} (-${downMove.toFixed(2)})
          </span>
        </div>

        {/* Probability */}
        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-text-muted">
          <span>{pctProb}% probability within</span>
          <span className="font-mono font-semibold text-accent">+/-{pctMove}%</span>
          <span>by {activeMove.expiration}</span>
        </div>
      </div>
    </div>
  )
}
