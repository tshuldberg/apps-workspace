'use client'

import { cn } from '../lib/utils.js'
import { TradeGradeBadge, type TradeGrade } from './trade-grade-badge.js'

export interface JournalEntryData {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  entryPrice: string
  exitPrice: string | null
  quantity: string
  pnl: string | null
  rMultiple: string | null
  setupType: string
  grade: TradeGrade | null
  tags: string[]
  entryDate: string | Date
  exitDate: string | Date | null
}

export interface JournalEntryCardProps {
  entry: JournalEntryData
  onClick?: (id: string) => void
  className?: string
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatSetupType(setup: string): string {
  return setup
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function JournalEntryCard({ entry, onClick, className }: JournalEntryCardProps) {
  const pnlNum = entry.pnl ? parseFloat(entry.pnl) : null
  const pnlColor = pnlNum !== null ? (pnlNum >= 0 ? 'text-trading-green' : 'text-trading-red') : 'text-text-muted'
  const rNum = entry.rMultiple ? parseFloat(entry.rMultiple) : null

  return (
    <button
      type="button"
      onClick={() => onClick?.(entry.id)}
      className={cn(
        'flex w-full items-center gap-4 rounded-lg border border-border bg-navy-dark px-4 py-3',
        'text-left transition-colors hover:border-text-muted/30 hover:bg-navy-mid',
        className,
      )}
    >
      {/* Date */}
      <div className="w-20 shrink-0">
        <span className="text-xs text-text-muted">{formatDate(entry.entryDate)}</span>
      </div>

      {/* Symbol + Side */}
      <div className="flex w-24 shrink-0 items-center gap-2">
        <span className="text-sm font-semibold text-text-primary">{entry.symbol}</span>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
            entry.side === 'buy'
              ? 'bg-trading-green/20 text-trading-green'
              : 'bg-trading-red/20 text-trading-red',
          )}
        >
          {entry.side}
        </span>
      </div>

      {/* P&L */}
      <div className="w-24 shrink-0 text-right">
        <span className={cn('font-mono text-sm font-semibold tabular-nums', pnlColor)}>
          {pnlNum !== null ? formatCurrency(pnlNum) : '--'}
        </span>
      </div>

      {/* R-Multiple */}
      <div className="w-16 shrink-0 text-right">
        <span
          className={cn(
            'font-mono text-xs tabular-nums',
            rNum !== null ? (rNum >= 0 ? 'text-trading-green' : 'text-trading-red') : 'text-text-muted',
          )}
        >
          {rNum !== null ? `${rNum >= 0 ? '+' : ''}${rNum.toFixed(2)}R` : '--'}
        </span>
      </div>

      {/* Setup Type */}
      <div className="hidden w-24 shrink-0 sm:block">
        <span className="rounded bg-navy-mid px-2 py-0.5 text-xs text-text-muted">
          {formatSetupType(entry.setupType)}
        </span>
      </div>

      {/* Grade */}
      <div className="w-8 shrink-0">
        {entry.grade ? <TradeGradeBadge grade={entry.grade} /> : <span className="text-xs text-text-muted">--</span>}
      </div>

      {/* Tags */}
      <div className="hidden min-w-0 flex-1 gap-1 overflow-hidden lg:flex">
        {entry.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="truncate rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent"
          >
            {tag}
          </span>
        ))}
        {entry.tags.length > 3 && (
          <span className="text-[10px] text-text-muted">+{entry.tags.length - 3}</span>
        )}
      </div>
    </button>
  )
}
