'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'
import type { DOMLevel } from '@marlin/shared'

export interface DOMLadderProps {
  /** DOM levels to display (from getDOM) */
  levels: DOMLevel[]
  /** Current last trade price */
  lastPrice?: number
  /** Tick size for display (e.g. 0.01) */
  tickSize?: number
  /** Called when user clicks a bid level to sell limit */
  onSellLimit?: (price: number) => void
  /** Called when user clicks an ask level to buy limit */
  onBuyLimit?: (price: number) => void
  /** Called when user drags an order line to a new price */
  onModifyOrder?: (orderId: string, newPrice: number) => void
  /** Active orders to display on the ladder */
  activeOrders?: Array<{
    id: string
    side: 'buy' | 'sell'
    price: number
    quantity: number
    type: string
  }>
  className?: string
}

function formatSize(size: number): string {
  if (size === 0) return ''
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)}M`
  if (size >= 1_000) return `${(size / 1_000).toFixed(1)}K`
  return size.toString()
}

function formatPrice(price: number, tickSize: number): string {
  const decimals = Math.max(0, -Math.floor(Math.log10(tickSize)))
  return price.toFixed(decimals)
}

export function DOMLadder({
  levels,
  lastPrice,
  tickSize = 0.01,
  onSellLimit,
  onBuyLimit,
  onModifyOrder,
  activeOrders = [],
  className,
}: DOMLadderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAutoCenter, setIsAutoCenter] = useState(true)

  // Find the max bid/ask size for bar width normalization
  const maxBidSize = useMemo(
    () => Math.max(...levels.map((l) => l.bidSize), 1),
    [levels],
  )
  const maxAskSize = useMemo(
    () => Math.max(...levels.map((l) => l.askSize), 1),
    [levels],
  )

  // Auto-center: scroll to keep the best bid/ask visible
  useEffect(() => {
    if (!isAutoCenter || !containerRef.current) return
    const bestBidIdx = levels.findIndex((l) => l.isBestBid)
    const bestAskIdx = levels.findIndex((l) => l.isBestAsk)
    const centerIdx = bestBidIdx >= 0 && bestAskIdx >= 0
      ? Math.floor((bestBidIdx + bestAskIdx) / 2)
      : bestBidIdx >= 0
        ? bestBidIdx
        : bestAskIdx >= 0
          ? bestAskIdx
          : Math.floor(levels.length / 2)

    const rowHeight = 24
    const scrollTarget = centerIdx * rowHeight - containerRef.current.clientHeight / 2
    containerRef.current.scrollTo({ top: scrollTarget, behavior: 'smooth' })
  }, [levels, isAutoCenter])

  // Build order map by price for quick lookup
  const ordersByPrice = useMemo(() => {
    const map = new Map<string, typeof activeOrders>()
    for (const order of activeOrders) {
      const key = formatPrice(order.price, tickSize)
      const existing = map.get(key) ?? []
      existing.push(order)
      map.set(key, existing)
    }
    return map
  }, [activeOrders, tickSize])

  const handleBidClick = useCallback(
    (price: number) => {
      onSellLimit?.(price)
    },
    [onSellLimit],
  )

  const handleAskClick = useCallback(
    (price: number) => {
      onBuyLimit?.(price)
    },
    [onBuyLimit],
  )

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-panel border border-border bg-navy-dark', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-semibold text-text-primary">Depth of Market</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 px-2 text-[10px]',
              isAutoCenter ? 'text-accent' : 'text-text-muted',
            )}
            onClick={() => setIsAutoCenter(!isAutoCenter)}
          >
            {isAutoCenter ? 'Auto' : 'Manual'}
          </Button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_1fr] border-b border-border bg-navy-mid/50 px-1 py-0.5">
        <span className="text-right text-[10px] font-medium uppercase tracking-wider text-trading-green">
          Bid
        </span>
        <span className="text-center text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Price
        </span>
        <span className="text-left text-[10px] font-medium uppercase tracking-wider text-trading-red">
          Ask
        </span>
      </div>

      {/* Scrollable price ladder */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        onScroll={() => setIsAutoCenter(false)}
      >
        {levels.map((level) => {
          const priceStr = formatPrice(level.price, tickSize)
          const orders = ordersByPrice.get(priceStr) ?? []
          const bidBarWidth = level.bidSize > 0 ? (level.bidSize / maxBidSize) * 100 : 0
          const askBarWidth = level.askSize > 0 ? (level.askSize / maxAskSize) * 100 : 0
          const isSpread = !level.isBestBid && !level.isBestAsk && level.bidSize === 0 && level.askSize === 0
          const isLastPrice = lastPrice !== undefined && formatPrice(lastPrice, tickSize) === priceStr

          return (
            <div
              key={priceStr}
              className={cn(
                'grid h-6 grid-cols-[1fr_80px_1fr] items-center border-b border-border/20 px-1',
                isLastPrice && 'bg-accent/10',
              )}
            >
              {/* Bid side */}
              <button
                type="button"
                className="relative flex h-full items-center justify-end overflow-hidden"
                onClick={() => handleBidClick(level.price)}
                disabled={level.bidSize === 0}
              >
                {/* Volume bar background */}
                <div
                  className={cn(
                    'absolute right-0 top-0 h-full transition-all duration-150',
                    level.isBestBid ? 'bg-trading-green/30' : 'bg-trading-green/15',
                  )}
                  style={{ width: `${bidBarWidth}%` }}
                />
                {/* Size text */}
                <span
                  className={cn(
                    'relative z-10 font-mono text-[11px] tabular-nums',
                    level.isBestBid ? 'font-semibold text-trading-green' : 'text-trading-green/80',
                  )}
                >
                  {formatSize(level.bidSize)}
                </span>
              </button>

              {/* Price center column */}
              <div className="flex items-center justify-center gap-0.5">
                {/* Order indicators */}
                {orders.length > 0 && (
                  <div className="flex gap-0.5">
                    {orders.map((o) => (
                      <div
                        key={o.id}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          o.side === 'buy' ? 'bg-trading-green' : 'bg-trading-red',
                        )}
                        title={`${o.type} ${o.side} ${o.quantity} @ ${o.price}`}
                      />
                    ))}
                  </div>
                )}
                <span
                  className={cn(
                    'font-mono text-[11px] font-medium tabular-nums',
                    level.isBestBid ? 'text-trading-green' : '',
                    level.isBestAsk ? 'text-trading-red' : '',
                    isLastPrice ? 'font-bold text-accent' : '',
                    !level.isBestBid && !level.isBestAsk && !isLastPrice ? 'text-text-secondary' : '',
                  )}
                >
                  {priceStr}
                </span>
              </div>

              {/* Ask side */}
              <button
                type="button"
                className="relative flex h-full items-center justify-start overflow-hidden"
                onClick={() => handleAskClick(level.price)}
                disabled={level.askSize === 0}
              >
                {/* Volume bar background */}
                <div
                  className={cn(
                    'absolute left-0 top-0 h-full transition-all duration-150',
                    level.isBestAsk ? 'bg-trading-red/30' : 'bg-trading-red/15',
                  )}
                  style={{ width: `${askBarWidth}%` }}
                />
                {/* Size text */}
                <span
                  className={cn(
                    'relative z-10 font-mono text-[11px] tabular-nums',
                    level.isBestAsk ? 'font-semibold text-trading-red' : 'text-trading-red/80',
                  )}
                >
                  {formatSize(level.askSize)}
                </span>
              </button>
            </div>
          )
        })}

        {levels.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-text-muted">
            No order book data
          </div>
        )}
      </div>

      {/* Footer: cumulative totals */}
      {levels.length > 0 && (
        <div className="grid grid-cols-[1fr_80px_1fr] border-t border-border bg-navy-mid/50 px-1 py-1">
          <span className="text-right font-mono text-[10px] tabular-nums text-trading-green/70">
            {formatSize(levels[levels.length - 1]?.cumulativeBidSize ?? 0)} total
          </span>
          <span className="text-center text-[10px] text-text-muted">cum</span>
          <span className="text-left font-mono text-[10px] tabular-nums text-trading-red/70">
            {formatSize(levels[levels.length - 1]?.cumulativeAskSize ?? 0)} total
          </span>
        </div>
      )}
    </div>
  )
}
