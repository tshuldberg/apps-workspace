'use client'

import { useCallback, useRef, useState, useMemo } from 'react'
import { cn } from '../lib/utils.js'
import type { Strategy, StrategyLeg } from '@marlin/shared'
import { calculateLegPnLAtExpiry } from '@marlin/shared'

export interface StrategyLegEditorProps {
  strategy: Strategy
  availableStrikes: number[]
  onStrategyChange: (strategy: Strategy) => void
  className?: string
}

/**
 * Inline leg editor with drag-to-reorder, quick-adjust controls,
 * and per-leg P&L contribution display.
 */
export function StrategyLegEditor({
  strategy,
  availableStrikes,
  onStrategyChange,
  className,
}: StrategyLegEditorProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)

  // ── Reorder ──────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx)
    dragRef.current = idx
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }, [])

  const handleDrop = useCallback(
    (idx: number) => {
      const fromIdx = dragRef.current
      if (fromIdx === null || fromIdx === idx) {
        setDragIdx(null)
        setDragOverIdx(null)
        return
      }

      const newLegs = [...strategy.legs]
      const [moved] = newLegs.splice(fromIdx, 1)
      newLegs.splice(idx, 0, moved!)

      onStrategyChange({ ...strategy, legs: newLegs })
      setDragIdx(null)
      setDragOverIdx(null)
      dragRef.current = null
    },
    [strategy, onStrategyChange],
  )

  const handleDragEnd = useCallback(() => {
    setDragIdx(null)
    setDragOverIdx(null)
    dragRef.current = null
  }, [])

  // ── Leg mutations ─────────────────────────────────────────────────────────

  const updateLeg = useCallback(
    (legId: string, updates: Partial<StrategyLeg>) => {
      const updatedLegs = strategy.legs.map((leg) =>
        leg.id === legId ? { ...leg, ...updates } : leg,
      )
      onStrategyChange({ ...strategy, legs: updatedLegs })
    },
    [strategy, onStrategyChange],
  )

  const removeLeg = useCallback(
    (legId: string) => {
      onStrategyChange({
        ...strategy,
        legs: strategy.legs.filter((l) => l.id !== legId),
      })
    },
    [strategy, onStrategyChange],
  )

  /**
   * Move strike up/down by one step in the available strikes array.
   */
  const adjustStrike = useCallback(
    (legId: string, direction: 1 | -1) => {
      const leg = strategy.legs.find((l) => l.id === legId)
      if (!leg || availableStrikes.length === 0) return

      const sorted = [...availableStrikes].sort((a, b) => a - b)
      const currentIdx = sorted.findIndex((s) => s === leg.strike)
      if (currentIdx === -1) return

      const newIdx = currentIdx + direction
      if (newIdx < 0 || newIdx >= sorted.length) return

      updateLeg(legId, { strike: sorted[newIdx]! })
    },
    [strategy.legs, availableStrikes, updateLeg],
  )

  const adjustQuantity = useCallback(
    (legId: string, delta: number) => {
      const leg = strategy.legs.find((l) => l.id === legId)
      if (!leg) return
      const newQty = Math.max(1, leg.quantity + delta)
      updateLeg(legId, { quantity: newQty })
    },
    [strategy.legs, updateLeg],
  )

  // ── Render ───────────────────────────────────────────────────────────────

  if (strategy.legs.length === 0) {
    return (
      <div className={cn('rounded border border-border bg-navy-dark p-4', className)}>
        <p className="text-center text-xs text-text-muted">No legs to edit</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1 rounded border border-border bg-navy-dark p-2', className)}>
      {/* Header */}
      <div className="grid grid-cols-[24px_60px_52px_90px_70px_60px_80px_auto_28px] items-center gap-1 px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
        <span />
        <span>Side</span>
        <span>Type</span>
        <span>Strike</span>
        <span>Qty</span>
        <span>Premium</span>
        <span>Leg P&L</span>
        <span>Expiration</span>
        <span />
      </div>

      {strategy.legs.map((leg, idx) => (
        <LegEditorRow
          key={leg.id}
          leg={leg}
          index={idx}
          underlyingPrice={strategy.underlyingPrice}
          isDragging={dragIdx === idx}
          isDragOver={dragOverIdx === idx}
          availableStrikes={availableStrikes}
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragEnd={handleDragEnd}
          onSideToggle={() =>
            updateLeg(leg.id, { side: leg.side === 'buy' ? 'sell' : 'buy' })
          }
          onTypeToggle={() =>
            updateLeg(leg.id, { type: leg.type === 'call' ? 'put' : 'call' })
          }
          onStrikeUp={() => adjustStrike(leg.id, 1)}
          onStrikeDown={() => adjustStrike(leg.id, -1)}
          onQuantityUp={() => adjustQuantity(leg.id, 1)}
          onQuantityDown={() => adjustQuantity(leg.id, -1)}
          onRemove={() => removeLeg(leg.id)}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Leg Row
// ---------------------------------------------------------------------------

interface LegEditorRowProps {
  leg: StrategyLeg
  index: number
  underlyingPrice: number
  isDragging: boolean
  isDragOver: boolean
  availableStrikes: number[]
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
  onSideToggle: () => void
  onTypeToggle: () => void
  onStrikeUp: () => void
  onStrikeDown: () => void
  onQuantityUp: () => void
  onQuantityDown: () => void
  onRemove: () => void
}

function LegEditorRow({
  leg,
  index,
  underlyingPrice,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSideToggle,
  onTypeToggle,
  onStrikeUp,
  onStrikeDown,
  onQuantityUp,
  onQuantityDown,
  onRemove,
}: LegEditorRowProps) {
  const legPnl = useMemo(
    () => calculateLegPnLAtExpiry(leg, underlyingPrice),
    [leg, underlyingPrice],
  )

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'grid grid-cols-[24px_60px_52px_90px_70px_60px_80px_auto_28px] items-center gap-1 rounded px-1 py-1 transition-colors',
        isDragging && 'opacity-50',
        isDragOver && 'bg-accent/10',
        !isDragging && !isDragOver && 'hover:bg-navy-mid/30',
      )}
    >
      {/* Drag handle */}
      <div className="flex cursor-grab items-center justify-center text-text-muted active:cursor-grabbing">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="4" cy="3" r="1" />
          <circle cx="8" cy="3" r="1" />
          <circle cx="4" cy="6" r="1" />
          <circle cx="8" cy="6" r="1" />
          <circle cx="4" cy="9" r="1" />
          <circle cx="8" cy="9" r="1" />
        </svg>
      </div>

      {/* Side toggle */}
      <button
        type="button"
        onClick={onSideToggle}
        className={cn(
          'rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors',
          leg.side === 'buy'
            ? 'bg-trading-green/20 text-trading-green hover:bg-trading-green/30'
            : 'bg-trading-red/20 text-trading-red hover:bg-trading-red/30',
        )}
      >
        {leg.side === 'buy' ? 'BUY' : 'SELL'}
      </button>

      {/* Type toggle */}
      <button
        type="button"
        onClick={onTypeToggle}
        className={cn(
          'rounded px-1 py-0.5 text-[11px] font-semibold transition-colors',
          leg.type === 'call'
            ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
            : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30',
        )}
      >
        {leg.type === 'call' ? 'C' : 'P'}
      </button>

      {/* Strike with arrows */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onStrikeDown}
          className="rounded px-0.5 py-0.5 text-text-muted transition-colors hover:bg-navy-light hover:text-text-primary"
          title="Lower strike"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 4L5 6L3 4" />
          </svg>
        </button>
        <span className="min-w-[50px] text-center font-mono text-xs tabular-nums text-text-primary">
          {leg.strike.toFixed(2)}
        </span>
        <button
          type="button"
          onClick={onStrikeUp}
          className="rounded px-0.5 py-0.5 text-text-muted transition-colors hover:bg-navy-light hover:text-text-primary"
          title="Higher strike"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 6L5 4L7 6" />
          </svg>
        </button>
      </div>

      {/* Quantity +/- */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onQuantityDown}
          className="rounded px-1 py-0.5 text-xs text-text-muted transition-colors hover:bg-navy-light hover:text-text-primary"
        >
          -
        </button>
        <span className="w-6 text-center font-mono text-xs tabular-nums text-text-primary">
          {leg.quantity}
        </span>
        <button
          type="button"
          onClick={onQuantityUp}
          className="rounded px-1 py-0.5 text-xs text-text-muted transition-colors hover:bg-navy-light hover:text-text-primary"
        >
          +
        </button>
      </div>

      {/* Premium */}
      <span className="text-right font-mono text-xs tabular-nums text-text-secondary">
        ${leg.premium.toFixed(2)}
      </span>

      {/* Leg P&L at current price */}
      <span
        className={cn(
          'text-right font-mono text-xs tabular-nums',
          legPnl > 0 ? 'text-trading-green' : legPnl < 0 ? 'text-trading-red' : 'text-text-muted',
        )}
      >
        {legPnl >= 0 ? '+' : ''}${legPnl.toFixed(0)}
      </span>

      {/* Expiration */}
      <span className="font-mono text-xs text-text-muted">{leg.expiration}</span>

      {/* Delete */}
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center justify-center rounded p-0.5 text-text-muted transition-colors hover:bg-trading-red/20 hover:text-trading-red"
        title="Remove leg"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  )
}
