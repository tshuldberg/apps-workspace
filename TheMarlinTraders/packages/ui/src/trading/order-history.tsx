'use client'

import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'

export type OrderStatus = 'pending' | 'filled' | 'partially_filled' | 'cancelled'

export interface OrderHistoryRow {
  id: string
  createdAt: string
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit' | 'stop'
  quantity: number
  filledQuantity?: number
  filledPrice?: string | null
  limitPrice?: string | null
  stopPrice?: string | null
  status: OrderStatus
}

export interface OrderHistoryProps {
  orders: OrderHistoryRow[]
  onCancel?: (orderId: string) => void
  className?: string
}

function formatPrice(price: string | null | undefined): string {
  if (!price) return '--'
  return parseFloat(price).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'text-warning',
  filled: 'text-trading-green',
  partially_filled: 'text-info',
  cancelled: 'text-text-muted',
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  filled: 'Filled',
  partially_filled: 'Partial',
  cancelled: 'Cancelled',
}

export function OrderHistory({ orders, onCancel, className }: OrderHistoryProps) {
  return (
    <div className={cn('flex flex-col rounded-panel border border-border bg-navy-dark', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-semibold text-text-primary">Order History</span>
        <span className="text-xs text-text-muted">{orders.length} orders</span>
      </div>

      {orders.length === 0 ? (
        <div className="p-4 text-center text-sm text-text-muted">No orders yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Symbol</th>
                <th className="px-4 py-2 font-medium">Side</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium text-right">Qty</th>
                <th className="px-4 py-2 font-medium text-right">Price</th>
                <th className="px-4 py-2 font-medium text-right">Status</th>
                {onCancel && <th className="px-4 py-2 font-medium text-right" />}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const displayPrice =
                  order.status === 'filled'
                    ? order.filledPrice
                    : order.type === 'limit'
                      ? order.limitPrice
                      : order.type === 'stop'
                        ? order.stopPrice
                        : null
                return (
                  <tr
                    key={order.id}
                    className="border-b border-border/50 hover:bg-navy-mid/50"
                  >
                    <td className="px-4 py-2 text-text-secondary">
                      {formatTime(order.createdAt)}
                    </td>
                    <td className="px-4 py-2 font-mono font-semibold text-text-primary">
                      {order.symbol}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2 font-semibold uppercase',
                        order.side === 'buy' ? 'text-trading-green' : 'text-trading-red',
                      )}
                    >
                      {order.side}
                    </td>
                    <td className="px-4 py-2 capitalize text-text-secondary">{order.type}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-text-primary">
                      {order.filledQuantity && order.filledQuantity !== order.quantity
                        ? `${order.filledQuantity}/${order.quantity}`
                        : order.quantity}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-text-secondary">
                      {order.type === 'market' && order.status === 'pending'
                        ? 'MKT'
                        : formatPrice(displayPrice)}
                    </td>
                    <td className={cn('px-4 py-2 text-right font-medium', STATUS_STYLES[order.status])}>
                      {STATUS_LABELS[order.status]}
                    </td>
                    {onCancel && (
                      <td className="px-4 py-2 text-right">
                        {order.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCancel(order.id)}
                            className="text-text-muted hover:text-trading-red"
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
