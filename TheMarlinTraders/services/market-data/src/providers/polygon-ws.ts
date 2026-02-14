import WebSocket from 'ws'
import { z } from 'zod'
import { normalizeTrade, normalizeAggregate } from '../normalization/normalize.js'
import type { NormalizedTrade, NormalizedBar } from '@marlin/shared'

const POLYGON_WS_URL = 'wss://socket.polygon.io/stocks'

/** Raw Polygon.io trade message schema */
const PolygonTradeSchema = z.object({
  ev: z.literal('T'),
  sym: z.string(),
  p: z.number(),
  s: z.number(),
  t: z.number(),
  c: z.array(z.number()).optional(),
  x: z.number().optional(),
})

/** Raw Polygon.io aggregate (minute bar) message schema */
const PolygonAggregateSchema = z.object({
  ev: z.literal('AM'),
  sym: z.string(),
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number(),
  s: z.number(),
  e: z.number(),
  vw: z.number().optional(),
  z: z.number().optional(),
})

export type PolygonTrade = z.infer<typeof PolygonTradeSchema>
export type PolygonAggregate = z.infer<typeof PolygonAggregateSchema>

const PolygonMessageSchema = z.discriminatedUnion('ev', [
  PolygonTradeSchema,
  PolygonAggregateSchema,
  z.object({ ev: z.literal('status'), status: z.string(), message: z.string() }),
])

export interface PolygonWSOptions {
  apiKey: string
  symbols: string[]
  onTrade: (trade: NormalizedTrade) => void
  onBar: (bar: NormalizedBar) => void
  onError?: (error: Error) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

export class PolygonWebSocketAdapter {
  private ws: WebSocket | null = null
  private reconnectAttempt = 0
  private maxReconnectDelay = 30_000
  private baseDelay = 100
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isShuttingDown = false

  constructor(private readonly options: PolygonWSOptions) {}

  connect(): void {
    this.isShuttingDown = false
    this.ws = new WebSocket(POLYGON_WS_URL)

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

  subscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const tradeChannels = symbols.map((s) => `T.${s}`).join(',')
    const aggChannels = symbols.map((s) => `AM.${s}`).join(',')
    this.ws.send(JSON.stringify({ action: 'subscribe', params: `${tradeChannels},${aggChannels}` }))
  }

  unsubscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const tradeChannels = symbols.map((s) => `T.${s}`).join(',')
    const aggChannels = symbols.map((s) => `AM.${s}`).join(',')
    this.ws.send(JSON.stringify({ action: 'unsubscribe', params: `${tradeChannels},${aggChannels}` }))
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
      const result = PolygonMessageSchema.safeParse(msg)
      if (!result.success) continue

      const data = result.data
      switch (data.ev) {
        case 'T':
          this.options.onTrade(normalizeTrade(data))
          break
        case 'AM':
          this.options.onBar(normalizeAggregate(data))
          break
        case 'status':
          if (data.status === 'auth_success') {
            this.options.onConnected?.()
            this.subscribe(this.options.symbols)
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
