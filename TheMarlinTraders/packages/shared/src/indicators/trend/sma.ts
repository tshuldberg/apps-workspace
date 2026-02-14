import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'

export const SmaParamsSchema = z.object({
  period: z.number().int().min(1),
  source: SourceSchema.default('close'),
})

export function sma(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, source } = SmaParamsSchema.parse(params)
  const values = extractSource(data, source)
  return smaArray(values, period)
}

export function smaArray(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(NaN)
  if (values.length < period) return result

  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += values[i]
  }
  result[period - 1] = sum / period

  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period]
    result[i] = sum / period
  }
  return result
}

export const smaMeta: IndicatorMeta = {
  name: 'sma',
  label: 'SMA',
  category: 'trend',
  display: 'overlay',
  defaultParams: { period: 20, source: 'close' },
  paramSchema: SmaParamsSchema,
  outputs: ['value'],
  defaultColors: ['#3b82f6'],
}
