'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'
import { Input } from '../primitives/input.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/select.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../primitives/dialog.js'

// ── Types ──────────────────────────────────────────────────

export type LiveOrderSide = 'buy' | 'sell'
export type LiveOrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop'
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok'
export type TradingMode = 'paper' | 'live'

export interface LiveOrderValues {
  symbol: string
  side: LiveOrderSide
  type: LiveOrderType
  quantity: number
  limitPrice?: number
  stopPrice?: number
  trailPercent?: number
  trailPrice?: number
  timeInForce: TimeInForce
  extendedHours?: boolean
  estimatedPrice?: number
}

export interface AccountInfo {
  cashBalance: number
  buyingPower: number
  equity: number
}

export interface RiskWarning {
  level: 'low' | 'medium' | 'high'
  warnings: string[]
}

export interface LiveOrderEntryProps {
  symbol?: string
  mode: TradingMode
  onModeChange?: (mode: TradingMode) => void
  account?: AccountInfo
  bidPrice?: number
  askPrice?: number
  lastPrice?: number
  onSubmit: (order: LiveOrderValues, riskAcknowledged: boolean) => void
  riskWarning?: RiskWarning | null
  disabled?: boolean
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

// ── Component ──────────────────────────────────────────────

export function LiveOrderEntry({
  symbol: initialSymbol = '',
  mode,
  onModeChange,
  account,
  bidPrice,
  askPrice,
  lastPrice,
  onSubmit,
  riskWarning,
  disabled,
  className,
}: LiveOrderEntryProps) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [side, setSide] = useState<LiveOrderSide>('buy')
  const [orderType, setOrderType] = useState<LiveOrderType>('market')
  const [quantity, setQuantity] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')
  const [trailPercent, setTrailPercent] = useState('')
  const [timeInForce, setTimeInForce] = useState<TimeInForce>('day')
  const [extendedHours, setExtendedHours] = useState(false)
  const [showRiskDialog, setShowRiskDialog] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<LiveOrderValues | null>(null)

  // Dollar amount input for position size calculator
  const [dollarAmount, setDollarAmount] = useState('')

  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol)
  }, [initialSymbol])

  // Position size calculator: convert dollar amount to shares
  useEffect(() => {
    if (dollarAmount && lastPrice && lastPrice > 0) {
      const shares = Math.floor(parseFloat(dollarAmount) / lastPrice)
      if (shares > 0) setQuantity(shares.toString())
    }
  }, [dollarAmount, lastPrice])

  // Show risk dialog when riskWarning arrives
  useEffect(() => {
    if (riskWarning && riskWarning.level === 'medium' && pendingOrder) {
      setShowRiskDialog(true)
    }
  }, [riskWarning, pendingOrder])

  const buildOrder = useCallback((): LiveOrderValues | null => {
    const qty = parseInt(quantity, 10)
    if (!symbol || !qty || qty <= 0) return null

    const order: LiveOrderValues = {
      symbol: symbol.toUpperCase(),
      side,
      type: orderType,
      quantity: qty,
      timeInForce,
      extendedHours: extendedHours || undefined,
      estimatedPrice: lastPrice,
    }

    if ((orderType === 'limit' || orderType === 'stop_limit') && limitPrice) {
      order.limitPrice = parseFloat(limitPrice)
    }
    if ((orderType === 'stop' || orderType === 'stop_limit') && stopPrice) {
      order.stopPrice = parseFloat(stopPrice)
    }
    if (orderType === 'trailing_stop' && trailPercent) {
      order.trailPercent = parseFloat(trailPercent)
    }

    return order
  }, [symbol, side, orderType, quantity, limitPrice, stopPrice, trailPercent, timeInForce, extendedHours, lastPrice])

  const handleSubmit = useCallback(() => {
    const order = buildOrder()
    if (!order) return

    if (mode === 'live') {
      // First submission goes through without riskAcknowledged to get risk check
      setPendingOrder(order)
      onSubmit(order, false)
    } else {
      onSubmit(order, false)
    }
  }, [buildOrder, mode, onSubmit])

  const handleRiskConfirm = useCallback(() => {
    if (pendingOrder) {
      onSubmit(pendingOrder, true)
      setShowRiskDialog(false)
      setPendingOrder(null)
    }
  }, [pendingOrder, onSubmit])

  const handleRiskCancel = useCallback(() => {
    setShowRiskDialog(false)
    setPendingOrder(null)
  }, [])

  // Keyboard shortcut: Cmd/Ctrl+Enter to submit
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSubmit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSubmit])

  const isLive = mode === 'live'

  return (
    <>
      <div className={cn('flex flex-col gap-3 rounded-panel border border-border bg-navy-dark p-4', className)}>
        {/* Header: mode toggle + badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-primary">Order Entry</span>
          {onModeChange ? (
            <div className="flex rounded border border-border">
              <button
                className={cn(
                  'px-2.5 py-0.5 text-xs font-bold transition-colors',
                  mode === 'paper'
                    ? 'bg-warning/20 text-warning'
                    : 'text-text-muted hover:text-text-secondary',
                )}
                onClick={() => onModeChange('paper')}
              >
                PAPER
              </button>
              <button
                className={cn(
                  'px-2.5 py-0.5 text-xs font-bold transition-colors',
                  mode === 'live'
                    ? 'bg-trading-green/20 text-trading-green'
                    : 'text-text-muted hover:text-text-secondary',
                )}
                onClick={() => onModeChange('live')}
              >
                LIVE
              </button>
            </div>
          ) : (
            <span
              className={cn(
                'rounded px-2 py-0.5 text-xs font-bold',
                isLive
                  ? 'bg-trading-green/20 text-trading-green'
                  : 'bg-warning/20 text-warning',
              )}
            >
              {isLive ? 'LIVE' : 'PAPER'}
            </span>
          )}
        </div>

        {/* Account summary (live mode) */}
        {isLive && account && (
          <div className="grid grid-cols-3 gap-2 rounded border border-border/50 bg-navy-mid/30 p-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted">Balance</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                {formatCurrency(account.cashBalance)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted">Buying Power</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                {formatCurrency(account.buyingPower)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted">Equity</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                {formatCurrency(account.equity)}
              </span>
            </div>
          </div>
        )}

        {/* Bid / Ask display */}
        {(bidPrice !== undefined || askPrice !== undefined) && (
          <div className="flex items-center justify-between rounded border border-border/50 bg-navy-mid/30 px-3 py-1.5">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted">Bid</span>
              <span className="font-mono text-xs tabular-nums text-trading-red">
                {bidPrice !== undefined ? formatCurrency(bidPrice) : '--'}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-text-muted">Last</span>
              <span className="font-mono text-xs tabular-nums text-text-primary">
                {lastPrice !== undefined ? formatCurrency(lastPrice) : '--'}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-text-muted">Ask</span>
              <span className="font-mono text-xs tabular-nums text-trading-green">
                {askPrice !== undefined ? formatCurrency(askPrice) : '--'}
              </span>
            </div>
          </div>
        )}

        {/* Symbol */}
        <Input
          variant="monospace"
          placeholder="Symbol (e.g. AAPL)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          disabled={disabled}
        />

        {/* Side toggle */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={side === 'buy' ? 'trading-buy' : 'ghost'}
            size="sm"
            onClick={() => setSide('buy')}
            disabled={disabled}
          >
            Buy
          </Button>
          <Button
            variant={side === 'sell' ? 'trading-sell' : 'ghost'}
            size="sm"
            onClick={() => setSide('sell')}
            disabled={disabled}
          >
            Sell
          </Button>
        </div>

        {/* Order type */}
        <Select value={orderType} onValueChange={(v) => setOrderType(v as LiveOrderType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="market">Market</SelectItem>
            <SelectItem value="limit">Limit</SelectItem>
            <SelectItem value="stop">Stop</SelectItem>
            <SelectItem value="stop_limit">Stop Limit</SelectItem>
            <SelectItem value="trailing_stop">Trailing Stop</SelectItem>
          </SelectContent>
        </Select>

        {/* Quantity */}
        <Input
          variant="monospace"
          type="number"
          placeholder="Quantity (shares)"
          min={1}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={disabled}
        />

        {/* Position size calculator */}
        <Input
          variant="monospace"
          type="number"
          placeholder="Dollar amount (auto-calc shares)"
          min={0}
          step={0.01}
          value={dollarAmount}
          onChange={(e) => setDollarAmount(e.target.value)}
          disabled={disabled}
        />

        {/* Limit price */}
        {(orderType === 'limit' || orderType === 'stop_limit') && (
          <Input
            variant="monospace"
            type="number"
            placeholder="Limit Price"
            min={0.01}
            step={0.01}
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            disabled={disabled}
          />
        )}

        {/* Stop price */}
        {(orderType === 'stop' || orderType === 'stop_limit') && (
          <Input
            variant="monospace"
            type="number"
            placeholder="Stop Price"
            min={0.01}
            step={0.01}
            value={stopPrice}
            onChange={(e) => setStopPrice(e.target.value)}
            disabled={disabled}
          />
        )}

        {/* Trail percent */}
        {orderType === 'trailing_stop' && (
          <Input
            variant="monospace"
            type="number"
            placeholder="Trail % (e.g. 2.5)"
            min={0.1}
            step={0.1}
            value={trailPercent}
            onChange={(e) => setTrailPercent(e.target.value)}
            disabled={disabled}
          />
        )}

        {/* Time in force */}
        <Select value={timeInForce} onValueChange={(v) => setTimeInForce(v as TimeInForce)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="gtc">GTC (Good Till Cancel)</SelectItem>
            <SelectItem value="ioc">IOC (Immediate or Cancel)</SelectItem>
            <SelectItem value="fok">FOK (Fill or Kill)</SelectItem>
          </SelectContent>
        </Select>

        {/* Extended hours (only for limit orders) */}
        {orderType === 'limit' && (
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={extendedHours}
              onChange={(e) => setExtendedHours(e.target.checked)}
              className="rounded border-border"
              disabled={disabled}
            />
            Extended hours trading
          </label>
        )}

        {/* Submit */}
        <Button
          variant={side === 'buy' ? 'trading-buy' : 'trading-sell'}
          onClick={handleSubmit}
          disabled={disabled || !symbol || !quantity}
          className="w-full"
        >
          {isLive ? (side === 'buy' ? 'BUY' : 'SELL') : side === 'buy' ? 'Buy' : 'Sell'}{' '}
          {symbol || '---'}
          {isLive && ' (LIVE)'}
        </Button>

        <span className="text-center text-xs text-text-muted">
          Cmd/Ctrl+Enter to submit
        </span>
      </div>

      {/* Risk Confirmation Dialog */}
      <Dialog open={showRiskDialog} onOpenChange={setShowRiskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Risk Warning</DialogTitle>
            <DialogDescription>
              Please review the following warnings before proceeding with this order.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {riskWarning?.warnings.map((warning, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded border border-warning/30 bg-warning/10 p-3"
              >
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
                <span className="text-sm text-text-secondary">{warning}</span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleRiskCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRiskConfirm}>
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
