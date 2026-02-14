/**
 * Event-Driven Backtesting Engine
 * Sprints 43-44: Tick-by-tick simulation with realistic fill modeling
 *
 * Processes market data events through a priority queue, matches orders against
 * incoming ticks, and tracks positions with real-time mark-to-market.
 */

import type { OHLCV } from '@marlin/shared'
import { OrderMatcher, type MatchResult } from './order-matching.js'

// ── Event Types ──────────────────────────────────────────────────────────

export type EventType = 'price' | 'fill' | 'timer' | 'bar'

export interface BaseEvent {
  type: EventType
  timestamp: number
}

export interface PriceEvent extends BaseEvent {
  type: 'price'
  symbol: string
  price: number
  volume: number
  bid?: number
  ask?: number
}

export interface FillEvent extends BaseEvent {
  type: 'fill'
  orderId: string
  symbol: string
  side: OrderSide
  filledQty: number
  fillPrice: number
  commission: number
  remainingQty: number
}

export interface TimerEvent extends BaseEvent {
  type: 'timer'
  label: string
}

export interface BarEvent extends BaseEvent {
  type: 'bar'
  symbol: string
  bar: OHLCV
}

export type BacktestEvent = PriceEvent | FillEvent | TimerEvent | BarEvent

// ── Order Types ──────────────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit'
export type OrderStatus = 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected'

export interface Order {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  filledQuantity: number
  limitPrice?: number
  stopPrice?: number
  status: OrderStatus
  createdAt: number
  updatedAt: number
}

// ── Position Types ───────────────────────────────────────────────────────

export interface Position {
  symbol: string
  side: OrderSide
  quantity: number
  avgEntryPrice: number
  unrealizedPnl: number
  realizedPnl: number
  openedAt: number
}

// ── Configuration ────────────────────────────────────────────────────────

export interface EngineConfig {
  /** Starting capital in base currency */
  initialCapital: number
  /** Commission per share/contract */
  commissionPerUnit: number
  /** Slippage model coefficient (default 0.0005) */
  slippageCoefficient: number
  /** Maximum percentage of bar volume a single order can consume (default 0.1 = 10%) */
  maxVolumeParticipation: number
  /** Market impact coefficient for sqrt model (default 0.1) */
  marketImpactCoefficient: number
  /** Average daily volume for market impact calculations */
  averageDailyVolume: number
}

const DEFAULT_CONFIG: EngineConfig = {
  initialCapital: 100_000,
  commissionPerUnit: 0.005,
  slippageCoefficient: 0.0005,
  maxVolumeParticipation: 0.1,
  marketImpactCoefficient: 0.1,
  averageDailyVolume: 1_000_000,
}

// ── Event Queue ──────────────────────────────────────────────────────────

/**
 * Priority queue of events sorted by timestamp (ascending).
 * Uses a binary min-heap for O(log n) insert and O(log n) extract-min.
 */
export class EventQueue {
  private heap: BacktestEvent[] = []

  get length(): number {
    return this.heap.length
  }

  push(event: BacktestEvent): void {
    this.heap.push(event)
    this.bubbleUp(this.heap.length - 1)
  }

  pop(): BacktestEvent | undefined {
    if (this.heap.length === 0) return undefined
    const top = this.heap[0]!
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this.sinkDown(0)
    }
    return top
  }

  peek(): BacktestEvent | undefined {
    return this.heap[0]
  }

  clear(): void {
    this.heap = []
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2)
      if (this.heap[parent]!.timestamp <= this.heap[idx]!.timestamp) break
      this.swap(parent, idx)
      idx = parent
    }
  }

  private sinkDown(idx: number): void {
    const n = this.heap.length
    while (true) {
      let smallest = idx
      const left = 2 * idx + 1
      const right = 2 * idx + 2

      if (left < n && this.heap[left]!.timestamp < this.heap[smallest]!.timestamp) {
        smallest = left
      }
      if (right < n && this.heap[right]!.timestamp < this.heap[smallest]!.timestamp) {
        smallest = right
      }
      if (smallest === idx) break
      this.swap(idx, smallest)
      idx = smallest
    }
  }

  private swap(a: number, b: number): void {
    const tmp = this.heap[a]!
    this.heap[a] = this.heap[b]!
    this.heap[b] = tmp
  }
}

// ── Position Manager ─────────────────────────────────────────────────────

/**
 * Tracks open positions with real-time mark-to-market calculations.
 * Handles position opening, averaging, and closing.
 */
export class PositionManager {
  private positions: Map<string, Position> = new Map()
  private closedPnl = 0

  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol)
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values())
  }

  get totalRealizedPnl(): number {
    return this.closedPnl
  }

  /**
   * Apply a fill to update or create a position.
   * Returns the realized P&L if the fill reduces or closes a position.
   */
  applyFill(fill: FillEvent): number {
    const existing = this.positions.get(fill.symbol)

    if (!existing) {
      // Open new position
      this.positions.set(fill.symbol, {
        symbol: fill.symbol,
        side: fill.side,
        quantity: fill.filledQty,
        avgEntryPrice: fill.fillPrice,
        unrealizedPnl: 0,
        realizedPnl: 0,
        openedAt: fill.timestamp,
      })
      return 0
    }

    if (existing.side === fill.side) {
      // Adding to position — average the entry price
      const totalCost =
        existing.avgEntryPrice * existing.quantity + fill.fillPrice * fill.filledQty
      const totalQty = existing.quantity + fill.filledQty
      existing.avgEntryPrice = totalCost / totalQty
      existing.quantity = totalQty
      return 0
    }

    // Reducing or closing position
    const closeQty = Math.min(existing.quantity, fill.filledQty)
    const pnlPerUnit =
      existing.side === 'buy'
        ? fill.fillPrice - existing.avgEntryPrice
        : existing.avgEntryPrice - fill.fillPrice
    const realizedPnl = pnlPerUnit * closeQty - fill.commission

    existing.realizedPnl += realizedPnl
    this.closedPnl += realizedPnl
    existing.quantity -= closeQty

    if (existing.quantity <= 0) {
      this.positions.delete(fill.symbol)
    }

    // If fill quantity exceeds the existing position, open a new position in the opposite direction
    const excess = fill.filledQty - closeQty
    if (excess > 0) {
      this.positions.set(fill.symbol, {
        symbol: fill.symbol,
        side: fill.side,
        quantity: excess,
        avgEntryPrice: fill.fillPrice,
        unrealizedPnl: 0,
        realizedPnl: 0,
        openedAt: fill.timestamp,
      })
    }

    return realizedPnl
  }

  /**
   * Mark all positions to market with the latest price.
   */
  markToMarket(symbol: string, currentPrice: number): void {
    const pos = this.positions.get(symbol)
    if (!pos) return

    pos.unrealizedPnl =
      pos.side === 'buy'
        ? (currentPrice - pos.avgEntryPrice) * pos.quantity
        : (pos.avgEntryPrice - currentPrice) * pos.quantity
  }

  get totalUnrealizedPnl(): number {
    let total = 0
    for (const pos of this.positions.values()) {
      total += pos.unrealizedPnl
    }
    return total
  }

  reset(): void {
    this.positions.clear()
    this.closedPnl = 0
  }
}

// ── Completed Trade ──────────────────────────────────────────────────────

export interface CompletedTrade {
  symbol: string
  side: OrderSide
  entryPrice: number
  exitPrice: number
  quantity: number
  pnl: number
  entryTime: number
  exitTime: number
  commission: number
}

// ── Event Handlers ───────────────────────────────────────────────────────

export interface EngineCallbacks {
  onFill?: (event: FillEvent) => void
  onOrderRejected?: (order: Order, reason: string) => void
  onPositionUpdate?: (position: Position) => void
  onBar?: (event: BarEvent) => void
  onTrade?: (trade: CompletedTrade) => void
}

// ── Strategy Interface ───────────────────────────────────────────────────

export interface Strategy {
  /** Called once when the backtest starts */
  init?(engine: EventDrivenBacktester): void
  /** Called on every price event */
  onPrice?(engine: EventDrivenBacktester, event: PriceEvent): void
  /** Called on every bar close */
  onBar?(engine: EventDrivenBacktester, event: BarEvent): void
  /** Called when a fill occurs */
  onFill?(engine: EventDrivenBacktester, event: FillEvent): void
  /** Called on timer events */
  onTimer?(engine: EventDrivenBacktester, event: TimerEvent): void
}

// ── Main Engine ──────────────────────────────────────────────────────────

/**
 * Event-driven backtesting engine with tick-by-tick simulation,
 * realistic order matching, and position management.
 */
export class EventDrivenBacktester {
  readonly config: EngineConfig
  readonly eventQueue: EventQueue
  readonly positionManager: PositionManager
  readonly orderMatcher: OrderMatcher

  private orders: Map<string, Order> = new Map()
  private nextOrderId = 1
  private callbacks: EngineCallbacks = {}
  private _equity: number
  private _currentTime = 0
  private _trades: CompletedTrade[] = []
  private _equityCurve: { timestamp: number; equity: number }[] = []

  constructor(config?: Partial<EngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.eventQueue = new EventQueue()
    this.positionManager = new PositionManager()
    this.orderMatcher = new OrderMatcher({
      maxVolumeParticipation: this.config.maxVolumeParticipation,
      marketImpactCoefficient: this.config.marketImpactCoefficient,
      averageDailyVolume: this.config.averageDailyVolume,
      slippageCoefficient: this.config.slippageCoefficient,
    })
    this._equity = this.config.initialCapital
  }

  get equity(): number {
    return this._equity + this.positionManager.totalUnrealizedPnl
  }

  get cash(): number {
    return this._equity
  }

  get currentTime(): number {
    return this._currentTime
  }

  get trades(): CompletedTrade[] {
    return [...this._trades]
  }

  get equityCurve(): { timestamp: number; equity: number }[] {
    return [...this._equityCurve]
  }

  get pendingOrders(): Order[] {
    return Array.from(this.orders.values()).filter(
      (o) => o.status === 'pending' || o.status === 'partial',
    )
  }

  // ── Public API ─────────────────────────────────────────────────────────

  on(callbacks: EngineCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  /**
   * Submit a new order.
   * Returns the order ID.
   */
  submitOrder(params: {
    symbol: string
    side: OrderSide
    type: OrderType
    quantity: number
    limitPrice?: number
    stopPrice?: number
  }): string {
    const id = `ORD-${String(this.nextOrderId++).padStart(6, '0')}`

    // Validate order
    if (params.quantity <= 0) {
      this.callbacks.onOrderRejected?.(
        { ...params, id, filledQuantity: 0, status: 'rejected', createdAt: this._currentTime, updatedAt: this._currentTime },
        'Quantity must be positive',
      )
      return id
    }

    if (params.type === 'limit' && params.limitPrice === undefined) {
      this.callbacks.onOrderRejected?.(
        { ...params, id, filledQuantity: 0, status: 'rejected', createdAt: this._currentTime, updatedAt: this._currentTime },
        'Limit price required for limit orders',
      )
      return id
    }

    if ((params.type === 'stop' || params.type === 'stop_limit') && params.stopPrice === undefined) {
      this.callbacks.onOrderRejected?.(
        { ...params, id, filledQuantity: 0, status: 'rejected', createdAt: this._currentTime, updatedAt: this._currentTime },
        'Stop price required for stop orders',
      )
      return id
    }

    const order: Order = {
      id,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
      filledQuantity: 0,
      limitPrice: params.limitPrice,
      stopPrice: params.stopPrice,
      status: 'pending',
      createdAt: this._currentTime,
      updatedAt: this._currentTime,
    }

    this.orders.set(id, order)
    return id
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId)
    if (!order || order.status === 'filled' || order.status === 'cancelled') {
      return false
    }
    order.status = 'cancelled'
    order.updatedAt = this._currentTime
    return true
  }

  /**
   * Load OHLCV bar data into the event queue as both bar events
   * and synthetic price events at OHLC prices within each bar.
   */
  loadBars(symbol: string, bars: OHLCV[]): void {
    for (const bar of bars) {
      // Emit a bar event at the bar timestamp
      this.eventQueue.push({
        type: 'bar',
        timestamp: bar.timestamp,
        symbol,
        bar,
      })

      // Synthetic intrabar ticks at open, high, low, close
      // Order: open -> high/low (depends on close vs open) -> close
      const barDuration = 1 // sub-ms offsets to maintain order
      const goesUp = bar.close >= bar.open

      this.eventQueue.push({
        type: 'price',
        timestamp: bar.timestamp + barDuration,
        symbol,
        price: bar.open,
        volume: bar.volume * 0.25,
      })

      if (goesUp) {
        this.eventQueue.push({
          type: 'price',
          timestamp: bar.timestamp + barDuration * 2,
          symbol,
          price: bar.low,
          volume: bar.volume * 0.25,
        })
        this.eventQueue.push({
          type: 'price',
          timestamp: bar.timestamp + barDuration * 3,
          symbol,
          price: bar.high,
          volume: bar.volume * 0.25,
        })
      } else {
        this.eventQueue.push({
          type: 'price',
          timestamp: bar.timestamp + barDuration * 2,
          symbol,
          price: bar.high,
          volume: bar.volume * 0.25,
        })
        this.eventQueue.push({
          type: 'price',
          timestamp: bar.timestamp + barDuration * 3,
          symbol,
          price: bar.low,
          volume: bar.volume * 0.25,
        })
      }

      this.eventQueue.push({
        type: 'price',
        timestamp: bar.timestamp + barDuration * 4,
        symbol,
        price: bar.close,
        volume: bar.volume * 0.25,
      })
    }
  }

  /**
   * Schedule a timer event.
   */
  scheduleTimer(timestamp: number, label: string): void {
    this.eventQueue.push({ type: 'timer', timestamp, label })
  }

  /**
   * Run the backtest by draining the event queue.
   */
  run(strategy: Strategy): void {
    strategy.init?.(this)

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.pop()!
      this._currentTime = event.timestamp

      switch (event.type) {
        case 'price':
          this.handlePriceEvent(event, strategy)
          break
        case 'bar':
          this.handleBarEvent(event, strategy)
          break
        case 'fill':
          this.handleFillEvent(event, strategy)
          break
        case 'timer':
          strategy.onTimer?.(this, event)
          break
      }
    }
  }

  /**
   * Reset the engine to its initial state for a fresh run.
   */
  reset(): void {
    this.eventQueue.clear()
    this.positionManager.reset()
    this.orders.clear()
    this.nextOrderId = 1
    this._equity = this.config.initialCapital
    this._currentTime = 0
    this._trades = []
    this._equityCurve = []
  }

  // ── Private Event Handlers ─────────────────────────────────────────────

  private handlePriceEvent(event: PriceEvent, strategy: Strategy): void {
    // Try to match pending orders against this tick
    const pendingOrders = Array.from(this.orders.values()).filter(
      (o) =>
        o.symbol === event.symbol &&
        (o.status === 'pending' || o.status === 'partial'),
    )

    for (const order of pendingOrders) {
      const result = this.orderMatcher.tryMatch(order, event)
      if (!result) continue

      this.applyMatchResult(order, result, event.timestamp)
    }

    // Mark positions to market
    this.positionManager.markToMarket(event.symbol, event.price)

    // Let strategy react
    strategy.onPrice?.(this, event)
  }

  private handleBarEvent(event: BarEvent, strategy: Strategy): void {
    // Record equity at each bar
    this._equityCurve.push({
      timestamp: event.timestamp,
      equity: this.equity,
    })

    this.callbacks.onBar?.(event)
    strategy.onBar?.(this, event)
  }

  private handleFillEvent(event: FillEvent, strategy: Strategy): void {
    this.callbacks.onFill?.(event)
    strategy.onFill?.(this, event)
  }

  private applyMatchResult(order: Order, result: MatchResult, timestamp: number): void {
    const commission = result.filledQty * this.config.commissionPerUnit

    const fillEvent: FillEvent = {
      type: 'fill',
      timestamp,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      filledQty: result.filledQty,
      fillPrice: result.fillPrice,
      commission,
      remainingQty: order.quantity - order.filledQuantity - result.filledQty,
    }

    // Update order state
    order.filledQuantity += result.filledQty
    order.updatedAt = timestamp

    if (order.filledQuantity >= order.quantity) {
      order.status = 'filled'
    } else {
      order.status = 'partial'
    }

    // Track position state before fill to detect closures
    const existingPos = this.positionManager.getPosition(order.symbol)
    const hadPosition = !!existingPos
    const wasOppositeSide = hadPosition && existingPos!.side !== order.side
    const prevQty = existingPos?.quantity ?? 0

    // Apply fill to position manager
    const realizedPnl = this.positionManager.applyFill(fillEvent)

    // Update cash equity
    this._equity += realizedPnl

    // Record completed trade if a position was reduced/closed
    if (wasOppositeSide && realizedPnl !== 0) {
      const closedQty = Math.min(prevQty, result.filledQty)
      this._trades.push({
        symbol: order.symbol,
        side: existingPos!.side,
        entryPrice: existingPos!.avgEntryPrice,
        exitPrice: result.fillPrice,
        quantity: closedQty,
        pnl: realizedPnl,
        entryTime: existingPos!.openedAt,
        exitTime: timestamp,
        commission,
      })
      this.callbacks.onTrade?.({
        symbol: order.symbol,
        side: existingPos!.side,
        entryPrice: existingPos!.avgEntryPrice,
        exitPrice: result.fillPrice,
        quantity: closedQty,
        pnl: realizedPnl,
        entryTime: existingPos!.openedAt,
        exitTime: timestamp,
        commission,
      })
    }

    // Notify position update
    const updatedPos = this.positionManager.getPosition(order.symbol)
    if (updatedPos) {
      this.callbacks.onPositionUpdate?.(updatedPos)
    }

    // Emit fill callback and schedule fill event for strategy
    this.callbacks.onFill?.(fillEvent)

    // Push fill event into queue so the strategy processes it in order
    this.eventQueue.push(fillEvent)
  }
}
