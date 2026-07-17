import type {
  OptionsContract,
  OptionsChainData,
  OptionType,
  Strike,
  Expiration,
  GreeksResult,
  IVData,
} from '@marlin/shared'
import { calculateGreeks, impliedVolatility, ivRank, ivPercentile } from '@marlin/shared'

export class OptionsDataError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public ticker?: string,
  ) {
    super(message)
    this.name = 'OptionsDataError'
  }
}

// --- Polygon.io OPRA response types ---

interface PolygonOptionsContract {
  cfi?: string
  contract_type: 'call' | 'put'
  exercise_style?: string
  expiration_date: string
  primary_exchange?: string
  shares_per_contract?: number
  strike_price: number
  ticker: string
  underlying_ticker: string
}

interface PolygonOptionsQuote {
  day?: { close?: number; high?: number; low?: number; open?: number; volume?: number }
  details?: PolygonOptionsContract
  greeks?: {
    delta?: number
    gamma?: number
    theta?: number
    vega?: number
  }
  implied_volatility?: number
  last_quote?: { ask?: number; bid?: number; midpoint?: number }
  open_interest?: number
  underlying_asset?: { price?: number; change_to_break_even?: number }
}

interface PolygonSnapshotResponse {
  status: string
  results?: PolygonOptionsQuote[]
  request_id?: string
}

interface PolygonContractsResponse {
  status: string
  results?: PolygonOptionsContract[]
  next_url?: string
  request_id?: string
}

// --- Rate limiting ---

const BASE_URL = 'https://api.polygon.io'
const RATE_LIMIT_INTERVAL_MS = 12_000 // 5 req/min on free tier
let lastRequestTime = 0
let warnedOptionsFallback = false

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

function warnFallbackOnce(reason: string): void {
  if (warnedOptionsFallback) return
  warnedOptionsFallback = true
  console.warn(`[options-data] Using generated fallback options data (${reason}).`)
}

function getDefaultUnderlyingPrice(symbol: string): number {
  const defaults: Record<string, number> = {
    AAPL: 275,
    NVDA: 725,
    MSFT: 430,
    META: 690,
    AMZN: 255,
    TSLA: 410,
    SPY: 620,
    QQQ: 560,
  }
  return defaults[symbol] ?? 100 + (symbol.charCodeAt(0) % 200)
}

function getFallbackExpirations(): Expiration[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expirations: Expiration[] = []

  for (let i = 0; i < 8; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + (i + 1) * 7)
    const day = d.getDay()
    const toFriday = (5 - day + 7) % 7
    d.setDate(d.getDate() + toFriday)

    const date = d.toISOString().slice(0, 10)
    const dte = Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86_400_000))
    const dayOfMonth = d.getDate()
    const isMonthly = dayOfMonth >= 15 && dayOfMonth <= 21
    expirations.push({
      date,
      dte,
      isWeekly: !isMonthly,
      isMonthly,
    })
  }

  return expirations
}

function formatOptionTicker(symbol: string, expiration: string, type: OptionType, strike: number): string {
  const [year, month, day] = expiration.split('-')
  const yymmdd = `${year?.slice(2) ?? '00'}${month ?? '01'}${day ?? '01'}`
  const cp = type === 'call' ? 'C' : 'P'
  const strikeInt = Math.round(strike * 1000)
  return `O:${symbol}${yymmdd}${cp}${String(strikeInt).padStart(8, '0')}`
}

function buildFallbackContract(
  symbol: string,
  expiration: string,
  type: OptionType,
  strike: number,
  underlyingPrice: number,
  index: number,
): OptionsContract {
  const now = Date.now()
  const expTs = new Date(`${expiration}T00:00:00Z`).getTime()
  const t = Math.max((expTs - now) / (365.25 * 24 * 60 * 60 * 1000), 1 / 365)
  const moneyness = (strike - underlyingPrice) / underlyingPrice
  const iv = Math.max(0.12, 0.2 + Math.abs(moneyness) * 0.5)

  const intrinsic =
    type === 'call'
      ? Math.max(0, underlyingPrice - strike)
      : Math.max(0, strike - underlyingPrice)
  const timeValue = underlyingPrice * iv * Math.sqrt(t) * 0.16
  const mid = Math.max(0.05, intrinsic + timeValue)
  const bid = Number((mid * 0.97).toFixed(2))
  const ask = Number((mid * 1.03).toFixed(2))

  const callDelta = Math.min(0.95, Math.max(0.05, 0.5 - moneyness * 2))
  const delta = type === 'call' ? callDelta : callDelta - 1
  const gamma = Math.max(0.005, 0.03 - Math.abs(moneyness) * 0.04)
  const vega = Math.max(0.03, 0.18 - Math.abs(moneyness) * 0.16)
  const theta = -(mid * 0.015)

  return {
    symbol: formatOptionTicker(symbol, expiration, type, strike),
    underlying: symbol,
    type,
    strike,
    expiration,
    bid,
    ask,
    last: Number(mid.toFixed(2)),
    volume: 250 + ((index * 137) % 8_500),
    openInterest: 900 + ((index * 431) % 45_000),
    iv,
    greeks: {
      delta: Number(delta.toFixed(4)),
      gamma: Number(gamma.toFixed(4)),
      theta: Number(theta.toFixed(4)),
      vega: Number(vega.toFixed(4)),
      rho: 0,
    },
  }
}

function getFallbackChain(symbol: string, expiration?: string): OptionsChainData {
  const underlyingPrice = getDefaultUnderlyingPrice(symbol)
  const expirations = getFallbackExpirations()
  const targetExpiration = expiration ?? expirations[0]?.date ?? new Date().toISOString().slice(0, 10)

  const step = underlyingPrice >= 300 ? 10 : underlyingPrice >= 150 ? 5 : 2.5
  const baseStrike = Math.round(underlyingPrice / step) * step
  const strikes: Strike[] = []

  for (let i = -8; i <= 8; i++) {
    const strikePrice = Number((baseStrike + i * step).toFixed(2))
    if (strikePrice <= 0) continue
    strikes.push({
      price: strikePrice,
      call: buildFallbackContract(symbol, targetExpiration, 'call', strikePrice, underlyingPrice, i + 20),
      put: buildFallbackContract(symbol, targetExpiration, 'put', strikePrice, underlyingPrice, i + 60),
    })
  }

  return {
    underlying: symbol,
    underlyingPrice,
    expiration: targetExpiration,
    strikes,
    updatedAt: Date.now(),
  }
}

function getApiKey(): string {
  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) {
    throw new OptionsDataError('POLYGON_API_KEY environment variable is not set', 500)
  }
  return apiKey
}

// --- Public API ---

/**
 * Fetch available expiration dates for a given underlying symbol.
 */
export async function getExpirations(symbol: string): Promise<Expiration[]> {
  try {
    const apiKey = getApiKey()
    const url = `${BASE_URL}/v3/reference/options/contracts?underlying_ticker=${encodeURIComponent(symbol)}&limit=1000&apiKey=${apiKey}`

    await rateLimitWait()

    const response = await fetch(url)
    if (!response.ok) {
      throw new OptionsDataError(
        `Polygon API error: ${response.status} ${response.statusText}`,
        response.status,
        symbol,
      )
    }

    const data: PolygonContractsResponse = await response.json()
    if (!data.results || data.results.length === 0) return []

    // Collect unique expiration dates
    const expirationSet = new Map<string, boolean>()
    for (const contract of data.results) {
      if (!expirationSet.has(contract.expiration_date)) {
        expirationSet.set(contract.expiration_date, true)
      }
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const expirations: Expiration[] = []
    for (const [dateStr] of expirationSet) {
      const expDate = new Date(dateStr + 'T00:00:00')
      const dte = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / 86_400_000))
      if (dte < 0) continue

      // Fridays that aren't the third Friday of the month are weeklies
      const dayOfWeek = expDate.getDay()
      const dayOfMonth = expDate.getDate()
      const isThirdFriday = dayOfWeek === 5 && dayOfMonth >= 15 && dayOfMonth <= 21
      const isMonthly = isThirdFriday
      const isWeekly = !isMonthly

      expirations.push({ date: dateStr, dte, isWeekly, isMonthly })
    }

    expirations.sort((a, b) => a.date.localeCompare(b.date))
    return expirations
  } catch (error) {
    if (shouldUseDevFallback()) {
      const reason = error instanceof Error ? error.message : 'request failure'
      warnFallbackOnce(reason)
      return getFallbackExpirations()
    }
    throw error
  }
}

/**
 * Fetch the full options chain for a symbol at a specific expiration.
 */
export async function getChain(
  symbol: string,
  expiration?: string,
): Promise<OptionsChainData> {
  try {
    const apiKey = getApiKey()

    let url = `${BASE_URL}/v3/snapshot/options/${encodeURIComponent(symbol)}?limit=250&apiKey=${apiKey}`
    if (expiration) {
      url += `&expiration_date=${encodeURIComponent(expiration)}`
    }

    await rateLimitWait()

    const response = await fetch(url)
    if (!response.ok) {
      throw new OptionsDataError(
        `Polygon API error: ${response.status} ${response.statusText}`,
        response.status,
        symbol,
      )
    }

    const data: PolygonSnapshotResponse = await response.json()

    // Determine underlying price from the first result
    let underlyingPrice = 0
    if (data.results && data.results.length > 0) {
      underlyingPrice = data.results[0]?.underlying_asset?.price ?? 0
    }

    // Group by strike
    const strikeMap = new Map<number, Strike>()

    for (const quote of data.results ?? []) {
      if (!quote.details) continue

      const strikePrice = quote.details.strike_price
      if (!strikeMap.has(strikePrice)) {
        strikeMap.set(strikePrice, { price: strikePrice })
      }

      const contract = polygonQuoteToContract(quote, underlyingPrice)
      const strike = strikeMap.get(strikePrice)!

      if (quote.details.contract_type === 'call') {
        strike.call = contract
      } else {
        strike.put = contract
      }
    }

    const strikes = Array.from(strikeMap.values()).sort((a, b) => a.price - b.price)

    return {
      underlying: symbol,
      underlyingPrice,
      expiration: expiration ?? (strikes.length > 0 ? strikes[0]!.call?.expiration ?? strikes[0]!.put?.expiration ?? '' : ''),
      strikes,
      updatedAt: Date.now(),
    }
  } catch (error) {
    if (shouldUseDevFallback()) {
      const reason = error instanceof Error ? error.message : 'request failure'
      warnFallbackOnce(reason)
      return getFallbackChain(symbol, expiration)
    }
    throw error
  }
}

/**
 * Fetch a single contract quote with Greeks.
 */
export async function getQuote(contractSymbol: string): Promise<OptionsContract | null> {
  const apiKey = getApiKey()
  const url = `${BASE_URL}/v3/snapshot/options/${encodeURIComponent(contractSymbol)}?apiKey=${apiKey}`

  await rateLimitWait()

  const response = await fetch(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new OptionsDataError(
      `Polygon API error: ${response.status} ${response.statusText}`,
      response.status,
      contractSymbol,
    )
  }

  const data: PolygonSnapshotResponse = await response.json()
  if (!data.results || data.results.length === 0) return null

  return polygonQuoteToContract(data.results[0]!, 0)
}

/**
 * Compute IV analytics for a symbol (IV Rank, IV Percentile, history).
 * Uses the chain snapshot to derive current ATM IV and simulated history.
 */
export async function getIVAnalytics(symbol: string): Promise<IVData> {
  // Fetch current chain to get ATM IV
  const chain = await getChain(symbol)

  let currentIV = 0
  let callVolume = 0
  let putVolume = 0

  // Find ATM strike (closest to underlying price)
  let closestStrike: Strike | null = null
  let closestDiff = Infinity

  for (const strike of chain.strikes) {
    const diff = Math.abs(strike.price - chain.underlyingPrice)
    if (diff < closestDiff) {
      closestDiff = diff
      closestStrike = strike
    }

    callVolume += strike.call?.volume ?? 0
    putVolume += strike.put?.volume ?? 0
  }

  if (closestStrike) {
    const callIV = closestStrike.call?.iv ?? 0
    const putIV = closestStrike.put?.iv ?? 0
    currentIV = (callIV + putIV) / 2 || callIV || putIV
  }

  const putCallRatio = callVolume > 0 ? putVolume / callVolume : 0

  // For IV Rank/Percentile we need historical data.
  // Polygon's free tier doesn't give historical IV, so we return what we have.
  // In production this would query stored daily IV snapshots.
  return {
    currentIV,
    ivRank: 0,
    ivPercentile: 0,
    putCallRatio,
    ivHistory: [],
  }
}

// --- Helpers ---

function polygonQuoteToContract(
  quote: PolygonOptionsQuote,
  underlyingPrice: number,
): OptionsContract {
  const details = quote.details!
  const riskFreeRate = 0.05 // Approximate 10Y Treasury yield

  const bid = quote.last_quote?.bid ?? 0
  const ask = quote.last_quote?.ask ?? 0
  const mid = (bid + ask) / 2 || (quote.last_quote?.midpoint ?? 0)
  const last = quote.day?.close ?? mid
  const volume = quote.day?.volume ?? 0
  const openInterest = quote.open_interest ?? 0

  const expDate = new Date(details.expiration_date + 'T00:00:00')
  const now = new Date()
  const T = Math.max(0, (expDate.getTime() - now.getTime()) / (365.25 * 86_400_000))

  let iv = quote.implied_volatility ?? 0
  if (iv === 0 && mid > 0 && underlyingPrice > 0 && T > 0) {
    iv = impliedVolatility(details.contract_type, mid, underlyingPrice, details.strike_price, T, riskFreeRate)
    if (isNaN(iv)) iv = 0
  }

  let greeks: GreeksResult
  if (quote.greeks?.delta !== undefined) {
    greeks = {
      delta: quote.greeks.delta ?? 0,
      gamma: quote.greeks.gamma ?? 0,
      theta: quote.greeks.theta ?? 0,
      vega: quote.greeks.vega ?? 0,
      rho: 0,
    }
  } else if (iv > 0 && underlyingPrice > 0 && T > 0) {
    greeks = calculateGreeks(details.contract_type, underlyingPrice, details.strike_price, T, riskFreeRate, iv)
  } else {
    greeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 }
  }

  return {
    symbol: details.ticker,
    underlying: details.underlying_ticker,
    type: details.contract_type,
    strike: details.strike_price,
    expiration: details.expiration_date,
    bid,
    ask,
    last,
    volume,
    openInterest,
    iv,
    greeks,
  }
}
