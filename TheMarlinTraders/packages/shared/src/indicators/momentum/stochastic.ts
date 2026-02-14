import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'
import { smaArray } from '../trend/sma.js'

export const StochasticParamsSchema = z.object({
  kPeriod: z.number().int().min(1).default(14),
  dPeriod: z.number().int().min(1).default(3),
  smooth: z.number().int().min(1).default(3),
})

export function stochastic(
  data: OHLCV[],
  params: Record<string, unknown>,
): { k: number[]; d: number[] } {
  const { kPeriod, dPeriod, smooth } = StochasticParamsSchema.parse(params)
  const len = data.length
  const rawK = new Array<number>(len).fill(NaN)

  // Raw %K
  for (let i = kPeriod - 1; i < len; i++) {
    let highest = -Infinity
    let lowest = Infinity
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (data[j].high > highest) highest = data[j].high
      if (data[j].low < lowest) lowest = data[j].low
    }
    const range = highest - lowest
    rawK[i] = range === 0 ? 50 : ((data[i].close - lowest) / range) * 100
  }

  // Smoothed %K (SMA of raw %K)
  const validRawK = rawK.filter((v) => !isNaN(v))
  const smoothedKValid = smooth > 1 ? smaArray(validRawK, smooth) : validRawK

  const k = new Array<number>(len).fill(NaN)
  const offset = len - validRawK.length
  const smoothOffset = smooth > 1 ? 0 : 0
  for (let i = 0; i < smoothedKValid.length; i++) {
    k[offset + i] = smoothedKValid[i]
  }

  // %D = SMA of %K
  const validK = k.filter((v) => !isNaN(v))
  const dValid = smaArray(validK, dPeriod)
  const d = new Array<number>(len).fill(NaN)
  const kOffset = len - validK.length
  for (let i = 0; i < dValid.length; i++) {
    d[kOffset + i] = dValid[i]
  }

  return { k, d }
}

export const stochasticMeta: IndicatorMeta = {
  name: 'stochastic',
  label: 'Stochastic',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { kPeriod: 14, dPeriod: 3, smooth: 3 },
  paramSchema: StochasticParamsSchema,
  outputs: ['k', 'd'],
  defaultColors: ['#3b82f6', '#f59e0b'],
  referenceLines: [
    { value: 80, color: '#ef4444', label: 'Overbought' },
    { value: 20, color: '#22c55e', label: 'Oversold' },
  ],
}
