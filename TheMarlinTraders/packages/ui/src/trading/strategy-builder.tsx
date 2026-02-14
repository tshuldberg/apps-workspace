'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '../lib/utils.js'
import type {
  Strategy,
  StrategyLeg,
  OptionsChainData,
} from '@marlin/shared'
import {
  STRATEGY_TEMPLATES,
  getTemplatesByCategory,
  buildStrategyFromTemplate,
  calculateNetGreeks,
  calculateNetPremium,
} from '@marlin/shared'

export interface StrategyBuilderProps {
  chainData: OptionsChainData | null
  expirations: string[]
  strategy: Strategy
  onStrategyChange: (strategy: Strategy) => void
  onAnalyze: () => void
  className?: string
}

let nextLegId = 0
function generateLegId(): string {
  nextLegId += 1
  return `ui-leg-${Date.now()}-${nextLegId}`
}

const CATEGORY_ORDER = ['Directional', 'Spreads', 'Income', 'Volatility', 'Calendar', 'Advanced']

export function StrategyBuilder({
  chainData,
  expirations,
  strategy,
  onStrategyChange,
  onAnalyze,
  className,
}: StrategyBuilderProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  const templatesByCategory = useMemo(() => getTemplatesByCategory(), [])

  const availableStrikes = useMemo(() => {
    if (!chainData) return []
    return chainData.strikes.map((s) => s.price).sort((a, b) => a - b)
  }, [chainData])

  const defaultExpiration = useMemo(() => {
    if (expirations.length === 0) return ''
    return expirations[0]!
  }, [expirations])

  const netGreeks = useMemo(() => calculateNetGreeks(strategy), [strategy])
  const netPremium = useMemo(() => calculateNetPremium(strategy), [strategy])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      setSelectedTemplateId(templateId)
      if (!templateId || !chainData) return

      const template = STRATEGY_TEMPLATES.find((t) => t.id === templateId)
      if (!template) return

      const builtStrategy = buildStrategyFromTemplate(template, chainData)
      onStrategyChange(builtStrategy)
    },
    [chainData, onStrategyChange],
  )

  const handleAddLeg = useCallback(() => {
    const newLeg: StrategyLeg = {
      id: generateLegId(),
      side: 'buy',
      type: 'call',
      strike: availableStrikes.length > 0 ? availableStrikes[Math.floor(availableStrikes.length / 2)]! : 0,
      expiration: defaultExpiration,
      quantity: 1,
      premium: 0,
    }

    onStrategyChange({
      ...strategy,
      name: strategy.legs.length === 0 ? 'Custom Strategy' : strategy.name,
      legs: [...strategy.legs, newLeg],
    })
    setSelectedTemplateId('')
  }, [strategy, availableStrikes, defaultExpiration, onStrategyChange])

  const handleLegChange = useCallback(
    (legId: string, updates: Partial<StrategyLeg>) => {
      const updatedLegs = strategy.legs.map((leg) => {
        if (leg.id !== legId) return leg

        const updatedLeg = { ...leg, ...updates }

        // Look up premium from chain when strike or type changes
        if (chainData && (updates.strike !== undefined || updates.type !== undefined)) {
          const strike = chainData.strikes.find((s) => s.price === updatedLeg.strike)
          if (strike) {
            const contract = updatedLeg.type === 'call' ? strike.call : strike.put
            if (contract) {
              updatedLeg.premium =
                contract.bid > 0 && contract.ask > 0
                  ? (contract.bid + contract.ask) / 2
                  : contract.last
              updatedLeg.greeks = contract.greeks
            }
          }
        }

        return updatedLeg
      })

      onStrategyChange({ ...strategy, legs: updatedLegs, name: strategy.name || 'Custom Strategy' })
      setSelectedTemplateId('')
    },
    [strategy, chainData, onStrategyChange],
  )

  const handleRemoveLeg = useCallback(
    (legId: string) => {
      onStrategyChange({
        ...strategy,
        legs: strategy.legs.filter((l) => l.id !== legId),
      })
    },
    [strategy, onStrategyChange],
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={cn('flex flex-col gap-3 bg-navy-dark p-4', className)}>
      {/* Strategy Template Selector */}
      <div>
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Strategy Template
        </label>
        <select
          value={selectedTemplateId}
          onChange={(e) => handleTemplateSelect(e.target.value)}
          className="w-full rounded border border-border bg-navy-mid px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
        >
          <option value="">Custom Strategy</option>
          {CATEGORY_ORDER.map((category) => {
            const templates = templatesByCategory[category]
            if (!templates || templates.length === 0) return null
            return (
              <optgroup key={category} label={category}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
        {selectedTemplateId && (
          <p className="mt-1 text-[11px] text-text-muted">
            {STRATEGY_TEMPLATES.find((t) => t.id === selectedTemplateId)?.description}
          </p>
        )}
      </div>

      {/* Strategy Name */}
      <div>
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Strategy Name
        </label>
        <input
          type="text"
          value={strategy.name}
          onChange={(e) => onStrategyChange({ ...strategy, name: e.target.value })}
          className="w-full rounded border border-border bg-navy-mid px-3 py-1.5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
          placeholder="My Strategy"
        />
      </div>

      {/* Legs */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Legs ({strategy.legs.length})
          </span>
          <button
            type="button"
            onClick={handleAddLeg}
            className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent transition-colors hover:bg-accent/30"
          >
            + Add Leg
          </button>
        </div>

        {strategy.legs.length === 0 && (
          <div className="rounded border border-border/50 bg-navy-mid/30 px-4 py-6 text-center text-xs text-text-muted">
            Select a template or add legs to build your strategy
          </div>
        )}

        <div className="flex flex-col gap-2">
          {strategy.legs.map((leg, idx) => (
            <LegRow
              key={leg.id}
              leg={leg}
              index={idx}
              strikes={availableStrikes}
              expirations={expirations}
              onChange={(updates) => handleLegChange(leg.id, updates)}
              onRemove={() => handleRemoveLeg(leg.id)}
            />
          ))}
        </div>
      </div>

      {/* Net Premium */}
      {strategy.legs.length > 0 && (
        <div className="rounded border border-border bg-navy-mid/50 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {netPremium >= 0 ? 'Net Debit' : 'Net Credit'}
            </span>
            <span
              className={cn(
                'font-mono text-sm font-semibold tabular-nums',
                netPremium >= 0 ? 'text-trading-red' : 'text-trading-green',
              )}
            >
              ${Math.abs(netPremium).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Net Greeks Summary */}
      {strategy.legs.length > 0 && (
        <div className="rounded border border-border bg-navy-mid/50 px-3 py-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Net Greeks
          </div>
          <div className="grid grid-cols-5 gap-2">
            <GreekCell label="\u0394" value={netGreeks.delta} decimals={2} />
            <GreekCell label="\u0393" value={netGreeks.gamma} decimals={4} />
            <GreekCell label="\u0398" value={netGreeks.theta} decimals={2} />
            <GreekCell label="V" value={netGreeks.vega} decimals={2} />
            <GreekCell label="\u03C1" value={netGreeks.rho} decimals={3} />
          </div>
        </div>
      )}

      {/* Analyze Button */}
      <button
        type="button"
        onClick={onAnalyze}
        disabled={strategy.legs.length === 0}
        className={cn(
          'mt-1 rounded px-4 py-2 text-sm font-semibold transition-colors',
          strategy.legs.length > 0
            ? 'bg-accent text-text-primary hover:bg-accent/80'
            : 'cursor-not-allowed bg-navy-mid text-text-muted',
        )}
      >
        Analyze Strategy
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GreekCell({
  label,
  value,
  decimals,
}: {
  label: string
  value: number
  decimals: number
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-text-muted">{label}</div>
      <div
        className={cn(
          'font-mono text-xs tabular-nums',
          value > 0 ? 'text-trading-green' : value < 0 ? 'text-trading-red' : 'text-text-secondary',
        )}
      >
        {value.toFixed(decimals)}
      </div>
    </div>
  )
}

function LegRow({
  leg,
  index,
  strikes,
  expirations,
  onChange,
  onRemove,
}: {
  leg: StrategyLeg
  index: number
  strikes: number[]
  expirations: string[]
  onChange: (updates: Partial<StrategyLeg>) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-navy-mid/30 px-2 py-1.5">
      {/* Leg number */}
      <span className="w-5 text-center text-[10px] font-semibold text-text-muted">{index + 1}</span>

      {/* Buy / Sell toggle */}
      <button
        type="button"
        onClick={() => onChange({ side: leg.side === 'buy' ? 'sell' : 'buy' })}
        className={cn(
          'w-12 rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors',
          leg.side === 'buy'
            ? 'bg-trading-green/20 text-trading-green'
            : 'bg-trading-red/20 text-trading-red',
        )}
      >
        {leg.side === 'buy' ? 'BUY' : 'SELL'}
      </button>

      {/* Call / Put toggle */}
      <button
        type="button"
        onClick={() => onChange({ type: leg.type === 'call' ? 'put' : 'call' })}
        className={cn(
          'w-12 rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors',
          leg.type === 'call'
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-orange-500/20 text-orange-400',
        )}
      >
        {leg.type === 'call' ? 'CALL' : 'PUT'}
      </button>

      {/* Strike dropdown */}
      <select
        value={leg.strike}
        onChange={(e) => onChange({ strike: parseFloat(e.target.value) })}
        className="w-20 rounded border border-border/50 bg-navy-dark px-1 py-0.5 font-mono text-xs text-text-primary outline-none focus:border-accent"
      >
        {strikes.map((s) => (
          <option key={s} value={s}>
            {s.toFixed(2)}
          </option>
        ))}
      </select>

      {/* Expiration dropdown */}
      <select
        value={leg.expiration}
        onChange={(e) => onChange({ expiration: e.target.value })}
        className="w-28 rounded border border-border/50 bg-navy-dark px-1 py-0.5 font-mono text-xs text-text-primary outline-none focus:border-accent"
      >
        {expirations.map((exp) => (
          <option key={exp} value={exp}>
            {exp}
          </option>
        ))}
      </select>

      {/* Quantity */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onChange({ quantity: Math.max(1, leg.quantity - 1) })}
          className="rounded px-1 py-0.5 text-xs text-text-muted transition-colors hover:bg-navy-light hover:text-text-primary"
        >
          -
        </button>
        <span className="w-6 text-center font-mono text-xs text-text-primary">{leg.quantity}</span>
        <button
          type="button"
          onClick={() => onChange({ quantity: leg.quantity + 1 })}
          className="rounded px-1 py-0.5 text-xs text-text-muted transition-colors hover:bg-navy-light hover:text-text-primary"
        >
          +
        </button>
      </div>

      {/* Premium display */}
      <span className="min-w-[50px] text-right font-mono text-xs tabular-nums text-text-secondary">
        ${leg.premium.toFixed(2)}
      </span>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="ml-auto rounded p-0.5 text-text-muted transition-colors hover:bg-trading-red/20 hover:text-trading-red"
        title="Remove leg"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
        </svg>
      </button>
    </div>
  )
}
