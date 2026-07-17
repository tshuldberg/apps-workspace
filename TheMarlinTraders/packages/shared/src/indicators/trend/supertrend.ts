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

  const atr = new Array<number>(len).fill(NaN)
  let sum = 0
  for (let i = 0; i < period; i++) sum += tr[i]
  atr[period - 1] = sum / period
  for (let i = period; i < len; i++) {
    atr[i] = (atr[i - 1]! * (period - 1) + tr[i]!) / period
  }

  // Compute Supertrend
  const upperBand = new Array<number>(len).fill(NaN)
  const lowerBand = new Array<number>(len).fill(NaN)

  for (let i = period - 1; i < len; i++) {
    const bar = data[i]!
    const hl2 = (bar.high + bar.low) / 2
    const atrValue = atr[i]!
    const basicUpper = hl2 + multiplier * atrValue
    const basicLower = hl2 - multiplier * atrValue

    if (i === period - 1) {
      upperBand[i] = basicUpper
      lowerBand[i] = basicLower
      direction[i] = bar.close <= upperBand[i]! ? -1 : 1
      value[i] = direction[i]! === 1 ? lowerBand[i]! : upperBand[i]!
      continue
    }

    const prevBar = data[i - 1]!
    const prevUpperBand = upperBand[i - 1]!
    const prevLowerBand = lowerBand[i - 1]!
    const prevDirection = direction[i - 1]!

    upperBand[i] = basicUpper < prevUpperBand || prevBar.close > prevUpperBand
      ? basicUpper
      : prevUpperBand
    lowerBand[i] = basicLower > prevLowerBand || prevBar.close < prevLowerBand
      ? basicLower
      : prevLowerBand

    if (prevDirection === -1) {
      // Was bearish
      direction[i] = bar.close > upperBand[i]! ? 1 : -1
    } else {
      // Was bullish
      direction[i] = bar.close < lowerBand[i]! ? -1 : 1
    }

    value[i] = direction[i]! === 1 ? lowerBand[i]! : upperBand[i]!
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
