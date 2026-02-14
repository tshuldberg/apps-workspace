'use client'

import { useRef, useMemo, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '../lib/utils.js'
import { PriceCell } from './price-cell.js'
import type { WatchlistRow } from './watchlist-panel.js'
import { type SortConfig, type WatchlistColumn, toggleSort, sortRows } from './watchlist-sort.js'

const ROW_HEIGHT = 32

const COLUMNS: { key: WatchlistColumn; label: string; align: 'left' | 'right' }[] = [
  { key: 'symbol', label: 'Symbol', align: 'left' },
  { key: 'lastPrice', label: 'Last', align: 'right' },
  { key: 'changePercent', label: 'Chg %', align: 'right' },
  { key: 'volume', label: 'Volume', align: 'right' },
]

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`
  return vol.toString()
}

export interface VirtualWatchlistProps {
  rows: WatchlistRow[]
  onRowClick?: (symbol: string) => void
  className?: string
}

export function VirtualWatchlist({ rows, onRowClick, className }: VirtualWatchlistProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [sort, setSort] = useState<SortConfig | null>(null)

  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort])

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  })

  const handleSort = useCallback(
    (col: WatchlistColumn) => setSort((prev) => toggleSort(prev, col)),
    [],
  )

  return (
    <div className={cn('flex flex-col bg-navy-dark text-sm', className)}>
      {/* Header */}
      <div className="flex items-center border-b border-border px-2 py-1 text-xs text-text-muted">
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            type="button"
            onClick={() => handleSort(col.key)}
            className={cn(
              'flex-1 cursor-pointer select-none px-1 py-0.5 hover:text-text-secondary',
              col.align === 'right' && 'text-right',
              sort?.column === col.key && 'text-text-primary',
            )}
          >
            {col.label}
            {sort?.column === col.key && (
              <span className="ml-0.5">{sort.direction === 'asc' ? '\u25B2' : '\u25BC'}</span>
            )}
          </button>
        ))}
      </div>

      {/* Virtualized body */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = sorted[virtualRow.index]!
            return (
              <div
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => onRowClick?.(row.symbol)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRowClick?.(row.symbol)
                }}
                className="absolute left-0 flex w-full cursor-pointer items-center border-b border-border/50 px-2 hover:bg-navy-light"
                style={{
                  height: `${ROW_HEIGHT}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex-1 font-mono text-text-primary">{row.symbol}</div>
                <div className="flex-1 text-right">
                  <PriceCell price={row.lastPrice} decimals={2} />
                </div>
                <div
                  className={cn(
                    'flex-1 text-right font-mono tabular-nums',
                    row.changePercent >= 0 ? 'text-trading-green' : 'text-trading-red',
                  )}
                >
                  {row.changePercent >= 0 ? '+' : ''}
                  {row.changePercent.toFixed(2)}%
                </div>
                <div className="flex-1 text-right font-mono tabular-nums text-text-secondary">
                  {formatVolume(row.volume)}
                </div>
              </div>
            )
          })}
        </div>

        {sorted.length === 0 && (
          <div className="flex items-center justify-center py-8 text-text-muted">
            No symbols in this watchlist
          </div>
        )}
      </div>
    </div>
  )
}
