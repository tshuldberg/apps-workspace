import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const SupertrendParamsSchema = z.object({
  period: z.number().int().min(1).default(10),
  multiplier: z.number().min(0).default(3),
})

export function supertrend(
  data: OHLCV[],
  params: Record<string, unknown>,
): { value: number[]; direction: number[] } {
  const { period, multiplier } = SupertrendParamsSchema.parse(params)
  const len = data.length
  const value = new Array<number>(len).fill(NaN)
  const direction = new Array<number>(len).fill(NaN)

  if (len < period) return { value, direction }

  // Compute ATR
  const tr = new Array<number>(len).fill(0)
  tr[0] = data[0].high - data[0].low
  for (let i = 1; i < len; i++) {
    tr[i] = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    )
  }

  const atr = new Array<number>(len).fill(NaN)
  let sum = 0
  for (let i = 0; i < period; i++) sum += tr[i]
  atr[period - 1] = sum / period
  for (let i = period; i < len; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period
  }

  // Compute Supertrend
  const upperBand = new Array<number>(len).fill(NaN)
  const lowerBand = new Array<number>(len).fill(NaN)

  for (let i = period - 1; i < len; i++) {
    const hl2 = (data[i].high + data[i].low) / 2
    const basicUpper = hl2 + multiplier * atr[i]
    const basicLower = hl2 - multiplier * atr[i]

    if (i === period - 1) {
      upperBand[i] = basicUpper
      lowerBand[i] = basicLower
      direction[i] = data[i].close <= upperBand[i] ? -1 : 1
      value[i] = direction[i] === 1 ? lowerBand[i] : upperBand[i]
      continue
    }

    upperBand[i] = basicUpper < upperBand[i - 1] || data[i - 1].close > upperBand[i - 1]
      ? basicUpper
      : upperBand[i - 1]
    lowerBand[i] = basicLower > lowerBand[i - 1] || data[i - 1].close < lowerBand[i - 1]
      ? basicLower
      : lowerBand[i - 1]

    if (direction[i - 1] === -1) {
      // Was bearish
      direction[i] = data[i].close > upperBand[i] ? 1 : -1
    } else {
      // Was bullish
      direction[i] = data[i].close < lowerBand[i] ? -1 : 1
    }

    value[i] = direction[i] === 1 ? lowerBand[i] : upperBand[i]
  }

  return { value, direction }
}

export const supertrendMeta: IndicatorMeta = {
  name: 'supertrend',
  label: 'Supertrend',
  category: 'trend',
  display: 'overlay',
  defaultParams: { period: 10, multiplier: 3 },
  paramSchema: SupertrendParamsSchema,
  outputs: ['value', 'direction'],
  defaultColors: ['#22c55e', '#ef4444'],
}
