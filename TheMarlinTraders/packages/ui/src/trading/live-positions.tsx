'use client'

import { useState } from 'react'
import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../primitives/dialog.js'

// ── Types ──────────────────────────────────────────────────

export interface LivePositionRow {
  symbol: string
  quantity: number
  side: 'long' | 'short'
  avgEntryPrice: number
  currentPrice: number
  marketValue: number
  costBasis: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  changeToday: number
  /** 'paper' or 'live' to distinguish source */
  source: 'paper' | 'live'
}

export type PositionViewMode = 'all' | 'paper' | 'live'

export interface LivePositionsPanelProps {
  positions: LivePositionRow[]
  onClose?: (symbol: string, source: 'paper' | 'live') => void
  className?: string
}

// ── Helpers ────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────

export function LivePositionsPanel({
  positions,
  onClose,
  className,
}: LivePositionsPanelProps) {
  const [viewMode, setViewMode] = useState<PositionViewMode>('all')
  const [closeConfirm, setCloseConfirm] = useState<{
    symbol: string
    source: 'paper' | 'live'
  } | null>(null)

  const filtered = positions.filter((p) => {
    if (viewMode === 'all') return true
    return p.source === viewMode
  })

  // Aggregate P&L
  const totalUnrealizedPnL = filtered.reduce((sum, p) => sum + p.unrealizedPnL, 0)
  const totalDailyChange = filtered.reduce(
    (sum, p) => sum + (p.currentPrice * p.quantity * p.changeToday) / 100,
    0,
  )

  const handleCloseClick = (symbol: string, source: 'paper' | 'live') => {
    if (source === 'live') {
      // Confirm before closing live positions
      setCloseConfirm({ symbol, source })
    } else {
      onClose?.(symbol, source)
    }
  }

  const handleConfirmClose = () => {
    if (closeConfirm) {
      onClose?.(closeConfirm.symbol, closeConfirm.source)
      setCloseConfirm(null)
    }
  }

  return (
    <>
      <div className={cn('flex flex-col rounded-panel border border-border bg-navy-dark', className)}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-sm font-semibold text-text-primary">Positions</span>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex rounded border border-border text-[10px]">
              {(['all', 'paper', 'live'] as const).map((m) => (
                <button
                  key={m}
                  className={cn(
                    'px-2 py-0.5 font-medium uppercase transition-colors',
                    viewMode === m
                      ? 'bg-navy-light text-text-primary'
                      : 'text-text-muted hover:text-text-secondary',
                  )}
                  onClick={() => setViewMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <span className="text-xs text-text-muted">{filtered.length} open</span>
          </div>
        </div>

        {/* Aggregate P&L bar */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-b border-border/50 bg-navy-mid/20 px-4 py-1.5">
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted">Total P&L:</span>
              <span
                className={cn(
                  'font-mono text-xs font-semibold tabular-nums',
                  totalUnrealizedPnL >= 0 ? 'text-trading-green' : 'text-trading-red',
                )}
              >
                {formatCurrency(totalUnrealizedPnL)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted">Today:</span>
              <span
                className={cn(
                  'font-mono text-xs font-semibold tabular-nums',
                  totalDailyChange >= 0 ? 'text-trading-green' : 'text-trading-red',
                )}
              >
                {formatCurrency(totalDailyChange)}
              </span>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="p-4 text-center text-sm text-text-muted">No open positions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="px-4 py-2 font-medium">Symbol</th>
                  <th className="px-4 py-2 font-medium text-right">Qty</th>
                  <th className="px-4 py-2 font-medium text-right">Avg Cost</th>
                  <th className="px-4 py-2 font-medium text-right">Current</th>
                  <th className="px-4 py-2 font-medium text-right">Mkt Value</th>
                  <th className="px-4 py-2 font-medium text-right">P&L</th>
                  <th className="px-4 py-2 font-medium text-right">%</th>
                  <th className="px-4 py-2 font-medium text-right">Today</th>
                  {onClose && <th className="px-4 py-2 font-medium text-right" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((pos) => (
                  <tr
                    key={`${pos.source}-${pos.symbol}`}
                    className="border-b border-border/50 hover:bg-navy-mid/50"
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-text-primary">
                          {pos.symbol}
                        </span>
                        <span
                          className={cn(
                            'rounded px-1 py-px text-[9px] font-bold uppercase',
                            pos.source === 'live'
                              ? 'bg-trading-green/20 text-trading-green'
                              : 'bg-warning/20 text-warning',
                          )}
                        >
                          {pos.source}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-text-primary">
                      {pos.quantity}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-text-secondary">
                      {formatCurrency(pos.avgEntryPrice)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-text-primary">
                      {formatCurrency(pos.currentPrice)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-text-primary">
                      {formatCurrency(pos.marketValue)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2 text-right font-mono tabular-nums',
                        pos.unrealizedPnL >= 0 ? 'text-trading-green' : 'text-trading-red',
                      )}
                    >
                      {formatCurrency(pos.unrealizedPnL)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2 text-right font-mono tabular-nums',
                        pos.unrealizedPnLPercent >= 0
                          ? 'text-trading-green'
                          : 'text-trading-red',
                      )}
                    >
                      {formatPercent(pos.unrealizedPnLPercent)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2 text-right font-mono tabular-nums',
                        pos.changeToday >= 0 ? 'text-trading-green' : 'text-trading-red',
                      )}
                    >
                      {formatPercent(pos.changeToday)}
                    </td>
                    {onClose && (
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCloseClick(pos.symbol, pos.source)}
                        >
                          Close
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Close position confirmation for live orders */}
      <Dialog
        open={closeConfirm !== null}
        onOpenChange={(open) => !open && setCloseConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Live Position</DialogTitle>
            <DialogDescription>
              This will submit a market order to close your{' '}
              <span className="font-mono font-semibold text-text-primary">
                {closeConfirm?.symbol}
              </span>{' '}
              position. This action trades real money and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmClose}>
              Close Position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
