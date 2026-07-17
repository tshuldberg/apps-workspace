import type { NormalizedBar, Timeframe } from '@marlin/shared'

export class PolygonApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public ticker?: string,
  ) {
    super(message)
    this.name = 'PolygonApiError'
  }
}

interface PolygonAggResult {
  o: number
  h: number
  l: number
  c: number
  v: number
  t: number
  vw?: number
  n?: number
}

interface PolygonAggResponse {
  status: string
  resultsCount: number
  results?: PolygonAggResult[]
  ticker?: string
  queryCount?: number
  request_id?: string
}

const TIMEFRAME_MAP: Record<Timeframe, { multiplier: number; timespan: string }> = {
  '1m': { multiplier: 1, timespan: 'minute' },
  '5m': { multiplier: 5, timespan: 'minute' },
  '15m': { multiplier: 15, timespan: 'minute' },
  '30m': { multiplier: 30, timespan: 'minute' },
  '1h': { multiplier: 1, timespan: 'hour' },
  '4h': { multiplier: 4, timespan: 'hour' },
  '1D': { multiplier: 1, timespan: 'day' },
  '1W': { multiplier: 1, timespan: 'week' },
  '1M': { multiplier: 1, timespan: 'month' },
}

const BASE_URL = 'https://api.polygon.io'
const RATE_LIMIT_INTERVAL_MS = 12_000 // 5 req/min = 1 per 12s
const DEV_FALLBACK_MAX_POINTS = 2_000

let lastRequestTime = 0
let warnedMockFallback = false

async function rateLimitWait(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return

  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_INTERVAL_MS - elapsed))
  }
  lastRequestTime = Date.now()
}

function shouldUseDevFallback(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function timeframeToMs(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1m':
      return 60_000
    case '5m':
      return 5 * 60_000
    case '15m':
      return 15 * 60_000
    case '30m':
      return 30 * 60_000
    case '1h':
      return 60 * 60_000
    case '4h':
      return 4 * 60 * 60_000
    case '1D':
      return 24 * 60 * 60_000
    case '1W':
      return 7 * 24 * 60 * 60_000
    case '1M':
      return 30 * 24 * 60 * 60_000
  }
}

function warnFallbackOnce(reason: string): void {
  if (warnedMockFallback) return
  warnedMockFallback = true
  console.warn(`[market-data] Using generated fallback bars (${reason}).`)
}

function generateMockAggregates(
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string,
): NormalizedBar[] {
  const now = Date.now()
  let start = Date.parse(from)
  let end = Date.parse(to)
  const stepMs = timeframeToMs(timeframe)

  if (!Number.isFinite(start)) start = now - 90 * 24 * 60 * 60_000
  if (!Number.isFinite(end)) end = now
  if (end <= start) end = start + stepMs * 200

  const estimatedPoints = Math.floor((end - start) / stepMs) + 1
  const stride = Math.max(1, Math.ceil(estimatedPoints / DEV_FALLBACK_MAX_POINTS))
  const effectiveStep = stepMs * stride

  const seed = symbol
    .toUpperCase()
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0)

  let price = 50 + (seed % 350)
  const bars: NormalizedBar[] = []

  for (let ts = start, i = 0; ts <= end && bars.length < DEV_FALLBACK_MAX_POINTS; ts += effectiveStep, i++) {
    const wave = Math.sin((i + seed) * 0.05) * 0.006
    const drift = Math.cos((i + seed) * 0.017) * 0.0018
    const noise = Math.sin((i + 3) * ((seed % 11) + 2)) * 0.0015
    const delta = wave + drift + noise

    const open = price
    const close = Math.max(1, open * (1 + delta))
    const high = Math.max(open, close) * (1 + Math.abs(delta) * 0.5 + 0.001)
    const low = Math.min(open, close) * (1 - Math.abs(delta) * 0.5 - 0.001)
    const volume = 500_000 + ((seed * 7919 + i * 104_729) % 1_500_000)

    bars.push({
      symbol,
      timeframe,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume,
      timestamp: ts,
    })

    price = close
  }

  return bars
}

export async function getAggregates(
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string,
): Promise<NormalizedBar[]> {
  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) {
    if (shouldUseDevFallback()) {
      warnFallbackOnce('missing POLYGON_API_KEY')
      return generateMockAggregates(symbol, timeframe, from, to)
    }
    throw new PolygonApiError('POLYGON_API_KEY environment variable is not set', 500)
  }

  const tf = TIMEFRAME_MAP[timeframe]
  const url = `${BASE_URL}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${tf.multiplier}/${tf.timespan}/${from}/${to}?adjusted=true&sort=asc&apiKey=${apiKey}`

  try {
    await rateLimitWait()

    const response = await fetch(url)

    if (!response.ok) {
      if (shouldUseDevFallback()) {
        warnFallbackOnce(`Polygon HTTP ${response.status}`)
        return generateMockAggregates(symbol, timeframe, from, to)
      }

      throw new PolygonApiError(
        `Polygon API error: ${response.status} ${response.statusText}`,
        response.status,
        symbol,
      )
    }

    const data: PolygonAggResponse = await response.json()

    if (!data.results || data.results.length === 0) {
      if (shouldUseDevFallback()) {
        warnFallbackOnce('empty Polygon response')
        return generateMockAggregates(symbol, timeframe, from, to)
      }
      return []
    }

    return data.results.map(
      (r): NormalizedBar => ({
        symbol,
        timeframe,
        open: r.o,
        high: r.h,
        low: r.l,
        close: r.c,
        volume: r.v,
        timestamp: r.t,
        vwap: r.vw,
        tradeCount: r.n,
      }),
    )
  } catch (error) {
    if (shouldUseDevFallback()) {
      const reason = error instanceof Error ? error.message : 'request failure'
      warnFallbackOnce(reason)
      return generateMockAggregates(symbol, timeframe, from, to)
    }

    throw error
  }
}
