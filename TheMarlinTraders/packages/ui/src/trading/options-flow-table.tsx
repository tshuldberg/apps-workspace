'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'
import type { FlowEntry, FlowFilter, FlowType, FlowSentiment } from '@marlin/shared'

export interface OptionsFlowTableProps {
  entries: FlowEntry[]
  onEntryClick?: (entry: FlowEntry) => void
  onFilterChange?: (filter: FlowFilter) => void
  className?: string
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatPremium(premium: number): string {
  if (premium >= 1_000_000) return `$${(premium / 1_000_000).toFixed(1)}M`
  if (premium >= 1_000) return `$${(premium / 1_000).toFixed(1)}K`
  return `$${premium.toFixed(0)}`
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`
  return vol.toString()
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function formatExpiration(exp: string): string {
  const parts = exp.split('-')
  return `${parts[1]}/${parts[2]}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SentimentBadge({ sentiment }: { sentiment: FlowSentiment }) {
  const colors = {
    bullish: 'bg-trading-green/15 text-trading-green border-trading-green/30',
    bearish: 'bg-trading-red/15 text-trading-red border-trading-red/30',
    neutral: 'bg-text-muted/15 text-text-muted border-text-muted/30',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase',
        colors[sentiment],
      )}
    >
      {sentiment.slice(0, 4)}
    </span>
  )
}

function FlowTypeBadge({ flowType }: { flowType: FlowType }) {
  const config: Record<FlowType, { label: string; className: string }> = {
    sweep: { label: 'Sweep', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
    block: { label: 'Block', className: 'bg-accent/15 text-accent border-accent/30' },
    split: { label: 'Split', className: 'bg-text-muted/15 text-text-muted border-text-muted/30' },
    multi_leg: { label: 'Multi', className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  }

  const { label, className } = config[flowType]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase',
        className,
      )}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function exportToCsv(entries: FlowEntry[], filename: string) {
  const headers = ['Time', 'Symbol', 'Exp', 'Strike', 'C/P', 'Side', 'Volume', 'OI', 'Premium', 'Type', 'Sentiment', 'Score']
  const rows = entries.map((e) => [
    new Date(e.timestamp).toISOString(),
    e.symbol,
    e.expiration,
    e.strike.toFixed(2),
    e.type.toUpperCase(),
    e.side.toUpperCase(),
    e.volume.toString(),
    e.openInterest.toString(),
    e.premium.toFixed(2),
    e.flowType,
    e.sentiment,
    e.unusualScore.toString(),
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const COLUMNS = [
  { key: 'time', label: 'Time', width: 'w-[72px]', align: 'left' as const },
  { key: 'symbol', label: 'Symbol', width: 'w-[64px]', align: 'left' as const },
  { key: 'exp', label: 'Exp', width: 'w-[52px]', align: 'left' as const },
  { key: 'strike', label: 'Strike', width: 'w-[68px]', align: 'right' as const },
  { key: 'cp', label: 'C/P', width: 'w-[36px]', align: 'center' as const },
  { key: 'side', label: 'Side', width: 'w-[36px]', align: 'center' as const },
  { key: 'vol', label: 'Vol', width: 'w-[56px]', align: 'right' as const },
  { key: 'oi', label: 'OI', width: 'w-[56px]', align: 'right' as const },
  { key: 'premium', label: 'Premium', width: 'w-[72px]', align: 'right' as const },
  { key: 'type', label: 'Type', width: 'w-[56px]', align: 'center' as const },
  { key: 'sentiment', label: 'Sent.', width: 'w-[56px]', align: 'center' as const },
]

export function OptionsFlowTable({
  entries,
  onEntryClick,
  onFilterChange,
  className,
}: OptionsFlowTableProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [symbolFilter, setSymbolFilter] = useState('')
  const [minPremiumFilter, setMinPremiumFilter] = useState('')
  const [flowTypeFilter, setFlowTypeFilter] = useState<FlowType | ''>('')
  const [sentimentFilter, setSentimentFilter] = useState<FlowSentiment | ''>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const filteredEntries = useMemo(() => {
    let result = entries

    if (symbolFilter) {
      const sym = symbolFilter.toUpperCase()
      result = result.filter((e) => e.symbol.includes(sym))
    }

    if (minPremiumFilter) {
      const min = parseFloat(minPremiumFilter)
      if (!isNaN(min)) {
        result = result.filter((e) => e.premium >= min)
      }
    }

    if (flowTypeFilter) {
      result = result.filter((e) => e.flowType === flowTypeFilter)
    }

    if (sentimentFilter) {
      result = result.filter((e) => e.sentiment === sentimentFilter)
    }

    return result
  }, [entries, symbolFilter, minPremiumFilter, flowTypeFilter, sentimentFilter])

  const handleFilterUpdate = useCallback(() => {
    onFilterChange?.({
      symbol: symbolFilter || undefined,
      minPremium: minPremiumFilter ? parseFloat(minPremiumFilter) : undefined,
      flowType: flowTypeFilter || undefined,
      sentiment: sentimentFilter || undefined,
    })
  }, [symbolFilter, minPremiumFilter, flowTypeFilter, sentimentFilter, onFilterChange])

  return (
    <div className={cn('flex flex-col bg-navy-dark', className)}>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-navy-dark px-3 py-2">
        {/* Symbol search */}
        <input
          type="text"
          value={symbolFilter}
          onChange={(e) => { setSymbolFilter(e.target.value); handleFilterUpdate() }}
          placeholder="Symbol..."
          className="w-24 rounded border border-border bg-navy-mid px-2 py-1 font-mono text-xs uppercase text-text-primary outline-none transition-colors placeholder:normal-case placeholder:text-text-muted focus:border-accent"
        />

        {/* Min premium */}
        <input
          type="text"
          value={minPremiumFilter}
          onChange={(e) => { setMinPremiumFilter(e.target.value); handleFilterUpdate() }}
          placeholder="Min premium..."
          className="w-28 rounded border border-border bg-navy-mid px-2 py-1 font-mono text-xs text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
        />

        {/* Flow type */}
        <select
          value={flowTypeFilter}
          onChange={(e) => { setFlowTypeFilter(e.target.value as FlowType | ''); handleFilterUpdate() }}
          className="rounded border border-border bg-navy-mid px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
        >
          <option value="">All Types</option>
          <option value="sweep">Sweep</option>
          <option value="block">Block</option>
          <option value="split">Split</option>
          <option value="multi_leg">Multi-leg</option>
        </select>

        {/* Sentiment */}
        <select
          value={sentimentFilter}
          onChange={(e) => { setSentimentFilter(e.target.value as FlowSentiment | ''); handleFilterUpdate() }}
          className="rounded border border-border bg-navy-mid px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
        >
          <option value="">All Sentiment</option>
          <option value="bullish">Bullish</option>
          <option value="bearish">Bearish</option>
          <option value="neutral">Neutral</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          {/* Pause button */}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-7 px-2 text-xs',
              isPaused && 'border-amber-500/30 bg-amber-500/10 text-amber-400',
            )}
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </Button>

          {/* Export button */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => exportToCsv(filteredEntries, 'options-flow')}
          >
            <svg className="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
            </svg>
            CSV
          </Button>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center border-b border-border bg-navy-mid px-2 py-1">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={cn(
              'shrink-0 px-1 text-[10px] font-medium uppercase tracking-wider text-text-muted',
              col.width,
              col.align === 'right' && 'text-right',
              col.align === 'center' && 'text-center',
            )}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Scrollable rows */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {filteredEntries.map((entry, index) => (
          <div
            key={entry.id}
            role="button"
            tabIndex={0}
            onClick={() => onEntryClick?.(entry)}
            onKeyDown={(e) => { if (e.key === 'Enter') onEntryClick?.(entry) }}
            className={cn(
              'flex cursor-pointer items-center border-b border-border/30 px-2 py-0.5 transition-colors hover:bg-navy-light',
              index === 0 && !isPaused && 'animate-pulse bg-navy-light/50',
            )}
          >
            {/* Time */}
            <div className="w-[72px] shrink-0 px-1 font-mono text-[11px] tabular-nums text-text-muted">
              {formatTime(entry.timestamp)}
            </div>

            {/* Symbol */}
            <div className="w-[64px] shrink-0 px-1 font-mono text-[11px] font-semibold text-text-primary">
              {entry.symbol}
            </div>

            {/* Expiration */}
            <div className="w-[52px] shrink-0 px-1 font-mono text-[11px] tabular-nums text-text-muted">
              {formatExpiration(entry.expiration)}
            </div>

            {/* Strike */}
            <div className="w-[68px] shrink-0 px-1 text-right font-mono text-[11px] tabular-nums text-text-secondary">
              ${entry.strike.toFixed(2)}
            </div>

            {/* Call/Put */}
            <div
              className={cn(
                'w-[36px] shrink-0 px-1 text-center font-mono text-[11px] font-semibold',
                entry.type === 'call' ? 'text-trading-green' : 'text-trading-red',
              )}
            >
              {entry.type === 'call' ? 'C' : 'P'}
            </div>

            {/* Side */}
            <div
              className={cn(
                'w-[36px] shrink-0 px-1 text-center font-mono text-[11px]',
                entry.side === 'buy' ? 'text-trading-green' : 'text-trading-red',
              )}
            >
              {entry.side === 'buy' ? 'B' : 'S'}
            </div>

            {/* Volume */}
            <div className="w-[56px] shrink-0 px-1 text-right font-mono text-[11px] tabular-nums text-text-secondary">
              {formatVolume(entry.volume)}
            </div>

            {/* OI */}
            <div className="w-[56px] shrink-0 px-1 text-right font-mono text-[11px] tabular-nums text-text-muted">
              {formatVolume(entry.openInterest)}
            </div>

            {/* Premium */}
            <div className="w-[72px] shrink-0 px-1 text-right font-mono text-[11px] font-semibold tabular-nums text-text-primary">
              {formatPremium(entry.premium)}
            </div>

            {/* Flow Type */}
            <div className="flex w-[56px] shrink-0 items-center justify-center px-1">
              <FlowTypeBadge flowType={entry.flowType} />
            </div>

            {/* Sentiment */}
            <div className="flex w-[56px] shrink-0 items-center justify-center px-1">
              <SentimentBadge sentiment={entry.sentiment} />
            </div>
          </div>
        ))}

        {filteredEntries.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-text-muted">
            No unusual options activity detected
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 border-t border-border px-3 py-1 text-[10px] text-text-muted">
        <span>{filteredEntries.length} entries</span>
        {isPaused && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-400">
            Paused
          </span>
        )}
      </div>
    </div>
  )
}
