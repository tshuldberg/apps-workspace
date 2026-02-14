import { describe, it, expect } from 'vitest'
import { formatPrice, formatVolume, formatPercent, formatMarketCap } from '../../src/utils/formatters.js'

describe('formatPrice', () => {
  it('formats prices >= $1 with 2 decimal places', () => {
    expect(formatPrice(123.456)).toBe('123.46')
    expect(formatPrice(1)).toBe('1.00')
    expect(formatPrice(10000)).toBe('10,000.00')
  })

  it('formats prices < $1 with 4 decimal places', () => {
    expect(formatPrice(0.1234)).toBe('0.1234')
    expect(formatPrice(0.00567)).toBe('0.0057')
  })
})

describe('formatVolume', () => {
  it('formats billions', () => {
    expect(formatVolume(1_500_000_000)).toBe('1.50B')
  })

  it('formats millions', () => {
    expect(formatVolume(2_500_000)).toBe('2.50M')
  })

  it('formats thousands', () => {
    expect(formatVolume(45_000)).toBe('45.00K')
  })

  it('formats small numbers as-is', () => {
    expect(formatVolume(500)).toBe('500')
  })
})

describe('formatPercent', () => {
  it('adds + sign for positive values', () => {
    expect(formatPercent(5.5)).toBe('+5.50%')
  })

  it('adds - sign for negative values', () => {
    expect(formatPercent(-3.2)).toBe('-3.20%')
  })

  it('handles zero', () => {
    expect(formatPercent(0)).toBe('+0.00%')
  })
})

describe('formatMarketCap', () => {
  it('formats trillions', () => {
    expect(formatMarketCap(3_000_000_000_000)).toBe('$3.00T')
  })

  it('formats billions', () => {
    expect(formatMarketCap(750_000_000)).toBe('$750.00M')
  })
})
