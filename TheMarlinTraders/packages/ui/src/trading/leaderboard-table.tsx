'use client'

import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export type LeaderboardTimeframe = '7d' | '30d' | '90d' | '1y' | 'all'
export type LeaderboardAssetClass = 'equities' | 'options' | 'crypto' | 'all'
export type LeaderboardStyle = 'day' | 'swing' | 'all'
export type LeaderboardMetric = 'sharpe' | 'winRate' | 'totalPnl' | 'profitFactor'

export interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  avatarUrl: string | null
  metricValue: number
  winRate: number
  sharpeRatio: number
  totalPnl: number
  profitFactor: number
  totalTrades: number
}

export interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  timeframe: LeaderboardTimeframe
  onTimeframeChange: (tf: LeaderboardTimeframe) => void
  assetClass: LeaderboardAssetClass
  onAssetClassChange: (ac: LeaderboardAssetClass) => void
  style: LeaderboardStyle
  onStyleChange: (style: LeaderboardStyle) => void
  metric: LeaderboardMetric
  onMetricChange: (metric: LeaderboardMetric) => void
  hasMore?: boolean
  onLoadMore?: () => void
  isLoading?: boolean
  onUserClick?: (userId: string) => void
  className?: string
}

// ── Config ───────────────────────────────────────────────────────────────────

const TIMEFRAMES: { value: LeaderboardTimeframe; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

const ASSET_CLASSES: { value: LeaderboardAssetClass; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'equities', label: 'Equities' },
  { value: 'options', label: 'Options' },
  { value: 'crypto', label: 'Crypto' },
]

const STYLES: { value: LeaderboardStyle; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'day', label: 'Day Trading' },
  { value: 'swing', label: 'Swing Trading' },
]

const METRICS: { value: LeaderboardMetric; label: string }[] = [
  { value: 'totalPnl', label: 'Total P&L' },
  { value: 'winRate', label: 'Win Rate' },
  { value: 'sharpe', label: 'Sharpe Ratio' },
  { value: 'profitFactor', label: 'Profit Factor' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMetricValue(value: number, metric: LeaderboardMetric): string {
  switch (metric) {
    case 'totalPnl': {
      const abs = Math.abs(value)
      const sign = value < 0 ? '-' : ''
      if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
      if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`
      return `${sign}$${abs.toFixed(2)}`
    }
    case 'winRate':
      return `${value.toFixed(1)}%`
    case 'sharpe':
      return value.toFixed(2)
    case 'profitFactor':
      return value >= 999 ? '---' : value.toFixed(2)
    default:
      return value.toFixed(2)
  }
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/20 text-xs font-bold text-yellow-400">
        1
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-300/20 text-xs font-bold text-gray-300">
        2
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-600/20 text-xs font-bold text-orange-400">
        3
      </span>
    )
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center text-xs font-mono tabular-nums text-text-muted">
      {rank}
    </span>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function LeaderboardTable({
  entries,
  timeframe,
  onTimeframeChange,
  assetClass,
  onAssetClassChange,
  style,
  onStyleChange,
  metric,
  onMetricChange,
  hasMore = false,
  onLoadMore,
  isLoading = false,
  onUserClick,
  className,
}: LeaderboardTableProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Timeframe tabs */}
        <div className="flex rounded-md border border-border">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              type="button"
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                timeframe === tf.value
                  ? 'bg-accent text-text-primary'
                  : 'text-text-muted hover:text-text-primary',
              )}
              onClick={() => onTimeframeChange(tf.value)}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Asset class chips */}
        <div className="flex gap-1">
          {ASSET_CLASSES.map((ac) => (
            <button
              key={ac.value}
              type="button"
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                assetClass === ac.value
                  ? 'bg-accent/20 text-accent'
                  : 'bg-navy-mid text-text-muted hover:text-text-secondary',
              )}
              onClick={() => onAssetClassChange(ac.value)}
            >
              {ac.label}
            </button>
          ))}
        </div>

        {/* Style filter */}
        <div className="flex gap-1">
          {STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                style === s.value
                  ? 'bg-accent/20 text-accent'
                  : 'bg-navy-mid text-text-muted hover:text-text-secondary',
              )}
              onClick={() => onStyleChange(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Metric selector */}
        <div className="ml-auto flex rounded-md border border-border">
          {METRICS.map((m) => (
            <button
              key={m.value}
              type="button"
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                metric === m.value
                  ? 'bg-accent text-text-primary'
                  : 'text-text-muted hover:text-text-primary',
              )}
              onClick={() => onMetricChange(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-navy-dark">
              <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Trader
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted">
                {METRICS.find((m) => m.value === metric)?.label ?? 'Metric'}
              </th>
              <th className="hidden px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted sm:table-cell">
                Win Rate
              </th>
              <th className="hidden px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted md:table-cell">
                Trades
              </th>
              <th className="hidden px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-text-muted lg:table-cell">
                Sharpe
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.userId}
                role="button"
                tabIndex={0}
                onClick={() => onUserClick?.(entry.userId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onUserClick?.(entry.userId)
                }}
                className={cn(
                  'border-b border-border transition-colors',
                  'cursor-pointer hover:bg-navy-mid',
                  entry.rank <= 3 && 'bg-navy-dark/50',
                )}
              >
                <td className="px-4 py-3">
                  <MedalIcon rank={entry.rank} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {entry.avatarUrl ? (
                      <img
                        src={entry.avatarUrl}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                        {entry.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-text-primary">
                      {entry.displayName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      'font-mono text-sm font-semibold tabular-nums',
                      metric === 'totalPnl'
                        ? entry.metricValue > 0
                          ? 'text-trading-green'
                          : entry.metricValue < 0
                            ? 'text-trading-red'
                            : 'text-text-muted'
                        : 'text-text-primary',
                    )}
                  >
                    {formatMetricValue(entry.metricValue, metric)}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right sm:table-cell">
                  <span
                    className={cn(
                      'font-mono text-xs tabular-nums',
                      entry.winRate >= 50 ? 'text-trading-green' : 'text-trading-red',
                    )}
                  >
                    {entry.winRate.toFixed(1)}%
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right font-mono text-xs tabular-nums text-text-muted md:table-cell">
                  {entry.totalTrades}
                </td>
                <td className="hidden px-4 py-3 text-right lg:table-cell">
                  <span
                    className={cn(
                      'font-mono text-xs tabular-nums',
                      entry.sharpeRatio > 0 ? 'text-trading-green' : entry.sharpeRatio < 0 ? 'text-trading-red' : 'text-text-muted',
                    )}
                  >
                    {entry.sharpeRatio.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}

            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-text-muted">
                  No traders found for the selected filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoading}
            className="rounded-md border border-border px-6 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-navy-mid hover:text-text-primary disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}
