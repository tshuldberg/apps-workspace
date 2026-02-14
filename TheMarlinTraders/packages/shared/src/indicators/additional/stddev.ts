import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'

export const StdDevParamsSchema = z.object({
  period: z.number().int().min(1).default(20),
  source: SourceSchema.default('close'),
})

export function stddev(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, source } = StdDevParamsSchema.parse(params)
  const values = extractSource(data, source)
  return stddevArray(values, period)
}

export function stddevArray(values: number[], period: number): number[] {
  const len = values.length
  const result = new Array<number>(len).fill(NaN)
  if (len < period) return result

  for (let i = period - 1; i < len; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += values[j]
    }
    const mean = sum / period

    let sqSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sqSum += (values[j] - mean) ** 2
    }
    result[i] = Math.sqrt(sqSum / period)
  }

  return result
}

export const stddevMeta: IndicatorMeta = {
  name: 'stddev',
  label: 'Standard Deviation',
  category: 'volatility',
  display: 'subchart',
  defaultParams: { period: 20, source: 'close' },
  paramSchema: StdDevParamsSchema,
  outputs: ['value'],
  defaultColors: ['#f97316'],
}
