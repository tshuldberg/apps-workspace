'use client'

import { useState, useCallback, useMemo } from 'react'
import { VisualStrategyBuilder } from '@marlin/ui/trading/visual-strategy-builder'
import { cn } from '@marlin/ui/lib/utils'
import type { VisualStrategy, StrategyBlock, BlockConnection } from '@marlin/shared'
import { getDefaultPorts, compileToTypeScript, validateStrategy } from '@marlin/shared'

// ── Example MA Crossover (pre-loaded as visual blocks) ──────────────────────

function createExampleStrategy(): VisualStrategy {
  const emaFast: StrategyBlock = {
    id: 'ema_fast',
    type: 'indicator',
    label: 'EMA (12)',
    config: { variant: 'ema' as const, period: 12, source: 'close' as const },
    position: { x: 80, y: 80 },
    ports: getDefaultPorts('indicator', 'ema'),
  }

  const emaSlow: StrategyBlock = {
    id: 'ema_slow',
    type: 'indicator',
    label: 'EMA (26)',
    config: { variant: 'ema' as const, period: 26, source: 'close' as const },
    position: { x: 80, y: 260 },
    ports: getDefaultPorts('indicator', 'ema'),
  }

  const crossover: StrategyBlock = {
    id: 'cross_above',
    type: 'condition',
    label: 'Crossover',
    config: { variant: 'indicator_crossover' as const, fastSource: 'fast', slowSource: 'slow', direction: 'cross_above' as const },
    position: { x: 380, y: 120 },
    ports: getDefaultPorts('condition', 'indicator_crossover'),
  }

  const crossunder: StrategyBlock = {
    id: 'cross_below',
    type: 'condition',
    label: 'Crossunder',
    config: { variant: 'indicator_crossover' as const, fastSource: 'fast', slowSource: 'slow', direction: 'cross_below' as const },
    position: { x: 380, y: 320 },
    ports: getDefaultPorts('condition', 'indicator_crossover'),
  }

  const buyAction: StrategyBlock = {
    id: 'buy_action',
    type: 'action',
    label: 'Buy Market',
    config: { variant: 'buy_market' as const, quantity: 100, quantityType: 'shares' as const },
    position: { x: 680, y: 120 },
    ports: getDefaultPorts('action', 'buy_market'),
  }

  const closeAction: StrategyBlock = {
    id: 'close_action',
    type: 'action',
    label: 'Close Position',
    config: { variant: 'close_position' as const, closePercent: 100 },
    position: { x: 680, y: 320 },
    ports: getDefaultPorts('action', 'close_position'),
  }

  const connections: BlockConnection[] = [
    // EMA Fast → Crossover (fast input)
    { id: 'c1', fromBlockId: 'ema_fast', fromPort: 'value', toBlockId: 'cross_above', toPort: 'fast' },
    // EMA Slow → Crossover (slow input)
    { id: 'c2', fromBlockId: 'ema_slow', fromPort: 'value', toBlockId: 'cross_above', toPort: 'slow' },
    // EMA Fast → Crossunder (fast input)
    { id: 'c3', fromBlockId: 'ema_fast', fromPort: 'value', toBlockId: 'cross_below', toPort: 'fast' },
    // EMA Slow → Crossunder (slow input)
    { id: 'c4', fromBlockId: 'ema_slow', fromPort: 'value', toBlockId: 'cross_below', toPort: 'slow' },
    // Crossover → Buy
    { id: 'c5', fromBlockId: 'cross_above', fromPort: 'result', toBlockId: 'buy_action', toPort: 'trigger' },
    // Crossunder → Close
    { id: 'c6', fromBlockId: 'cross_below', fromPort: 'result', toBlockId: 'close_action', toPort: 'trigger' },
  ]

  return {
    name: 'MA Crossover Strategy',
    description: 'EMA 12/26 crossover: buy on golden cross, close on death cross.',
    blocks: [emaFast, emaSlow, crossover, crossunder, buyAction, closeAction],
    connections,
  }
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function VisualStrategyPage() {
  const [strategy, setStrategy] = useState<VisualStrategy>(createExampleStrategy)
  const [strategyName, setStrategyName] = useState('MA Crossover Strategy')
  const [isSaved, setIsSaved] = useState(false)

  const validationErrors = useMemo(() => validateStrategy(strategy), [strategy])
  const generatedCode = useMemo(() => {
    if (strategy.blocks.length === 0) return ''
    return compileToTypeScript(strategy)
  }, [strategy])

  const handleStrategyChange = useCallback((updated: VisualStrategy) => {
    setStrategy(updated)
    setIsSaved(false)
  }, [])

  const handleSave = useCallback(() => {
    // In production: call tRPC endpoint to persist the strategy
    // For now, save to localStorage as a demo
    const payload = {
      ...strategy,
      name: strategyName,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem('marlin_visual_strategy', JSON.stringify(payload))
    setIsSaved(true)
  }, [strategy, strategyName])

  const handleLoad = useCallback(() => {
    const raw = localStorage.getItem('marlin_visual_strategy')
    if (!raw) return
    try {
      const loaded = JSON.parse(raw) as VisualStrategy
      setStrategy(loaded)
      setStrategyName(loaded.name)
    } catch {
      // Invalid stored data, ignore
    }
  }, [])

  const handleCompileAndCopy = useCallback(() => {
    if (!generatedCode) return
    navigator.clipboard.writeText(generatedCode)
  }, [generatedCode])

  const handleLoadExample = useCallback(() => {
    setStrategy(createExampleStrategy())
    setStrategyName('MA Crossover Strategy')
    setIsSaved(false)
  }, [])

  return (
    <div className="flex h-full flex-col bg-navy-black">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-border bg-navy-dark px-6 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-text-primary">Visual Strategy Builder</h1>
          <div className="h-4 w-px bg-border" />
          <input
            type="text"
            value={strategyName}
            onChange={(e) => {
              setStrategyName(e.target.value)
              setIsSaved(false)
            }}
            className="w-56 rounded border border-border bg-navy-mid px-2 py-1 text-xs text-text-primary outline-none transition-colors focus:border-accent"
            placeholder="Strategy name..."
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Block count */}
          <span className="text-[10px] text-text-muted">
            {strategy.blocks.length} block{strategy.blocks.length !== 1 ? 's' : ''} |{' '}
            {strategy.connections.length} connection{strategy.connections.length !== 1 ? 's' : ''}
          </span>

          <div className="h-4 w-px bg-border" />

          <button
            type="button"
            onClick={handleLoadExample}
            className="rounded px-3 py-1 text-xs text-text-muted transition-colors hover:bg-navy-mid hover:text-text-primary"
          >
            Load Example
          </button>

          <button
            type="button"
            onClick={handleLoad}
            className="rounded px-3 py-1 text-xs text-text-muted transition-colors hover:bg-navy-mid hover:text-text-primary"
          >
            Load Saved
          </button>

          <button
            type="button"
            onClick={handleSave}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium transition-colors',
              isSaved
                ? 'bg-trading-green/20 text-trading-green'
                : 'bg-navy-mid text-text-muted hover:text-text-primary',
            )}
          >
            {isSaved ? 'Saved' : 'Save'}
          </button>

          <button
            type="button"
            onClick={handleCompileAndCopy}
            disabled={strategy.blocks.length === 0}
            className={cn(
              'rounded px-3 py-1 text-xs font-semibold transition-colors',
              strategy.blocks.length > 0 && validationErrors.length === 0
                ? 'bg-accent text-text-primary hover:bg-accent/80'
                : strategy.blocks.length > 0
                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  : 'cursor-not-allowed bg-navy-mid text-text-muted',
            )}
          >
            Compile to Code
          </button>
        </div>
      </div>

      {/* Builder canvas (fills remaining space) */}
      <VisualStrategyBuilder
        strategy={strategy}
        onStrategyChange={handleStrategyChange}
        className="flex-1"
      />
    </div>
  )
}
