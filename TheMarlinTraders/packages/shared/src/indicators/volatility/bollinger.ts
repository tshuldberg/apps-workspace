import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, extractSource } from '../types.js'

export const BollingerParamsSchema = z.object({
  period: z.number().int().min(1).default(20),
  stdDev: z.number().min(0).default(2),
})

export function bollinger(
  data: OHLCV[],
  params: Record<string, unknown>,
): { upper: number[]; middle: number[]; lower: number[] } {
  const { period, stdDev } = BollingerParamsSchema.parse(params)
  const closes = extractSource(data, 'close')
  const len = closes.length

  const upper = new Array<number>(len).fill(NaN)
  const middle = new Array<number>(len).fill(NaN)
  const lower = new Array<number>(len).fill(NaN)

  if (len < period) return { upper, middle, lower }

  for (let i = period - 1; i < len; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += closes[j]
    }
    const mean = sum / period

    let sqSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sqSum += (closes[j] - mean) ** 2
    }
    const sd = Math.sqrt(sqSum / period)

    middle[i] = mean
    upper[i] = mean + stdDev * sd
    lower[i] = mean - stdDev * sd
  }

  return { upper, middle, lower }
}

export const bollingerMeta: IndicatorMeta = {
  name: 'bollinger',
  label: 'Bollinger Bands',
  category: 'volatility',
  display: 'overlay',
  defaultParams: { period: 20, stdDev: 2 },
  paramSchema: BollingerParamsSchema,
  outputs: ['upper', 'middle', 'lower'],
  defaultColors: ['#3b82f6', '#3b82f6', '#3b82f6'],
}
