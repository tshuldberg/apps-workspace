import { describe, it, expect, vi } from 'vitest'
import { BarBuilder } from '../src/aggregation/bar-builder.js'
import type { NormalizedTrade, NormalizedBar } from '@marlin/shared'

function trade(symbol: string, price: number, size: number, timestamp: number): NormalizedTrade {
  return { symbol, price, size, timestamp }
}

describe('BarBuilder', () => {
  it('does not emit a bar from a single trade', () => {
    const onBar = vi.fn()
    const builder = new BarBuilder(onBar)

    builder.processTrade(trade('AAPL', 175.00, 100, 1700000000000))

    expect(onBar).not.toHaveBeenCalled()
  })

  it('emits a completed bar when a new minute begins', () => {
    const onBar = vi.fn()
    const builder = new BarBuilder(onBar)

    // Minute 0: three trades
    builder.processTrade(trade('AAPL', 175.00, 100, 1700000000000)) // open
    builder.processTrade(trade('AAPL', 176.00, 200, 1700000010000)) // high
    builder.processTrade(trade('AAPL', 174.50, 50, 1700000030000))  // low + close

    // First trade of minute 1 triggers emit of minute 0 bar
    builder.processTrade(trade('AAPL', 175.50, 150, 1700000060000))

    expect(onBar).toHaveBeenCalledTimes(1)
    const bar: NormalizedBar = onBar.mock.calls[0]![0]
    expect(bar.symbol).toBe('AAPL')
    expect(bar.timeframe).toBe('1m')
    expect(bar.open).toBe(175.00)
    expect(bar.high).toBe(176.00)
    expect(bar.low).toBe(174.50)
    expect(bar.close).toBe(174.50)
    expect(bar.volume).toBe(350) // 100 + 200 + 50
    expect(bar.tradeCount).toBe(3)
  })

  it('computes VWAP correctly', () => {
    const onBar = vi.fn()
    const builder = new BarBuilder(onBar)

    builder.processTrade(trade('AAPL', 100, 200, 1700000000000))
    builder.processTrade(trade('AAPL', 110, 300, 1700000010000))

    // Trigger emit
    builder.processTrade(trade('AAPL', 105, 100, 1700000060000))

    const bar: NormalizedBar = onBar.mock.calls[0]![0]
    // VWAP = (100*200 + 110*300) / (200 + 300) = (20000 + 33000) / 500 = 106
    expect(bar.vwap).toBeCloseTo(106, 2)
  })

  it('tracks multiple symbols independently', () => {
    const onBar = vi.fn()
    const builder = new BarBuilder(onBar)

    builder.processTrade(trade('AAPL', 175, 100, 1700000000000))
    builder.processTrade(trade('MSFT', 350, 200, 1700000000000))

    // New minute for AAPL only
    builder.processTrade(trade('AAPL', 176, 50, 1700000060000))

    expect(onBar).toHaveBeenCalledTimes(1)
    expect(onBar.mock.calls[0]![0].symbol).toBe('AAPL')
  })

  it('flush emits all pending bars', () => {
    const onBar = vi.fn()
    const builder = new BarBuilder(onBar)

    builder.processTrade(trade('AAPL', 175, 100, 1700000000000))
    builder.processTrade(trade('MSFT', 350, 200, 1700000000000))
    builder.processTrade(trade('GOOGL', 140, 50, 1700000000000))

    builder.flush()

    expect(onBar).toHaveBeenCalledTimes(3)
    const symbols = onBar.mock.calls.map((c: [NormalizedBar]) => c[0].symbol).sort()
    expect(symbols).toEqual(['AAPL', 'GOOGL', 'MSFT'])
  })

  it('flushSymbol emits only the specified symbol', () => {
    const onBar = vi.fn()
    const builder = new BarBuilder(onBar)

    builder.processTrade(trade('AAPL', 175, 100, 1700000000000))
    builder.processTrade(trade('MSFT', 350, 200, 1700000000000))

    builder.flushSymbol('AAPL')

    expect(onBar).toHaveBeenCalledTimes(1)
    expect(onBar.mock.calls[0]![0].symbol).toBe('AAPL')
  })

  it('handles single-trade bars correctly', () => {
    const onBar = vi.fn()
    const builder = new BarBuilder(onBar)

    builder.processTrade(trade('AAPL', 175, 100, 1700000000000))
    builder.processTrade(trade('AAPL', 180, 50, 1700000060000))

    const bar: NormalizedBar = onBar.mock.calls[0]![0]
    expect(bar.open).toBe(175)
    expect(bar.high).toBe(175)
    expect(bar.low).toBe(175)
    expect(bar.close).toBe(175)
    expect(bar.volume).toBe(100)
    expect(bar.tradeCount).toBe(1)
    expect(bar.vwap).toBe(175)
  })

  it('updates high/low/close within the same minute', () => {
    const onBar = vi.fn()
    const builder = new BarBuilder(onBar)

    const base = 1700000000000
    builder.processTrade(trade('SPY', 450, 100, base))
    builder.processTrade(trade('SPY', 455, 100, base + 5000))   // new high
    builder.processTrade(trade('SPY', 448, 100, base + 10000))  // new low
    builder.processTrade(trade('SPY', 452, 100, base + 15000))  // close

    builder.flush()

    const bar: NormalizedBar = onBar.mock.calls[0]![0]
    expect(bar.open).toBe(450)
    expect(bar.high).toBe(455)
    expect(bar.low).toBe(448)
    expect(bar.close).toBe(452)
  })
})
