'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'

export interface ScreenerResultRow {
  symbol: string
  name: string
  exchange: string | null
  sector: string | null
  industry: string | null
  lastPrice: number | null
  changePercent: number | null
  volume: number | null
  marketCap: number | null
}

export interface ScreenerResultsProps {
  results: ScreenerResultRow[]
  total: number
  isDelayed: boolean
  executionMs: number
  appliedFilters: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onRowClick?: (symbol: string) => void
  onAddToWatchlist?: (symbol: string) => void
  sortBy: string
  sortDir: 'asc' | 'desc'
  onSortChange: (column: string) => void
  isLoading?: boolean
  className?: string
}

interface Column {
  key: string
  label: string
  align: 'left' | 'right'
  width?: string
  sortable: boolean
}

const COLUMNS: Column[] = [
  { key: 'symbol', label: 'Symbol', align: 'left', width: 'w-20', sortable: true },
  { key: 'name', label: 'Name', align: 'left', width: 'flex-1', sortable: true },
  { key: 'exchange', label: 'Exchange', align: 'left', width: 'w-16', sortable: true },
  { key: 'sector', label: 'Sector', align: 'left', width: 'w-28', sortable: true },
  { key: 'lastPrice', label: 'Last', align: 'right', width: 'w-20', sortable: false },
  { key: 'changePercent', label: 'Chg %', align: 'right', width: 'w-16', sortable: false },
  { key: 'volume', label: 'Volume', align: 'right', width: 'w-20', sortable: false },
  { key: 'market_cap', label: 'Mkt Cap', align: 'right', width: 'w-24', sortable: true },
]

function formatVolume(vol: number | null): string {
  if (vol === null) return '--'
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`
  return vol.toString()
}

function formatMarketCap(cap: number | null): string {
  if (cap === null) return '--'
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`
  return `$${cap.toLocaleString()}`
}

function formatPrice(price: number | null): string {
  if (price === null) return '--'
  return `$${price.toFixed(2)}`
}

const ROW_HEIGHT = 32
const VISIBLE_ROWS = 20

export function ScreenerResults({
  results,
  total,
  isDelayed,
  executionMs,
  appliedFilters,
  page,
  pageSize,
  onPageChange,
  onRowClick,
  onAddToWatchlist,
  sortBy,
  sortDir,
  onSortChange,
  isLoading,
  className,
}: ScreenerResultsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const totalPages = Math.ceil(total / pageSize)

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop)
    }
  }, [])

  // Virtual scrolling: only render visible rows
  const startIndex = Math.floor(scrollTop / ROW_HEIGHT)
  const endIndex = Math.min(startIndex + VISIBLE_ROWS + 2, results.length)
  const visibleRows = results.slice(startIndex, endIndex)
  const topPadding = startIndex * ROW_HEIGHT
  const bottomPadding = Math.max(0, (results.length - endIndex) * ROW_HEIGHT)

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Status bar */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-1.5 text-xs text-text-muted">
        <span>
          {total.toLocaleString()} result{total !== 1 ? 's' : ''}
        </span>
        <span>{appliedFilters} filter{appliedFilters !== 1 ? 's' : ''} applied</span>
        <span>{executionMs}ms</span>
        {isDelayed && (
          <span className="ml-auto rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
            Delayed 15min
          </span>
        )}
        {isLoading && (
          <span className="ml-auto text-accent">Scanning...</span>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center border-b border-border bg-navy-mid px-2 py-1 text-xs text-text-muted">
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            type="button"
            onClick={() => col.sortable && onSortChange(col.key)}
            disabled={!col.sortable}
            className={cn(
              'select-none px-1 py-0.5',
              col.width,
              col.align === 'right' && 'text-right',
              col.sortable && 'cursor-pointer hover:text-text-secondary',
              !col.sortable && 'cursor-default',
              sortBy === col.key && 'text-text-primary font-semibold',
            )}
          >
            {col.label}
            {sortBy === col.key && (
              <span className="ml-0.5">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
            )}
          </button>
        ))}
        {/* Actions column */}
        <div className="w-16" />
      </div>

      {/* Virtual scroll container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT }}
      >
        {/* Top spacer */}
        {topPadding > 0 && <div style={{ height: topPadding }} />}

        {/* Visible rows */}
        {visibleRows.map((row) => (
          <div
            key={row.symbol}
            role="button"
            tabIndex={0}
            onClick={() => onRowClick?.(row.symbol)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRowClick?.(row.symbol)
            }}
            className="flex cursor-pointer items-center border-b border-border/30 px-2 hover:bg-navy-light"
            style={{ height: ROW_HEIGHT }}
          >
            {/* Symbol */}
            <div className="w-20 px-1 font-mono text-sm font-semibold text-text-primary">
              {row.symbol}
            </div>

            {/* Name */}
            <div className="flex-1 truncate px-1 text-xs text-text-secondary">
              {row.name}
            </div>

            {/* Exchange */}
            <div className="w-16 px-1 text-xs text-text-muted">
              {row.exchange ?? '--'}
            </div>

            {/* Sector */}
            <div className="w-28 truncate px-1 text-xs text-text-muted">
              {row.sector ?? '--'}
            </div>

            {/* Last Price */}
            <div className="w-20 px-1 text-right font-mono text-xs text-text-primary tabular-nums">
              {formatPrice(row.lastPrice)}
            </div>

            {/* Change % */}
            <div
              className={cn(
                'w-16 px-1 text-right font-mono text-xs tabular-nums',
                row.changePercent !== null && row.changePercent >= 0 ? 'text-trading-green' : 'text-trading-red',
              )}
            >
              {row.changePercent !== null
                ? `${row.changePercent >= 0 ? '+' : ''}${row.changePercent.toFixed(2)}%`
                : '--'}
            </div>

            {/* Volume */}
            <div className="w-20 px-1 text-right font-mono text-xs text-text-secondary tabular-nums">
              {formatVolume(row.volume)}
            </div>

            {/* Market Cap */}
            <div className="w-24 px-1 text-right font-mono text-xs text-text-secondary tabular-nums">
              {formatMarketCap(row.marketCap)}
            </div>

            {/* Actions */}
            <div className="flex w-16 justify-end gap-0.5">
              {onAddToWatchlist && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-text-muted hover:text-accent"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddToWatchlist(row.symbol)
                  }}
                  title="Add to watchlist"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                  </svg>
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Bottom spacer */}
        {bottomPadding > 0 && <div style={{ height: bottomPadding }} />}

        {/* Empty state */}
        {results.length === 0 && !isLoading && (
          <div className="flex items-center justify-center py-12 text-sm text-text-muted">
            No stocks match your filters. Try adjusting your criteria.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-xs text-text-muted">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
