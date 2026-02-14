'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

type CalculatorTab = 'pip-value' | 'lot-size' | 'margin' | 'pnl'

interface CalculatorInput {
  pair: string
  lotSize: number
  entryPrice: number
  exitPrice: number
  stopLossPips: number
  riskAmount: number
  leverage: number
  accountCurrency: string
  direction: 'long' | 'short'
}

export interface ForexCalculatorProps {
  availablePairs?: string[]
  /** External calculator functions — if not provided, built-in calculations are used */
  calculatePipValue?: (pair: string, lotSize: number, accountCurrency: string, rate: number) => number
  calculateLotSize?: (risk: number, slPips: number, pair: string, accountCurrency: string, rate: number) => number
  calculateMargin?: (pair: string, lotSize: number, leverage: number, rate: number, accountCurrency: string) => number
  className?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const TABS: { value: CalculatorTab; label: string }[] = [
  { value: 'pip-value', label: 'Pip Value' },
  { value: 'lot-size', label: 'Lot Size' },
  { value: 'margin', label: 'Margin' },
  { value: 'pnl', label: 'Profit/Loss' },
]

const DEFAULT_PAIRS = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'AUD/USD',
  'USD/CAD',
  'USD/CHF',
  'NZD/USD',
  'EUR/GBP',
  'EUR/JPY',
  'GBP/JPY',
]

const ACCOUNT_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF']

// ── Built-in Calculators ────────────────────────────────────────────────────

function isJpyPair(pair: string): boolean {
  return pair.includes('JPY')
}

function getPipSize(pair: string): number {
  return isJpyPair(pair) ? 0.01 : 0.0001
}

function defaultPipValue(pair: string, lotSize: number, accountCurrency: string, rate: number): number {
  const pipSize = getPipSize(pair)
  const [, counter] = pair.split('/')
  if (counter === accountCurrency) {
    return lotSize * pipSize
  }
  if (rate <= 0) return 0
  return (lotSize * pipSize) / rate
}

function defaultLotSize(risk: number, slPips: number, pair: string, accountCurrency: string, rate: number): number {
  if (slPips <= 0 || risk <= 0) return 0
  const pipSize = getPipSize(pair)
  const [, counter] = pair.split('/')
  let pipValuePerUnit: number
  if (counter === accountCurrency) {
    pipValuePerUnit = pipSize
  } else {
    if (rate <= 0) return 0
    pipValuePerUnit = pipSize / rate
  }
  return risk / (slPips * pipValuePerUnit)
}

function defaultMargin(pair: string, lotSize: number, leverage: number, rate: number, accountCurrency: string): number {
  if (leverage <= 0) return 0
  const [base] = pair.split('/')
  const notional = lotSize / leverage
  if (base === accountCurrency) return notional
  return notional * rate
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatUnits(value: number): string {
  if (value >= 100_000) {
    const lots = value / 100_000
    return `${lots.toFixed(2)} standard lots (${value.toLocaleString()} units)`
  }
  if (value >= 10_000) {
    const lots = value / 10_000
    return `${lots.toFixed(2)} mini lots (${value.toLocaleString()} units)`
  }
  const lots = value / 1_000
  return `${lots.toFixed(2)} micro lots (${value.toLocaleString()} units)`
}

// ── Component ───────────────────────────────────────────────────────────────

export function ForexCalculator({
  availablePairs,
  calculatePipValue: pipValueFn,
  calculateLotSize: lotSizeFn,
  calculateMargin: marginFn,
  className,
}: ForexCalculatorProps) {
  const [activeTab, setActiveTab] = useState<CalculatorTab>('pip-value')
  const [input, setInput] = useState<CalculatorInput>({
    pair: 'EUR/USD',
    lotSize: 100_000,
    entryPrice: 1.0860,
    exitPrice: 1.0900,
    stopLossPips: 20,
    riskAmount: 100,
    leverage: 50,
    accountCurrency: 'USD',
    direction: 'long',
  })

  const pairs = availablePairs ?? DEFAULT_PAIRS

  const updateInput = useCallback(
    <K extends keyof CalculatorInput>(key: K, value: CalculatorInput[K]) => {
      setInput((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  // Compute results
  const pipValue = useMemo(() => {
    const fn = pipValueFn ?? defaultPipValue
    return fn(input.pair, input.lotSize, input.accountCurrency, input.entryPrice)
  }, [input.pair, input.lotSize, input.accountCurrency, input.entryPrice, pipValueFn])

  const lotSizeResult = useMemo(() => {
    const fn = lotSizeFn ?? defaultLotSize
    return fn(input.riskAmount, input.stopLossPips, input.pair, input.accountCurrency, input.entryPrice)
  }, [input.riskAmount, input.stopLossPips, input.pair, input.accountCurrency, input.entryPrice, lotSizeFn])

  const marginResult = useMemo(() => {
    const fn = marginFn ?? defaultMargin
    return fn(input.pair, input.lotSize, input.leverage, input.entryPrice, input.accountCurrency)
  }, [input.pair, input.lotSize, input.leverage, input.entryPrice, input.accountCurrency, marginFn])

  const pnlResult = useMemo(() => {
    const pipSize = getPipSize(input.pair)
    const priceDiff =
      input.direction === 'long'
        ? input.exitPrice - input.entryPrice
        : input.entryPrice - input.exitPrice
    const pips = priceDiff / pipSize
    const pnl = pips * pipValue
    return { pips, pnl }
  }, [input.direction, input.entryPrice, input.exitPrice, input.pair, pipValue])

  return (
    <div className={cn('rounded-lg border border-border bg-navy-dark', className)}>
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'flex-1 border-b-2 px-3 py-2.5 text-[10px] font-medium transition-colors',
              activeTab === tab.value
                ? 'border-accent text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-4">
        {/* Common inputs */}
        <div className="grid grid-cols-2 gap-3">
          {/* Pair selector */}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
              Pair
            </label>
            <select
              value={input.pair}
              onChange={(e) => updateInput('pair', e.target.value)}
              className="w-full rounded border border-border bg-navy-black px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
            >
              {pairs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Account currency */}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
              Account Currency
            </label>
            <select
              value={input.accountCurrency}
              onChange={(e) => updateInput('accountCurrency', e.target.value)}
              className="w-full rounded border border-border bg-navy-black px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
            >
              {ACCOUNT_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab-specific inputs and results */}
        {activeTab === 'pip-value' && (
          <>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
                Position Size (Units)
              </label>
              <input
                type="number"
                value={input.lotSize}
                onChange={(e) => updateInput('lotSize', Number(e.target.value))}
                className="w-full rounded border border-border bg-navy-black px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
              />
              <span className="text-[9px] text-text-muted">
                Standard: 100,000 | Mini: 10,000 | Micro: 1,000
              </span>
            </div>

            {/* Result */}
            <div className="rounded-lg bg-navy-black p-3">
              <span className="block text-[10px] uppercase tracking-wider text-text-muted">
                Pip Value
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-accent">
                {formatCurrency(pipValue, input.accountCurrency)}
              </span>
              <span className="block text-[10px] text-text-muted">
                per pip ({isJpyPair(input.pair) ? '0.01' : '0.0001'} price movement)
              </span>
            </div>
          </>
        )}

        {activeTab === 'lot-size' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
                  Risk Amount ({input.accountCurrency})
                </label>
                <input
                  type="number"
                  value={input.riskAmount}
                  onChange={(e) => updateInput('riskAmount', Number(e.target.value))}
                  className="w-full rounded border border-border bg-navy-black px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
                  Stop Loss (Pips)
                </label>
                <input
                  type="number"
                  value={input.stopLossPips}
                  onChange={(e) => updateInput('stopLossPips', Number(e.target.value))}
                  className="w-full rounded border border-border bg-navy-black px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-lg bg-navy-black p-3">
              <span className="block text-[10px] uppercase tracking-wider text-text-muted">
                Recommended Lot Size
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-accent">
                {formatUnits(lotSizeResult)}
              </span>
            </div>
          </>
        )}

        {activeTab === 'margin' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
                  Position Size (Units)
                </label>
                <input
                  type="number"
                  value={input.lotSize}
                  onChange={(e) => updateInput('lotSize', Number(e.target.value))}
                  className="w-full rounded border border-border bg-navy-black px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
                  Leverage
                </label>
                <select
                  value={input.leverage}
                  onChange={(e) => updateInput('leverage', Number(e.target.value))}
                  className="w-full rounded border border-border bg-navy-black px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
                >
                  {[10, 20, 30, 50, 100, 200, 500].map((lev) => (
                    <option key={lev} value={lev}>
                      {lev}:1
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg bg-navy-black p-3">
              <span className="block text-[10px] uppercase tracking-wider text-text-muted">
                Margin Required
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-accent">
                {formatCurrency(marginResult, input.accountCurrency)}
              </span>
              <span className="block text-[10px] text-text-muted">
                at {input.leverage}:1 leverage
              </span>
            </div>
          </>
        )}

        {activeTab === 'pnl' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
                  Position Size (Units)
                </label>
                <input
                  type="number"
                  value={input.lotSize}
                  onChange={(e) => updateInput('lotSize', Number(e.target.value))}
                  className="w-full rounded border border-border bg-navy-black px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
                  Direction
                </label>
                <div className="flex gap-0 rounded border border-border">
                  <button
                    type="button"
                    onClick={() => updateInput('direction', 'long')}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-xs font-medium transition-colors',
                      input.direction === 'long'
                        ? 'bg-trading-green/20 text-trading-green'
                        : 'text-text-muted',
                    )}
                  >
                    Long
                  </button>
                  <button
                    type="button"
                    onClick={() => updateInput('direction', 'short')}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-xs font-medium transition-colors',
                      input.direction === 'short'
                        ? 'bg-trading-red/20 text-trading-red'
                        : 'text-text-muted',
                    )}
                  >
                    Short
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
                  Entry Price
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={input.entryPrice}
                  onChange={(e) => updateInput('entryPrice', Number(e.target.value))}
                  className="w-full rounded border border-border bg-navy-black px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
                  Exit Price
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={input.exitPrice}
                  onChange={(e) => updateInput('exitPrice', Number(e.target.value))}
                  className="w-full rounded border border-border bg-navy-black px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-lg bg-navy-black p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-text-muted">
                    Profit / Loss
                  </span>
                  <span
                    className={cn(
                      'font-mono text-lg font-semibold tabular-nums',
                      pnlResult.pnl >= 0 ? 'text-trading-green' : 'text-trading-red',
                    )}
                  >
                    {pnlResult.pnl >= 0 ? '+' : ''}
                    {formatCurrency(pnlResult.pnl, input.accountCurrency)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-text-muted">
                    Pips
                  </span>
                  <span
                    className={cn(
                      'font-mono text-sm font-semibold tabular-nums',
                      pnlResult.pips >= 0 ? 'text-trading-green' : 'text-trading-red',
                    )}
                  >
                    {pnlResult.pips >= 0 ? '+' : ''}
                    {pnlResult.pips.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
