import WebSocket from 'ws'
import { z } from 'zod'
import type { NormalizedTrade, NormalizedBar } from '@marlin/shared'

const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws'

/** Binance trade stream message schema (<symbol>@trade) */
const BinanceTradeSchema = z.object({
  e: z.literal('trade'),
  s: z.string(),       // Symbol (e.g. 'BTCUSDT')
  p: z.string(),       // Price
  q: z.string(),       // Quantity
  T: z.number(),       // Trade time (ms)
  t: z.number(),       // Trade ID
  m: z.boolean(),      // Is buyer the maker?
})

/** Binance 24hr ticker stream message schema (<symbol>@ticker) */
const BinanceTickerSchema = z.object({
  e: z.literal('24hrTicker'),
  s: z.string(),       // Symbol
  c: z.string(),       // Close / last price
  o: z.string(),       // Open price
  h: z.string(),       // High
  l: z.string(),       // Low
  v: z.string(),       // Total traded base asset volume
  q: z.string(),       // Total traded quote asset volume
  E: z.number(),       // Event time
  P: z.string(),       // Price change percent
  w: z.string(),       // Weighted average price
  n: z.number(),       // Number of trades
})

const BinanceMessageSchema = z.discriminatedUnion('e', [
  BinanceTradeSchema,
  BinanceTickerSchema,
])

export type BinanceTrade = z.infer<typeof BinanceTradeSchema>
export type BinanceTicker = z.infer<typeof BinanceTickerSchema>

export interface BinanceWSOptions {
  /** Symbols in Binance format (e.g. ['btcusdt', 'ethusdt']) — lowercase */
  symbols: string[]
  onTrade: (trade: NormalizedTrade) => void
  onBar?: (bar: NormalizedBar) => void
  onError?: (error: Error) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

/**
 * Convert Binance symbol (BTCUSDT) to internal symbol format (BTC-USDT).
 * Handles common quote currencies: USDT, BUSD, USD, BTC, ETH, BNB.
 */
function binanceToInternalSymbol(binanceSymbol: string): string {
  const upper = binanceSymbol.toUpperCase()
  const quotes = ['USDT', 'BUSD', 'USDC', 'BTC', 'ETH', 'BNB']
  for (const quote of quotes) {
    if (upper.endsWith(quote)) {
      const base = upper.slice(0, -quote.length)
      if (base.length > 0) return `${base}-${quote}`
    }
  }
  return upper
}

function normalizeBinanceTrade(raw: BinanceTrade): NormalizedTrade {
  return {
    symbol: binanceToInternalSymbol(raw.s),
    price: parseFloat(raw.p),
    size: parseFloat(raw.q),
    timestamp: raw.T,
    exchange: 'BINANCE',
  }
}

function binanceTickerToBar(raw: BinanceTicker): NormalizedBar {
  return {
    symbol: binanceToInternalSymbol(raw.s),
    timeframe: '1m',
    open: parseFloat(raw.o),
    high: parseFloat(raw.h),
    low: parseFloat(raw.l),
    close: parseFloat(raw.c),
    volume: parseFloat(raw.v),
    timestamp: raw.E,
    vwap: parseFloat(raw.w),
    tradeCount: raw.n,
  }
}

export class BinanceWebSocketAdapter {
  private ws: WebSocket | null = null
  private reconnectAttempt = 0
  private maxReconnectDelay = 30_000
  private baseDelay = 100
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isShuttingDown = false
  private pingTimer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly options: BinanceWSOptions) {}

  connect(): void {
    this.isShuttingDown = false

    // Build combined stream URL: wss://stream.binance.com:9443/ws/<stream1>/<stream2>/...
    const streams = this.options.symbols.flatMap((s) => {
      const sym = s.toLowerCase()
      return [`${sym}@trade`, `${sym}@ticker`]
    })
    const url = `${BINANCE_WS_BASE}/${streams.join('/')}`

    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.reconnectAttempt = 0
      this.options.onConnected?.()
      this.startPing()
    })

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data.toString())
    })

    this.ws.on('close', () => {
      this.stopPing()
      this.options.onDisconnected?.()
      if (!this.isShuttingDown) {
        this.scheduleReconnect()
      }
    })

    this.ws.on('error', (err: Error) => {
      this.options.onError?.(err)
    })

    this.ws.on('pong', () => {
      // Connection is alive
    })
  }

  disconnect(): void {
    this.isShuttingDown = true
    this.stopPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /** Subscribe to additional symbols at runtime via Binance's SUBSCRIBE method */
  subscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const params = symbols.flatMap((s) => {
      const sym = s.toLowerCase()
      return [`${sym}@trade`, `${sym}@ticker`]
    })
    this.ws.send(
      JSON.stringify({
        method: 'SUBSCRIBE',
        params,
        id: Date.now(),
      }),
    )
  }

  unsubscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const params = symbols.flatMap((s) => {
      const sym = s.toLowerCase()
      return [`${sym}@trade`, `${sym}@ticker`]
    })
    this.ws.send(
      JSON.stringify({
        method: 'UNSUBSCRIBE',
        params,
        id: Date.now(),
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

    // Binance combined streams wrap messages in { stream, data } for combined URL
    // But direct stream URLs send the data directly
    const message = (parsed as Record<string, unknown>).data ?? parsed

    const result = BinanceMessageSchema.safeParse(message)
    if (!result.success) return

    const data = result.data
    switch (data.e) {
      case 'trade':
        this.options.onTrade(normalizeBinanceTrade(data))
        break
      case '24hrTicker':
        this.options.onBar?.(binanceTickerToBar(data))
        break
    }
  }

  /** Binance requires a pong response every 10 minutes to keep the connection alive.
   *  We send a ping every 3 minutes to be safe. */
  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping()
      }
    }, 180_000)
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
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
