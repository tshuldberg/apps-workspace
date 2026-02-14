/**
 * Pivot Point Detection & Trendline Fitting
 * Sprints 31-32: AI Chart Analysis
 */

import type { OHLCV } from '@marlin/shared'
import type { PivotPoint, Trendline } from '@marlin/shared'

/**
 * Find pivot highs in a bar series.
 * A pivot high is a bar whose high is greater than the highs of
 * `period` bars on either side.
 */
export function findPivotHighs(bars: OHLCV[], period: number): PivotPoint[] {
  const pivots: PivotPoint[] = []
  if (bars.length < period * 2 + 1) return pivots

  for (let i = period; i < bars.length - period; i++) {
    const bar = bars[i]!
    let isPivot = true

    for (let j = 1; j <= period; j++) {
      if (bars[i - j]!.high >= bar.high || bars[i + j]!.high >= bar.high) {
        isPivot = false
        break
      }
    }

    if (isPivot) {
      pivots.push({
        index: i,
        price: bar.high,
        timestamp: bar.timestamp,
      })
    }
  }

  return pivots
}

/**
 * Find pivot lows in a bar series.
 * A pivot low is a bar whose low is less than the lows of
 * `period` bars on either side.
 */
export function findPivotLows(bars: OHLCV[], period: number): PivotPoint[] {
  const pivots: PivotPoint[] = []
  if (bars.length < period * 2 + 1) return pivots

  for (let i = period; i < bars.length - period; i++) {
    const bar = bars[i]!
    let isPivot = true

    for (let j = 1; j <= period; j++) {
      if (bars[i - j]!.low <= bar.low || bars[i + j]!.low <= bar.low) {
        isPivot = false
        break
      }
    }

    if (isPivot) {
      pivots.push({
        index: i,
        price: bar.low,
        timestamp: bar.timestamp,
      })
    }
  }

  return pivots
}

/**
 * Fit a linear trendline through a set of points using ordinary least squares (OLS).
 * Returns slope, intercept, and R-squared goodness-of-fit.
 */
export function fitTrendline(points: { x: number; y: number }[]): {
  slope: number
  intercept: number
  r2: number
} {
  const n = points.length
  if (n < 2) {
    return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 }
  }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (const p of points) {
    sumX += p.x
    sumY += p.y
    sumXY += p.x * p.y
    sumX2 += p.x * p.x
    sumY2 += p.y * p.y
  }

  const denom = n * sumX2 - sumX * sumX
  if (Math.abs(denom) < 1e-10) {
    return { slope: 0, intercept: sumY / n, r2: 0 }
  }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // R-squared
  const meanY = sumY / n
  let ssTot = 0
  let ssRes = 0
  for (const p of points) {
    ssTot += (p.y - meanY) ** 2
    const predicted = slope * p.x + intercept
    ssRes += (p.y - predicted) ** 2
  }

  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

  return { slope, intercept, r2: Math.max(0, r2) }
}

/**
 * Build a Trendline object from a set of pivot points.
 */
export function buildTrendline(pivots: PivotPoint[]): Trendline | null {
  if (pivots.length < 2) return null

  const points = pivots.map((p) => ({ x: p.index, y: p.price }))
  const { slope, intercept, r2 } = fitTrendline(points)

  return {
    slope,
    intercept,
    r2,
    startIndex: pivots[0]!.index,
    endIndex: pivots[pivots.length - 1]!.index,
  }
}

/**
 * Check if recent bars have broken out past a trendline in the given direction.
 * Uses the last `lookback` bars (default 3) to check for breakout.
 */
export function isBrokenOut(
  bars: OHLCV[],
  trendline: Trendline,
  direction: 'up' | 'down',
  lookback: number = 3,
): boolean {
  if (bars.length === 0) return false

  const checkBars = bars.slice(-lookback)
  let breakoutCount = 0

  for (const bar of checkBars) {
    const idx = bars.indexOf(bar)
    const trendlineValue = trendline.slope * idx + trendline.intercept

    if (direction === 'up' && bar.close > trendlineValue) {
      breakoutCount++
    } else if (direction === 'down' && bar.close < trendlineValue) {
      breakoutCount++
    }
  }

  // Require at least 2 of the last `lookback` bars to confirm breakout
  return breakoutCount >= Math.min(2, lookback)
}

/**
 * Get the trendline value at a specific bar index.
 */
export function trendlineValueAt(trendline: Trendline, index: number): number {
  return trendline.slope * index + trendline.intercept
}

/**
 * Calculate average volume for a range of bars.
 */
export function avgVolume(bars: OHLCV[], start: number, end: number): number {
  const slice = bars.slice(start, end + 1)
  if (slice.length === 0) return 0
  return slice.reduce((sum, b) => sum + b.volume, 0) / slice.length
}

/**
 * Check if the current bar has volume confirmation
 * (volume above average by the specified multiplier).
 */
export function hasVolumeConfirmation(
  bars: OHLCV[],
  barIndex: number,
  lookbackBars: number = 20,
  multiplier: number = 1.5,
): boolean {
  const bar = bars[barIndex]
  if (!bar) return false

  const start = Math.max(0, barIndex - lookbackBars)
  const avg = avgVolume(bars, start, barIndex - 1)
  if (avg === 0) return false

  return bar.volume >= avg * multiplier
}
