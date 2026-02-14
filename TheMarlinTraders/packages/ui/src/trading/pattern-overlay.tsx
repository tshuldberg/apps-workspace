'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  type PatternDetection,
  type ChartPattern,
  CHART_PATTERNS,
  PATTERN_LABELS,
} from '@marlin/shared'
import { cn } from '../lib/utils.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface PatternOverlayProps {
  /** Pattern detections to display */
  detections: PatternDetection[]
  /** Called when user clicks a pattern card — should zoom the chart */
  onPatternClick?: (detection: PatternDetection) => void
  /** Called when user toggles a pattern type on/off */
  onTogglePattern?: (pattern: ChartPattern, enabled: boolean) => void
  className?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-trading-green'
  if (confidence >= 0.5) return 'text-yellow-400'
  return 'text-trading-red'
}

function confidenceBg(confidence: number): string {
  if (confidence >= 0.8) return 'bg-trading-green/10 border-trading-green/30'
  if (confidence >= 0.5) return 'bg-yellow-400/10 border-yellow-400/30'
  return 'bg-trading-red/10 border-trading-red/30'
}

function directionIcon(direction: 'bullish' | 'bearish'): string {
  return direction === 'bullish' ? '\u25B2' : '\u25BC'
}

function directionColor(direction: 'bullish' | 'bearish'): string {
  return direction === 'bullish' ? 'text-trading-green' : 'text-trading-red'
}

function formatPrice(price: number): string {
  return price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ── Component ──────────────────────────────────────────────────────────────

export function PatternOverlay({
  detections,
  onPatternClick,
  onTogglePattern,
  className,
}: PatternOverlayProps) {
  const [disabledPatterns, setDisabledPatterns] = useState<Set<ChartPattern>>(new Set())

  const filteredDetections = useMemo(
    () => detections.filter((d) => !disabledPatterns.has(d.pattern)),
    [detections, disabledPatterns],
  )

  // Unique pattern types present in the detections
  const activePatternTypes = useMemo(() => {
    const types = new Set<ChartPattern>()
    for (const d of detections) {
      types.add(d.pattern)
    }
    return Array.from(types)
  }, [detections])

  const handleToggle = useCallback(
    (pattern: ChartPattern) => {
      setDisabledPatterns((prev) => {
        const next = new Set(prev)
        if (next.has(pattern)) {
          next.delete(pattern)
          onTogglePattern?.(pattern, true)
        } else {
          next.add(pattern)
          onTogglePattern?.(pattern, false)
        }
        return next
      })
    },
    [onTogglePattern],
  )

  if (detections.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-text-muted', className)}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-40">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
        <p className="text-sm">No patterns detected</p>
        <p className="text-xs opacity-60">Try a longer lookback period or different timeframe</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Pattern type toggles */}
      {activePatternTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
          {activePatternTypes.map((pattern) => (
            <button
              key={pattern}
              type="button"
              onClick={() => handleToggle(pattern)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                disabledPatterns.has(pattern)
                  ? 'bg-navy-mid/50 text-text-muted line-through opacity-50'
                  : 'bg-navy-mid text-text-secondary hover:text-text-primary',
              )}
            >
              {PATTERN_LABELS[pattern]}
            </button>
          ))}
        </div>
      )}

      {/* Pattern detection cards */}
      <div className="space-y-2">
        {filteredDetections.map((detection, idx) => (
          <button
            key={`${detection.pattern}-${detection.startBar}-${idx}`}
            type="button"
            onClick={() => onPatternClick?.(detection)}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
              confidenceBg(detection.confidence),
              'hover:brightness-110',
            )}
          >
            {/* Direction indicator */}
            <div className={cn('mt-0.5 text-lg', directionColor(detection.direction))}>
              {directionIcon(detection.direction)}
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  {PATTERN_LABELS[detection.pattern]}
                </span>
                <span
                  className={cn(
                    'font-mono text-xs font-semibold tabular-nums',
                    confidenceColor(detection.confidence),
                  )}
                >
                  {(detection.confidence * 100).toFixed(0)}%
                </span>
              </div>

              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-text-muted">
                <span className={directionColor(detection.direction)}>
                  {detection.direction}
                </span>
                <span>Bars {detection.startBar}–{detection.endBar}</span>
                <span>{detection.keyPoints.length} key points</span>
              </div>

              {/* Price target & stop loss */}
              {(detection.priceTarget || detection.stopLoss) && (
                <div className="mt-1.5 flex gap-4 text-[11px]">
                  {detection.priceTarget && (
                    <span className="flex items-center gap-1">
                      <span className="text-text-muted">Target:</span>
                      <span className="font-mono tabular-nums text-trading-green">
                        ${formatPrice(detection.priceTarget)}
                      </span>
                    </span>
                  )}
                  {detection.stopLoss && (
                    <span className="flex items-center gap-1">
                      <span className="text-text-muted">Stop:</span>
                      <span className="font-mono tabular-nums text-trading-red">
                        ${formatPrice(detection.stopLoss)}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
