'use client'

import { cn } from '../lib/utils.js'

export interface PerformanceMetricsData {
  winRate: number
  profitFactor: number
  expectancy: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  maxDrawdownDuration: number
  totalPnl: number
  totalTrades: number
  avgWin: number
  avgLoss: number
  avgHoldingTime: number
}

export interface PerformanceMetricsProps {
  data: PerformanceMetricsData
  className?: string
}

interface StatCardProps {
  label: string
  value: string
  subValue?: string
  positive?: boolean | null
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  return `$${value.toFixed(2)}`
}

function formatHours(hours: number): string {
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remaining = Math.round(hours % 24)
    return remaining > 0 ? `${days}d ${remaining}h` : `${days}d`
  }
  if (hours >= 1) return `${hours.toFixed(1)}h`
  return `${Math.round(hours * 60)}m`
}

function StatCard({ label, value, subValue, positive }: StatCardProps) {
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
      {subValue && (
        <span className="text-[10px] text-text-muted">{subValue}</span>
      )}
    </div>
  )
}

export function PerformanceMetrics({ data, className }: PerformanceMetricsProps) {
  const cards: StatCardProps[] = [
    {
      label: 'Win Rate',
      value: `${data.winRate.toFixed(1)}%`,
      subValue: `${data.totalTrades} trades`,
      positive: data.winRate >= 50 ? true : data.winRate > 0 ? false : null,
    },
    {
      label: 'Total P&L',
      value: formatCurrency(data.totalPnl),
      positive: data.totalPnl > 0 ? true : data.totalPnl < 0 ? false : null,
    },
    {
      label: 'Profit Factor',
      value: data.profitFactor >= 999 ? '---' : data.profitFactor.toFixed(2),
      subValue: `Avg Win ${formatCurrency(data.avgWin)} / Avg Loss ${formatCurrency(data.avgLoss)}`,
      positive: data.profitFactor > 1 ? true : data.profitFactor > 0 ? false : null,
    },
    {
      label: 'Expectancy',
      value: formatCurrency(data.expectancy),
      subValue: 'per trade',
      positive: data.expectancy > 0 ? true : data.expectancy < 0 ? false : null,
    },
    {
      label: 'Sharpe Ratio',
      value: data.sharpeRatio.toFixed(2),
      subValue: `Sortino ${data.sortinoRatio.toFixed(2)}`,
      positive: data.sharpeRatio > 0 ? true : data.sharpeRatio < 0 ? false : null,
    },
    {
      label: 'Max Drawdown',
      value: formatCurrency(data.maxDrawdown),
      subValue: data.maxDrawdownDuration > 0
        ? `${Math.round(data.maxDrawdownDuration)} day${Math.round(data.maxDrawdownDuration) !== 1 ? 's' : ''} duration`
        : undefined,
      positive: data.maxDrawdown === 0 ? null : false,
    },
    {
      label: 'Avg Holding Time',
      value: formatHours(data.avgHoldingTime),
      positive: null,
    },
  ]

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7', className)}>
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  )
}
