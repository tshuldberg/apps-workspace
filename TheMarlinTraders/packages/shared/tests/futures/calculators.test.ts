import { describe, it, expect } from 'vitest'
import type { FuturesContract } from '../../src/futures/types.js'
import {
  calculateTickValue,
  calculatePnL,
  calculateMarginRequired,
  calculateSpreadValue,
  calculateTicks,
  calculateCOTIndex,
  getContractMultiplier,
  getContractSpec,
  getAllContractSpecs,
} from '../../src/futures/calculators.js'

// ── Test Contract Fixtures ──────────────────────────────────────────────────

function makeContract(overrides: Partial<FuturesContract> = {}): FuturesContract {
  return {
    symbol: 'ESH26',
    underlyingSymbol: 'ES',
    exchange: 'CME',
    contractMonth: '202603',
    expirationDate: '2026-03-20T00:00:00Z',
    tickSize: 0.25,
    tickValue: 12.5,
    pointValue: 50,
    initialMargin: 12_980,
    maintenanceMargin: 11_800,
    tradingHours: 'Sun-Fri 6:00pm-5:00pm ET',
    isActive: true,
    isFrontMonth: true,
    ...overrides,
  }
}

const ES_CONTRACT = makeContract()

const CL_CONTRACT = makeContract({
  symbol: 'CLH26',
  underlyingSymbol: 'CL',
  exchange: 'NYMEX',
  tickSize: 0.01,
  tickValue: 10,
  pointValue: 1_000,
  initialMargin: 6_820,
  maintenanceMargin: 6_200,
})

const GC_CONTRACT = makeContract({
  symbol: 'GCJ26',
  underlyingSymbol: 'GC',
  exchange: 'COMEX',
  tickSize: 0.1,
  tickValue: 10,
  pointValue: 100,
  initialMargin: 10_450,
  maintenanceMargin: 9_500,
})

// ── calculateTickValue ──────────────────────────────────────────────────────

describe('calculateTickValue', () => {
  it('returns tick value for ES ($12.50)', () => {
    expect(calculateTickValue(ES_CONTRACT)).toBe(12.5)
  })

  it('returns tick value for CL ($10)', () => {
    expect(calculateTickValue(CL_CONTRACT)).toBe(10)
  })

  it('returns tick value for GC ($10)', () => {
    expect(calculateTickValue(GC_CONTRACT)).toBe(10)
  })
})

// ── calculatePnL ────────────────────────────────────────────────────────────

describe('calculatePnL', () => {
  it('calculates profit on long ES (1 contract, 10-point move)', () => {
    // 10 points / 0.25 tick = 40 ticks * $12.50 * 1 contract = $500
    const pnl = calculatePnL(ES_CONTRACT, 5800, 5810, 1)
    expect(pnl).toBe(500)
  })

  it('calculates loss on long ES (1 contract, -5 point move)', () => {
    // -5 points / 0.25 tick = -20 ticks * $12.50 * 1 = -$250
    const pnl = calculatePnL(ES_CONTRACT, 5800, 5795, 1)
    expect(pnl).toBe(-250)
  })

  it('calculates profit on short ES (negative qty)', () => {
    // Selling at 5800, covering at 5790: profit for short
    // 10 points down / 0.25 = -40 ticks * 12.5 * (-1) = +$500
    const pnl = calculatePnL(ES_CONTRACT, 5800, 5790, -1)
    expect(pnl).toBe(500)
  })

  it('handles multiple contracts', () => {
    // 5 contracts, 4-point move on ES
    // 4 / 0.25 = 16 ticks * $12.50 * 5 = $1000
    const pnl = calculatePnL(ES_CONTRACT, 5800, 5804, 5)
    expect(pnl).toBe(1000)
  })

  it('calculates P&L for CL (crude oil)', () => {
    // 1 dollar move on CL: 1 / 0.01 = 100 ticks * $10 * 1 = $1000
    const pnl = calculatePnL(CL_CONTRACT, 78.00, 79.00, 1)
    expect(pnl).toBe(1000)
  })

  it('calculates P&L for GC (gold)', () => {
    // 10 dollar move on GC: 10 / 0.1 = 100 ticks * $10 * 1 = $1000
    const pnl = calculatePnL(GC_CONTRACT, 2900, 2910, 1)
    expect(pnl).toBe(1000)
  })

  it('returns 0 when entry equals exit', () => {
    const pnl = calculatePnL(ES_CONTRACT, 5800, 5800, 1)
    expect(pnl).toBe(0)
  })
})

// ── calculateMarginRequired ─────────────────────────────────────────────────

describe('calculateMarginRequired', () => {
  it('calculates margin for 1 ES contract', () => {
    expect(calculateMarginRequired(ES_CONTRACT, 1)).toBe(12_980)
  })

  it('calculates margin for 3 ES contracts', () => {
    expect(calculateMarginRequired(ES_CONTRACT, 3)).toBe(12_980 * 3)
  })

  it('uses absolute value for negative qty', () => {
    expect(calculateMarginRequired(ES_CONTRACT, -2)).toBe(12_980 * 2)
  })

  it('calculates margin for CL', () => {
    expect(calculateMarginRequired(CL_CONTRACT, 1)).toBe(6_820)
  })

  it('calculates margin for GC', () => {
    expect(calculateMarginRequired(GC_CONTRACT, 2)).toBe(10_450 * 2)
  })
})

// ── calculateSpreadValue ────────────────────────────────────────────────────

describe('calculateSpreadValue', () => {
  it('calculates positive spread (backwardation)', () => {
    // Front 5900, Back 5895 -> spread = 5 points * $50 = $250
    const value = calculateSpreadValue(5900, 5895, ES_CONTRACT)
    expect(value).toBe(250)
  })

  it('calculates negative spread (contango)', () => {
    // Front 5890, Back 5895 -> spread = -5 points * $50 = -$250
    const value = calculateSpreadValue(5890, 5895, ES_CONTRACT)
    expect(value).toBe(-250)
  })

  it('returns 0 when prices are equal', () => {
    expect(calculateSpreadValue(5900, 5900, ES_CONTRACT)).toBe(0)
  })

  it('works for CL contracts', () => {
    // Front $78, Back $79 -> spread = -$1 * $1000 = -$1000
    const value = calculateSpreadValue(78, 79, CL_CONTRACT)
    expect(value).toBe(-1000)
  })
})

// ── calculateTicks ──────────────────────────────────────────────────────────

describe('calculateTicks', () => {
  it('calculates ticks for ES', () => {
    // 1 point / 0.25 tickSize = 4 ticks
    expect(calculateTicks(ES_CONTRACT, 5800, 5801)).toBe(4)
  })

  it('calculates ticks for CL', () => {
    // $0.10 / 0.01 tickSize = 10 ticks
    expect(calculateTicks(CL_CONTRACT, 78.00, 78.10)).toBe(10)
  })

  it('handles negative tick count', () => {
    expect(calculateTicks(ES_CONTRACT, 5801, 5800)).toBe(-4)
  })
})

// ── calculateCOTIndex ───────────────────────────────────────────────────────

describe('calculateCOTIndex', () => {
  it('returns 100 when current is at max of range', () => {
    const index = calculateCOTIndex(100, [0, 25, 50, 75, 100])
    expect(index).toBe(100)
  })

  it('returns 0 when current is at min of range', () => {
    const index = calculateCOTIndex(0, [0, 25, 50, 75, 100])
    expect(index).toBe(0)
  })

  it('returns 50 when current is at midpoint', () => {
    const index = calculateCOTIndex(50, [0, 25, 50, 75, 100])
    expect(index).toBe(50)
  })

  it('returns 50 when all values are the same', () => {
    const index = calculateCOTIndex(10, [10, 10, 10])
    expect(index).toBe(50)
  })

  it('returns 50 for empty history', () => {
    const index = calculateCOTIndex(10, [])
    expect(index).toBe(50)
  })

  it('handles negative values', () => {
    const index = calculateCOTIndex(-50, [-100, -75, -50, -25, 0])
    expect(index).toBe(50)
  })
})

// ── getContractMultiplier ───────────────────────────────────────────────────

describe('getContractMultiplier', () => {
  it('returns 50 for ES', () => {
    expect(getContractMultiplier('ES')).toBe(50)
  })

  it('returns 1000 for CL', () => {
    expect(getContractMultiplier('CL')).toBe(1_000)
  })

  it('returns 100 for GC', () => {
    expect(getContractMultiplier('GC')).toBe(100)
  })

  it('returns 1 for unknown symbol', () => {
    expect(getContractMultiplier('UNKNOWN')).toBe(1)
  })

  it('is case-insensitive', () => {
    expect(getContractMultiplier('es')).toBe(50)
  })
})

// ── getContractSpec ─────────────────────────────────────────────────────────

describe('getContractSpec', () => {
  it('returns spec for known symbol', () => {
    const spec = getContractSpec('ES')
    expect(spec).not.toBeNull()
    expect(spec!.symbol).toBe('ES')
    expect(spec!.name).toBe('E-mini S&P 500')
    expect(spec!.exchange).toBe('CME')
  })

  it('returns null for unknown symbol', () => {
    expect(getContractSpec('FOOBAR')).toBeNull()
  })
})

// ── getAllContractSpecs ──────────────────────────────────────────────────────

describe('getAllContractSpecs', () => {
  it('returns all 11 major futures specs', () => {
    const specs = getAllContractSpecs()
    expect(specs.length).toBe(11)
  })

  it('includes ES, CL, GC', () => {
    const specs = getAllContractSpecs()
    const symbols = specs.map((s) => s.symbol)
    expect(symbols).toContain('ES')
    expect(symbols).toContain('CL')
    expect(symbols).toContain('GC')
  })
})
