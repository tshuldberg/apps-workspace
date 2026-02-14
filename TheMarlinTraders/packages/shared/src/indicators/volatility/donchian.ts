import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const DonchianParamsSchema = z.object({
  period: z.number().int().min(1).default(20),
})

export function donchian(
  data: OHLCV[],
  params: Record<string, unknown>,
): { upper: number[]; middle: number[]; lower: number[] } {
  const { period } = DonchianParamsSchema.parse(params)
  const len = data.length

  const upper = new Array<number>(len).fill(NaN)
  const middle = new Array<number>(len).fill(NaN)
  const lower = new Array<number>(len).fill(NaN)

  if (len < period) return { upper, middle, lower }

  for (let i = period - 1; i < len; i++) {
    let highest = -Infinity
    let lowest = Infinity
    for (let j = i - period + 1; j <= i; j++) {
      if (data[j].high > highest) highest = data[j].high
      if (data[j].low < lowest) lowest = data[j].low
    }
    upper[i] = highest
    lower[i] = lowest
    middle[i] = (highest + lowest) / 2
  }

  return { upper, middle, lower }
}

export const donchianMeta: IndicatorMeta = {
  name: 'donchian',
  label: 'Donchian Channels',
  category: 'volatility',
  display: 'overlay',
  defaultParams: { period: 20 },
  paramSchema: DonchianParamsSchema,
  outputs: ['upper', 'middle', 'lower'],
  defaultColors: ['#06b6d4', '#06b6d4', '#06b6d4'],
}
