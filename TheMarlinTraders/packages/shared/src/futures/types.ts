/**
 * Futures Contract Types
 * Sprints 37-38: Futures + Auto Pattern Recognition
 */

// ── Futures Contract ─────────────────────────────────────────────────────────

export interface FuturesContract {
  /** Full contract symbol, e.g. "ESH26" */
  symbol: string
  /** Root symbol, e.g. "ES" */
  underlyingSymbol: string
  /** Exchange code, e.g. "CME", "NYMEX", "COMEX", "CBOT" */
  exchange: string
  /** Contract month in YYYYMM format, e.g. "202603" */
  contractMonth: string
  /** Expiration date (last trading day) ISO string */
  expirationDate: string
  /** Minimum price movement, e.g. 0.25 for ES */
  tickSize: number
  /** Dollar value per tick, e.g. 12.50 for ES */
  tickValue: number
  /** Dollar value per full point, e.g. 50 for ES */
  pointValue: number
  /** Initial margin required per contract */
  initialMargin: number
  /** Maintenance margin per contract */
  maintenanceMargin: number
  /** Human-readable trading hours, e.g. "Sun-Fri 6:00pm-5:00pm ET" */
  tradingHours: string
  /** Whether the contract is currently active and trading */
  isActive: boolean
  /** Whether this is the front-month (most-traded) contract */
  isFrontMonth: boolean
}

// ── Continuous Contract ──────────────────────────────────────────────────────

export type AdjustmentMethod = 'back_adjusted' | 'unadjusted' | 'ratio_adjusted'

export interface ContinuousContract {
  /** Root symbol for the continuous series, e.g. "ES" */
  symbol: string
  /** How the continuous series is constructed */
  adjustmentMethod: AdjustmentMethod
  /** Date of the most recent rollover, ISO string */
  rolloverDate: string
}

// ── Spread Trading ───────────────────────────────────────────────────────────

export type SpreadType = 'calendar' | 'inter_commodity'

export interface SpreadTrade {
  /** Near-month (front) leg */
  frontLeg: FuturesContract
  /** Far-month (back) leg */
  backLeg: FuturesContract
  /** Type of spread */
  spreadType: SpreadType
}

// ── COT Data ─────────────────────────────────────────────────────────────────

export interface COTData {
  /** Root futures symbol */
  symbol: string
  /** Report date ISO string (COT reports released weekly on Fridays) */
  reportDate: string
  /** Commercial hedger long contracts */
  commercialLong: number
  /** Commercial hedger short contracts */
  commercialShort: number
  /** Non-commercial (large speculator) long contracts */
  nonCommercialLong: number
  /** Non-commercial (large speculator) short contracts */
  nonCommercialShort: number
  /** Non-reportable (small speculator) long contracts */
  nonReportableLong: number
  /** Non-reportable (small speculator) short contracts */
  nonReportableShort: number
}

// ── Rollover Calendar ────────────────────────────────────────────────────────

export interface RolloverEntry {
  /** Contract month in YYYYMM format */
  month: string
  /** First notice date ISO string (commodities) */
  firstNoticeDate: string
  /** Last trading date ISO string */
  lastTradingDate: string
  /** Current volume for this contract */
  volume: number
}

export interface RolloverCalendar {
  /** Root futures symbol */
  symbol: string
  /** Ordered list of contract months with rollover info */
  contracts: RolloverEntry[]
}

// ── Asset Class for UI grouping ──────────────────────────────────────────────

export type FuturesAssetClass = 'indices' | 'commodities' | 'bonds' | 'currencies'

export interface FuturesQuote {
  symbol: string
  name: string
  underlyingSymbol: string
  assetClass: FuturesAssetClass
  price: number
  change: number
  changePercent: number
  volume: number
  openInterest: number
  contractMonth: string
  expirationDate: string
  high24h: number
  low24h: number
  /** Sparkline data: array of recent prices (e.g. last 24h hourly) */
  sparkline: number[]
}

// ── Detected Pattern (for auto scanner) ──────────────────────────────────────

export interface DetectedPattern {
  id: string
  symbol: string
  pattern: string
  confidence: number
  direction: 'bullish' | 'bearish'
  detectedAt: string
  priceAtDetection: number
  priceTarget?: number
  stopLoss?: number
  /** Whether the pattern has played out (for accuracy tracking) */
  outcome?: 'hit_target' | 'hit_stop' | 'expired' | 'pending'
  outcomePrice?: number
  outcomeDate?: string
  assetClass?: string
}

export interface PatternScanConfig {
  /** How often to run the scanner in minutes */
  scanIntervalMinutes: number
  /** Minimum confidence threshold (0-1) */
  minConfidence: number
  /** Which pattern types to scan for */
  enabledPatterns: string[]
  /** Symbols to scan (empty = all) */
  symbols: string[]
  /** Fire alerts on high-confidence detections */
  alertOnDetection: boolean
  /** Minimum confidence to fire an alert */
  alertMinConfidence: number
}

export interface ScanResult {
  scannedSymbols: number
  patternsFound: number
  avgConfidence: number
  scanDurationMs: number
  detectedPatterns: DetectedPattern[]
}
