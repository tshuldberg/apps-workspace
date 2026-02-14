'use client'

import { useMemo } from 'react'
import { cn } from '../lib/utils.js'
import type { FuturesQuote, FuturesAssetClass } from '@marlin/shared'

// ── Types ────────────────────────────────────────────────────────────────────

export interface FuturesDashboardProps {
  quotes: FuturesQuote[]
  isLoading?: boolean
  onContractClick?: (symbol: string) => void
  className?: string
}

// ── Asset Class Colors ──────────────────────────────────────────────────────

const ASSET_CLASS_COLORS: Record<FuturesAssetClass, { bg: string; text: string; border: string; label: string }> = {
  indices: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    label: 'Indices',
  },
  commodities: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    label: 'Commodities',
  },
  bonds: {
    bg: 'bg-gray-400/10',
    text: 'text-gray-400',
    border: 'border-gray-400/30',
    label: 'Bonds',
  },
  currencies: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    label: 'Currencies',
  },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: number, symbol: string): string {
  // Bonds use fractional notation but display decimal for simplicity
  if (['ZB', 'ZN'].some((s) => symbol.startsWith(s))) {
    return price.toFixed(3)
  }
  // Currency futures have 4-5 decimal precision
  if (['6E', '6J'].some((s) => symbol.startsWith(s))) {
    return price.toFixed(5)
  }
  return price.toFixed(2)
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`
  return vol.toString()
}

function formatChange(change: number, changePercent: number): {
  text: string
  color: string
} {
  const sign = change >= 0 ? '+' : ''
  return {
    text: `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`,
    color: change >= 0 ? 'text-trading-green' : 'text-trading-red',
  }
}

function formatMonthYear(contractMonth: string): string {
  if (contractMonth.length !== 6) return contractMonth
  const year = contractMonth.slice(0, 4)
  const month = parseInt(contractMonth.slice(4), 10)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[month - 1]} ${year}`
}

// ── Sparkline Component ─────────────────────────────────────────────────────

function MiniSparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 80
  const height = 24

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  const isUp = data[data.length - 1]! >= data[0]!
  const color = isUp ? '#22c55e' : '#ef4444'

  return (
    <svg width={width} height={height} className={className}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Contract Card ───────────────────────────────────────────────────────────

function FuturesContractCard({
  quote,
  onClick,
}: {
  quote: FuturesQuote
  onClick?: () => void
}) {
  const assetStyle = ASSET_CLASS_COLORS[quote.assetClass]
  const changeInfo = formatChange(quote.change, quote.changePercent)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick?.()
      }}
      className={cn(
        'group cursor-pointer rounded-lg border bg-navy-dark p-4 transition-colors hover:border-accent/40 hover:bg-navy-mid',
        assetStyle.border,
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-text-primary">
              {quote.underlyingSymbol}
            </span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[9px] font-medium uppercase',
                assetStyle.bg,
                assetStyle.text,
              )}
            >
              {quote.assetClass}
            </span>
          </div>
          <div className="text-xs text-text-muted">{quote.name}</div>
        </div>
        <MiniSparkline data={quote.sparkline} />
      </div>

      {/* Price */}
      <div className="mb-2">
        <span className="font-mono text-lg font-bold tabular-nums text-text-primary">
          {formatPrice(quote.price, quote.underlyingSymbol)}
        </span>
        <span className={cn('ml-2 font-mono text-xs tabular-nums', changeInfo.color)}>
          {changeInfo.text}
        </span>
      </div>

      {/* Details row */}
      <div className="flex items-center gap-4 text-[10px]">
        <div>
          <span className="text-text-muted">Vol </span>
          <span className="font-mono tabular-nums text-text-secondary">
            {formatVolume(quote.volume)}
          </span>
        </div>
        <div>
          <span className="text-text-muted">OI </span>
          <span className="font-mono tabular-nums text-text-secondary">
            {formatVolume(quote.openInterest)}
          </span>
        </div>
        <div>
          <span className="text-text-muted">Exp </span>
          <span className="font-mono tabular-nums text-text-secondary">
            {formatMonthYear(quote.contractMonth)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────────────────────

export function FuturesDashboard({
  quotes,
  isLoading = false,
  onContractClick,
  className,
}: FuturesDashboardProps) {
  // Group by asset class
  const grouped = useMemo(() => {
    const groups = new Map<FuturesAssetClass, FuturesQuote[]>()
    const order: FuturesAssetClass[] = ['indices', 'commodities', 'bonds', 'currencies']

    for (const q of quotes) {
      const existing = groups.get(q.assetClass) ?? []
      existing.push(q)
      groups.set(q.assetClass, existing)
    }

    return order
      .filter((cls) => groups.has(cls))
      .map((cls) => ({
        assetClass: cls,
        label: ASSET_CLASS_COLORS[cls].label,
        quotes: groups.get(cls)!,
      }))
  }, [quotes])

  if (isLoading && quotes.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-16', className)}>
        <span className="text-sm text-text-muted">Loading futures data...</span>
      </div>
    )
  }

  if (quotes.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-16', className)}>
        <span className="text-sm text-text-muted">No futures data available</span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {grouped.map((group) => (
        <div key={group.assetClass}>
          {/* Group header */}
          <div className="mb-3 flex items-center gap-2">
            <h3
              className={cn(
                'text-xs font-semibold uppercase tracking-wider',
                ASSET_CLASS_COLORS[group.assetClass].text,
              )}
            >
              {group.label}
            </h3>
            <div className="flex-1 border-t border-border" />
            <span className="font-mono text-[10px] tabular-nums text-text-muted">
              {group.quotes.length} {group.quotes.length === 1 ? 'contract' : 'contracts'}
            </span>
          </div>

          {/* Contract grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.quotes.map((quote) => (
              <FuturesContractCard
                key={quote.symbol}
                quote={quote}
                onClick={() => onContractClick?.(quote.symbol)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
