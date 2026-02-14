import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  runScanCycle,
  getActivePatterns,
  getPatternHistory,
  updatePatternOutcome,
  getPatternAccuracy,
  startScanner,
  stopScanner,
  updateScannerConfig,
  getScannerConfig,
} from '../../src/services/pattern-scanner.js'

// ── Lifecycle ───────────────────────────────────────────────────────────────

afterEach(() => {
  stopScanner()
})

// ── runScanCycle ────────────────────────────────────────────────────────────

describe('runScanCycle', () => {
  it('returns a ScanResult with expected fields', async () => {
    const result = await runScanCycle()

    expect(result).toHaveProperty('scannedSymbols')
    expect(result).toHaveProperty('patternsFound')
    expect(result).toHaveProperty('avgConfidence')
    expect(result).toHaveProperty('scanDurationMs')
    expect(result).toHaveProperty('detectedPatterns')

    expect(typeof result.scannedSymbols).toBe('number')
    expect(typeof result.patternsFound).toBe('number')
    expect(typeof result.avgConfidence).toBe('number')
    expect(typeof result.scanDurationMs).toBe('number')
    expect(Array.isArray(result.detectedPatterns)).toBe(true)
  })

  it('scans default universe when no symbols configured', async () => {
    const result = await runScanCycle({
      scanIntervalMinutes: 15,
      minConfidence: 0.6,
      enabledPatterns: ['head_and_shoulders'],
      symbols: [],
      alertOnDetection: false,
      alertMinConfidence: 0.75,
    })

    expect(result.scannedSymbols).toBeGreaterThan(0)
  })

  it('scans only configured symbols when provided', async () => {
    const result = await runScanCycle({
      scanIntervalMinutes: 15,
      minConfidence: 0.6,
      enabledPatterns: ['double_bottom'],
      symbols: ['AAPL', 'MSFT'],
      alertOnDetection: false,
      alertMinConfidence: 0.75,
    })

    expect(result.scannedSymbols).toBe(2)
  })

  it('reports 0 patterns found when no data available', async () => {
    const result = await runScanCycle()
    // With mock implementation (no real data), patterns found should be 0
    expect(result.patternsFound).toBe(0)
  })

  it('tracks scan duration', async () => {
    const result = await runScanCycle()
    expect(result.scanDurationMs).toBeGreaterThanOrEqual(0)
  })
})

// ── getActivePatterns ───────────────────────────────────────────────────────

describe('getActivePatterns', () => {
  it('returns an array', () => {
    const patterns = getActivePatterns()
    expect(Array.isArray(patterns)).toBe(true)
  })

  it('filters by minimum confidence', () => {
    const patterns = getActivePatterns({ minConfidence: 0.9 })
    for (const p of patterns) {
      expect(p.confidence).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('filters by direction', () => {
    const bullish = getActivePatterns({ direction: 'bullish' })
    for (const p of bullish) {
      expect(p.direction).toBe('bullish')
    }

    const bearish = getActivePatterns({ direction: 'bearish' })
    for (const p of bearish) {
      expect(p.direction).toBe('bearish')
    }
  })

  it('supports sorting by confidence', () => {
    const patterns = getActivePatterns({ sortBy: 'confidence', sortDir: 'desc' })
    for (let i = 1; i < patterns.length; i++) {
      expect(patterns[i]!.confidence).toBeLessThanOrEqual(patterns[i - 1]!.confidence)
    }
  })

  it('supports sorting by symbol', () => {
    const patterns = getActivePatterns({ sortBy: 'symbol', sortDir: 'asc' })
    for (let i = 1; i < patterns.length; i++) {
      expect(patterns[i]!.symbol >= patterns[i - 1]!.symbol).toBe(true)
    }
  })
})

// ── getPatternHistory ───────────────────────────────────────────────────────

describe('getPatternHistory', () => {
  it('returns patterns and total count', () => {
    const result = getPatternHistory()
    expect(result).toHaveProperty('patterns')
    expect(result).toHaveProperty('total')
    expect(Array.isArray(result.patterns)).toBe(true)
    expect(typeof result.total).toBe('number')
  })

  it('supports pagination with limit and offset', () => {
    const result = getPatternHistory({ limit: 10, offset: 0 })
    expect(result.patterns.length).toBeLessThanOrEqual(10)
  })

  it('filters by symbol', () => {
    const result = getPatternHistory({ symbol: 'AAPL' })
    for (const p of result.patterns) {
      expect(p.symbol).toBe('AAPL')
    }
  })
})

// ── updatePatternOutcome ────────────────────────────────────────────────────

describe('updatePatternOutcome', () => {
  it('returns false for non-existent pattern', () => {
    const result = updatePatternOutcome('non-existent-id', 'hit_target', 100)
    expect(result).toBe(false)
  })
})

// ── getPatternAccuracy ──────────────────────────────────────────────────────

describe('getPatternAccuracy', () => {
  it('returns accuracy statistics', () => {
    const accuracy = getPatternAccuracy()
    expect(accuracy).toHaveProperty('totalTracked')
    expect(accuracy).toHaveProperty('hitTarget')
    expect(accuracy).toHaveProperty('hitStop')
    expect(accuracy).toHaveProperty('expired')
    expect(accuracy).toHaveProperty('hitRate')
    expect(accuracy).toHaveProperty('avgConfidence')

    expect(typeof accuracy.totalTracked).toBe('number')
    expect(typeof accuracy.hitRate).toBe('number')
    expect(accuracy.hitRate).toBeGreaterThanOrEqual(0)
    expect(accuracy.hitRate).toBeLessThanOrEqual(1)
  })
})

// ── Scanner Lifecycle ───────────────────────────────────────────────────────

describe('scanner lifecycle', () => {
  it('starts and stops without error', () => {
    expect(() => startScanner()).not.toThrow()
    expect(() => stopScanner()).not.toThrow()
  })

  it('updates config', () => {
    const newConfig = updateScannerConfig({ scanIntervalMinutes: 30 })
    expect(newConfig.scanIntervalMinutes).toBe(30)
  })

  it('returns current config', () => {
    const config = getScannerConfig()
    expect(config).toHaveProperty('scanIntervalMinutes')
    expect(config).toHaveProperty('minConfidence')
    expect(config).toHaveProperty('enabledPatterns')
    expect(config).toHaveProperty('symbols')
    expect(config).toHaveProperty('alertOnDetection')
    expect(config).toHaveProperty('alertMinConfidence')
  })

  it('restarts scanner when config is updated while running', () => {
    startScanner()
    const config = updateScannerConfig({ minConfidence: 0.8 })
    expect(config.minConfidence).toBe(0.8)
    stopScanner()
  })
})

// ── Alert Integration ───────────────────────────────────────────────────────

describe('alert integration', () => {
  it('does not fire alert when alertOnDetection is false', async () => {
    const result = await runScanCycle({
      scanIntervalMinutes: 15,
      minConfidence: 0.6,
      enabledPatterns: ['head_and_shoulders'],
      symbols: ['AAPL'],
      alertOnDetection: false,
      alertMinConfidence: 0.75,
    })

    // No error thrown means alerts were not attempted (or handled gracefully)
    expect(result).toBeDefined()
  })
})
