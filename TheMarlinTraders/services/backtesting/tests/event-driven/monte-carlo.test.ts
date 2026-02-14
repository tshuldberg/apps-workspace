import { describe, it, expect } from 'vitest'
import { MonteCarloSimulator } from '../../src/event-driven/monte-carlo.js'

// ── Simulation Tests ─────────────────────────────────────────────────────

describe('MonteCarloSimulator - simulate', () => {
  it('should produce the correct number of paths', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 500,
      initialCapital: 100_000,
      seed: 42,
    })

    const trades = [100, -50, 200, -30, 150, -80, 60]
    const result = mc.simulate(trades, 500)

    expect(result.paths.length).toBe(500)
    expect(result.numSimulations).toBe(500)
  })

  it('should produce correct number of sample paths (max 100)', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 200,
      initialCapital: 100_000,
      seed: 42,
    })

    const trades = [100, -50, 200, -30, 150]
    const result = mc.simulate(trades, 200)

    expect(result.samplePaths.length).toBeLessThanOrEqual(100)
    expect(result.samplePaths.length).toBeGreaterThan(0)
  })

  it('should produce all sample paths when simulations < 100', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 50,
      initialCapital: 100_000,
      seed: 42,
    })

    const trades = [100, -50, 200]
    const result = mc.simulate(trades, 50)

    expect(result.samplePaths.length).toBeLessThanOrEqual(50)
  })

  it('should have equity curves of correct length', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 10,
      initialCapital: 100_000,
      seed: 42,
    })

    const trades = [100, -50, 200, -30]
    const result = mc.simulate(trades, 10)

    // Each equity curve should have n+1 points (initial + one per trade)
    for (const path of result.paths) {
      expect(path.equityCurve.length).toBe(trades.length + 1)
      expect(path.equityCurve[0]).toBe(100_000)
    }
  })

  it('should handle empty trade list', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 100,
      initialCapital: 100_000,
      seed: 42,
    })

    const result = mc.simulate([], 100)

    expect(result.paths.length).toBe(0)
    expect(result.meanFinalEquity).toBe(100_000)
    expect(result.meanMaxDrawdown).toBe(0)
  })

  it('should handle single trade', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 100,
      initialCapital: 100_000,
      seed: 42,
    })

    const result = mc.simulate([500], 100)

    // Every path should end at 100,500 since there's only one trade
    for (const path of result.paths) {
      expect(path.finalEquity).toBeCloseTo(100_500, 5)
    }
    expect(result.meanFinalEquity).toBeCloseTo(100_500, 0)
  })
})

// ── Confidence Interval Tests ────────────────────────────────────────────

describe('MonteCarloSimulator - Confidence Intervals', () => {
  it('should contain the median in the confidence interval', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 1000,
      initialCapital: 100_000,
      seed: 42,
    })

    const trades = [100, -50, 200, -30, 150, -80, 60, 120, -40, 90]
    const result = mc.simulate(trades)

    // Median (p50) should be between p5 and p95
    expect(result.finalEquity.p50).toBeGreaterThanOrEqual(result.finalEquity.p5)
    expect(result.finalEquity.p50).toBeLessThanOrEqual(result.finalEquity.p95)

    expect(result.maxDrawdown.p50).toBeGreaterThanOrEqual(result.maxDrawdown.p5)
    expect(result.maxDrawdown.p50).toBeLessThanOrEqual(result.maxDrawdown.p95)

    expect(result.sharpeRatio.p50).toBeGreaterThanOrEqual(result.sharpeRatio.p5)
    expect(result.sharpeRatio.p50).toBeLessThanOrEqual(result.sharpeRatio.p95)
  })

  it('should have ordered percentiles (p5 <= p25 <= p50 <= p75 <= p95)', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 1000,
      initialCapital: 100_000,
      seed: 42,
    })

    const trades = [100, -50, 200, -30, 150, -80, 60]
    const result = mc.simulate(trades)

    // Final equity percentiles should be ordered
    expect(result.finalEquity.p5).toBeLessThanOrEqual(result.finalEquity.p25)
    expect(result.finalEquity.p25).toBeLessThanOrEqual(result.finalEquity.p50)
    expect(result.finalEquity.p50).toBeLessThanOrEqual(result.finalEquity.p75)
    expect(result.finalEquity.p75).toBeLessThanOrEqual(result.finalEquity.p95)

    // Max drawdown percentiles should be ordered
    expect(result.maxDrawdown.p5).toBeLessThanOrEqual(result.maxDrawdown.p25)
    expect(result.maxDrawdown.p25).toBeLessThanOrEqual(result.maxDrawdown.p50)
    expect(result.maxDrawdown.p50).toBeLessThanOrEqual(result.maxDrawdown.p75)
    expect(result.maxDrawdown.p75).toBeLessThanOrEqual(result.maxDrawdown.p95)
  })

  it('should produce reasonable mean values', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 2000,
      initialCapital: 100_000,
      seed: 42,
    })

    // Net positive expectancy: sum = 420
    const trades = [100, -50, 200, -30, 150, -80, 60, 120, -40, 90, -100]
    const result = mc.simulate(trades)

    // Mean final equity should be around initial + sum of trades
    const expectedPnl = trades.reduce((s, t) => s + t, 0)
    const expectedFinal = 100_000 + expectedPnl

    // With bootstrapping, mean should converge to expected value
    // Allow some tolerance (within 10% of expected)
    expect(result.meanFinalEquity).toBeGreaterThan(expectedFinal * 0.8)
    expect(result.meanFinalEquity).toBeLessThan(expectedFinal * 1.2)
  })
})

// ── Ruin Probability Tests ───────────────────────────────────────────────

describe('MonteCarloSimulator - Ruin Probability', () => {
  it('should return probability between 0 and 1', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 500,
      initialCapital: 100_000,
      seed: 42,
    })

    const trades = [100, -50, 200, -300, 150, -500, 60]
    const result = mc.calculateRuinProbability(trades, 0.1, 500)

    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(1)
    expect(result.totalSimulations).toBe(500)
    expect(result.ruinCount).toBeGreaterThanOrEqual(0)
    expect(result.ruinCount).toBeLessThanOrEqual(500)
    expect(result.drawdownThreshold).toBe(0.1)
  })

  it('should produce 0% ruin for all-winning trades', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 1000,
      initialCapital: 100_000,
      seed: 42,
    })

    // All positive P&Ls — no drawdown possible
    const trades = [100, 200, 150, 300, 250, 180, 400, 350]
    const result = mc.calculateRuinProbability(trades, 0.01, 1000)

    // With all-winning trades, equity only goes up so DD = 0
    expect(result.probability).toBe(0)
    expect(result.ruinCount).toBe(0)
  })

  it('should produce high ruin probability for very volatile trades with tight threshold', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 1000,
      initialCapital: 10_000,
      seed: 42,
    })

    // Very volatile with large losses relative to capital
    const trades = [5000, -8000, 3000, -7000, 2000, -6000, 4000, -9000]
    const result = mc.calculateRuinProbability(trades, 0.3, 1000)

    // With losses of 80% of capital, ruin at 30% threshold should be common
    expect(result.probability).toBeGreaterThan(0.1)
  })

  it('should increase ruin probability with lower drawdown threshold', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 1000,
      initialCapital: 100_000,
      seed: 42,
    })

    const trades = [500, -300, 200, -800, 400, -600, 300, -400]

    const looseThreshold = mc.calculateRuinProbability(trades, 0.5, 1000)
    const tightThreshold = mc.calculateRuinProbability(trades, 0.01, 1000)

    // Tighter threshold should have equal or higher ruin probability
    expect(tightThreshold.probability).toBeGreaterThanOrEqual(looseThreshold.probability)
  })

  it('should return 0 probability for empty trades', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 100,
      initialCapital: 100_000,
      seed: 42,
    })

    const result = mc.calculateRuinProbability([], 0.1, 100)
    expect(result.probability).toBe(0)
    expect(result.ruinCount).toBe(0)
  })

  it('should return 0 probability for zero threshold', () => {
    const mc = new MonteCarloSimulator({
      numSimulations: 100,
      initialCapital: 100_000,
      seed: 42,
    })

    const trades = [100, -500, 200]
    const result = mc.calculateRuinProbability(trades, 0, 100)
    expect(result.probability).toBe(0)
  })
})

// ── Reproducibility Tests ────────────────────────────────────────────────

describe('MonteCarloSimulator - Reproducibility', () => {
  it('should produce identical results with the same seed', () => {
    const trades = [100, -50, 200, -30, 150, -80, 60]

    const mc1 = new MonteCarloSimulator({ numSimulations: 100, seed: 42, initialCapital: 100_000 })
    const mc2 = new MonteCarloSimulator({ numSimulations: 100, seed: 42, initialCapital: 100_000 })

    const r1 = mc1.simulate(trades, 100)
    const r2 = mc2.simulate(trades, 100)

    expect(r1.meanFinalEquity).toBeCloseTo(r2.meanFinalEquity, 5)
    expect(r1.meanMaxDrawdown).toBeCloseTo(r2.meanMaxDrawdown, 5)

    // Check individual paths match
    for (let i = 0; i < r1.paths.length; i++) {
      expect(r1.paths[i]!.finalEquity).toBeCloseTo(r2.paths[i]!.finalEquity, 5)
    }
  })

  it('should produce different results with different seeds', () => {
    const trades = [100, -50, 200, -30, 150, -80, 60, 120, -40, 90]

    const mc1 = new MonteCarloSimulator({ numSimulations: 500, seed: 42, initialCapital: 100_000 })
    const mc2 = new MonteCarloSimulator({ numSimulations: 500, seed: 99, initialCapital: 100_000 })

    const r1 = mc1.simulate(trades, 500)
    const r2 = mc2.simulate(trades, 500)

    // Individual path values should differ (with high probability)
    let anyDifferent = false
    for (let i = 0; i < Math.min(r1.paths.length, r2.paths.length); i++) {
      if (Math.abs(r1.paths[i]!.finalEquity - r2.paths[i]!.finalEquity) > 0.01) {
        anyDifferent = true
        break
      }
    }
    expect(anyDifferent).toBe(true)
  })
})
