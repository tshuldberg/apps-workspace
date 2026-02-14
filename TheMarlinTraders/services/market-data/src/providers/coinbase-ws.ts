import WebSocket from 'ws'
import { z } from 'zod'
import type { NormalizedTrade, NormalizedBar } from '@marlin/shared'

const COINBASE_WS_URL = 'wss://ws-feed.exchange.coinbase.com'

/** Coinbase ticker message schema (real-time price updates) */
const CoinbaseTickerSchema = z.object({
  type: z.literal('ticker'),
  product_id: z.string(),
  price: z.string(),
  best_bid: z.string().optional(),
  best_ask: z.string().optional(),
  last_size: z.string().optional(),
  volume_24h: z.string().optional(),
  open_24h: z.string().optional(),
  high_24h: z.string().optional(),
  low_24h: z.string().optional(),
  time: z.string(),
  trade_id: z.number().optional(),
  side: z.enum(['buy', 'sell']).optional(),
})

/** Coinbase match (trade) message schema */
const CoinbaseMatchSchema = z.object({
  type: z.literal('match'),
  product_id: z.string(),
  price: z.string(),
  size: z.string(),
  time: z.string(),
  trade_id: z.number(),
  maker_order_id: z.string().optional(),
  taker_order_id: z.string().optional(),
  side: z.enum(['buy', 'sell']),
})

const CoinbaseMessageSchema = z.discriminatedUnion('type', [
  CoinbaseTickerSchema,
  CoinbaseMatchSchema,
  z.object({ type: z.literal('subscriptions'), channels: z.array(z.unknown()) }),
  z.object({ type: z.literal('error'), message: z.string(), reason: z.string().optional() }),
  z.object({ type: z.literal('heartbeat'), product_id: z.string(), time: z.string(), sequence: z.number().optional(), last_trade_id: z.number().optional() }),
])

export type CoinbaseTicker = z.infer<typeof CoinbaseTickerSchema>
export type CoinbaseMatch = z.infer<typeof CoinbaseMatchSchema>

export interface CoinbaseWSOptions {
  /** Trading pairs to subscribe to (e.g. ['BTC-USD', 'ETH-USD']) */
  pairs: string[]
  onTrade: (trade: NormalizedTrade) => void
  onBar?: (bar: NormalizedBar) => void
  onError?: (error: Error) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

/**
 * Normalize a Coinbase pair format to internal symbol format.
 * Coinbase uses 'BTC-USD', we store as 'BTC-USD' (crypto keeps dash format).
 */
function normalizeSymbol(productId: string): string {
  return productId.toUpperCase()
}

function normalizeCoinbaseTrade(match: CoinbaseMatch): NormalizedTrade {
  return {
    symbol: normalizeSymbol(match.product_id),
    price: parseFloat(match.price),
    size: parseFloat(match.size),
    timestamp: new Date(match.time).getTime(),
    exchange: 'COINBASE',
  }
}

function coinbaseTickerToBar(ticker: CoinbaseTicker): NormalizedBar {
  return {
    symbol: normalizeSymbol(ticker.product_id),
    timeframe: '1m',
    open: parseFloat(ticker.open_24h ?? ticker.price),
    high: parseFloat(ticker.high_24h ?? ticker.price),
    low: parseFloat(ticker.low_24h ?? ticker.price),
    close: parseFloat(ticker.price),
    volume: parseFloat(ticker.volume_24h ?? '0'),
    timestamp: new Date(ticker.time).getTime(),
  }
}

export class CoinbaseWebSocketAdapter {
  private ws: WebSocket | null = null
  private reconnectAttempt = 0
  private maxReconnectDelay = 30_000
  private baseDelay = 100
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isShuttingDown = false
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastMessageTime = 0

  constructor(private readonly options: CoinbaseWSOptions) {}

  connect(): void {
    this.isShuttingDown = false
    this.ws = new WebSocket(COINBASE_WS_URL)

    this.ws.on('open', () => {
      this.reconnectAttempt = 0
      this.subscribe(this.options.pairs)
      this.options.onConnected?.()
      this.startHeartbeatMonitor()
    })

    this.ws.on('message', (data: WebSocket.Data) => {
      this.lastMessageTime = Date.now()
      this.handleMessage(data.toString())
    })

    this.ws.on('close', () => {
      this.stopHeartbeatMonitor()
      this.options.onDisconnected?.()
      if (!this.isShuttingDown) {
        this.scheduleReconnect()
      }
    })

    this.ws.on('error', (err: Error) => {
      this.options.onError?.(err)
    })
  }

  disconnect(): void {
    this.isShuttingDown = true
    this.stopHeartbeatMonitor()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  subscribe(pairs: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(
      JSON.stringify({
        type: 'subscribe',
        product_ids: pairs,
        channels: ['ticker', 'matches', 'heartbeat'],
      }),
    )
  }

  unsubscribe(pairs: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(
      JSON.stringify({
        type: 'unsubscribe',
        product_ids: pairs,
        channels: ['ticker', 'matches', 'heartbeat'],
      }),
    )
  }

  private handleMessage(raw: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }

    const result = CoinbaseMessageSchema.safeParse(parsed)
    if (!result.success) return

    const data = result.data
    switch (data.type) {
      case 'match':
        this.options.onTrade(normalizeCoinbaseTrade(data))
        break
      case 'ticker':
        this.options.onBar?.(coinbaseTickerToBar(data))
        break
      case 'error':
        this.options.onError?.(new Error(`Coinbase WS error: ${data.message}`))
        break
      case 'subscriptions':
      case 'heartbeat':
        // no-op, connection is alive
        break
    }
  }

  /** Monitor for stale connections — reconnect if no messages for 60s.
   *  Crypto markets are 24/7, silence likely means a dead connection. */
  private startHeartbeatMonitor(): void {
    this.lastMessageTime = Date.now()
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastMessageTime > 60_000) {
        this.options.onError?.(new Error('Coinbase WS heartbeat timeout — reconnecting'))
        this.ws?.close()
      }
    }, 15_000)
  }

  private stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      this.baseDelay * 2 ** this.reconnectAttempt + Math.random() * 100,
      this.maxReconnectDelay,
    )
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }
}
