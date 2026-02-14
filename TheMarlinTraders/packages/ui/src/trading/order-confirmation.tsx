'use client'

import { useCallback, useState } from 'react'
import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'

export interface OrderSummary {
  symbol: string
  side: 'buy' | 'sell'
  type: string
  quantity: number
  price?: number
  stopPrice?: number
  /** Estimated total cost or proceeds */
  estimatedTotal?: number
  /** New position size after this fill */
  newPositionSize?: number
  /** Current position size before this fill */
  currentPositionSize?: number
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme'

export interface OrderConfirmationProps {
  order: OrderSummary
  /** Risk assessment from the risk-confirmation service */
  riskLevel?: RiskLevel
  /** Warnings to display (large order, unusual activity, etc.) */
  warnings?: string[]
  /** Whether this is a paper trade */
  isPaper?: boolean
  /** Called when user confirms the order */
  onConfirm: () => void
  /** Called when user cancels */
  onCancel: () => void
  /** Called when user toggles "don't ask again" */
  onSkipToggle?: (skip: boolean) => void
  /** Whether this dialog is open */
  open: boolean
  className?: string
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'text-trading-green bg-trading-green/10 border-trading-green/30',
  medium: 'text-warning bg-warning/10 border-warning/30',
  high: 'text-trading-red bg-trading-red/10 border-trading-red/30',
  extreme: 'text-trading-red bg-trading-red/20 border-trading-red/50',
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  extreme: 'Extreme Risk',
}

export function OrderConfirmation({
  order,
  riskLevel = 'low',
  warnings = [],
  isPaper = true,
  onConfirm,
  onCancel,
  onSkipToggle,
  open,
  className,
}: OrderConfirmationProps) {
  const [skipConfirmation, setSkipConfirmation] = useState(false)

  const handleSkipToggle = useCallback(() => {
    const next = !skipConfirmation
    setSkipConfirmation(next)
    onSkipToggle?.(next)
  }, [skipConfirmation, onSkipToggle])

  if (!open) return null

  const isBuy = order.side === 'buy'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className={cn(
          'w-full max-w-md rounded-lg border border-border bg-navy-dark shadow-2xl',
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">Confirm Order</span>
            {isPaper && (
              <span className="rounded bg-warning/20 px-2 py-0.5 text-[10px] font-bold text-warning">
                PAPER
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-text-muted transition-colors hover:text-text-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          {/* Order summary */}
          <div className="space-y-2">
            {/* Side + Symbol */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-bold uppercase',
                  isBuy ? 'bg-trading-green/20 text-trading-green' : 'bg-trading-red/20 text-trading-red',
                )}
              >
                {order.side}
              </span>
              <span className="font-mono text-lg font-bold text-text-primary">{order.symbol}</span>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div className="text-xs text-text-muted">Type</div>
              <div className="text-right font-mono text-xs text-text-primary">{order.type}</div>

              <div className="text-xs text-text-muted">Quantity</div>
              <div className="text-right font-mono text-xs tabular-nums text-text-primary">
                {order.quantity}
              </div>

              {order.price !== undefined && (
                <>
                  <div className="text-xs text-text-muted">Price</div>
                  <div className="text-right font-mono text-xs tabular-nums text-text-primary">
                    {formatCurrency(order.price)}
                  </div>
                </>
              )}

              {order.stopPrice !== undefined && (
                <>
                  <div className="text-xs text-text-muted">Stop Price</div>
                  <div className="text-right font-mono text-xs tabular-nums text-text-primary">
                    {formatCurrency(order.stopPrice)}
                  </div>
                </>
              )}

              {order.estimatedTotal !== undefined && (
                <>
                  <div className="text-xs text-text-muted">
                    Est. {isBuy ? 'Cost' : 'Proceeds'}
                  </div>
                  <div
                    className={cn(
                      'text-right font-mono text-xs font-semibold tabular-nums',
                      isBuy ? 'text-trading-red' : 'text-trading-green',
                    )}
                  >
                    {formatCurrency(order.estimatedTotal)}
                  </div>
                </>
              )}
            </div>

            {/* Position impact */}
            {order.currentPositionSize !== undefined && order.newPositionSize !== undefined && (
              <div className="rounded border border-border/50 bg-navy-mid/30 p-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  Position Impact
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-text-secondary">
                    {order.currentPositionSize} shares
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                    {order.newPositionSize} shares
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Risk level indicator */}
          <div className={cn('rounded border px-3 py-2 text-xs font-medium', RISK_COLORS[riskLevel])}>
            {RISK_LABELS[riskLevel]}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-1">
              {warnings.map((warning, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded border border-warning/20 bg-warning/5 px-3 py-2"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mt-0.5 shrink-0 text-warning"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span className="text-xs text-warning">{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Skip confirmation toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={skipConfirmation}
              onChange={handleSkipToggle}
              className="h-3.5 w-3.5 rounded border-border bg-navy-mid accent-accent"
            />
            <span className="text-xs text-text-muted">
              Don&apos;t ask again for this session
            </span>
          </label>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={isBuy ? 'trading-buy' : 'trading-sell'}
            size="sm"
            onClick={onConfirm}
            className="min-w-[100px]"
          >
            Confirm {order.side === 'buy' ? 'Buy' : 'Sell'}
          </Button>
        </div>
      </div>
    </div>
  )
}
