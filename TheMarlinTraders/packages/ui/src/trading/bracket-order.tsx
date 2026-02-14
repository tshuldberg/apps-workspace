'use client'

import { useCallback, useMemo, useState } from 'react'
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

// ── Types ────────────────────────────────────────────────

export type BracketAction = 'BUY' | 'SELL'
export type BracketEntryType = 'MKT' | 'LMT'

export interface BracketOrderValues {
  action: BracketAction
  entryType: BracketEntryType
  quantity: number
  entryPrice: number | null
  targetPrice: number
  stopPrice: number
}

export interface BracketOrderProps {
  symbol: string
  currentPrice?: number
  onSubmit: (values: BracketOrderValues) => void
  disabled?: boolean
  className?: string
}

// ── Helpers ──────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

// ── Component ────────────────────────────────────────────

export function BracketOrder({
  symbol,
  currentPrice,
  onSubmit,
  disabled,
  className,
}: BracketOrderProps) {
  const [action, setAction] = useState<BracketAction>('BUY')
  const [entryType, setEntryType] = useState<BracketEntryType>('LMT')
  const [quantity, setQuantity] = useState('')
  const [entryPriceInput, setEntryPriceInput] = useState(
    currentPrice?.toFixed(2) ?? '',
  )
  const [targetPriceInput, setTargetPriceInput] = useState('')
  const [stopPriceInput, setStopPriceInput] = useState('')
  const [targetMode, setTargetMode] = useState<'price' | 'percent'>('price')
  const [stopMode, setStopMode] = useState<'price' | 'percent'>('price')
  const [targetPercent, setTargetPercent] = useState('')
  const [stopPercent, setStopPercent] = useState('')

  const entryPrice = entryType === 'MKT' ? (currentPrice ?? 0) : parseFloat(entryPriceInput) || 0

  // Calculate prices from percentages
  const effectiveTargetPrice = useMemo(() => {
    if (targetMode === 'percent' && targetPercent && entryPrice > 0) {
      const pct = parseFloat(targetPercent) / 100
      return action === 'BUY'
        ? entryPrice * (1 + pct)
        : entryPrice * (1 - pct)
    }
    return parseFloat(targetPriceInput) || 0
  }, [targetMode, targetPercent, targetPriceInput, entryPrice, action])

  const effectiveStopPrice = useMemo(() => {
    if (stopMode === 'percent' && stopPercent && entryPrice > 0) {
      const pct = parseFloat(stopPercent) / 100
      return action === 'BUY'
        ? entryPrice * (1 - pct)
        : entryPrice * (1 + pct)
    }
    return parseFloat(stopPriceInput) || 0
  }, [stopMode, stopPercent, stopPriceInput, entryPrice, action])

  // Risk:Reward calculation
  const riskReward = useMemo(() => {
    if (entryPrice <= 0 || effectiveTargetPrice <= 0 || effectiveStopPrice <= 0) {
      return null
    }

    let risk: number
    let reward: number

    if (action === 'BUY') {
      risk = entryPrice - effectiveStopPrice
      reward = effectiveTargetPrice - entryPrice
    } else {
      risk = effectiveStopPrice - entryPrice
      reward = entryPrice - effectiveTargetPrice
    }

    if (risk <= 0 || reward <= 0) return null

    return {
      ratio: reward / risk,
      riskAmount: risk,
      rewardAmount: reward,
      riskPercent: (risk / entryPrice) * 100,
      rewardPercent: (reward / entryPrice) * 100,
    }
  }, [entryPrice, effectiveTargetPrice, effectiveStopPrice, action])

  const qty = parseInt(quantity, 10)
  const totalRisk = riskReward && qty > 0 ? riskReward.riskAmount * qty : null
  const totalReward = riskReward && qty > 0 ? riskReward.rewardAmount * qty : null

  const canSubmit =
    !disabled &&
    symbol &&
    qty > 0 &&
    entryPrice > 0 &&
    effectiveTargetPrice > 0 &&
    effectiveStopPrice > 0 &&
    riskReward !== null

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return

    onSubmit({
      action,
      entryType,
      quantity: qty,
      entryPrice: entryType === 'MKT' ? null : entryPrice,
      targetPrice: effectiveTargetPrice,
      stopPrice: effectiveStopPrice,
    })
  }, [canSubmit, action, entryType, qty, entryPrice, effectiveTargetPrice, effectiveStopPrice, onSubmit])

  // Visual price scale (mini preview)
  const priceScale = useMemo(() => {
    if (!entryPrice || !effectiveTargetPrice || !effectiveStopPrice) return null

    const prices = [entryPrice, effectiveTargetPrice, effectiveStopPrice]
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min

    if (range <= 0) return null

    const normalize = (p: number) => ((p - min) / range) * 100

    return {
      entry: normalize(entryPrice),
      target: normalize(effectiveTargetPrice),
      stop: normalize(effectiveStopPrice),
    }
  }, [entryPrice, effectiveTargetPrice, effectiveStopPrice])

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-panel border border-border bg-navy-dark p-4',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">
          Bracket Order
        </span>
        <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
          IBKR
        </span>
      </div>

      {/* Symbol */}
      <div className="text-center font-mono text-lg font-bold text-text-primary">
        {symbol || '---'}
        {currentPrice && (
          <span className="ml-2 text-sm text-text-muted">
            @ {formatCurrency(currentPrice)}
          </span>
        )}
      </div>

      {/* Action toggle */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={action === 'BUY' ? 'trading-buy' : 'ghost'}
          size="sm"
          onClick={() => setAction('BUY')}
          disabled={disabled}
        >
          Buy
        </Button>
        <Button
          variant={action === 'SELL' ? 'trading-sell' : 'ghost'}
          size="sm"
          onClick={() => setAction('SELL')}
          disabled={disabled}
        >
          Sell
        </Button>
      </div>

      {/* Entry order */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-muted">Entry</label>
        <div className="flex gap-2">
          <Select
            value={entryType}
            onValueChange={(v) => setEntryType(v as BracketEntryType)}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MKT">Market</SelectItem>
              <SelectItem value="LMT">Limit</SelectItem>
            </SelectContent>
          </Select>
          {entryType === 'LMT' && (
            <Input
              variant="monospace"
              type="number"
              placeholder="Entry Price"
              step={0.01}
              min={0.01}
              value={entryPriceInput}
              onChange={(e) => setEntryPriceInput(e.target.value)}
              disabled={disabled}
            />
          )}
        </div>
      </div>

      {/* Quantity */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-muted">Quantity</label>
        <Input
          variant="monospace"
          type="number"
          placeholder="Shares"
          min={1}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={disabled}
        />
      </div>

      {/* Profit Target */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-trading-green">
            Profit Target
          </label>
          <div className="flex gap-1">
            <button
              onClick={() => setTargetMode('price')}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                targetMode === 'price'
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              $
            </button>
            <button
              onClick={() => setTargetMode('percent')}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                targetMode === 'percent'
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              %
            </button>
          </div>
        </div>
        {targetMode === 'price' ? (
          <Input
            variant="monospace"
            type="number"
            placeholder="Target Price"
            step={0.01}
            min={0.01}
            value={targetPriceInput}
            onChange={(e) => setTargetPriceInput(e.target.value)}
            disabled={disabled}
          />
        ) : (
          <Input
            variant="monospace"
            type="number"
            placeholder="Target % from entry"
            step={0.1}
            min={0.01}
            value={targetPercent}
            onChange={(e) => setTargetPercent(e.target.value)}
            disabled={disabled}
          />
        )}
      </div>

      {/* Stop Loss */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-trading-red">
            Stop Loss
          </label>
          <div className="flex gap-1">
            <button
              onClick={() => setStopMode('price')}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                stopMode === 'price'
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              $
            </button>
            <button
              onClick={() => setStopMode('percent')}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                stopMode === 'percent'
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              %
            </button>
          </div>
        </div>
        {stopMode === 'price' ? (
          <Input
            variant="monospace"
            type="number"
            placeholder="Stop Price"
            step={0.01}
            min={0.01}
            value={stopPriceInput}
            onChange={(e) => setStopPriceInput(e.target.value)}
            disabled={disabled}
          />
        ) : (
          <Input
            variant="monospace"
            type="number"
            placeholder="Stop % from entry"
            step={0.1}
            min={0.01}
            value={stopPercent}
            onChange={(e) => setStopPercent(e.target.value)}
            disabled={disabled}
          />
        )}
      </div>

      {/* Risk:Reward display */}
      {riskReward && (
        <div className="rounded-lg border border-border/50 bg-navy-mid/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Risk : Reward</span>
            <span
              className={cn(
                'font-mono text-sm font-bold tabular-nums',
                riskReward.ratio >= 2
                  ? 'text-trading-green'
                  : riskReward.ratio >= 1
                    ? 'text-warning'
                    : 'text-trading-red',
              )}
            >
              1 : {riskReward.ratio.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-text-muted">Risk: </span>
              <span className="font-mono tabular-nums text-trading-red">
                {formatCurrency(riskReward.riskAmount)}/sh
                {totalRisk && ` (${formatCurrency(totalRisk)})`}
              </span>
            </div>
            <div>
              <span className="text-text-muted">Reward: </span>
              <span className="font-mono tabular-nums text-trading-green">
                {formatCurrency(riskReward.rewardAmount)}/sh
                {totalReward && ` (${formatCurrency(totalReward)})`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Visual price scale */}
      {priceScale && (
        <div className="relative h-20 rounded border border-border/50 bg-navy-mid/20 p-2">
          <span className="absolute left-2 top-1 text-[10px] text-text-muted">
            Price Scale
          </span>
          {/* Target marker */}
          <div
            className="absolute left-4 right-4 flex items-center"
            style={{ bottom: `${priceScale.target}%` }}
          >
            <div className="h-px flex-1 bg-trading-green/50" />
            <span className="ml-1 font-mono text-[10px] tabular-nums text-trading-green">
              TP {formatCurrency(effectiveTargetPrice)}
            </span>
          </div>
          {/* Entry marker */}
          <div
            className="absolute left-4 right-4 flex items-center"
            style={{ bottom: `${priceScale.entry}%` }}
          >
            <div className="h-px flex-1 bg-accent/50" />
            <span className="ml-1 font-mono text-[10px] tabular-nums text-accent">
              Entry {formatCurrency(entryPrice)}
            </span>
          </div>
          {/* Stop marker */}
          <div
            className="absolute left-4 right-4 flex items-center"
            style={{ bottom: `${priceScale.stop}%` }}
          >
            <div className="h-px flex-1 bg-trading-red/50" />
            <span className="ml-1 font-mono text-[10px] tabular-nums text-trading-red">
              SL {formatCurrency(effectiveStopPrice)}
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      <Button
        variant={action === 'BUY' ? 'trading-buy' : 'trading-sell'}
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full"
      >
        Submit Bracket ({action} {quantity || '0'} {symbol})
      </Button>

      <span className="text-center text-[10px] text-text-muted">
        Creates 3 linked orders: entry + take profit + stop loss
      </span>
    </div>
  )
}
