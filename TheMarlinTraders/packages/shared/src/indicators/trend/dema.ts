import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'
import { emaArray } from './ema.js'

export const DemaParamsSchema = z.object({
  period: z.number().int().min(1),
  source: SourceSchema.default('close'),
})

export function dema(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, source } = DemaParamsSchema.parse(params)
  const values = extractSource(data, source)
  return demaArray(values, period)
}

export function demaArray(values: number[], period: number): number[] {
  const ema1 = emaArray(values, period)
  const ema2 = emaArray(ema1.filter((v) => !isNaN(v)), period)

  const result = new Array<number>(values.length).fill(NaN)
  // ema2 starts at index (period-1) of ema1's valid values
  // ema1 valid from index (period-1), ema2 valid from index (period-1) of that = 2*(period-1)
  const offset = 2 * (period - 1)
  for (let i = offset; i < values.length; i++) {
    const e1 = ema1[i]
    const e2 = ema2[i - (period - 1)]
    if (!isNaN(e1) && !isNaN(e2)) {
      result[i] = 2 * e1 - e2
    }
  }
  return result
}

export const demaMeta: IndicatorMeta = {
  name: 'dema',
  label: 'DEMA',
  category: 'trend',
  display: 'overlay',
  defaultParams: { period: 20, source: 'close' },
  paramSchema: DemaParamsSchema,
  outputs: ['value'],
  defaultColors: ['#06b6d4'],
}
