import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const AroonParamsSchema = z.object({
  period: z.number().int().min(1).default(25),
})

export function aroon(
  data: OHLCV[],
  params: Record<string, unknown>,
): { up: number[]; down: number[] } {
  const { period } = AroonParamsSchema.parse(params)
  const len = data.length

  const up = new Array<number>(len).fill(NaN)
  const down = new Array<number>(len).fill(NaN)

  if (len < period + 1) return { up, down }

  for (let i = period; i < len; i++) {
    let highestIdx = i - period
    let lowestIdx = i - period

    for (let j = i - period; j <= i; j++) {
      if (data[j].high >= data[highestIdx].high) highestIdx = j
      if (data[j].low <= data[lowestIdx].low) lowestIdx = j
    }

    up[i] = ((period - (i - highestIdx)) / period) * 100
    down[i] = ((period - (i - lowestIdx)) / period) * 100
  }

  return { up, down }
}

export const aroonMeta: IndicatorMeta = {
  name: 'aroon',
  label: 'Aroon',
  category: 'complex',
  display: 'subchart',
  defaultParams: { period: 25 },
  paramSchema: AroonParamsSchema,
  outputs: ['up', 'down'],
  defaultColors: ['#22c55e', '#ef4444'],
  referenceLines: [
    { value: 70, color: '#334155' },
    { value: 30, color: '#334155' },
  ],
}
