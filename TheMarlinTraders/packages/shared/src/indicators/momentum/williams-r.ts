import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const WilliamsRParamsSchema = z.object({
  period: z.number().int().min(1).default(14),
})

export function williamsR(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period } = WilliamsRParamsSchema.parse(params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len < period) return result

  for (let i = period - 1; i < len; i++) {
    let highest = -Infinity
    let lowest = Infinity
    for (let j = i - period + 1; j <= i; j++) {
      if (data[j].high > highest) highest = data[j].high
      if (data[j].low < lowest) lowest = data[j].low
    }
    const range = highest - lowest
    result[i] = range === 0 ? -50 : ((highest - data[i].close) / range) * -100
  }

  return result
}

export const williamsRMeta: IndicatorMeta = {
  name: 'williams-r',
  label: 'Williams %R',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { period: 14 },
  paramSchema: WilliamsRParamsSchema,
  outputs: ['value'],
  defaultColors: ['#ec4899'],
  referenceLines: [
    { value: -20, color: '#ef4444', label: 'Overbought' },
    { value: -80, color: '#22c55e', label: 'Oversold' },
  ],
}
