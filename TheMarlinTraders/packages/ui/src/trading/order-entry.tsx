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

export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop'

export interface OrderEntryValues {
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  limitPrice?: number
  stopPrice?: number
}

export interface OrderEntryProps {
  symbol?: string
  onSubmit: (order: OrderEntryValues) => void
  disabled?: boolean
  className?: string
}

export function OrderEntry({ symbol: initialSymbol = '', onSubmit, disabled, className }: OrderEntryProps) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [side, setSide] = useState<OrderSide>('buy')
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [quantity, setQuantity] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')

  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol)
  }, [initialSymbol])

  const handleSubmit = useCallback(() => {
    const qty = parseInt(quantity, 10)
    if (!symbol || !qty || qty <= 0) return

    const order: OrderEntryValues = {
      symbol: symbol.toUpperCase(),
      side,
      type: orderType,
      quantity: qty,
    }

    if (orderType === 'limit' && limitPrice) {
      order.limitPrice = parseFloat(limitPrice)
    }
    if (orderType === 'stop' && stopPrice) {
      order.stopPrice = parseFloat(stopPrice)
    }

    onSubmit(order)
  }, [symbol, side, orderType, quantity, limitPrice, stopPrice, onSubmit])

  // Keyboard shortcut: Enter to submit
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

  return (
    <div className={cn('flex flex-col gap-3 rounded-panel border border-border bg-navy-dark p-4', className)}>
      {/* PAPER badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">Order Entry</span>
        <span className="rounded bg-warning/20 px-2 py-0.5 text-xs font-bold text-warning">
          PAPER
        </span>
      </div>

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
      <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="market">Market</SelectItem>
          <SelectItem value="limit">Limit</SelectItem>
          <SelectItem value="stop">Stop</SelectItem>
        </SelectContent>
      </Select>

      {/* Quantity */}
      <Input
        variant="monospace"
        type="number"
        placeholder="Quantity"
        min={1}
        step={1}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        disabled={disabled}
      />

      {/* Limit price (shown for limit orders) */}
      {orderType === 'limit' && (
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

      {/* Stop price (shown for stop orders) */}
      {orderType === 'stop' && (
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

      {/* Submit */}
      <Button
        variant={side === 'buy' ? 'trading-buy' : 'trading-sell'}
        onClick={handleSubmit}
        disabled={disabled || !symbol || !quantity}
        className="w-full"
      >
        {side === 'buy' ? 'Buy' : 'Sell'} {symbol || '---'}
      </Button>

      <span className="text-center text-xs text-text-muted">
        Cmd/Ctrl+Enter to submit
      </span>
    </div>
  )
}
