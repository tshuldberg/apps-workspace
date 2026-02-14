'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/utils.js'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../primitives/dropdown-menu.js'

export type OrderLineType = 'limit' | 'stop' | 'trailing_stop' | 'take_profit' | 'stop_loss'

export interface OrderLine {
  id: string
  side: 'buy' | 'sell'
  type: OrderLineType
  price: number
  quantity: number
  symbol: string
  /** Group ID for bracket orders (links entry + TP + SL) */
  bracketGroupId?: string
  /** Trail distance for trailing stop orders */
  trailDistance?: number
}

export interface ChartOrderLinesProps {
  /** Pending orders to display on the chart */
  orders: OrderLine[]
  /** Current chart price range */
  priceRange: { min: number; max: number }
  /** Chart container height in pixels */
  chartHeight: number
  /** Called when user drags an order to a new price */
  onModifyPrice?: (orderId: string, newPrice: number) => void
  /** Called when user right-clicks -> Cancel */
  onCancel?: (orderId: string) => void
  /** Called when user right-clicks -> View Details */
  onViewDetails?: (orderId: string) => void
  className?: string
}

/** Map order type to dash pattern */
function getLineStyle(type: OrderLineType): string {
  switch (type) {
    case 'stop':
    case 'stop_loss':
      return '' // solid
    case 'limit':
    case 'take_profit':
      return '8 4' // dashed
    case 'trailing_stop':
      return '2 4' // dotted
    default:
      return '8 4'
  }
}

/** Map order type to display label */
function getTypeLabel(type: OrderLineType): string {
  switch (type) {
    case 'limit':
      return 'LMT'
    case 'stop':
      return 'STP'
    case 'trailing_stop':
      return 'TRAIL'
    case 'take_profit':
      return 'TP'
    case 'stop_loss':
      return 'SL'
    default:
      return type.toUpperCase()
  }
}

function priceToY(price: number, min: number, max: number, height: number): number {
  if (max === min) return height / 2
  return height - ((price - min) / (max - min)) * height
}

function yToPrice(y: number, min: number, max: number, height: number): number {
  if (height === 0) return min
  return max - (y / height) * (max - min)
}

export function ChartOrderLines({
  orders,
  priceRange,
  chartHeight,
  onModifyPrice,
  onCancel,
  onViewDetails,
  className,
}: ChartOrderLinesProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragY, setDragY] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(
    (orderId: string, e: React.MouseEvent) => {
      if (e.button !== 0) return // Only left-click for drag
      e.preventDefault()
      setDraggingId(orderId)
      setDragY(e.clientY)
    },
    [],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingId) return
      setDragY(e.clientY)
    },
    [draggingId],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingId || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const localY = e.clientY - rect.top
      const newPrice = yToPrice(localY, priceRange.min, priceRange.max, chartHeight)
      const roundedPrice = Math.round(newPrice * 100) / 100

      onModifyPrice?.(draggingId, roundedPrice)
      setDraggingId(null)
      setDragY(null)
    },
    [draggingId, priceRange, chartHeight, onModifyPrice],
  )

  // Group bracket orders for connected-line visualization
  const bracketGroups = useMemo(() => {
    const groups = new Map<string, OrderLine[]>()
    for (const order of orders) {
      if (order.bracketGroupId) {
        const group = groups.get(order.bracketGroupId) ?? []
        group.push(order)
        groups.set(order.bracketGroupId, group)
      }
    }
    return groups
  }, [orders])

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none absolute inset-0', className)}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setDraggingId(null)
        setDragY(null)
      }}
    >
      <svg width="100%" height={chartHeight} className="absolute inset-0">
        {/* Bracket connection lines (vertical connectors between entry/TP/SL) */}
        {[...bracketGroups.entries()].map(([groupId, groupOrders]) => {
          if (groupOrders.length < 2) return null
          const sortedByPrice = [...groupOrders].sort((a, b) => b.price - a.price)
          const topY = priceToY(sortedByPrice[0]!.price, priceRange.min, priceRange.max, chartHeight)
          const bottomY = priceToY(
            sortedByPrice[sortedByPrice.length - 1]!.price,
            priceRange.min,
            priceRange.max,
            chartHeight,
          )

          return (
            <line
              key={`bracket-${groupId}`}
              x1="40"
              y1={topY}
              x2="40"
              y2={bottomY}
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="4 2"
              opacity="0.5"
            />
          )
        })}

        {/* Order lines */}
        {orders.map((order) => {
          const isDragging = draggingId === order.id
          let y: number

          if (isDragging && dragY !== null && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            y = dragY - rect.top
          } else {
            y = priceToY(order.price, priceRange.min, priceRange.max, chartHeight)
          }

          // Skip if outside visible range
          if (y < -20 || y > chartHeight + 20) return null

          const color = order.side === 'buy' ? '#22c55e' : '#ef4444'
          const dashArray = getLineStyle(order.type)

          return (
            <g key={order.id}>
              {/* Main horizontal line */}
              <line
                x1="50"
                y1={y}
                x2="100%"
                y2={y}
                stroke={color}
                strokeWidth={isDragging ? 2 : 1}
                strokeDasharray={dashArray || undefined}
                opacity={isDragging ? 1 : 0.8}
              />

              {/* Trailing stop trail indicator */}
              {order.type === 'trailing_stop' && order.trailDistance && (
                <line
                  x1="50"
                  y1={y}
                  x2="50"
                  y2={priceToY(
                    order.price + (order.side === 'sell' ? -order.trailDistance : order.trailDistance),
                    priceRange.min,
                    priceRange.max,
                    chartHeight,
                  )}
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.5"
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Order labels (HTML overlay for text + interactivity) */}
      {orders.map((order) => {
        const isDragging = draggingId === order.id
        let y: number

        if (isDragging && dragY !== null && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          y = dragY - rect.top
        } else {
          y = priceToY(order.price, priceRange.min, priceRange.max, chartHeight)
        }

        if (y < -20 || y > chartHeight + 20) return null

        const isBuy = order.side === 'buy'
        const currentPrice = isDragging && dragY !== null && containerRef.current
          ? Math.round(
              yToPrice(
                dragY - containerRef.current.getBoundingClientRect().top,
                priceRange.min,
                priceRange.max,
                chartHeight,
              ) * 100,
            ) / 100
          : order.price

        return (
          <DropdownMenu key={order.id}>
            <DropdownMenuTrigger asChild>
              <div
                className={cn(
                  'pointer-events-auto absolute left-0 flex cursor-grab items-center gap-1 rounded-r px-2 py-0.5',
                  isBuy ? 'bg-trading-green/90' : 'bg-trading-red/90',
                  isDragging && 'cursor-grabbing opacity-90',
                )}
                style={{ top: y - 10 }}
                onMouseDown={(e) => handleMouseDown(order.id, e)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <span className="font-mono text-[10px] font-bold text-white">
                  {getTypeLabel(order.type)}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-white/90">
                  {order.quantity}@{currentPrice.toFixed(2)}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem
                onSelect={() => onViewDetails?.(order.id)}
              >
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-trading-red"
                onSelect={() => onCancel?.(order.id)}
              >
                Cancel Order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </div>
  )
}
