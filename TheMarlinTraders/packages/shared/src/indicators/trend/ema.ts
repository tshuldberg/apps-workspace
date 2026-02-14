import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'

export const EmaParamsSchema = z.object({
  period: z.number().int().min(1),
  source: SourceSchema.default('close'),
})

export function ema(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, source } = EmaParamsSchema.parse(params)
  const values = extractSource(data, source)
  return emaArray(values, period)
}

export function emaArray(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(NaN)
  if (values.length < period) return result

  const k = 2 / (period + 1)

  // Seed with SMA of first `period` values
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += values[i]
  }
  result[period - 1] = sum / period

  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k)
  }
  return result
}

export const emaMeta: IndicatorMeta = {
  name: 'ema',
  label: 'EMA',
  category: 'trend',
  display: 'overlay',
  defaultParams: { period: 20, source: 'close' },
  paramSchema: EmaParamsSchema,
  outputs: ['value'],
  defaultColors: ['#f59e0b'],
}
