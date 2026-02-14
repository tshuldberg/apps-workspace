/**
 * Futures Data Provider
 * Sprints 37-38: Futures + Auto Pattern Recognition
 *
 * Adapter for Polygon.io futures endpoints.
 * Handles contract specs, continuous contracts, rollover detection, and front month ID.
 */

import WebSocket from 'ws'
import { z } from 'zod'
import type {
  FuturesContract,
  ContinuousContract,
  AdjustmentMethod,
  RolloverCalendar,
  RolloverEntry,
  FuturesQuote,
  FuturesAssetClass,
} from '@marlin/shared'
import { getContractSpec, CONTRACT_SPECS } from '@marlin/shared'

// ── Polygon REST Endpoints ──────────────────────────────────────────────────

const POLYGON_BASE = 'https://api.polygon.io'

function apiKey(): string {
  return process.env.POLYGON_API_KEY ?? ''
}

// ── Contract Month Codes ────────────────────────────────────────────────────

const MONTH_CODES: Record<string, number> = {
  F: 1,  // January
  G: 2,  // February
  H: 3,  // March
  J: 4,  // April
  K: 5,  // May
  M: 6,  // June
  N: 7,  // July
  Q: 8,  // August
  U: 9,  // September
  V: 10, // October
  X: 11, // November
  Z: 12, // December
}

const NUMBER_TO_MONTH_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(MONTH_CODES).map(([code, num]) => [num, code]),
)

// ── Asset Class Mapping ─────────────────────────────────────────────────────

const ASSET_CLASS_MAP: Record<string, FuturesAssetClass> = {
  ES: 'indices',
  NQ: 'indices',
  YM: 'indices',
  RTY: 'indices',
  CL: 'commodities',
  GC: 'commodities',
  SI: 'commodities',
  ZB: 'bonds',
  ZN: 'bonds',
  '6E': 'currencies',
  '6J': 'currencies',
}

const SYMBOL_NAMES: Record<string, string> = {
  ES: 'E-mini S&P 500',
  NQ: 'E-mini NASDAQ-100',
  YM: 'E-mini Dow',
  RTY: 'E-mini Russell 2000',
  CL: 'Crude Oil WTI',
  GC: 'Gold',
  SI: 'Silver',
  ZB: '30-Year T-Bond',
  ZN: '10-Year T-Note',
  '6E': 'Euro FX',
  '6J': 'Japanese Yen',
}

// ── Major futures tracked ───────────────────────────────────────────────────

export const MAJOR_FUTURES = ['ES', 'NQ', 'YM', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN', '6E', '6J'] as const

// ── Polygon Response Schemas ────────────────────────────────────────────────

const PolygonBarSchema = z.object({
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number(),
  t: z.number(),
  vw: z.number().optional(),
  n: z.number().optional(),
})

const PolygonAggregatesResponseSchema = z.object({
  ticker: z.string().optional(),
  status: z.string().optional(),
  results: z.array(PolygonBarSchema).optional(),
  resultsCount: z.number().optional(),
})

const PolygonSnapshotSchema = z.object({
  ticker: z.string(),
  day: z.object({
    o: z.number(),
    h: z.number(),
    l: z.number(),
    c: z.number(),
    v: z.number(),
    vw: z.number().optional(),
  }).optional(),
  lastTrade: z.object({
    p: z.number(),
    s: z.number(),
    t: z.number(),
  }).optional(),
  prevDay: z.object({
    o: z.number(),
    h: z.number(),
    l: z.number(),
    c: z.number(),
    v: z.number(),
  }).optional(),
})

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse a futures symbol like "ESH26" into root "ES", month code "H", year "26".
 */
export function parseFuturesSymbol(symbol: string): {
  root: string
  monthCode: string
  year: string
  contractMonth: string
} | null {
  // Match patterns like ESH26, 6EH26, CLZ25
  const match = symbol.match(/^([A-Z0-9]{1,3})([FGHJKMNQUVXZ])(\d{2})$/)
  if (!match) return null

  const root = match[1]!
  const monthCode = match[2]!
  const year = match[3]!
  const monthNum = MONTH_CODES[monthCode]
  if (monthNum === undefined) return null

  const fullYear = 2000 + parseInt(year, 10)
  const contractMonth = `${fullYear}${String(monthNum).padStart(2, '0')}`

  return { root, monthCode, year, contractMonth }
}

/**
 * Build a futures symbol from root, month, and year.
 */
export function buildFuturesSymbol(root: string, month: number, year: number): string {
  const code = NUMBER_TO_MONTH_CODE[month]
  if (!code) throw new Error(`Invalid month: ${month}`)
  const yearSuffix = String(year % 100).padStart(2, '0')
  return `${root}${code}${yearSuffix}`
}

/**
 * Get the front-month contract for a root symbol based on volume.
 * In practice, the front month is typically the nearest expiration with the highest volume.
 */
export function identifyFrontMonth(contracts: { symbol: string; volume: number; expirationDate: string }[]): string | null {
  if (contracts.length === 0) return null

  // Sort by expiration date, then by volume descending
  const sorted = [...contracts]
    .filter((c) => new Date(c.expirationDate) > new Date())
    .sort((a, b) => {
      const dateA = new Date(a.expirationDate).getTime()
      const dateB = new Date(b.expirationDate).getTime()
      // Pick nearest expiration that still has significant volume
      if (dateA !== dateB) return dateA - dateB
      return b.volume - a.volume
    })

  return sorted[0]?.symbol ?? null
}

/**
 * Detect if a rollover is imminent (front month volume declining relative to next month).
 */
export function detectRollover(
  frontVolume: number,
  backVolume: number,
  daysToExpiration: number,
): { isRolling: boolean; rolloverPercentage: number } {
  // Rollover typically happens when back-month volume exceeds front-month
  // and we are within ~10 days of expiration
  const volumeRatio = backVolume > 0 ? frontVolume / backVolume : Infinity
  const isRolling = daysToExpiration <= 10 && volumeRatio < 1.5
  const rolloverPercentage = backVolume / (frontVolume + backVolume) * 100

  return { isRolling, rolloverPercentage }
}

// ── Continuous Contract Construction ────────────────────────────────────────

export interface HistoricalBar {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

/**
 * Back-adjust a historical series at a rollover point.
 * All bars before the rollover are shifted by the gap between old and new contract prices.
 */
export function backAdjust(
  bars: HistoricalBar[],
  rolloverIndex: number,
  oldClose: number,
  newClose: number,
): HistoricalBar[] {
  const gap = newClose - oldClose

  return bars.map((bar, i) => {
    if (i < rolloverIndex) {
      return {
        ...bar,
        open: bar.open + gap,
        high: bar.high + gap,
        low: bar.low + gap,
        close: bar.close + gap,
      }
    }
    return bar
  })
}

/**
 * Ratio-adjust a historical series at a rollover point.
 * All bars before the rollover are scaled by the ratio of new/old contract prices.
 */
export function ratioAdjust(
  bars: HistoricalBar[],
  rolloverIndex: number,
  oldClose: number,
  newClose: number,
): HistoricalBar[] {
  if (oldClose === 0) return bars
  const ratio = newClose / oldClose

  return bars.map((bar, i) => {
    if (i < rolloverIndex) {
      return {
        ...bar,
        open: bar.open * ratio,
        high: bar.high * ratio,
        low: bar.low * ratio,
        close: bar.close * ratio,
      }
    }
    return bar
  })
}

// ── Polygon API Calls ───────────────────────────────────────────────────────

/**
 * Fetch historical aggregates (bars) for a futures symbol.
 */
export async function fetchFuturesAggregates(
  symbol: string,
  multiplier: number,
  timespan: 'minute' | 'hour' | 'day' | 'week',
  from: string,
  to: string,
): Promise<HistoricalBar[]> {
  const url = `${POLYGON_BASE}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey()}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Polygon API error: ${res.status}`)

  const json = await res.json()
  const parsed = PolygonAggregatesResponseSchema.safeParse(json)
  if (!parsed.success || !parsed.data.results) return []

  return parsed.data.results.map((bar) => ({
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    timestamp: bar.t,
  }))
}

/**
 * Build a continuous contract series for a root symbol using the specified adjustment method.
 */
export async function buildContinuousContract(
  rootSymbol: string,
  adjustmentMethod: AdjustmentMethod,
  from: string,
  to: string,
): Promise<{ bars: HistoricalBar[]; contract: ContinuousContract }> {
  // For MVP, fetch the front-month contract data
  // In production, this would splice multiple contract months together at rollover points
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const frontSymbol = buildFuturesSymbol(rootSymbol, currentMonth <= 3 ? 3 : currentMonth <= 6 ? 6 : currentMonth <= 9 ? 9 : 12, currentYear)

  const bars = await fetchFuturesAggregates(frontSymbol, 1, 'day', from, to)

  const contract: ContinuousContract = {
    symbol: rootSymbol,
    adjustmentMethod,
    rolloverDate: now.toISOString(),
  }

  // Apply adjustment if not unadjusted
  // In a full implementation, this would iterate through rollover points
  // For now, return the raw front-month data
  return { bars, contract }
}

/**
 * Get contract specifications for a futures symbol.
 */
export function getContractSpecification(symbol: string): FuturesContract | null {
  const parsed = parseFuturesSymbol(symbol)
  if (!parsed) {
    // Try as root symbol
    const spec = getContractSpec(symbol)
    if (!spec) return null

    const now = new Date()
    const quarterMonth = [3, 6, 9, 12].find((m) => m > now.getMonth() + 1) ?? 3
    const year = quarterMonth <= now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear()

    return {
      symbol: buildFuturesSymbol(symbol, quarterMonth, year),
      underlyingSymbol: symbol,
      exchange: spec.exchange,
      contractMonth: `${year}${String(quarterMonth).padStart(2, '0')}`,
      expirationDate: new Date(year, quarterMonth - 1, 20).toISOString(),
      tickSize: spec.tickSize,
      tickValue: spec.tickValue,
      pointValue: spec.pointValue,
      initialMargin: spec.initialMargin,
      maintenanceMargin: spec.maintenanceMargin,
      tradingHours: spec.tradingHours,
      isActive: true,
      isFrontMonth: true,
    }
  }

  const spec = getContractSpec(parsed.root)
  if (!spec) return null

  const month = MONTH_CODES[parsed.monthCode]!
  const year = 2000 + parseInt(parsed.year, 10)

  return {
    symbol,
    underlyingSymbol: parsed.root,
    exchange: spec.exchange,
    contractMonth: parsed.contractMonth,
    expirationDate: new Date(year, month - 1, 20).toISOString(),
    tickSize: spec.tickSize,
    tickValue: spec.tickValue,
    pointValue: spec.pointValue,
    initialMargin: spec.initialMargin,
    maintenanceMargin: spec.maintenanceMargin,
    tradingHours: spec.tradingHours,
    isActive: true,
    isFrontMonth: false,
  }
}

/**
 * Get rollover calendar for a root symbol.
 * Returns upcoming contract months with their key dates and volume.
 */
export function getRolloverCalendar(rootSymbol: string): RolloverCalendar {
  const now = new Date()
  const contracts: RolloverEntry[] = []

  // Generate next 4 quarterly contract months for financial futures,
  // or next 12 monthly for commodities
  const isQuarterly = ['ES', 'NQ', 'YM', 'RTY', 'ZB', 'ZN', '6E', '6J'].includes(rootSymbol)
  const months = isQuarterly ? [3, 6, 9, 12] : Array.from({ length: 12 }, (_, i) => i + 1)

  let year = now.getFullYear()
  let added = 0

  while (added < (isQuarterly ? 4 : 6)) {
    for (const month of months) {
      const contractDate = new Date(year, month - 1, 1)
      if (contractDate <= now && added === 0) continue

      const monthStr = `${year}${String(month).padStart(2, '0')}`
      // First notice date is typically ~1 month before expiration for commodities
      const firstNoticeDate = new Date(year, month - 2, 28)
      // Last trading date is typically the 3rd Friday of the contract month
      const lastTradingDate = new Date(year, month - 1, 20)

      contracts.push({
        month: monthStr,
        firstNoticeDate: firstNoticeDate.toISOString(),
        lastTradingDate: lastTradingDate.toISOString(),
        volume: 0, // Populated from market data
      })

      added++
      if (added >= (isQuarterly ? 4 : 6)) break
    }
    year++
  }

  return { symbol: rootSymbol, contracts }
}

// ── Futures WebSocket Adapter ───────────────────────────────────────────────

const POLYGON_FUTURES_WS_URL = 'wss://socket.polygon.io/stocks'

export interface FuturesWSOptions {
  apiKey: string
  symbols: string[]
  onQuote: (quote: FuturesQuote) => void
  onError?: (error: Error) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

export class FuturesWebSocketAdapter {
  private ws: WebSocket | null = null
  private reconnectAttempt = 0
  private maxReconnectDelay = 30_000
  private baseDelay = 100
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isShuttingDown = false

  constructor(private readonly options: FuturesWSOptions) {}

  connect(): void {
    this.isShuttingDown = false
    this.ws = new WebSocket(POLYGON_FUTURES_WS_URL)

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
    const channels = symbols.map((s) => `T.${s},AM.${s}`).join(',')
    this.ws.send(JSON.stringify({ action: 'subscribe', params: channels }))
  }

  unsubscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const channels = symbols.map((s) => `T.${s},AM.${s}`).join(',')
    this.ws.send(JSON.stringify({ action: 'unsubscribe', params: channels }))
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
      if (typeof msg !== 'object' || msg === null) continue
      const m = msg as Record<string, unknown>

      if (m.ev === 'status' && m.status === 'auth_success') {
        this.options.onConnected?.()
        this.subscribe(this.options.symbols)
      }

      // Process trade or aggregate messages into FuturesQuote updates
      if (m.ev === 'T' && typeof m.sym === 'string' && typeof m.p === 'number') {
        const symbolParsed = parseFuturesSymbol(m.sym)
        const root = symbolParsed?.root ?? m.sym
        const assetClass = ASSET_CLASS_MAP[root] ?? 'commodities'
        const name = SYMBOL_NAMES[root] ?? root

        this.options.onQuote({
          symbol: m.sym,
          name,
          underlyingSymbol: root,
          assetClass,
          price: m.p,
          change: 0,
          changePercent: 0,
          volume: typeof m.s === 'number' ? m.s : 0,
          openInterest: 0,
          contractMonth: symbolParsed?.contractMonth ?? '',
          expirationDate: '',
          high24h: m.p,
          low24h: m.p,
          sparkline: [],
        })
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
