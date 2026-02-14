'use client'

import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProfileStatsData {
  winRate: number
  sharpeRatio: number
  maxDrawdown: number
  profitFactor: number
  totalTrades: number
  bestMonth: number
}

export interface ProfileStatsProps {
  data: ProfileStatsData | null
  isPrivate?: boolean
  className?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  return `$${value.toFixed(2)}`
}

// ── Stat Card ────────────────────────────────────────────────────────────────

interface StatItemProps {
  label: string
  value: string
  positive?: boolean | null
}

function StatItem({ label, value, positive }: StatItemProps) {
  const colorClass =
    positive === null || positive === undefined
      ? 'text-text-primary'
      : positive
        ? 'text-trading-green'
        : 'text-trading-red'

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-navy-dark px-4 py-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span className={cn('font-mono text-lg font-semibold tabular-nums', colorClass)}>
        {value}
      </span>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProfileStats({ data, isPrivate = false, className }: ProfileStatsProps) {
  if (isPrivate || !data) {
    return (
      <div className={cn('rounded-lg border border-border bg-navy-dark p-8 text-center', className)}>
        <div className="text-2xl text-text-muted mb-2">
          {/* Lock icon as SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-2"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="text-sm text-text-muted">Trading stats are private</p>
        <p className="text-xs text-text-muted mt-1">
          This user has chosen to keep their trading statistics hidden
        </p>
      </div>
    )
  }

  const stats: StatItemProps[] = [
    {
      label: 'Win Rate',
      value: `${data.winRate.toFixed(1)}%`,
      positive: data.winRate >= 50 ? true : data.winRate > 0 ? false : null,
    },
    {
      label: 'Sharpe Ratio',
      value: data.sharpeRatio.toFixed(2),
      positive: data.sharpeRatio > 0 ? true : data.sharpeRatio < 0 ? false : null,
    },
    {
      label: 'Max Drawdown',
      value: formatCurrency(data.maxDrawdown),
      positive: data.maxDrawdown === 0 ? null : false,
    },
    {
      label: 'Profit Factor',
      value: data.profitFactor >= 999 ? '---' : data.profitFactor.toFixed(2),
      positive: data.profitFactor > 1 ? true : data.profitFactor > 0 ? false : null,
    },
    {
      label: 'Total Trades',
      value: data.totalTrades.toLocaleString(),
      positive: null,
    },
    {
      label: 'Best Month',
      value: formatCurrency(data.bestMonth),
      positive: data.bestMonth > 0 ? true : data.bestMonth < 0 ? false : null,
    },
  ]

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6', className)}>
      {stats.map((stat) => (
        <StatItem key={stat.label} {...stat} />
      ))}
    </div>
  )
}
