/**
 * Historical Data Loader
 * Sprint 41-42: Vectorized Backtesting Engine
 *
 * Loads, adjusts, and generates OHLCV bar data for backtesting.
 * Includes a mock data generator that produces realistic price series
 * for testing without a live database connection.
 */

import type { OHLCV, Timeframe } from '@marlin/shared'

// ── Corporate Action Types ────────────────────────────────────────────────

export interface StockSplit {
  /** Ex-date timestamp (ms) */
  exDate: number
  /** Split ratio numerator (e.g. 4 for a 4:1 split) */
  numerator: number
  /** Split ratio denominator (e.g. 1 for a 4:1 split) */
  denominator: number
}

export interface Dividend {
  /** Ex-dividend date timestamp (ms) */
  exDate: number
  /** Cash dividend per share */
  amount: number
}

// ── Mock Data Generator Options ───────────────────────────────────────────

export interface MockBarOptions {
  /** Starting price (default 100) */
  startPrice?: number
  /** Annualized volatility as decimal (default 0.25 = 25%) */
  volatility?: number
  /** Daily drift/trend as decimal (default 0.0002 = ~5% annualized) */
  drift?: number
  /** Probability of a gap between bars (default 0.05 = 5%) */
  gapProbability?: number
  /** Maximum gap size as a fraction of price (default 0.03 = 3%) */
  maxGapSize?: number
  /** Starting timestamp in ms (default: 2024-01-02 09:30 ET) */
  startTimestamp?: number
  /** Timeframe for bar spacing (default '1D') */
  timeframe?: Timeframe
  /** Average volume per bar (default 1_000_000) */
  avgVolume?: number
  /** Random seed for reproducibility (simple LCG — not crypto-grade) */
  seed?: number
}

// ── Data Loader ───────────────────────────────────────────────────────────

/**
 * Load historical bars from TimescaleDB.
 *
 * This is a mock implementation that generates realistic bars.
 * In production, this would query the market-data service's TimescaleDB
 * hypertable via the data pipeline.
 *
 * @param symbol    Ticker symbol (e.g. 'AAPL')
 * @param timeframe Bar timeframe (e.g. '1D', '1h')
 * @param start     Start timestamp (ms)
 * @param end       End timestamp (ms)
 */
export async function loadHistoricalBars(
  symbol: string,
  timeframe: Timeframe,
  start: number,
  end: number,
): Promise<OHLCV[]> {
  // TODO: Replace with actual TimescaleDB query via market-data service
  // SELECT time_bucket('1 day', timestamp) AS bucket,
  //        first(open, timestamp) AS open,
  //        max(high) AS high,
  //        min(low) AS low,
  //        last(close, timestamp) AS close,
  //        sum(volume) AS volume
  // FROM bars
  // WHERE symbol = $1
  //   AND timestamp BETWEEN $2 AND $3
  // GROUP BY bucket
  // ORDER BY bucket ASC

  const intervalMs = timeframeToMs(timeframe)
  const count = Math.floor((end - start) / intervalMs)

  return generateMockBars(symbol, Math.max(1, count), {
    startTimestamp: start,
    timeframe,
  })
}

// ── Corporate Action Adjustments ──────────────────────────────────────────

/**
 * Adjust historical prices for stock splits.
 *
 * All bars before each split's ex-date are divided by the split ratio.
 * This makes pre-split prices comparable to post-split prices.
 *
 * @param bars    OHLCV array (will be cloned, not mutated)
 * @param splits  Array of StockSplit records, sorted by exDate ascending
 * @returns       New array with adjusted prices
 */
export function adjustForSplits(bars: OHLCV[], splits: StockSplit[]): OHLCV[] {
  if (splits.length === 0) return bars

  const adjusted = bars.map((b) => ({ ...b }))

  for (const split of splits) {
    const ratio = split.numerator / split.denominator

    for (const bar of adjusted) {
      if (bar.timestamp < split.exDate) {
        bar.open /= ratio
        bar.high /= ratio
        bar.low /= ratio
        bar.close /= ratio
        bar.volume *= ratio
      }
    }
  }

  return adjusted
}

/**
 * Adjust historical prices for ex-dividend dates.
 *
 * Subtracts the dividend amount from all bars before the ex-date.
 * This removes the discontinuity that occurs when a stock goes ex-dividend.
 *
 * @param bars       OHLCV array (will be cloned, not mutated)
 * @param dividends  Array of Dividend records, sorted by exDate ascending
 * @returns          New array with adjusted prices
 */
export function adjustForDividends(bars: OHLCV[], dividends: Dividend[]): OHLCV[] {
  if (dividends.length === 0) return bars

  const adjusted = bars.map((b) => ({ ...b }))

  for (const div of dividends) {
    for (const bar of adjusted) {
      if (bar.timestamp < div.exDate) {
        bar.open -= div.amount
        bar.high -= div.amount
        bar.low -= div.amount
        bar.close -= div.amount
      }
    }
  }

  return adjusted
}

// ── Mock Data Generator ───────────────────────────────────────────────────

/**
 * Generate realistic mock OHLCV bars using geometric Brownian motion
 * with configurable trend, volatility, and gap behavior.
 *
 * The generator produces bars with:
 * - Realistic OHLC relationships (high >= open, close; low <= open, close)
 * - Volume that correlates with price movement
 * - Occasional gaps between bars
 * - Configurable drift and volatility
 *
 * @param symbol  Ticker symbol (metadata only)
 * @param count   Number of bars to generate
 * @param options Configuration options
 */
export function generateMockBars(
  _symbol: string,
  count: number,
  options: MockBarOptions = {},
): OHLCV[] {
  const {
    startPrice = 100,
    volatility = 0.25,
    drift = 0.0002,
    gapProbability = 0.05,
    maxGapSize = 0.03,
    startTimestamp = 1704200400000, // 2024-01-02 09:30 ET
    timeframe = '1D',
    avgVolume = 1_000_000,
    seed,
  } = options

  const intervalMs = timeframeToMs(timeframe)
  const rng = createRng(seed)

  // Daily volatility from annualized
  const dailyVol = volatility / Math.sqrt(252)

  const bars: OHLCV[] = []
  let price = startPrice

  for (let i = 0; i < count; i++) {
    const timestamp = startTimestamp + i * intervalMs

    // Apply gap if triggered
    if (i > 0 && rng() < gapProbability) {
      const gapDirection = rng() > 0.5 ? 1 : -1
      const gapSize = rng() * maxGapSize
      price *= 1 + gapDirection * gapSize
    }

    const open = price

    // Generate intra-bar price movement using random walk
    const returnVal = drift + dailyVol * gaussianRandom(rng)
    const close = open * (1 + returnVal)

    // Generate realistic high/low
    // High is above both open and close, low is below both
    const barRange = Math.abs(close - open)
    const extraWick = barRange * (0.2 + rng() * 0.8) // Wicks 20-100% of body

    const high = Math.max(open, close) + extraWick * rng()
    const low = Math.min(open, close) - extraWick * rng()

    // Volume correlates with absolute return (bigger moves = more volume)
    const moveSize = Math.abs(returnVal)
    const volumeMultiplier = 0.5 + moveSize * 20 + rng() * 0.5
    const volume = Math.round(avgVolume * volumeMultiplier)

    bars.push({
      open: roundPrice(open),
      high: roundPrice(Math.max(high, open, close)),
      low: roundPrice(Math.min(low, open, close)),
      close: roundPrice(close),
      volume,
      timestamp,
    })

    // Next bar opens near this bar's close
    price = close
  }

  return bars
}

// ── Helpers ───────────────────────────────────────────────────────────────

function timeframeToMs(tf: Timeframe): number {
  switch (tf) {
    case '1m': return 60_000
    case '5m': return 5 * 60_000
    case '15m': return 15 * 60_000
    case '30m': return 30 * 60_000
    case '1h': return 60 * 60_000
    case '4h': return 4 * 60 * 60_000
    case '1D': return 24 * 60 * 60_000
    case '1W': return 7 * 24 * 60 * 60_000
    case '1M': return 30 * 24 * 60 * 60_000
  }
}

/**
 * Simple seeded pseudo-random number generator (LCG).
 * Not cryptographically secure — fine for mock data.
 */
function createRng(seed?: number): () => number {
  let state = seed ?? Math.floor(Math.random() * 2_147_483_647)

  return () => {
    state = (state * 1_664_525 + 1_013_904_223) & 0x7fffffff
    return state / 0x7fffffff
  }
}

/**
 * Box-Muller transform: generate a normally distributed random number
 * from a uniform RNG.
 */
function gaussianRandom(rng: () => number): number {
  const u1 = rng()
  const u2 = rng()

  // Prevent log(0)
  const safeU1 = Math.max(u1, 1e-10)

  return Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2)
}

function roundPrice(price: number): number {
  return Math.round(price * 10_000) / 10_000
}
