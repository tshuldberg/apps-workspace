import WebSocket from 'ws'
import { z } from 'zod'
import type { NormalizedTrade, NormalizedBar, NormalizedQuote } from '@marlin/shared'
import { FOREX_SESSIONS, ALL_FOREX_PAIRS, type SessionDefinition } from '@marlin/shared'

const POLYGON_FOREX_WS_URL = 'wss://socket.polygon.io/forex'

/** Raw Polygon.io forex quote message schema */
const PolygonForexQuoteSchema = z.object({
  ev: z.literal('C'),
  p: z.string(),    // Pair (e.g. 'EUR/USD')
  a: z.number(),    // Ask price
  b: z.number(),    // Bid price
  t: z.number(),    // Timestamp
  x: z.number().optional(), // Exchange ID
})

/** Raw Polygon.io forex aggregate schema */
const PolygonForexAggregateSchema = z.object({
  ev: z.literal('CA'),
  pair: z.string(),
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number(),
  s: z.number(),    // Start timestamp
  e: z.number(),    // End timestamp
  vw: z.number().optional(),
})

const PolygonForexMessageSchema = z.discriminatedUnion('ev', [
  PolygonForexQuoteSchema,
  PolygonForexAggregateSchema,
  z.object({ ev: z.literal('status'), status: z.string(), message: z.string() }),
])

export type PolygonForexQuote = z.infer<typeof PolygonForexQuoteSchema>
export type PolygonForexAggregate = z.infer<typeof PolygonForexAggregateSchema>

export interface ForexProviderOptions {
  apiKey: string
  /** Forex pairs to subscribe to (e.g. ['EUR/USD', 'GBP/USD']).
   *  Defaults to ALL_FOREX_PAIRS. */
  pairs?: string[]
  onQuote: (quote: NormalizedQuote) => void
  onBar?: (bar: NormalizedBar) => void
  onError?: (error: Error) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

/** Convert Polygon forex pair format (e.g. 'EUR/USD') to symbol string */
function normalizeForexSymbol(pair: string): string {
  return pair.toUpperCase()
}

function normalizeForexQuote(raw: PolygonForexQuote): NormalizedQuote {
  return {
    symbol: normalizeForexSymbol(raw.p),
    bidPrice: raw.b,
    bidSize: 0, // Polygon forex doesn't provide bid/ask size
    askPrice: raw.a,
    askSize: 0,
    timestamp: raw.t,
  }
}

function normalizeForexAggregate(raw: PolygonForexAggregate): NormalizedBar {
  return {
    symbol: normalizeForexSymbol(raw.pair),
    timeframe: '1m',
    open: raw.o,
    high: raw.h,
    low: raw.l,
    close: raw.c,
    volume: raw.v,
    timestamp: raw.s,
    vwap: raw.vw,
  }
}

/** Convert a forex quote to a synthetic trade for the bar builder */
function quoteToSyntheticTrade(quote: NormalizedQuote): NormalizedTrade {
  const mid = (quote.bidPrice + quote.askPrice) / 2
  return {
    symbol: quote.symbol,
    price: mid,
    size: 1,
    timestamp: quote.timestamp,
    exchange: 'FOREX',
  }
}

// ── Session Utilities ───────────────────────────────────────────────────────

export interface SessionStatus {
  session: SessionDefinition
  isOpen: boolean
  /** Minutes until session opens (0 if currently open) */
  minutesUntilOpen: number
  /** Minutes until session closes (0 if currently closed) */
  minutesUntilClose: number
}

/**
 * Parse a time string like '08:00' into total minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

/**
 * Get the current status of all forex trading sessions.
 *
 * @param now  Optional Date for testing; defaults to current time.
 * @returns Array of session statuses.
 */
export function getForexSessionStatuses(now = new Date()): SessionStatus[] {
  // Convert to ET minutes since midnight
  const etTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
  )
  const currentMinutes = etTime.getHours() * 60 + etTime.getMinutes()

  return FOREX_SESSIONS.map((session) => {
    const openMin = timeToMinutes(session.openET)
    const closeMin = timeToMinutes(session.closeET)

    let isOpen: boolean
    if (openMin < closeMin) {
      // Same-day session (e.g., London 03:00-12:00 ET)
      isOpen = currentMinutes >= openMin && currentMinutes < closeMin
    } else {
      // Overnight session (e.g., Sydney 17:00-02:00 ET)
      isOpen = currentMinutes >= openMin || currentMinutes < closeMin
    }

    // Forex market is closed on weekends (Saturday and Sunday in ET)
    const dayOfWeek = etTime.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Sunday: only open from ~17:00 ET (Sydney open)
      if (dayOfWeek === 0 && currentMinutes < timeToMinutes('17:00')) {
        isOpen = false
      }
      // Saturday: always closed
      if (dayOfWeek === 6) {
        isOpen = false
      }
    }

    // Calculate minutes until open/close
    let minutesUntilOpen = 0
    let minutesUntilClose = 0

    if (!isOpen) {
      if (currentMinutes < openMin) {
        minutesUntilOpen = openMin - currentMinutes
      } else {
        minutesUntilOpen = 24 * 60 - currentMinutes + openMin
      }
    } else {
      if (closeMin > currentMinutes) {
        minutesUntilClose = closeMin - currentMinutes
      } else {
        minutesUntilClose = 24 * 60 - currentMinutes + closeMin
      }
    }

    return { session, isOpen, minutesUntilOpen, minutesUntilClose }
  })
}

/**
 * Get overlap zones — periods where multiple sessions are active simultaneously.
 * These tend to be the most volatile and liquid trading periods.
 */
export function getSessionOverlaps(): { name: string; sessions: string[]; openET: string; closeET: string }[] {
  return [
    {
      name: 'Tokyo-London',
      sessions: ['Tokyo', 'London'],
      openET: '03:00',
      closeET: '04:00',
    },
    {
      name: 'London-New York',
      sessions: ['London', 'New York'],
      openET: '08:00',
      closeET: '12:00',
    },
    {
      name: 'Sydney-Tokyo',
      sessions: ['Sydney', 'Tokyo'],
      openET: '19:00',
      closeET: '02:00',
    },
  ]
}

// ── WebSocket Adapter ───────────────────────────────────────────────────────

export class ForexWebSocketAdapter {
  private ws: WebSocket | null = null
  private reconnectAttempt = 0
  private maxReconnectDelay = 30_000
  private baseDelay = 100
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isShuttingDown = false

  constructor(private readonly options: ForexProviderOptions) {}

  connect(): void {
    this.isShuttingDown = false
    this.ws = new WebSocket(POLYGON_FOREX_WS_URL)

    this.ws.on('open', () => {
      this.reconnectAttempt = 0
      this.authenticate()
    })

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data.toString())
    })

    this.ws.on('close', () => {
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
    const quoteChannels = pairs.map((p) => `C.${p.replace('/', '')}`).join(',')
    const aggChannels = pairs.map((p) => `CA.${p.replace('/', '')}`).join(',')
    this.ws.send(JSON.stringify({ action: 'subscribe', params: `${quoteChannels},${aggChannels}` }))
  }

  unsubscribe(pairs: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const quoteChannels = pairs.map((p) => `C.${p.replace('/', '')}`).join(',')
    const aggChannels = pairs.map((p) => `CA.${p.replace('/', '')}`).join(',')
    this.ws.send(JSON.stringify({ action: 'unsubscribe', params: `${quoteChannels},${aggChannels}` }))
  }

  private authenticate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ action: 'auth', params: this.options.apiKey }))
  }

  private handleMessage(raw: string): void {
    let messages: unknown[]
    try {
      const parsed: unknown = JSON.parse(raw)
      messages = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return
    }

    for (const msg of messages) {
      const result = PolygonForexMessageSchema.safeParse(msg)
      if (!result.success) continue

      const data = result.data
      switch (data.ev) {
        case 'C': {
          const quote = normalizeForexQuote(data)
          this.options.onQuote(quote)
          break
        }
        case 'CA':
          this.options.onBar?.(normalizeForexAggregate(data))
          break
        case 'status':
          if (data.status === 'auth_success') {
            this.options.onConnected?.()
            const pairs = this.options.pairs ?? [...ALL_FOREX_PAIRS]
            this.subscribe(pairs)
          }
          break
      }
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
