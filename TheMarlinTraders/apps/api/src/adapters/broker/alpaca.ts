import type {
  BrokerAdapter,
  BrokerAccount,
  BrokerCredentials,
  BrokerOrder,
  BrokerOrderResult,
  BrokerPosition,
  BrokerSession,
  OrderStatus,
  OrderUpdate,
  OrderUpdateEvent,
  OrderSide,
} from './broker.interface.js'

// ── Alpaca API types ───────────────────────────────────────

interface AlpacaAccount {
  id: string
  account_number: string
  status: string
  currency: string
  cash: string
  buying_power: string
  portfolio_value: string
  equity: string
  last_equity: string
  multiplier: string
  daytrade_count: number
  pattern_day_trader: boolean
  created_at: string
}

interface AlpacaPosition {
  asset_id: string
  symbol: string
  qty: string
  side: string
  avg_entry_price: string
  current_price: string
  market_value: string
  cost_basis: string
  unrealized_pl: string
  unrealized_plpc: string
  change_today: string
}

interface AlpacaOrder {
  id: string
  client_order_id: string
  status: string
  symbol: string
  side: string
  type: string
  qty: string
  filled_qty: string
  filled_avg_price: string | null
  limit_price: string | null
  stop_price: string | null
  trail_percent: string | null
  trail_price: string | null
  time_in_force: string
  submitted_at: string
  filled_at: string | null
  canceled_at: string | null
  expired_at: string | null
}

interface AlpacaStreamMessage {
  stream: string
  data: {
    event: string
    order: AlpacaOrder
    timestamp: string
  }
}

// ── Constants ──────────────────────────────────────────────

const LIVE_BASE_URL = 'https://api.alpaca.markets'
const PAPER_BASE_URL = 'https://paper-api.alpaca.markets'
const LIVE_STREAM_URL = 'wss://api.alpaca.markets/stream'
const PAPER_STREAM_URL = 'wss://paper-api.alpaca.markets/stream'

// ── Status mapping ─────────────────────────────────────────

const STATUS_MAP: Record<string, OrderStatus> = {
  new: 'new',
  accepted: 'accepted',
  pending_new: 'pending_new',
  partially_filled: 'partially_filled',
  filled: 'filled',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  expired: 'expired',
  rejected: 'rejected',
  replaced: 'replaced',
}

const EVENT_MAP: Record<string, OrderUpdateEvent> = {
  new: 'new',
  fill: 'fill',
  partial_fill: 'partial_fill',
  canceled: 'canceled',
  expired: 'expired',
  rejected: 'rejected',
  replaced: 'replaced',
}

// ── Order type mapping ─────────────────────────────────────

const ORDER_TYPE_TO_ALPACA: Record<string, string> = {
  market: 'market',
  limit: 'limit',
  stop: 'stop',
  stop_limit: 'stop_limit',
  trailing_stop: 'trailing_stop',
}

// ── Adapter ────────────────────────────────────────────────

export class AlpacaAdapter implements BrokerAdapter {
  readonly provider = 'alpaca' as const

  private baseUrl: string = PAPER_BASE_URL
  private streamUrl: string = PAPER_STREAM_URL
  private accessToken: string = ''
  private ws: WebSocket | null = null
  private orderUpdateCallbacks: Set<(update: OrderUpdate) => void> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isConnected = false

  // ── Authentication ─────────────────────────────────────

  async authenticate(credentials: BrokerCredentials): Promise<BrokerSession> {
    this.accessToken = credentials.accessToken
    const isPaper = credentials.paper ?? false

    this.baseUrl = isPaper ? PAPER_BASE_URL : LIVE_BASE_URL
    this.streamUrl = isPaper ? PAPER_STREAM_URL : LIVE_STREAM_URL

    // Validate credentials by fetching the account
    const account = await this.getAccount()

    return {
      accountId: account.accountId,
      provider: 'alpaca',
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
    }
  }

  // ── Account ────────────────────────────────────────────

  async getAccount(): Promise<BrokerAccount> {
    const data = await this.request<AlpacaAccount>('GET', '/v2/account')

    return {
      accountId: data.id,
      status: this.mapAccountStatus(data.status),
      currency: data.currency,
      cashBalance: parseFloat(data.cash),
      buyingPower: parseFloat(data.buying_power),
      portfolioValue: parseFloat(data.portfolio_value),
      equity: parseFloat(data.equity),
      multiplier: parseInt(data.multiplier, 10),
      daytradeCount: data.daytrade_count,
      patternDayTrader: data.pattern_day_trader,
      lastEquity: parseFloat(data.last_equity),
      createdAt: data.created_at,
    }
  }

  // ── Positions ──────────────────────────────────────────

  async getPositions(): Promise<BrokerPosition[]> {
    const data = await this.request<AlpacaPosition[]>('GET', '/v2/positions')

    return data.map((p) => ({
      symbol: p.symbol,
      quantity: parseFloat(p.qty),
      side: p.side === 'short' ? ('short' as const) : ('long' as const),
      avgEntryPrice: parseFloat(p.avg_entry_price),
      currentPrice: parseFloat(p.current_price),
      marketValue: parseFloat(p.market_value),
      costBasis: parseFloat(p.cost_basis),
      unrealizedPnL: parseFloat(p.unrealized_pl),
      unrealizedPnLPercent: parseFloat(p.unrealized_plpc) * 100,
      changeToday: parseFloat(p.change_today) * 100,
    }))
  }

  // ── Orders ─────────────────────────────────────────────

  async submitOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
    const body: Record<string, unknown> = {
      symbol: order.symbol,
      qty: order.quantity.toString(),
      side: order.side,
      type: ORDER_TYPE_TO_ALPACA[order.type] ?? 'market',
      time_in_force: order.timeInForce,
    }

    if (order.limitPrice !== undefined) {
      body.limit_price = order.limitPrice.toString()
    }
    if (order.stopPrice !== undefined) {
      body.stop_price = order.stopPrice.toString()
    }
    if (order.trailPercent !== undefined) {
      body.trail_percent = order.trailPercent.toString()
    }
    if (order.trailPrice !== undefined) {
      body.trail_price = order.trailPrice.toString()
    }
    if (order.extendedHours) {
      body.extended_hours = true
    }

    const data = await this.request<AlpacaOrder>('POST', '/v2/orders', body)

    return this.mapOrder(data)
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request('DELETE', `/v2/orders/${encodeURIComponent(orderId)}`)
  }

  async getOrders(status?: OrderStatus): Promise<BrokerOrderResult[]> {
    let path = '/v2/orders?limit=100'

    if (status) {
      // Alpaca uses different status query params
      const alpacaStatus = status === 'cancelled' ? 'canceled' : status
      path += `&status=${alpacaStatus}`
    } else {
      path += '&status=all'
    }

    const data = await this.request<AlpacaOrder[]>('GET', path)

    return data.map((o) => this.mapOrder(o))
  }

  // ── WebSocket Order Updates ────────────────────────────

  subscribeOrderUpdates(cb: (update: OrderUpdate) => void): () => void {
    this.orderUpdateCallbacks.add(cb)

    // Start WebSocket if not already connected
    if (!this.isConnected) {
      this.connectStream()
    }

    return () => {
      this.orderUpdateCallbacks.delete(cb)
      // Disconnect if no more listeners
      if (this.orderUpdateCallbacks.size === 0) {
        this.disconnectStream()
      }
    }
  }

  disconnect(): void {
    this.disconnectStream()
    this.orderUpdateCallbacks.clear()
  }

  // ── Private: HTTP ──────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new AlpacaApiError(
        `Alpaca API error: ${response.status} ${response.statusText} - ${errorBody}`,
        response.status,
      )
    }

    // DELETE returns 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T
    }

    return response.json() as Promise<T>
  }

  // ── Private: WebSocket ─────────────────────────────────

  private connectStream(): void {
    if (this.ws) return

    try {
      this.ws = new WebSocket(this.streamUrl)

      this.ws.addEventListener('open', () => {
        this.isConnected = true
        // Authenticate the stream
        this.ws?.send(
          JSON.stringify({
            action: 'authenticate',
            data: { oauth_token: this.accessToken },
          }),
        )
        // Subscribe to trade updates
        this.ws?.send(
          JSON.stringify({
            action: 'listen',
            data: { streams: ['trade_updates'] },
          }),
        )
      })

      this.ws.addEventListener('message', (event) => {
        try {
          const msg: AlpacaStreamMessage = JSON.parse(
            typeof event.data === 'string' ? event.data : '',
          )
          if (msg.stream === 'trade_updates' && msg.data?.order) {
            const update = this.mapOrderUpdate(msg.data)
            for (const cb of this.orderUpdateCallbacks) {
              cb(update)
            }
          }
        } catch {
          // Ignore malformed messages
        }
      })

      this.ws.addEventListener('close', () => {
        this.isConnected = false
        this.ws = null
        // Reconnect after 5 seconds if there are still listeners
        if (this.orderUpdateCallbacks.size > 0) {
          this.reconnectTimer = setTimeout(() => this.connectStream(), 5000)
        }
      })

      this.ws.addEventListener('error', () => {
        this.ws?.close()
      })
    } catch {
      // WebSocket construction failed — retry later
      this.reconnectTimer = setTimeout(() => this.connectStream(), 5000)
    }
  }

  private disconnectStream(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }

  // ── Private: Mappers ───────────────────────────────────

  private mapOrder(o: AlpacaOrder): BrokerOrderResult {
    return {
      orderId: o.id,
      clientOrderId: o.client_order_id,
      status: STATUS_MAP[o.status] ?? ('new' as OrderStatus),
      symbol: o.symbol,
      side: o.side as OrderSide,
      type: this.mapOrderType(o.type),
      quantity: parseFloat(o.qty),
      filledQuantity: parseFloat(o.filled_qty),
      avgFillPrice: o.filled_avg_price ? parseFloat(o.filled_avg_price) : undefined,
      limitPrice: o.limit_price ? parseFloat(o.limit_price) : undefined,
      stopPrice: o.stop_price ? parseFloat(o.stop_price) : undefined,
      timeInForce: o.time_in_force as BrokerOrderResult['timeInForce'],
      submittedAt: o.submitted_at,
      filledAt: o.filled_at ?? undefined,
      cancelledAt: o.canceled_at ?? undefined,
    }
  }

  private mapOrderUpdate(data: AlpacaStreamMessage['data']): OrderUpdate {
    const order = data.order
    return {
      event: EVENT_MAP[data.event] ?? ('new' as OrderUpdateEvent),
      orderId: order.id,
      symbol: order.symbol,
      side: order.side as OrderSide,
      status: STATUS_MAP[order.status] ?? ('new' as OrderStatus),
      filledQuantity: parseFloat(order.filled_qty),
      avgFillPrice: order.filled_avg_price
        ? parseFloat(order.filled_avg_price)
        : undefined,
      timestamp: data.timestamp,
    }
  }

  private mapOrderType(
    alpacaType: string,
  ): BrokerOrderResult['type'] {
    const map: Record<string, BrokerOrderResult['type']> = {
      market: 'market',
      limit: 'limit',
      stop: 'stop',
      stop_limit: 'stop_limit',
      trailing_stop: 'trailing_stop',
    }
    return map[alpacaType] ?? 'market'
  }

  private mapAccountStatus(
    status: string,
  ): BrokerAccount['status'] {
    if (status === 'ACTIVE') return 'active'
    if (status === 'ACCOUNT_DISABLED') return 'disabled'
    return 'restricted'
  }
}

// ── Error ──────────────────────────────────────────────────

export class AlpacaApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message)
    this.name = 'AlpacaApiError'
  }
}
