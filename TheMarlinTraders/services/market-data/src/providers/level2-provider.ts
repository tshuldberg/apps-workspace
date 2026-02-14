import WebSocket from 'ws'
import { z } from 'zod'
import { EventEmitter } from 'events'
import type { OrderBook, Level2Update, Level2Entry } from '@marlin/shared'

// ── Polygon Level 2 Message Schemas ────────────────────────────────────────

const PolygonL2SnapshotSchema = z.object({
  ev: z.literal('XL2'),
  sym: z.string(),
  bids: z.array(z.tuple([z.number(), z.number()])), // [price, size]
  asks: z.array(z.tuple([z.number(), z.number()])), // [price, size]
  t: z.number(),
})

const PolygonL2UpdateSchema = z.object({
  ev: z.literal('L2'),
  sym: z.string(),
  bids: z.array(z.tuple([z.number(), z.number()])).optional(),
  asks: z.array(z.tuple([z.number(), z.number()])).optional(),
  t: z.number(),
})

type PolygonL2Snapshot = z.infer<typeof PolygonL2SnapshotSchema>
type PolygonL2Update = z.infer<typeof PolygonL2UpdateSchema>

const PolygonL2MessageSchema = z.discriminatedUnion('ev', [
  PolygonL2SnapshotSchema,
  PolygonL2UpdateSchema,
  z.object({ ev: z.literal('status'), status: z.string(), message: z.string() }),
])

// ── Configuration ──────────────────────────────────────────────────────────

export type DepthLevel = 5 | 10 | 20 | 50

export interface Level2ProviderOptions {
  apiKey: string
  /** Maximum depth to maintain per side (default: 20) */
  depth?: DepthLevel
  onError?: (error: Error) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

// ── Provider ───────────────────────────────────────────────────────────────

export class Level2Provider extends EventEmitter {
  private ws: WebSocket | null = null
  private reconnectAttempt = 0
  private maxReconnectDelay = 30_000
  private baseDelay = 100
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isShuttingDown = false
  private subscribedSymbols = new Set<string>()
  private books = new Map<string, OrderBook>()
  private depth: DepthLevel

  constructor(private readonly options: Level2ProviderOptions) {
    super()
    this.depth = options.depth ?? 20
  }

  /** Connect to Level 2 WebSocket feed */
  connect(): void {
    this.isShuttingDown = false
    this.ws = new WebSocket('wss://socket.polygon.io/stocks')

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

  /** Disconnect and clean up */
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
    this.books.clear()
    this.subscribedSymbols.clear()
  }

  /** Subscribe to Level 2 data for the given symbols */
  subscribe(symbols: string[]): void {
    for (const s of symbols) {
      this.subscribedSymbols.add(s)
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const channels = symbols.map((s) => `XL2.${s}`).join(',')
    this.ws.send(JSON.stringify({ action: 'subscribe', params: channels }))
  }

  /** Unsubscribe from Level 2 data for the given symbols */
  unsubscribe(symbols: string[]): void {
    for (const s of symbols) {
      this.subscribedSymbols.delete(s)
      this.books.delete(s)
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const channels = symbols.map((s) => `XL2.${s}`).join(',')
    this.ws.send(JSON.stringify({ action: 'unsubscribe', params: channels }))
  }

  /** Get the current order book snapshot for a symbol */
  getBook(symbol: string): OrderBook | undefined {
    return this.books.get(symbol)
  }

  /** Set the maximum depth to maintain */
  setDepth(depth: DepthLevel): void {
    this.depth = depth
    // Trim existing books to new depth
    for (const [symbol, book] of this.books) {
      this.books.set(symbol, {
        ...book,
        bids: book.bids.slice(0, depth),
        asks: book.asks.slice(0, depth),
      })
    }
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
      const result = PolygonL2MessageSchema.safeParse(msg)
      if (!result.success) continue

      const data = result.data
      switch (data.ev) {
        case 'XL2':
          this.handleSnapshot(data)
          break
        case 'L2':
          this.handleUpdate(data)
          break
        case 'status':
          if (data.status === 'auth_success') {
            this.options.onConnected?.()
            // Re-subscribe to previously tracked symbols
            if (this.subscribedSymbols.size > 0) {
              this.subscribe([...this.subscribedSymbols])
            }
          }
          break
      }
    }
  }

  /** Process a full order book snapshot */
  private handleSnapshot(snap: PolygonL2Snapshot): void {
    const bids: Level2Entry[] = snap.bids
      .map(([price, size]) => ({ price, size }))
      .sort((a, b) => b.price - a.price)
      .slice(0, this.depth)

    const asks: Level2Entry[] = snap.asks
      .map(([price, size]) => ({ price, size }))
      .sort((a, b) => a.price - b.price)
      .slice(0, this.depth)

    const book: OrderBook = {
      symbol: snap.sym,
      bids,
      asks,
      timestamp: snap.t,
    }

    this.books.set(snap.sym, book)
    this.emit('snapshot', book)
  }

  /** Process an incremental Level 2 update */
  private handleUpdate(upd: PolygonL2Update): void {
    let book = this.books.get(upd.sym)
    if (!book) {
      // No snapshot yet — create empty book
      book = { symbol: upd.sym, bids: [], asks: [], timestamp: upd.t }
      this.books.set(upd.sym, book)
    }

    const updates: Level2Update[] = []

    if (upd.bids) {
      for (const [price, size] of upd.bids) {
        const update = this.applyEntryUpdate(book.bids, price, size, 'desc')
        updates.push({ side: 'bid', price, size, action: update })
      }
      book.bids = book.bids.slice(0, this.depth)
    }

    if (upd.asks) {
      for (const [price, size] of upd.asks) {
        const update = this.applyEntryUpdate(book.asks, price, size, 'asc')
        updates.push({ side: 'ask', price, size, action: update })
      }
      book.asks = book.asks.slice(0, this.depth)
    }

    book.timestamp = upd.t

    if (updates.length > 0) {
      this.emit('update', upd.sym, updates, book)
    }
  }

  /**
   * Apply a single price/size update to a sorted side of the book.
   * If size === 0, remove the level. Otherwise, insert or update.
   * Returns the action taken.
   */
  private applyEntryUpdate(
    entries: Level2Entry[],
    price: number,
    size: number,
    sortOrder: 'asc' | 'desc',
  ): 'add' | 'remove' | 'update' {
    const idx = entries.findIndex((e) => e.price === price)

    if (size === 0) {
      if (idx !== -1) {
        entries.splice(idx, 1)
      }
      return 'remove'
    }

    if (idx !== -1) {
      entries[idx]!.size = size
      return 'update'
    }

    // Insert in sorted position
    const entry: Level2Entry = { price, size }
    const insertIdx = entries.findIndex((e) =>
      sortOrder === 'desc' ? e.price < price : e.price > price,
    )
    if (insertIdx === -1) {
      entries.push(entry)
    } else {
      entries.splice(insertIdx, 0, entry)
    }
    return 'add'
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
