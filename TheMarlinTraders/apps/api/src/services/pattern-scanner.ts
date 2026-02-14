/**
 * Auto Pattern Recognition Service
 * Sprints 37-38: Futures + Auto Pattern Recognition
 *
 * Continuous pattern scanning across a universe of symbols.
 * Integrates with the pattern detection from Sprints 31-32.
 */

import { z } from 'zod'
import type {
  DetectedPattern,
  PatternScanConfig,
  ScanResult,
  ChartPattern,
  PatternDetection,
} from '@marlin/shared'
import { CHART_PATTERNS, PATTERN_LABELS, PATTERN_DIRECTIONS, DEFAULT_PATTERN_CONFIG } from '@marlin/shared'

// ── In-Memory Store ─────────────────────────────────────────────────────────
// Production: replace with Redis or PostgreSQL

const detectedPatterns: Map<string, DetectedPattern> = new Map()
const patternHistory: DetectedPattern[] = []

// ── Default Config ──────────────────────────────────────────────────────────

const DEFAULT_SCAN_CONFIG: PatternScanConfig = {
  scanIntervalMinutes: 15,
  minConfidence: 0.6,
  enabledPatterns: [...CHART_PATTERNS],
  symbols: [],
  alertOnDetection: true,
  alertMinConfidence: 0.75,
}

let currentConfig: PatternScanConfig = { ...DEFAULT_SCAN_CONFIG }
let scanTimer: ReturnType<typeof setInterval> | null = null

// ── Pattern Detection Integration ───────────────────────────────────────────
// In production, this calls the actual pattern detection engine from Sprint 31-32.
// Here we define the interface and mock implementation.

interface OHLCV {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

/**
 * Run pattern detection on a single symbol's price data.
 * This wraps the Sprint 31-32 pattern detection engine.
 */
async function detectPatternsForSymbol(
  symbol: string,
  bars: OHLCV[],
  enabledPatterns: string[],
  minConfidence: number,
): Promise<PatternDetection[]> {
  // In production, this imports and calls the actual pattern detection functions
  // from packages/shared/src/patterns/
  //
  // For now, return empty — the actual detection will be wired when the
  // pattern detection engine is invoked via tRPC or direct import.
  //
  // Example integration:
  // import { detectPatterns } from '@marlin/shared'
  // return detectPatterns(bars, {
  //   enabledPatterns: enabledPatterns as ChartPattern[],
  //   minConfidence,
  // })
  return []
}

/**
 * Fetch OHLCV data for a symbol (delegates to market data service).
 */
async function fetchBarsForSymbol(symbol: string): Promise<OHLCV[]> {
  // In production, this calls the market data service
  // For now, return empty array — will be wired to polygon provider
  return []
}

// ── Scanner Core ────────────────────────────────────────────────────────────

/**
 * Run a single scan cycle across all configured symbols.
 */
export async function runScanCycle(
  config: PatternScanConfig = currentConfig,
): Promise<ScanResult> {
  const start = performance.now()
  const symbols = config.symbols.length > 0 ? config.symbols : getDefaultScanUniverse()
  const newPatterns: DetectedPattern[] = []

  for (const symbol of symbols) {
    try {
      const bars = await fetchBarsForSymbol(symbol)
      if (bars.length < 20) continue // Need minimum data

      const detections = await detectPatternsForSymbol(
        symbol,
        bars,
        config.enabledPatterns,
        config.minConfidence,
      )

      for (const detection of detections) {
        const id = `${symbol}-${detection.pattern}-${detection.startBar}-${Date.now()}`
        const currentPrice = bars[bars.length - 1]?.close ?? 0

        const detected: DetectedPattern = {
          id,
          symbol,
          pattern: PATTERN_LABELS[detection.pattern] ?? detection.pattern,
          confidence: detection.confidence,
          direction: detection.direction,
          detectedAt: new Date().toISOString(),
          priceAtDetection: currentPrice,
          priceTarget: detection.priceTarget,
          stopLoss: detection.stopLoss,
          outcome: 'pending',
        }

        detectedPatterns.set(id, detected)
        newPatterns.push(detected)

        // Fire alert if high confidence
        if (config.alertOnDetection && detection.confidence >= config.alertMinConfidence) {
          await firePatternAlert(detected)
        }
      }
    } catch {
      // Log and continue scanning other symbols
    }
  }

  const scanDurationMs = Math.round(performance.now() - start)

  return {
    scannedSymbols: symbols.length,
    patternsFound: newPatterns.length,
    avgConfidence:
      newPatterns.length > 0
        ? newPatterns.reduce((sum, p) => sum + p.confidence, 0) / newPatterns.length
        : 0,
    scanDurationMs,
    detectedPatterns: newPatterns,
  }
}

/**
 * Get all currently active (pending) detected patterns.
 */
export function getActivePatterns(filters?: {
  minConfidence?: number
  direction?: 'bullish' | 'bearish'
  patternType?: string
  assetClass?: string
  sortBy?: 'confidence' | 'recency' | 'symbol'
  sortDir?: 'asc' | 'desc'
}): DetectedPattern[] {
  let patterns = Array.from(detectedPatterns.values()).filter(
    (p) => p.outcome === 'pending',
  )

  // Apply filters
  if (filters?.minConfidence !== undefined) {
    patterns = patterns.filter((p) => p.confidence >= filters.minConfidence!)
  }
  if (filters?.direction) {
    patterns = patterns.filter((p) => p.direction === filters.direction)
  }
  if (filters?.patternType) {
    patterns = patterns.filter((p) => p.pattern === filters.patternType)
  }
  if (filters?.assetClass) {
    patterns = patterns.filter((p) => p.assetClass === filters.assetClass)
  }

  // Sort
  const sortBy = filters?.sortBy ?? 'recency'
  const sortDir = filters?.sortDir ?? 'desc'
  const mult = sortDir === 'asc' ? 1 : -1

  patterns.sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return (a.confidence - b.confidence) * mult
      case 'recency':
        return (new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()) * mult
      case 'symbol':
        return a.symbol.localeCompare(b.symbol) * mult
      default:
        return 0
    }
  })

  return patterns
}

/**
 * Get historical pattern detection data with outcome tracking.
 */
export function getPatternHistory(filters?: {
  symbol?: string
  limit?: number
  offset?: number
}): { patterns: DetectedPattern[]; total: number } {
  let patterns = [...patternHistory]

  if (filters?.symbol) {
    patterns = patterns.filter((p) => p.symbol === filters.symbol)
  }

  const total = patterns.length
  const offset = filters?.offset ?? 0
  const limit = filters?.limit ?? 50

  return {
    patterns: patterns.slice(offset, offset + limit),
    total,
  }
}

/**
 * Update a pattern's outcome (for ML feedback loop).
 */
export function updatePatternOutcome(
  patternId: string,
  outcome: 'hit_target' | 'hit_stop' | 'expired',
  outcomePrice?: number,
): boolean {
  const pattern = detectedPatterns.get(patternId)
  if (!pattern) return false

  pattern.outcome = outcome
  pattern.outcomePrice = outcomePrice
  pattern.outcomeDate = new Date().toISOString()

  // Move to history
  patternHistory.push({ ...pattern })
  detectedPatterns.delete(patternId)

  return true
}

/**
 * Get pattern accuracy statistics.
 */
export function getPatternAccuracy(): {
  totalTracked: number
  hitTarget: number
  hitStop: number
  expired: number
  hitRate: number
  avgConfidence: number
} {
  const tracked = patternHistory.filter((p) => p.outcome !== 'pending')
  const hitTarget = tracked.filter((p) => p.outcome === 'hit_target').length
  const hitStop = tracked.filter((p) => p.outcome === 'hit_stop').length
  const expired = tracked.filter((p) => p.outcome === 'expired').length

  return {
    totalTracked: tracked.length,
    hitTarget,
    hitStop,
    expired,
    hitRate: tracked.length > 0 ? hitTarget / tracked.length : 0,
    avgConfidence:
      tracked.length > 0
        ? tracked.reduce((sum, p) => sum + p.confidence, 0) / tracked.length
        : 0,
  }
}

// ── Alert Integration ───────────────────────────────────────────────────────

async function firePatternAlert(pattern: DetectedPattern): Promise<void> {
  // In production, this integrates with the alerts service
  // to send push notifications, emails, or webhooks
  console.log(
    `[Pattern Alert] ${pattern.direction.toUpperCase()} ${pattern.pattern} detected on ${pattern.symbol} ` +
    `(confidence: ${(pattern.confidence * 100).toFixed(0)}%, price: ${pattern.priceAtDetection})`,
  )
}

// ── Scanner Lifecycle ───────────────────────────────────────────────────────

/**
 * Start the continuous pattern scanner.
 */
export function startScanner(config?: Partial<PatternScanConfig>): void {
  if (scanTimer) stopScanner()

  if (config) {
    currentConfig = { ...DEFAULT_SCAN_CONFIG, ...config }
  }

  // Run immediately, then on interval
  runScanCycle(currentConfig)

  scanTimer = setInterval(
    () => runScanCycle(currentConfig),
    currentConfig.scanIntervalMinutes * 60_000,
  )
}

/**
 * Stop the continuous pattern scanner.
 */
export function stopScanner(): void {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
  }
}

/**
 * Update scanner configuration.
 */
export function updateScannerConfig(config: Partial<PatternScanConfig>): PatternScanConfig {
  currentConfig = { ...currentConfig, ...config }
  // Restart if running
  if (scanTimer) {
    stopScanner()
    startScanner(currentConfig)
  }
  return currentConfig
}

/**
 * Get current scanner configuration.
 */
export function getScannerConfig(): PatternScanConfig {
  return { ...currentConfig }
}

// ── Default Scan Universe ───────────────────────────────────────────────────

function getDefaultScanUniverse(): string[] {
  // Top 50 most-traded US equities + major futures + major ETFs
  return [
    // Tech
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'NFLX', 'CRM',
    // Finance
    'JPM', 'BAC', 'GS', 'MS', 'V', 'MA',
    // Healthcare
    'UNH', 'JNJ', 'LLY', 'PFE',
    // Energy
    'XOM', 'CVX',
    // ETFs
    'SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE',
    // Futures (root symbols)
    'ES', 'NQ', 'YM', 'RTY', 'CL', 'GC',
  ]
}
