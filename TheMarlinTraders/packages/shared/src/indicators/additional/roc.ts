import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'

export const RocParamsSchema = z.object({
  period: z.number().int().min(1).default(12),
  source: SourceSchema.default('close'),
})

export function roc(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, source } = RocParamsSchema.parse(params)
  const values = extractSource(data, source)
  return rocArray(values, period)
}

export function rocArray(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(NaN)
  if (values.length <= period) return result

  for (let i = period; i < values.length; i++) {
    const prev = values[i - period]
    result[i] = prev !== 0 ? ((values[i] - prev) / prev) * 100 : NaN
  }

  return result
}

export const rocMeta: IndicatorMeta = {
  name: 'roc',
  label: 'Rate of Change',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { period: 12, source: 'close' },
  paramSchema: RocParamsSchema,
  outputs: ['value'],
  defaultColors: ['#8b5cf6'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
