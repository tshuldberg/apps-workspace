'use client'

import { cn } from '../lib/utils.js'

export interface PortfolioSummaryData {
  totalValue: number
  cashBalance: number
  positionsValue: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  dailyPnL: number
  dailyPnLPercent: number
  buyingPower: number
}

export interface PortfolioSummaryProps {
  data: PortfolioSummaryData
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

function StatCard({
  label,
  value,
  subValue,
  color,
}: {
  label: string
  value: string
  subValue?: string
  color?: 'green' | 'red' | 'neutral'
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-muted">{label}</span>
      <span
        className={cn(
          'font-mono text-sm font-semibold tabular-nums',
          color === 'green' && 'text-trading-green',
          color === 'red' && 'text-trading-red',
          (!color || color === 'neutral') && 'text-text-primary',
        )}
      >
        {value}
      </span>
      {subValue && (
        <span
          className={cn(
            'font-mono text-xs tabular-nums',
            color === 'green' && 'text-trading-green/70',
            color === 'red' && 'text-trading-red/70',
            (!color || color === 'neutral') && 'text-text-muted',
          )}
        >
          {subValue}
        </span>
      )}
    </div>
  )
}

export function PortfolioSummary({ data, className }: PortfolioSummaryProps) {
  const pnlColor = data.unrealizedPnL >= 0 ? 'green' : 'red'
  const dailyColor = data.dailyPnL >= 0 ? 'green' : 'red'

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-panel border border-border bg-navy-dark p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">Portfolio</span>
        <span className="rounded bg-warning/20 px-2 py-0.5 text-xs font-bold text-warning">
          PAPER
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Value" value={formatCurrency(data.totalValue)} />
        <StatCard
          label="Daily P&L"
          value={formatCurrency(data.dailyPnL)}
          subValue={formatPercent(data.dailyPnLPercent)}
          color={dailyColor as 'green' | 'red'}
        />
        <StatCard label="Buying Power" value={formatCurrency(data.buyingPower)} />
        <StatCard label="Cash" value={formatCurrency(data.cashBalance)} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Positions Value" value={formatCurrency(data.positionsValue)} />
        <StatCard
          label="Unrealized P&L"
          value={formatCurrency(data.unrealizedPnL)}
          subValue={formatPercent(data.unrealizedPnLPercent)}
          color={pnlColor as 'green' | 'red'}
        />
      </div>
    </div>
  )
}
