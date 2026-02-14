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

let lastRequestTime = 0

async function rateLimitWait(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_INTERVAL_MS - elapsed))
  }
  lastRequestTime = Date.now()
}

export async function getAggregates(
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string,
): Promise<NormalizedBar[]> {
  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) {
    throw new PolygonApiError('POLYGON_API_KEY environment variable is not set', 500)
  }

  const tf = TIMEFRAME_MAP[timeframe]
  const url = `${BASE_URL}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${tf.multiplier}/${tf.timespan}/${from}/${to}?adjusted=true&sort=asc&apiKey=${apiKey}`

  await rateLimitWait()

  const response = await fetch(url)

  if (!response.ok) {
    throw new PolygonApiError(
      `Polygon API error: ${response.status} ${response.statusText}`,
      response.status,
      symbol,
    )
  }

  const data: PolygonAggResponse = await response.json()

  if (!data.results || data.results.length === 0) {
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
}
