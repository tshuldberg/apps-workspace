import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, extractSource } from '../types.js'
import { bollinger } from '../volatility/bollinger.js'

export const PercentBParamsSchema = z.object({
  period: z.number().int().min(1).default(20),
  stdDev: z.number().min(0).default(2),
})

export function percentB(data: OHLCV[], params: Record<string, unknown>): number[] {
  const parsed = PercentBParamsSchema.parse(params)
  const closes = extractSource(data, 'close')
  const { upper, lower } = bollinger(data, { period: parsed.period, stdDev: parsed.stdDev })
  const len = closes.length
  const result = new Array<number>(len).fill(NaN)

  for (let i = 0; i < len; i++) {
    if (!isNaN(upper[i]) && !isNaN(lower[i])) {
      const bandwidth = upper[i] - lower[i]
      result[i] = bandwidth !== 0 ? (closes[i] - lower[i]) / bandwidth : 0.5
    }
  }

  return result
}

export const percentBMeta: IndicatorMeta = {
  name: 'percent-b',
  label: '%B',
  category: 'volatility',
  display: 'subchart',
  defaultParams: { period: 20, stdDev: 2 },
  paramSchema: PercentBParamsSchema,
  outputs: ['value'],
  defaultColors: ['#ec4899'],
  referenceLines: [
    { value: 1, color: '#ef4444', label: 'Upper Band' },
    { value: 0.5, color: '#334155' },
    { value: 0, color: '#22c55e', label: 'Lower Band' },
  ],
}
