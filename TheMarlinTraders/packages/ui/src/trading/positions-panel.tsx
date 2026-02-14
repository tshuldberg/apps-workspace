'use client'

import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'

export interface PositionRow {
  symbol: string
  quantity: number
  averageCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
}

export interface PositionsPanelProps {
  positions: PositionRow[]
  onClose?: (symbol: string) => void
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

export function PositionsPanel({ positions, onClose, className }: PositionsPanelProps) {
  return (
    <div className={cn('flex flex-col rounded-panel border border-border bg-navy-dark', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-semibold text-text-primary">Positions</span>
        <span className="text-xs text-text-muted">{positions.length} open</span>
      </div>

      {positions.length === 0 ? (
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
                <th className="px-4 py-2 font-medium text-right">P&L</th>
                <th className="px-4 py-2 font-medium text-right">%</th>
                {onClose && <th className="px-4 py-2 font-medium text-right" />}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.symbol} className="border-b border-border/50 hover:bg-navy-mid/50">
                  <td className="px-4 py-2 font-mono font-semibold text-text-primary">
                    {pos.symbol}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-text-primary">
                    {pos.quantity}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-text-secondary">
                    {formatCurrency(pos.averageCost)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-text-primary">
                    {formatCurrency(pos.currentPrice)}
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
                      pos.unrealizedPnLPercent >= 0 ? 'text-trading-green' : 'text-trading-red',
                    )}
                  >
                    {formatPercent(pos.unrealizedPnLPercent)}
                  </td>
                  {onClose && (
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onClose(pos.symbol)}
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
  )
}
