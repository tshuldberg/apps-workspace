'use client'

import { cn } from '../lib/utils.js'
import type { IVData } from '@marlin/shared'

export interface OptionsHeaderProps {
  symbol: string
  price: number
  priceChange?: number
  priceChangePercent?: number
  ivData: IVData | null
  className?: string
}

function IVRankGauge({ value }: { value: number }) {
  // Color: 0-30 green (low IV = good for buying), 30-70 yellow, 70-100 red (high IV = good for selling)
  let color: string
  if (value <= 30) color = '#22c55e'
  else if (value <= 70) color = '#eab308'
  else color = '#ef4444'

  const width = Math.max(0, Math.min(100, value))

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-medium text-text-muted">IV Rank</span>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-navy-mid">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${width}%`, backgroundColor: color }}
          />
        </div>
        <span className="font-mono text-xs font-semibold tabular-nums" style={{ color }}>
          {value.toFixed(0)}
        </span>
      </div>
    </div>
  )
}

export function OptionsHeader({
  symbol,
  price,
  priceChange = 0,
  priceChangePercent = 0,
  ivData,
  className,
}: OptionsHeaderProps) {
  const isUp = priceChange >= 0

  return (
    <div
      className={cn(
        'flex items-center gap-6 border-b border-border bg-navy-dark px-4 py-2',
        className,
      )}
    >
      {/* Symbol + Price */}
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-lg font-bold text-text-primary">{symbol}</span>
        <span className="font-mono text-lg font-semibold tabular-nums text-text-primary">
          ${price.toFixed(2)}
        </span>
        <span
          className={cn(
            'font-mono text-sm tabular-nums',
            isUp ? 'text-trading-green' : 'text-trading-red',
          )}
        >
          {isUp ? '+' : ''}
          {priceChange.toFixed(2)} ({isUp ? '+' : ''}
          {priceChangePercent.toFixed(2)}%)
        </span>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-border" />

      {/* IV Rank Gauge */}
      {ivData && (
        <>
          <IVRankGauge value={ivData.ivRank} />

          {/* IV Percentile */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-medium text-text-muted">IV Pctile</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-text-secondary">
              {ivData.ivPercentile.toFixed(0)}%
            </span>
          </div>

          {/* Current IV */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-medium text-text-muted">IV</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-accent">
              {(ivData.currentIV * 100).toFixed(1)}%
            </span>
          </div>

          {/* Put/Call Ratio */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-medium text-text-muted">P/C Ratio</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-text-secondary">
              {ivData.putCallRatio.toFixed(2)}
            </span>
          </div>
        </>
      )}

      {!ivData && (
        <span className="text-xs text-text-muted">Loading IV data...</span>
      )}
    </div>
  )
}
