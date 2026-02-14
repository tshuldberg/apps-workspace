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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../primitives/dialog.js'

// ── Types ────────────────────────────────────────────────

export type OrderManagerStatus =
  | 'new'
  | 'accepted'
  | 'pending_new'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'expired'
  | 'rejected'
  | 'replaced'

export interface ManagedOrder {
  id: string
  brokerOrderId: string
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop'
  quantity: number
  filledQuantity: number
  limitPrice?: number
  stopPrice?: number
  avgFillPrice?: number
  status: OrderManagerStatus
  provider: 'paper' | 'alpaca' | 'ibkr' | 'tradier'
  accountId: string
  accountAlias?: string
  /** OCA group this order belongs to (IBKR) */
  ocaGroup?: string
  /** Parent order ID for bracket children */
  parentOrderId?: string
  submittedAt: string
  filledAt?: string
}

export interface OrderManagerProps {
  orders: ManagedOrder[]
  onCancel?: (orderId: string) => void
  onCancelAll?: () => void
  onModify?: (orderId: string, changes: { limitPrice?: number; quantity?: number }) => void
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const STATUS_STYLES: Record<OrderManagerStatus, string> = {
  new: 'text-accent',
  accepted: 'text-accent',
  pending_new: 'text-warning',
  partially_filled: 'text-info',
  filled: 'text-trading-green',
  cancelled: 'text-text-muted',
  expired: 'text-text-muted',
  rejected: 'text-trading-red',
  replaced: 'text-text-muted',
}

const STATUS_LABELS: Record<OrderManagerStatus, string> = {
  new: 'New',
  accepted: 'Accepted',
  pending_new: 'Pending',
  partially_filled: 'Partial',
  filled: 'Filled',
  cancelled: 'Cancelled',
  expired: 'Expired',
  rejected: 'Rejected',
  replaced: 'Replaced',
}

const PROVIDER_LABELS: Record<string, string> = {
  paper: 'Paper',
  alpaca: 'Alpaca',
  ibkr: 'IBKR',
  tradier: 'Tradier',
}

// ── Modify Dialog ────────────────────────────────────────

function ModifyDialog({
  order,
  onModify,
}: {
  order: ManagedOrder
  onModify: (orderId: string, changes: { limitPrice?: number; quantity?: number }) => void
}) {
  const [newPrice, setNewPrice] = useState(order.limitPrice?.toString() ?? '')
  const [newQty, setNewQty] = useState(order.quantity.toString())

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs text-accent">
          Modify
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modify Order</DialogTitle>
          <DialogDescription>
            Modify the price or quantity for {order.symbol} {order.side.toUpperCase()} order
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {order.type !== 'market' && (
            <div className="space-y-1">
              <label className="text-xs text-text-muted">
                {order.type === 'limit' || order.type === 'stop_limit' ? 'Limit Price' : 'Stop Price'}
              </label>
              <Input
                variant="monospace"
                type="number"
                step={0.01}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Quantity</label>
            <Input
              variant="monospace"
              type="number"
              step={1}
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            size="sm"
            onClick={() => {
              const changes: { limitPrice?: number; quantity?: number } = {}
              const price = parseFloat(newPrice)
              const qty = parseInt(newQty, 10)
              if (price > 0 && price !== order.limitPrice) changes.limitPrice = price
              if (qty > 0 && qty !== order.quantity) changes.quantity = qty
              onModify(order.id, changes)
            }}
          >
            Confirm Modify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Component ────────────────────────────────────────────

export function OrderManager({
  orders,
  onCancel,
  onCancelAll,
  onModify,
  className,
}: OrderManagerProps) {
  const [filterBroker, setFilterBroker] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSymbol, setFilterSymbol] = useState('')
  const [showCancelAllConfirm, setShowCancelAllConfirm] = useState(false)

  // Get unique brokers and accounts for filter
  const uniqueBrokers = useMemo(() => {
    const set = new Set(orders.map((o) => o.provider))
    return Array.from(set)
  }, [orders])

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterBroker !== 'all' && o.provider !== filterBroker) return false
      if (filterStatus !== 'all' && o.status !== filterStatus) return false
      if (
        filterSymbol &&
        !o.symbol.toLowerCase().includes(filterSymbol.toLowerCase())
      )
        return false
      return true
    })
  }, [orders, filterBroker, filterStatus, filterSymbol])

  // Group OCA orders together
  const groupedOrders = useMemo(() => {
    const ocaGroups = new Map<string, ManagedOrder[]>()
    const ungrouped: ManagedOrder[] = []

    for (const order of filteredOrders) {
      if (order.ocaGroup) {
        const group = ocaGroups.get(order.ocaGroup) ?? []
        group.push(order)
        ocaGroups.set(order.ocaGroup, group)
      } else {
        ungrouped.push(order)
      }
    }

    return { ocaGroups, ungrouped }
  }, [filteredOrders])

  const pendingCount = filteredOrders.filter(
    (o) => o.status === 'new' || o.status === 'accepted' || o.status === 'pending_new',
  ).length

  const handleCancelAll = useCallback(() => {
    setShowCancelAllConfirm(false)
    onCancelAll?.()
  }, [onCancelAll])

  const isModifiable = (order: ManagedOrder) =>
    (order.status === 'new' || order.status === 'accepted') &&
    order.type !== 'market'

  const isCancellable = (order: ManagedOrder) =>
    order.status === 'new' ||
    order.status === 'accepted' ||
    order.status === 'pending_new' ||
    order.status === 'partially_filled'

  return (
    <div
      className={cn(
        'flex flex-col rounded-panel border border-border bg-navy-dark',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">
            Orders
          </span>
          <span className="text-xs text-text-muted">
            {filteredOrders.length} total, {pendingCount} pending
          </span>
        </div>
        {onCancelAll && pendingCount > 0 && (
          <div>
            {showCancelAllConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-trading-red">Cancel all?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancelAll}
                  className="h-6 text-xs"
                >
                  Yes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCancelAllConfirm(false)}
                  className="h-6 text-xs"
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelAllConfirm(true)}
                className="text-xs text-text-muted hover:text-trading-red"
              >
                Cancel All
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-2">
        <Select value={filterBroker} onValueChange={setFilterBroker}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue placeholder="Broker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brokers</SelectItem>
            {uniqueBrokers.map((b) => (
              <SelectItem key={b} value={b}>
                {PROVIDER_LABELS[b] ?? b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="filled">Filled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="partially_filled">Partial</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Filter symbol..."
          value={filterSymbol}
          onChange={(e) => setFilterSymbol(e.target.value)}
          className="h-7 w-32 text-xs"
        />
      </div>

      {/* Orders table */}
      {filteredOrders.length === 0 ? (
        <div className="p-4 text-center text-sm text-text-muted">
          No orders match the current filters
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Price</th>
                <th className="px-3 py-2 font-medium text-right">Fill</th>
                <th className="px-3 py-2 font-medium">Broker</th>
                <th className="px-3 py-2 font-medium text-right">Status</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const displayPrice =
                  order.type === 'market'
                    ? 'MKT'
                    : order.limitPrice
                      ? formatCurrency(order.limitPrice)
                      : order.stopPrice
                        ? formatCurrency(order.stopPrice)
                        : '--'

                return (
                  <tr
                    key={order.id}
                    className={cn(
                      'border-b border-border/50 hover:bg-navy-mid/50',
                      order.ocaGroup && 'bg-accent/5',
                    )}
                  >
                    <td className="px-3 py-2 text-xs text-text-secondary">
                      {formatTime(order.submittedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-semibold text-text-primary">
                          {order.symbol}
                        </span>
                        {order.ocaGroup && (
                          <span className="rounded bg-accent/20 px-1 py-0.5 text-[9px] font-bold text-accent">
                            OCA
                          </span>
                        )}
                        {order.parentOrderId && (
                          <span className="rounded bg-info/20 px-1 py-0.5 text-[9px] font-bold text-info">
                            BKT
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 font-semibold uppercase',
                        order.side === 'buy'
                          ? 'text-trading-green'
                          : 'text-trading-red',
                      )}
                    >
                      {order.side}
                    </td>
                    <td className="px-3 py-2 text-xs capitalize text-text-secondary">
                      {order.type.replace('_', ' ')}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-text-primary">
                      {order.filledQuantity > 0 &&
                      order.filledQuantity !== order.quantity
                        ? `${order.filledQuantity}/${order.quantity}`
                        : order.quantity}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">
                      {displayPrice}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-text-primary">
                      {order.avgFillPrice
                        ? formatCurrency(order.avgFillPrice)
                        : '--'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-bold',
                          order.provider === 'paper' && 'bg-warning/20 text-warning',
                          order.provider === 'alpaca' && 'bg-trading-green/20 text-trading-green',
                          order.provider === 'ibkr' && 'bg-accent/20 text-accent',
                          order.provider === 'tradier' && 'bg-purple-500/20 text-purple-400',
                        )}
                      >
                        {PROVIDER_LABELS[order.provider]}
                      </span>
                      {order.accountAlias && (
                        <span className="ml-1 text-[10px] text-text-muted">
                          {order.accountAlias}
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right text-xs font-medium',
                        STATUS_STYLES[order.status],
                      )}
                    >
                      {STATUS_LABELS[order.status]}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onModify && isModifiable(order) && (
                          <ModifyDialog order={order} onModify={onModify} />
                        )}
                        {onCancel && isCancellable(order) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCancel(order.id)}
                            className="text-xs text-text-muted hover:text-trading-red"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
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
