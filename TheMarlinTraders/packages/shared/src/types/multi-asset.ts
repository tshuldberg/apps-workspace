import { z } from 'zod'

// ── Asset Class ─────────────────────────────────────────────────────────────

export const AssetClassSchema = z.enum(['stock', 'etf', 'crypto', 'forex', 'futures', 'option'])
export type AssetClass = z.infer<typeof AssetClassSchema>

// ── Crypto ──────────────────────────────────────────────────────────────────

export interface CryptoSymbol {
  /** Base currency (e.g. 'BTC') */
  base: string
  /** Quote currency (e.g. 'USD') */
  quote: string
  /** Exchange identifier (e.g. 'coinbase', 'binance') */
  exchange: string
}

/** Top 20 crypto pairs by market cap */
export const TOP_CRYPTO_PAIRS: readonly string[] = [
  'BTC-USD',
  'ETH-USD',
  'SOL-USD',
  'BNB-USD',
  'XRP-USD',
  'ADA-USD',
  'DOGE-USD',
  'AVAX-USD',
  'DOT-USD',
  'MATIC-USD',
  'LINK-USD',
  'UNI-USD',
  'ATOM-USD',
  'LTC-USD',
  'NEAR-USD',
  'FIL-USD',
  'APT-USD',
  'ARB-USD',
  'OP-USD',
  'SUI-USD',
] as const

// ── Forex ───────────────────────────────────────────────────────────────────

export interface ForexPair {
  /** Base currency (e.g. 'EUR') */
  base: string
  /** Counter / quote currency (e.g. 'USD') */
  counter: string
  /** Smallest price increment — 0.0001 for most pairs, 0.01 for JPY pairs */
  pipSize: number
}

/** Parse a pair string like 'EUR/USD' into a ForexPair */
export function parseForexPair(pair: string): ForexPair {
  const [base, counter] = pair.replace('/', '-').split('-')
  if (!base || !counter) throw new Error(`Invalid forex pair: ${pair}`)
  const isJpy = counter.toUpperCase() === 'JPY' || base.toUpperCase() === 'JPY'
  return {
    base: base.toUpperCase(),
    counter: counter.toUpperCase(),
    pipSize: isJpy ? 0.01 : 0.0001,
  }
}

/** Major forex pairs */
export const MAJOR_FOREX_PAIRS: readonly string[] = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'AUD/USD',
  'USD/CAD',
  'USD/CHF',
  'NZD/USD',
] as const

/** Cross forex pairs */
export const CROSS_FOREX_PAIRS: readonly string[] = [
  'EUR/GBP',
  'EUR/JPY',
  'GBP/JPY',
] as const

/** Exotic forex pairs */
export const EXOTIC_FOREX_PAIRS: readonly string[] = [
  'USD/MXN',
  'USD/ZAR',
  'USD/TRY',
] as const

/** All forex pairs combined */
export const ALL_FOREX_PAIRS: readonly string[] = [
  ...MAJOR_FOREX_PAIRS,
  ...CROSS_FOREX_PAIRS,
  ...EXOTIC_FOREX_PAIRS,
] as const

// ── Sessions ────────────────────────────────────────────────────────────────

export interface SessionDefinition {
  /** Display name (e.g. 'London') */
  name: string
  /** Session open time in HH:mm format */
  open: string
  /** Session close time in HH:mm format */
  close: string
  /** IANA timezone (e.g. 'America/New_York') */
  timezone: string
  /** All times expressed in ET offset for normalization */
  openET: string
  closeET: string
}

export const FOREX_SESSIONS: readonly SessionDefinition[] = [
  {
    name: 'Sydney',
    open: '17:00',
    close: '02:00',
    timezone: 'Australia/Sydney',
    openET: '17:00',
    closeET: '02:00',
  },
  {
    name: 'Tokyo',
    open: '19:00',
    close: '04:00',
    timezone: 'Asia/Tokyo',
    openET: '19:00',
    closeET: '04:00',
  },
  {
    name: 'London',
    open: '03:00',
    close: '12:00',
    timezone: 'Europe/London',
    openET: '03:00',
    closeET: '12:00',
  },
  {
    name: 'New York',
    open: '08:00',
    close: '17:00',
    timezone: 'America/New_York',
    openET: '08:00',
    closeET: '17:00',
  },
] as const

/** 8 major currencies for strength calculations */
export const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'] as const
export type MajorCurrency = (typeof MAJOR_CURRENCIES)[number]

// ── Lot Sizes ───────────────────────────────────────────────────────────────

export const LOT_SIZES = {
  standard: 100_000,
  mini: 10_000,
  micro: 1_000,
} as const

export type LotType = keyof typeof LOT_SIZES

// ── Currency Strength ───────────────────────────────────────────────────────

export interface CurrencyStrength {
  currency: MajorCurrency
  /** Normalized strength 0-100 */
  strength: number
  /** Absolute change from previous period */
  change: number
}

// ── Correlation ─────────────────────────────────────────────────────────────

export type CorrelationPeriod = '1D' | '1W' | '1M' | '3M' | '1Y'

export interface CorrelationEntry {
  symbolA: string
  symbolB: string
  coefficient: number
}

export interface CorrelationMatrix {
  symbols: string[]
  /** Row-major 2D array: matrix[i][j] = correlation between symbols[i] and symbols[j] */
  matrix: number[][]
  period: CorrelationPeriod
}
