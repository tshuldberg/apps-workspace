import { PolygonWebSocketAdapter } from './providers/polygon-ws.js'
import { Level2Provider } from './providers/level2-provider.js'
import { BarBuilder } from './aggregation/bar-builder.js'
import { RedisPublisher } from './publisher/redis-publisher.js'
import { isRegularTrade } from './normalization/normalize.js'
import type { PolygonTrade } from './providers/polygon-ws.js'
import type { OrderBook, Level2Update } from '@marlin/shared'

const POLYGON_API_KEY = process.env.POLYGON_API_KEY
const REDIS_URL = process.env.REDIS_URL
const SYMBOLS = (process.env.SYMBOLS ?? 'AAPL,MSFT,GOOGL,AMZN,TSLA,SPY,QQQ').split(',')

if (!POLYGON_API_KEY) {
  console.error('POLYGON_API_KEY is required')
  process.exit(1)
}

if (!REDIS_URL) {
  console.error('REDIS_URL is required')
  process.exit(1)
}

const publisher = new RedisPublisher(REDIS_URL)

const barBuilder = new BarBuilder(async (bar) => {
  await publisher.publishBar(bar)
  console.log(`[bar] ${bar.symbol} ${bar.timeframe} O=${bar.open} H=${bar.high} L=${bar.low} C=${bar.close} V=${bar.volume}`)
})

const adapter = new PolygonWebSocketAdapter({
  apiKey: POLYGON_API_KEY,
  symbols: SYMBOLS,
  onTrade: (trade) => {
    barBuilder.processTrade(trade)
  },
  onBar: async (bar) => {
    await publisher.publishBar(bar)
    console.log(`[agg] ${bar.symbol} ${bar.timeframe} O=${bar.open} C=${bar.close} V=${bar.volume}`)
  },
  onConnected: () => {
    console.log(`[market-data] Connected to Polygon.io, subscribed to ${SYMBOLS.join(', ')}`)
  },
  onDisconnected: () => {
    console.log('[market-data] Disconnected from Polygon.io, reconnecting...')
  },
  onError: (err) => {
    console.error('[market-data] WebSocket error:', err.message)
  },
})

// ── Level 2 Provider ──────────────────────────────────────────────────────
const L2_ENABLED = process.env.ENABLE_LEVEL2 === 'true'
const L2_SYMBOLS = (process.env.L2_SYMBOLS ?? 'SPY,QQQ,AAPL').split(',')

let level2Provider: Level2Provider | null = null

if (L2_ENABLED) {
  level2Provider = new Level2Provider({
    apiKey: POLYGON_API_KEY,
    depth: 20,
    onConnected: () => {
      console.log(`[market-data] Level 2 connected, subscribed to ${L2_SYMBOLS.join(', ')}`)
    },
    onDisconnected: () => {
      console.log('[market-data] Level 2 disconnected, reconnecting...')
    },
    onError: (err) => {
      console.error('[market-data] Level 2 WebSocket error:', err.message)
    },
  })

  level2Provider.on('snapshot', (book: OrderBook) => {
    console.log(`[L2] snapshot ${book.symbol} bids=${book.bids.length} asks=${book.asks.length}`)
  })

  level2Provider.on('update', (symbol: string, updates: Level2Update[]) => {
    console.log(`[L2] update ${symbol} changes=${updates.length}`)
  })
}

async function start(): Promise<void> {
  await publisher.connect()
  console.log('[market-data] Redis publisher connected')

  adapter.connect()
  console.log('[market-data] Starting Polygon.io WebSocket connection...')

  if (level2Provider && L2_ENABLED) {
    level2Provider.connect()
    level2Provider.subscribe(L2_SYMBOLS)
    console.log('[market-data] Starting Level 2 WebSocket connection...')
  }
}

function shutdown(): void {
  console.log('[market-data] Shutting down...')
  barBuilder.flush()
  adapter.disconnect()
  level2Provider?.disconnect()
  publisher.disconnect().then(() => {
    console.log('[market-data] Clean shutdown complete')
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start().catch((err) => {
  console.error('[market-data] Failed to start:', err)
  process.exit(1)
})
