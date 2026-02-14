import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'

export const WmaParamsSchema = z.object({
  period: z.number().int().min(1),
  source: SourceSchema.default('close'),
})

export function wma(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, source } = WmaParamsSchema.parse(params)
  const values = extractSource(data, source)
  return wmaArray(values, period)
}

export function wmaArray(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(NaN)
  if (values.length < period) return result

  const denominator = (period * (period + 1)) / 2

  for (let i = period - 1; i < values.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += values[i - period + 1 + j] * (j + 1)
    }
    result[i] = sum / denominator
  }
  return result
}

export const wmaMeta: IndicatorMeta = {
  name: 'wma',
  label: 'WMA',
  category: 'trend',
  display: 'overlay',
  defaultParams: { period: 20, source: 'close' },
  paramSchema: WmaParamsSchema,
  outputs: ['value'],
  defaultColors: ['#8b5cf6'],
}
