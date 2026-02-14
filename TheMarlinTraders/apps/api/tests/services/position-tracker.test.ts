import { describe, it, expect } from 'vitest'
import { PositionTracker } from '../../src/services/position-tracker.js'
import type { Position } from '../../src/services/position-tracker.js'

describe('PositionTracker', () => {
  const tracker = new PositionTracker()

  describe('calculatePositionPnL', () => {
    it('calculates positive unrealized P&L', () => {
      const position: Position = {
        symbol: 'AAPL',
        quantity: 100,
        averageCost: 150,
        currentPrice: 160,
      }
      const pnl = tracker.calculatePositionPnL(position)
      expect(pnl.marketValue).toBe(16000)
      expect(pnl.unrealizedPnL).toBe(1000)
      expect(pnl.unrealizedPnLPercent).toBeCloseTo(6.67, 1)
    })

    it('calculates negative unrealized P&L', () => {
      const position: Position = {
        symbol: 'TSLA',
        quantity: 50,
        averageCost: 200,
        currentPrice: 180,
      }
      const pnl = tracker.calculatePositionPnL(position)
      expect(pnl.marketValue).toBe(9000)
      expect(pnl.unrealizedPnL).toBe(-1000)
      expect(pnl.unrealizedPnLPercent).toBe(-10)
    })

    it('handles zero cost basis', () => {
      const position: Position = {
        symbol: 'XYZ',
        quantity: 10,
        averageCost: 0,
        currentPrice: 50,
      }
      const pnl = tracker.calculatePositionPnL(position)
      expect(pnl.unrealizedPnLPercent).toBe(0)
    })
  })

  describe('calculateNewAverageCost', () => {
    it('calculates average cost when adding to position', () => {
      // Bought 100 shares at $150, buying 50 more at $160
      const newAvg = tracker.calculateNewAverageCost(100, 150, 50, 160)
      expect(newAvg).toBeCloseTo(153.33, 1)
    })

    it('handles first purchase (zero existing)', () => {
      const newAvg = tracker.calculateNewAverageCost(0, 0, 100, 150)
      expect(newAvg).toBe(150)
    })

    it('returns 0 when total quantity is 0', () => {
      const newAvg = tracker.calculateNewAverageCost(0, 0, 0, 150)
      expect(newAvg).toBe(0)
    })
  })

  describe('calculateRealizedPnL', () => {
    it('calculates profit on a winning trade', () => {
      // Bought at $150, selling 50 shares at $170
      const pnl = tracker.calculateRealizedPnL(150, 170, 50)
      expect(pnl).toBe(1000)
    })

    it('calculates loss on a losing trade', () => {
      // Bought at $150, selling 50 shares at $140
      const pnl = tracker.calculateRealizedPnL(150, 140, 50)
      expect(pnl).toBe(-500)
    })

    it('returns 0 when breakeven', () => {
      const pnl = tracker.calculateRealizedPnL(150, 150, 100)
      expect(pnl).toBe(0)
    })
  })

  describe('calculatePortfolioSummary', () => {
    const positions: Position[] = [
      { symbol: 'AAPL', quantity: 100, averageCost: 150, currentPrice: 160 },
      { symbol: 'TSLA', quantity: 50, averageCost: 200, currentPrice: 190 },
    ]
    const cashBalance = 50000

    it('calculates total portfolio value', () => {
      const summary = tracker.calculatePortfolioSummary(positions, cashBalance)
      // positions: 100*160 + 50*190 = 16000 + 9500 = 25500
      expect(summary.positionsValue).toBe(25500)
      expect(summary.totalValue).toBe(75500) // 25500 + 50000
      expect(summary.cashBalance).toBe(50000)
      expect(summary.buyingPower).toBe(50000)
    })

    it('calculates unrealized P&L', () => {
      const summary = tracker.calculatePortfolioSummary(positions, cashBalance)
      // cost: 100*150 + 50*200 = 15000 + 10000 = 25000
      // value: 25500
      // pnl: 500
      expect(summary.unrealizedPnL).toBe(500)
      expect(summary.unrealizedPnLPercent).toBe(2) // 500/25000 * 100
    })

    it('calculates daily P&L when previous value provided', () => {
      const summary = tracker.calculatePortfolioSummary(positions, cashBalance, 74000)
      expect(summary.dailyPnL).toBe(1500) // 75500 - 74000
      expect(summary.dailyPnLPercent).toBeCloseTo(2.03, 1)
    })

    it('returns zero daily P&L when no previous value', () => {
      const summary = tracker.calculatePortfolioSummary(positions, cashBalance)
      expect(summary.dailyPnL).toBe(0)
    })

    it('handles empty positions', () => {
      const summary = tracker.calculatePortfolioSummary([], 100000)
      expect(summary.totalValue).toBe(100000)
      expect(summary.positionsValue).toBe(0)
      expect(summary.unrealizedPnL).toBe(0)
    })
  })
})
