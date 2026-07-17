import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const ZigzagParamsSchema = z.object({
  deviation: z.number().min(0.01).default(5),
})

export function zigzag(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { deviation } = ZigzagParamsSchema.parse(params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len < 2) return result

  const threshold = deviation / 100

  // Find pivot points
  type Pivot = { index: number; price: number; type: 'high' | 'low' }
  const pivots: Pivot[] = []

  const firstBar = data[0]!
  let lastPivot: Pivot = { index: 0, price: firstBar.high, type: 'high' }
  let lastLow: Pivot = { index: 0, price: firstBar.low, type: 'low' }

  if (firstBar.low < firstBar.high) {
    // Start with whichever comes first
    lastPivot = { index: 0, price: firstBar.high, type: 'high' }
    lastLow = { index: 0, price: firstBar.low, type: 'low' }
  }

  let currentHigh = firstBar.high
  let currentLow = firstBar.low
  let currentHighIdx = 0
  let currentLowIdx = 0
  let trend = 0 // 0=unknown, 1=up, -1=down

  for (let i = 1; i < len; i++) {
    const bar = data[i]!

    if (bar.high > currentHigh) {
      currentHigh = bar.high
      currentHighIdx = i
    }
    if (bar.low < currentLow) {
      currentLow = bar.low
      currentLowIdx = i
    }

    if (trend >= 0) {
      if (bar.low <= currentHigh * (1 - threshold)) {
        pivots.push({ index: currentHighIdx, price: currentHigh, type: 'high' })
        currentLow = bar.low
        currentLowIdx = i
        trend = -1
      }
    }
    if (trend <= 0) {
      if (bar.high >= currentLow * (1 + threshold)) {
        if (trend === -1) {
          pivots.push({ index: currentLowIdx, price: currentLow, type: 'low' })
        }
        currentHigh = bar.high
        currentHighIdx = i
        trend = 1
      }
    }
  }

  // Add the last pivot
  if (trend === 1) {
    pivots.push({ index: currentHighIdx, price: currentHigh, type: 'high' })
  } else if (trend === -1) {
    pivots.push({ index: currentLowIdx, price: currentLow, type: 'low' })
  }

  // Interpolate between pivots
  for (let p = 0; p < pivots.length; p++) {
    const pivot = pivots[p]!
    result[pivot.index] = pivot.price
  }

  // Linear interpolation between pivots
  for (let p = 0; p < pivots.length - 1; p++) {
    const startPivot = pivots[p]!
    const endPivot = pivots[p + 1]!
    const startIdx = startPivot.index
    const endIdx = endPivot.index
    const startPrice = startPivot.price
    const endPrice = endPivot.price
    const steps = endIdx - startIdx

    for (let i = 1; i < steps; i++) {
      result[startIdx + i] = startPrice + (endPrice - startPrice) * (i / steps)
    }
  }

  return result
}

export const zigzagMeta: IndicatorMeta = {
  name: 'zigzag',
  label: 'ZigZag',
  category: 'complex',
  display: 'overlay',
  defaultParams: { deviation: 5 },
  paramSchema: ZigzagParamsSchema,
  outputs: ['value'],
  defaultColors: ['#f97316'],
}
