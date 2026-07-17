import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const ChoppinessParamsSchema = z.object({
  period: z.number().int().min(1).default(14),
})

export function choppiness(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period } = ChoppinessParamsSchema.parse(params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len < period + 1) return result

  // True Range array
  const tr = new Array<number>(len)
  const firstBar = data[0]!
  tr[0] = firstBar.high - firstBar.low
  for (let i = 1; i < len; i++) {
    const bar = data[i]!
    const prevBar = data[i - 1]!
    tr[i] = Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - prevBar.close),
      Math.abs(bar.low - prevBar.close),
    )
  }

  for (let i = period; i < len; i++) {
    let atrSum = 0
    let highestHigh = -Infinity
    let lowestLow = Infinity

    for (let j = i - period + 1; j <= i; j++) {
      const bar = data[j]!
      atrSum += tr[j]!
      if (bar.high > highestHigh) highestHigh = bar.high
      if (bar.low < lowestLow) lowestLow = bar.low
    }

    const range = highestHigh - lowestLow
    if (range > 0) {
      result[i] = (100 * Math.log10(atrSum / range)) / Math.log10(period)
    }
  }

  return result
}

export const choppinessMeta: IndicatorMeta = {
  name: 'choppiness',
  label: 'Choppiness Index',
  category: 'volatility',
  display: 'subchart',
  defaultParams: { period: 14 },
  paramSchema: ChoppinessParamsSchema,
  outputs: ['value'],
  defaultColors: ['#a855f7'],
  referenceLines: [
    { value: 61.8, color: '#ef4444', label: 'Choppy' },
    { value: 38.2, color: '#22c55e', label: 'Trending' },
  ],
}
