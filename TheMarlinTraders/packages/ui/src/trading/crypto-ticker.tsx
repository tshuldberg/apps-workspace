'use client'

import { useMemo } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CryptoTickerData {
  pair: string
  price: number
  change24h: number
  changePercent24h: number
  volume24h: number
  high24h: number
  low24h: number
  marketCap: number
  /** Array of prices for sparkline (oldest first) */
  sparkline?: number[]
  lastUpdated: string
}

export interface CryptoTickerProps {
  coins: CryptoTickerData[]
  btcDominance?: number
  fearGreedIndex?: number
  fearGreedLabel?: string
  isLoading?: boolean
  onCoinClick?: (pair: string) => void
  className?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

function formatVolume(vol: number): string {
  if (vol >= 1e12) return `$${(vol / 1e12).toFixed(2)}T`
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`
  if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`
  return `$${vol.toFixed(0)}`
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`
  return `$${cap.toFixed(0)}`
}

/** Render an SVG sparkline from price data */
function Sparkline({ data, positive, width = 80, height = 24 }: {
  data: number[]
  positive: boolean
  width?: number
  height?: number
}) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padding = 2

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2)
      const y = height - padding - ((v - min) / range) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#22c55e' : '#ef4444'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Colored label for Fear & Greed index */
function getFearGreedColor(index: number): string {
  if (index <= 20) return 'text-trading-red'
  if (index <= 40) return 'text-orange-500'
  if (index <= 60) return 'text-yellow-500'
  if (index <= 80) return 'text-trading-green'
  return 'text-emerald-400'
}

// ── Component ───────────────────────────────────────────────────────────────

export function CryptoTicker({
  coins,
  btcDominance,
  fearGreedIndex,
  fearGreedLabel,
  isLoading = false,
  onCoinClick,
  className,
}: CryptoTickerProps) {
  const sortedCoins = useMemo(
    () => [...coins].sort((a, b) => b.marketCap - a.marketCap),
    [coins],
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Market overview bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-navy-dark px-4 py-2.5">
        {btcDominance !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">
              BTC Dominance
            </span>
            <span className="font-mono text-xs tabular-nums text-accent">
              {btcDominance.toFixed(1)}%
            </span>
          </div>
        )}

        {fearGreedIndex !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">
              Fear & Greed
            </span>
            <span
              className={cn(
                'font-mono text-xs font-semibold tabular-nums',
                getFearGreedColor(fearGreedIndex),
              )}
            >
              {fearGreedIndex}
            </span>
            {fearGreedLabel && (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium',
                  getFearGreedColor(fearGreedIndex),
                  'bg-current/10',
                )}
              >
                {fearGreedLabel}
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        <span className="text-[10px] text-text-muted">
          {sortedCoins.length} coins
        </span>
      </div>

      {/* Coin grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <span className="text-sm text-text-muted">Loading crypto prices...</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-navy-dark">
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  #
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  Pair
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  Price
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  24h Change
                </th>
                <th className="hidden px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted sm:table-cell">
                  24h Volume
                </th>
                <th className="hidden px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted md:table-cell">
                  Market Cap
                </th>
                <th className="hidden px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-text-muted lg:table-cell">
                  24h Chart
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedCoins.map((coin, idx) => {
                const isUp = coin.changePercent24h >= 0

                return (
                  <tr
                    key={coin.pair}
                    role="button"
                    tabIndex={0}
                    onClick={() => onCoinClick?.(coin.pair)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onCoinClick?.(coin.pair)
                    }}
                    className="cursor-pointer border-b border-border/50 transition-colors hover:bg-navy-light"
                  >
                    <td className="px-3 py-2.5 text-xs text-text-muted">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-sm font-medium text-text-primary">
                        {coin.pair.split('-')[0]}
                      </span>
                      <span className="ml-1 text-xs text-text-muted">
                        /{coin.pair.split('-')[1]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-mono text-sm tabular-nums text-text-primary">
                        ${formatPrice(coin.price)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={cn(
                          'font-mono text-sm tabular-nums',
                          isUp ? 'text-trading-green' : 'text-trading-red',
                        )}
                      >
                        {isUp ? '+' : ''}
                        {coin.changePercent24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                      <span className="font-mono text-xs tabular-nums text-text-secondary">
                        {formatVolume(coin.volume24h)}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right md:table-cell">
                      <span className="font-mono text-xs tabular-nums text-text-secondary">
                        {formatMarketCap(coin.marketCap)}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-center lg:table-cell">
                      {coin.sparkline && coin.sparkline.length > 1 ? (
                        <Sparkline data={coin.sparkline} positive={isUp} />
                      ) : (
                        <span className="text-text-muted">--</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
