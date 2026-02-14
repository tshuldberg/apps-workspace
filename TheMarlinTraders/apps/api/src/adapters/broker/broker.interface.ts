/**
 * Broker Adapter Interface
 *
 * Provider-agnostic interface for broker integrations.
 * Every broker (Alpaca, IBKR, Tradier) implements this contract
 * so the rest of the platform never couples to a specific API.
 */

// ── Credentials & Session ──────────────────────────────────

export interface BrokerCredentials {
  /** OAuth access token */
  accessToken: string
  /** OAuth refresh token (if applicable) */
  refreshToken?: string
  /** Paper/live trading flag */
  paper?: boolean
}

export interface BrokerSession {
  accountId: string
  provider: BrokerProvider
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
}

// ── Account ────────────────────────────────────────────────

export interface BrokerAccount {
  accountId: string
  status: 'active' | 'restricted' | 'disabled'
  currency: string
  cashBalance: number
  buyingPower: number
  portfolioValue: number
  equity: number
  /** Margin multiplier (1 = cash, 2/4 = margin) */
  multiplier: number
  /** Day-trade count (rolling 5 day) */
  daytradeCount: number
  /** Pattern day trader flag */
  patternDayTrader: boolean
  lastEquity: number
  createdAt: string
}

// ── Positions ──────────────────────────────────────────────

export interface BrokerPosition {
  symbol: string
  quantity: number
  side: 'long' | 'short'
  avgEntryPrice: number
  currentPrice: number
  marketValue: number
  costBasis: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  changeToday: number
}

// ── Orders ─────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell'

export type OrderType =
  | 'market'
  | 'limit'
  | 'stop'
  | 'stop_limit'
  | 'trailing_stop'

export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'pending_new'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'expired'
  | 'rejected'
  | 'replaced'

export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok'

export interface BrokerOrder {
  /** Internal broker order ID (set after submission) */
  id?: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  limitPrice?: number
  stopPrice?: number
  trailPercent?: number
  trailPrice?: number
  timeInForce: TimeInForce
  extendedHours?: boolean
}

export interface BrokerOrderResult {
  /** Broker-assigned order ID */
  orderId: string
  clientOrderId?: string
  status: OrderStatus
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  filledQuantity: number
  avgFillPrice?: number
  limitPrice?: number
  stopPrice?: number
  timeInForce: TimeInForce
  submittedAt: string
  filledAt?: string
  cancelledAt?: string
}

// ── Order Updates (WebSocket) ──────────────────────────────

export type OrderUpdateEvent =
  | 'new'
  | 'fill'
  | 'partial_fill'
  | 'canceled'
  | 'expired'
  | 'rejected'
  | 'replaced'

export interface OrderUpdate {
  event: OrderUpdateEvent
  orderId: string
  symbol: string
  side: OrderSide
  status: OrderStatus
  filledQuantity: number
  avgFillPrice?: number
  timestamp: string
}

// ── Provider Enum ──────────────────────────────────────────

export type BrokerProvider = 'alpaca' | 'ibkr' | 'tradier'

// ── Adapter Contract ───────────────────────────────────────

export interface BrokerAdapter {
  readonly provider: BrokerProvider

  /**
   * Authenticate with the broker using OAuth tokens.
   * Returns a session that can be persisted.
   */
  authenticate(credentials: BrokerCredentials): Promise<BrokerSession>

  /**
   * Fetch the trading account summary (balance, buying power, margin).
   */
  getAccount(): Promise<BrokerAccount>

  /**
   * Fetch all open positions.
   */
  getPositions(): Promise<BrokerPosition[]>

  /**
   * Submit a new order to the broker.
   */
  submitOrder(order: BrokerOrder): Promise<BrokerOrderResult>

  /**
   * Cancel a pending/open order by its broker-assigned ID.
   */
  cancelOrder(orderId: string): Promise<void>

  /**
   * List orders, optionally filtered by status.
   */
  getOrders(status?: OrderStatus): Promise<BrokerOrderResult[]>

  /**
   * Subscribe to real-time order update events via WebSocket.
   * Returns an unsubscribe function.
   */
  subscribeOrderUpdates(cb: (update: OrderUpdate) => void): () => void

  /**
   * Gracefully disconnect from the broker (close WS connections, etc.).
   */
  disconnect(): void
}
