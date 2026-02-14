'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { MarlinChart, ChartSkeleton, ChartError, type ChartType } from '@marlin/charts'
import type { OHLCV, Timeframe, DOMLevel, OrderBook } from '@marlin/shared'
import { DOMLadder } from '@marlin/ui/trading/dom-ladder'
import { OrderEntry, type OrderEntryValues } from '@marlin/ui/trading/order-entry'
import { ChartOrderLines, type OrderLine } from '@marlin/ui/trading/chart-order-lines'
import { OrderConfirmation, type OrderSummary } from '@marlin/ui/trading/order-confirmation'
import { PositionsPanel, type PositionRow } from '@marlin/ui/trading/positions-panel'

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D', '1W', '1M']

interface TradePageProps {
  params: Promise<{ symbol: string }>
}

type OrderTypeFilter = 'all' | 'pending' | 'filled' | 'cancelled'

export default function TradePage({ params }: TradePageProps) {
  const { symbol } = use(params)
  const displaySymbol = symbol.toUpperCase()

  const [timeframe, setTimeframe] = useState<Timeframe>('5m')
  const [data, setData] = useState<OHLCV[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  // DOM state
  const [domLevels, setDomLevels] = useState<DOMLevel[]>([])
  const [lastPrice, setLastPrice] = useState<number | undefined>()

  // Order state
  const [pendingOrders, setPendingOrders] = useState<OrderLine[]>([])
  const [orderFilter, setOrderFilter] = useState<OrderTypeFilter>('pending')
  const [quantity, setQuantity] = useState(100)

  // Confirmation dialog state
  const [confirmOrder, setConfirmOrder] = useState<OrderSummary | null>(null)
  const [skipConfirmation, setSkipConfirmation] = useState(false)

  // Positions
  const [positions, setPositions] = useState<PositionRow[]>([])

  // Chart container height for order line calculations
  const [chartHeight, setChartHeight] = useState(600)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  // Fetch chart data
  const fetchChartData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const from = new Date()
      from.setMonth(from.getMonth() - 1)
      const input = {
        '0': {
          json: {
            symbol: displaySymbol,
            timeframe,
            from: from.toISOString().slice(0, 10),
            to: new Date().toISOString().slice(0, 10),
          },
        },
      }
      const res = await fetch(
        `${apiUrl}/trpc/market.getBars?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
      )
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json = await res.json()
      const bars: OHLCV[] = json[0]?.result?.data?.json ?? []
      setData(bars)
      if (bars.length > 0) {
        setLastPrice(bars[bars.length - 1]!.close)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [displaySymbol, timeframe, apiUrl])

  useEffect(() => {
    fetchChartData()
  }, [fetchChartData])

  // Fetch order book data
  useEffect(() => {
    async function fetchOrderBook() {
      try {
        const input = { '0': { json: { symbol: displaySymbol, depth: 20 } } }
        const res = await fetch(
          `${apiUrl}/trpc/advancedOrders.getOrderBook?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
        )
        if (!res.ok) return
        const json = await res.json()
        const result = json[0]?.result?.data?.json
        if (result?.dom) {
          setDomLevels(result.dom)
        }
      } catch {
        // Order book is supplementary; don't block on failure
      }
    }
    fetchOrderBook()
    const interval = setInterval(fetchOrderBook, 1000) // Poll every second
    return () => clearInterval(interval)
  }, [displaySymbol, apiUrl])

  // Order submission handler
  const handleOrderSubmit = useCallback(
    (values: OrderEntryValues) => {
      const summary: OrderSummary = {
        symbol: values.symbol,
        side: values.side,
        type: values.type,
        quantity: values.quantity,
        price: values.limitPrice,
        stopPrice: values.stopPrice,
        estimatedTotal:
          values.quantity * (values.limitPrice ?? values.stopPrice ?? lastPrice ?? 0),
      }

      if (skipConfirmation) {
        // Submit immediately
        submitOrder(summary)
      } else {
        setConfirmOrder(summary)
      }
    },
    [lastPrice, skipConfirmation],
  )

  const submitOrder = useCallback(
    (summary: OrderSummary) => {
      // Add to pending orders for chart visualization
      const orderLine: OrderLine = {
        id: crypto.randomUUID(),
        side: summary.side,
        type: summary.type === 'limit' ? 'limit' : summary.type === 'stop' ? 'stop' : 'limit',
        price: summary.price ?? summary.stopPrice ?? lastPrice ?? 0,
        quantity: summary.quantity,
        symbol: summary.symbol,
      }
      setPendingOrders((prev) => [...prev, orderLine])
      setConfirmOrder(null)

      // TODO: Submit via tRPC mutation
    },
    [lastPrice],
  )

  // Click-to-trade from DOM
  const handleDOMBuyLimit = useCallback(
    (price: number) => {
      const summary: OrderSummary = {
        symbol: displaySymbol,
        side: 'buy',
        type: 'limit',
        quantity,
        price,
        estimatedTotal: quantity * price,
      }
      if (skipConfirmation) {
        submitOrder(summary)
      } else {
        setConfirmOrder(summary)
      }
    },
    [displaySymbol, quantity, skipConfirmation, submitOrder],
  )

  const handleDOMSellLimit = useCallback(
    (price: number) => {
      const summary: OrderSummary = {
        symbol: displaySymbol,
        side: 'sell',
        type: 'limit',
        quantity,
        price,
        estimatedTotal: quantity * price,
      }
      if (skipConfirmation) {
        submitOrder(summary)
      } else {
        setConfirmOrder(summary)
      }
    },
    [displaySymbol, quantity, skipConfirmation, submitOrder],
  )

  // Order modification from chart drag
  const handleModifyOrderPrice = useCallback(
    (orderId: string, newPrice: number) => {
      setPendingOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, price: newPrice } : o)),
      )
      // TODO: Submit modify via tRPC mutation
    },
    [],
  )

  // Cancel order
  const handleCancelOrder = useCallback((orderId: string) => {
    setPendingOrders((prev) => prev.filter((o) => o.id !== orderId))
    // TODO: Submit cancel via tRPC mutation
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key.toLowerCase()) {
        case 'b': {
          // Quick buy market
          const summary: OrderSummary = {
            symbol: displaySymbol,
            side: 'buy',
            type: 'market',
            quantity,
            estimatedTotal: quantity * (lastPrice ?? 0),
          }
          setConfirmOrder(summary)
          break
        }
        case 's': {
          // Quick sell market
          const summary: OrderSummary = {
            symbol: displaySymbol,
            side: 'sell',
            type: 'market',
            quantity,
            estimatedTotal: quantity * (lastPrice ?? 0),
          }
          setConfirmOrder(summary)
          break
        }
        case 'c':
          if (e.shiftKey) {
            // Cancel all pending orders
            setPendingOrders([])
          }
          break
        case '=':
        case '+':
          setQuantity((q) => q + 100)
          break
        case '-':
          setQuantity((q) => Math.max(1, q - 100))
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [displaySymbol, quantity, lastPrice])

  // Price range for chart order lines
  const priceRange = useMemo(() => {
    if (!data || data.length === 0) return { min: 0, max: 100 }
    const prices = data.flatMap((d) => [d.high, d.low])
    return {
      min: Math.min(...prices) * 0.99,
      max: Math.max(...prices) * 1.01,
    }
  }, [data])

  return (
    <div className="flex h-full flex-col bg-navy-black">
      {/* Position summary bar */}
      <div className="flex h-8 items-center gap-4 border-b border-border bg-navy-dark px-4">
        <span className="font-mono text-sm font-bold text-text-primary">{displaySymbol}</span>
        {lastPrice !== undefined && (
          <span className="font-mono text-sm tabular-nums text-text-primary">
            ${lastPrice.toFixed(2)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-text-muted">
          <span>Qty: <strong className="text-text-primary">{quantity}</strong></span>
          <span className="text-border">|</span>
          <span>B=Buy S=Sell C=Cancel +-=Qty</span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart area (left ~60%) */}
        <div className="relative flex-[3] overflow-hidden border-r border-border">
          {/* Toolbar */}
          <div className="flex h-8 items-center gap-2 border-b border-border bg-navy-dark px-3">
            <div className="flex gap-0.5 rounded bg-navy-mid p-0.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                    timeframe === tf
                      ? 'bg-accent text-text-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Chart + Order lines overlay */}
          <div className="relative flex-1" style={{ height: `calc(100% - 32px)` }}>
            {loading && !data && <ChartSkeleton />}
            {error && <ChartError error={error} onRetry={fetchChartData} />}
            {data && !error && (
              <>
                <MarlinChart data={data} chartType="candlestick" showVolume />
                <ChartOrderLines
                  orders={pendingOrders}
                  priceRange={priceRange}
                  chartHeight={chartHeight}
                  onModifyPrice={handleModifyOrderPrice}
                  onCancel={handleCancelOrder}
                />
              </>
            )}
          </div>
        </div>

        {/* Right panel (DOM + Order entry, ~20%) */}
        <div className="flex w-80 flex-col overflow-hidden">
          {/* DOM Ladder (top) */}
          <DOMLadder
            levels={domLevels}
            lastPrice={lastPrice}
            tickSize={0.01}
            onBuyLimit={handleDOMBuyLimit}
            onSellLimit={handleDOMSellLimit}
            activeOrders={pendingOrders}
            className="flex-1 overflow-hidden border-b border-border"
          />

          {/* Order entry (bottom) */}
          <OrderEntry
            symbol={displaySymbol}
            onSubmit={handleOrderSubmit}
            className="border-b border-border"
          />
        </div>
      </div>

      {/* Bottom panel: Active orders */}
      <div className="h-48 border-t border-border bg-navy-dark">
        <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
          <span className="text-xs font-semibold text-text-primary">Orders</span>
          {(['pending', 'filled', 'cancelled', 'all'] as OrderTypeFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setOrderFilter(filter)}
              className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                orderFilter === filter
                  ? 'bg-accent text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-text-muted">
            {pendingOrders.length} pending
          </span>
        </div>

        <div className="overflow-y-auto" style={{ height: 'calc(100% - 32px)' }}>
          {pendingOrders.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">
              No active orders
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] text-text-muted">
                  <th className="px-4 py-1 font-medium">Symbol</th>
                  <th className="px-4 py-1 font-medium">Side</th>
                  <th className="px-4 py-1 font-medium">Type</th>
                  <th className="px-4 py-1 font-medium text-right">Qty</th>
                  <th className="px-4 py-1 font-medium text-right">Price</th>
                  <th className="px-4 py-1 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border/30 hover:bg-navy-mid/30">
                    <td className="px-4 py-1 font-mono font-semibold text-text-primary">
                      {order.symbol}
                    </td>
                    <td className={`px-4 py-1 font-mono font-semibold ${
                      order.side === 'buy' ? 'text-trading-green' : 'text-trading-red'
                    }`}>
                      {order.side.toUpperCase()}
                    </td>
                    <td className="px-4 py-1 font-mono text-text-secondary">
                      {order.type}
                    </td>
                    <td className="px-4 py-1 text-right font-mono tabular-nums text-text-primary">
                      {order.quantity}
                    </td>
                    <td className="px-4 py-1 text-right font-mono tabular-nums text-text-primary">
                      ${order.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(order.id)}
                        className="text-[10px] text-trading-red hover:text-trading-red/80"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Order confirmation dialog */}
      {confirmOrder && (
        <OrderConfirmation
          order={confirmOrder}
          riskLevel="low"
          isPaper
          open={true}
          onConfirm={() => submitOrder(confirmOrder)}
          onCancel={() => setConfirmOrder(null)}
          onSkipToggle={(skip) => setSkipConfirmation(skip)}
        />
      )}
    </div>
  )
}
