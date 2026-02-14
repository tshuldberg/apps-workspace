'use client'

import { useState, useMemo } from 'react'
import { cn } from '../lib/utils.js'

export interface SetupBreakdownData {
  setupType: string
  winRate: number
  avgPnl: number
  count: number
  totalPnl: number
}

export interface SetupBreakdownProps {
  data: SetupBreakdownData[]
  className?: string
}

type SortKey = 'setupType' | 'winRate' | 'avgPnl' | 'count' | 'totalPnl'
type SortDir = 'asc' | 'desc'

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatSetupType(setup: string): string {
  return setup
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'setupType', label: 'Setup', align: 'left' },
  { key: 'count', label: 'Trades', align: 'right' },
  { key: 'winRate', label: 'Win Rate', align: 'right' },
  { key: 'avgPnl', label: 'Avg P&L', align: 'right' },
  { key: 'totalPnl', label: 'Total P&L', align: 'right' },
]

export function SetupBreakdown({ data, className }: SetupBreakdownProps) {
  const [sortKey, setSortKey] = useState<SortKey>('count')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let cmp: number
      if (sortKey === 'setupType') {
        cmp = a.setupType.localeCompare(b.setupType)
      } else {
        cmp = a[sortKey] - b[sortKey]
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  const maxWinRate = useMemo(() => Math.max(...data.map((d) => d.winRate), 1), [data])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-border bg-navy-dark p-8',
          className,
        )}
      >
        <span className="text-xs text-text-muted">No setup data available</span>
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-navy-dark', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'cursor-pointer px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary',
                  col.align === 'right' ? 'text-right' : 'text-left',
                )}
                onClick={() => handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (
                    <span className="text-accent">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => (
            <tr
              key={row.setupType}
              className="border-b border-border/50 transition-colors last:border-0 hover:bg-navy-mid/50"
            >
              {/* Setup Type */}
              <td className="px-4 py-2.5">
                <span className="text-sm font-medium text-text-primary">
                  {formatSetupType(row.setupType)}
                </span>
              </td>

              {/* Trade Count */}
              <td className="px-4 py-2.5 text-right">
                <span className="font-mono text-sm tabular-nums text-text-primary">
                  {row.count}
                </span>
              </td>

              {/* Win Rate with mini bar */}
              <td className="px-4 py-2.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        row.winRate >= 50 ? 'bg-trading-green' : 'bg-trading-red',
                      )}
                      style={{ width: `${(row.winRate / maxWinRate) * 100}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      'font-mono text-sm tabular-nums',
                      row.winRate >= 50 ? 'text-trading-green' : 'text-trading-red',
                    )}
                  >
                    {row.winRate.toFixed(1)}%
                  </span>
                </div>
              </td>

              {/* Avg P&L */}
              <td className="px-4 py-2.5 text-right">
                <span
                  className={cn(
                    'font-mono text-sm tabular-nums',
                    row.avgPnl >= 0 ? 'text-trading-green' : 'text-trading-red',
                  )}
                >
                  {formatCurrency(row.avgPnl)}
                </span>
              </td>

              {/* Total P&L */}
              <td className="px-4 py-2.5 text-right">
                <span
                  className={cn(
                    'font-mono text-sm font-semibold tabular-nums',
                    row.totalPnl >= 0 ? 'text-trading-green' : 'text-trading-red',
                  )}
                >
                  {formatCurrency(row.totalPnl)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
