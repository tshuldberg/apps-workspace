import { describe, it, expect } from 'vitest'
import {
  calculatePipValue,
  calculateLotSize,
  calculateMarginRequired,
  pipToPrice,
  priceToPip,
  calculatePnL,
  unitsToLotLabel,
} from '../../src/forex/calculators.js'
import { parseForexPair } from '../../src/types/multi-asset.js'

// ── parseForexPair ──────────────────────────────────────────────────────────

describe('parseForexPair', () => {
  it('parses EUR/USD correctly', () => {
    const pair = parseForexPair('EUR/USD')
    expect(pair.base).toBe('EUR')
    expect(pair.counter).toBe('USD')
    expect(pair.pipSize).toBe(0.0001)
  })

  it('parses USD/JPY with 0.01 pip size', () => {
    const pair = parseForexPair('USD/JPY')
    expect(pair.base).toBe('USD')
    expect(pair.counter).toBe('JPY')
    expect(pair.pipSize).toBe(0.01)
  })

  it('handles dash separator', () => {
    const pair = parseForexPair('GBP-USD')
    expect(pair.base).toBe('GBP')
    expect(pair.counter).toBe('USD')
  })

  it('handles lowercase input', () => {
    const pair = parseForexPair('eur/usd')
    expect(pair.base).toBe('EUR')
    expect(pair.counter).toBe('USD')
  })

  it('throws on invalid pair', () => {
    expect(() => parseForexPair('INVALID')).toThrow()
  })
})

// ── calculatePipValue ───────────────────────────────────────────────────────

describe('calculatePipValue', () => {
  it('calculates pip value for EUR/USD with USD account (standard lot)', () => {
    // EUR/USD: counter is USD, pip = 0.0001
    // Pip value = 100000 * 0.0001 = $10
    const value = calculatePipValue('EUR/USD', 100_000, 'USD')
    expect(value).toBeCloseTo(10, 5)
  })

  it('calculates pip value for EUR/USD with mini lot', () => {
    const value = calculatePipValue('EUR/USD', 10_000, 'USD')
    expect(value).toBeCloseTo(1, 5)
  })

  it('calculates pip value for EUR/USD with micro lot', () => {
    const value = calculatePipValue('EUR/USD', 1_000, 'USD')
    expect(value).toBeCloseTo(0.1, 5)
  })

  it('calculates pip value for USD/JPY with USD account', () => {
    // USD/JPY: counter is JPY (not USD), pip = 0.01
    // Pip value = 100000 * 0.01 / 154.82 ≈ $6.46
    const value = calculatePipValue('USD/JPY', 100_000, 'USD', 154.82)
    expect(value).toBeCloseTo(100000 * 0.01 / 154.82, 2)
  })

  it('calculates pip value for GBP/USD with USD account', () => {
    const value = calculatePipValue('GBP/USD', 100_000, 'USD')
    expect(value).toBeCloseTo(10, 5)
  })

  it('throws on zero exchange rate when needed', () => {
    expect(() => calculatePipValue('USD/JPY', 100_000, 'USD', 0)).toThrow()
  })
})

// ── calculateLotSize ────────────────────────────────────────────────────────

describe('calculateLotSize', () => {
  it('calculates lot size for EUR/USD risking $100 with 20 pip stop', () => {
    // Pip value per unit for EUR/USD (USD account) = 0.0001
    // Lot size = 100 / (20 * 0.0001) = 50,000 units (0.5 standard lot)
    const size = calculateLotSize(100, 20, 'EUR/USD', 'USD')
    expect(size).toBeCloseTo(50_000, 0)
  })

  it('calculates lot size for USD/JPY', () => {
    // Pip value per unit for USD/JPY (USD account, rate 154.82) = 0.01 / 154.82
    // Lot size = 100 / (20 * 0.01/154.82) = 100 / (0.2/154.82) = 100 * 154.82 / 0.2
    const size = calculateLotSize(100, 20, 'USD/JPY', 'USD', 154.82)
    const expected = 100 / (20 * 0.01 / 154.82)
    expect(size).toBeCloseTo(expected, 0)
  })

  it('returns larger lot for bigger risk amount', () => {
    const small = calculateLotSize(50, 20, 'EUR/USD', 'USD')
    const large = calculateLotSize(200, 20, 'EUR/USD', 'USD')
    expect(large).toBeGreaterThan(small)
  })

  it('returns smaller lot for wider stop loss', () => {
    const tight = calculateLotSize(100, 10, 'EUR/USD', 'USD')
    const wide = calculateLotSize(100, 40, 'EUR/USD', 'USD')
    expect(tight).toBeGreaterThan(wide)
  })

  it('throws on zero stop loss', () => {
    expect(() => calculateLotSize(100, 0, 'EUR/USD', 'USD')).toThrow()
  })

  it('throws on negative risk', () => {
    expect(() => calculateLotSize(-100, 20, 'EUR/USD', 'USD')).toThrow()
  })
})

// ── calculateMarginRequired ─────────────────────────────────────────────────

describe('calculateMarginRequired', () => {
  it('calculates margin for EUR/USD at 50:1 leverage', () => {
    // EUR/USD: base is EUR, not USD, so convert: notional * exchangeRate
    // Notional = 100000 / 50 = 2000 EUR
    // Margin = 2000 * 1.0862 = $2172.40
    const margin = calculateMarginRequired('EUR/USD', 100_000, 50, 1.0862, 'USD')
    expect(margin).toBeCloseTo(2000 * 1.0862, 2)
  })

  it('calculates margin for USD/JPY with USD account at 50:1', () => {
    // USD/JPY: base is USD = account currency
    // Notional = 100000 / 50 = $2000
    const margin = calculateMarginRequired('USD/JPY', 100_000, 50, 154.82, 'USD')
    expect(margin).toBeCloseTo(2000, 2)
  })

  it('higher leverage means less margin', () => {
    const low = calculateMarginRequired('EUR/USD', 100_000, 20, 1.0862, 'USD')
    const high = calculateMarginRequired('EUR/USD', 100_000, 100, 1.0862, 'USD')
    expect(high).toBeLessThan(low)
  })

  it('throws on zero leverage', () => {
    expect(() => calculateMarginRequired('EUR/USD', 100_000, 0, 1.0862, 'USD')).toThrow()
  })
})

// ── pipToPrice / priceToPip ─────────────────────────────────────────────────

describe('pipToPrice', () => {
  it('converts 10 pips for EUR/USD', () => {
    const price = pipToPrice('EUR/USD', 10)
    expect(price).toBeCloseTo(0.001, 6)
  })

  it('converts 10 pips for USD/JPY', () => {
    const price = pipToPrice('USD/JPY', 10)
    expect(price).toBeCloseTo(0.1, 6)
  })
})

describe('priceToPip', () => {
  it('converts price move to pips for EUR/USD', () => {
    const pips = priceToPip('EUR/USD', 0.0050)
    expect(pips).toBeCloseTo(50, 1)
  })

  it('converts price move to pips for USD/JPY', () => {
    const pips = priceToPip('USD/JPY', 0.50)
    expect(pips).toBeCloseTo(50, 1)
  })
})

// ── calculatePnL ────────────────────────────────────────────────────────────

describe('calculatePnL', () => {
  it('calculates profit on a winning long EUR/USD trade', () => {
    const pnl = calculatePnL('EUR/USD', 1.0860, 1.0900, 100_000, 'long', 'USD')
    // 40 pips * $10/pip = $400
    expect(pnl).toBeCloseTo(400, 0)
  })

  it('calculates loss on a losing long trade', () => {
    const pnl = calculatePnL('EUR/USD', 1.0860, 1.0840, 100_000, 'long', 'USD')
    // -20 pips * $10/pip = -$200
    expect(pnl).toBeCloseTo(-200, 0)
  })

  it('calculates profit on a winning short trade', () => {
    const pnl = calculatePnL('EUR/USD', 1.0860, 1.0830, 100_000, 'short', 'USD')
    // 30 pips * $10/pip = $300
    expect(pnl).toBeCloseTo(300, 0)
  })
})

// ── unitsToLotLabel ─────────────────────────────────────────────────────────

describe('unitsToLotLabel', () => {
  it('labels standard lots', () => {
    expect(unitsToLotLabel(100_000)).toContain('standard lot')
  })

  it('labels mini lots', () => {
    expect(unitsToLotLabel(10_000)).toContain('mini lot')
  })

  it('labels micro lots', () => {
    expect(unitsToLotLabel(1_000)).toContain('micro lot')
  })

  it('handles fractional standard lots', () => {
    expect(unitsToLotLabel(250_000)).toContain('2.50 standard lot')
  })
})
