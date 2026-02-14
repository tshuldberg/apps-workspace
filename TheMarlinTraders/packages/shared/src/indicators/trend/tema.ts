import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'
import { emaArray } from './ema.js'

export const TemaParamsSchema = z.object({
  period: z.number().int().min(1),
  source: SourceSchema.default('close'),
})

export function tema(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, source } = TemaParamsSchema.parse(params)
  const values = extractSource(data, source)
  return temaArray(values, period)
}

export function temaArray(values: number[], period: number): number[] {
  const ema1 = emaArray(values, period)
  const ema1Valid = ema1.filter((v) => !isNaN(v))
  const ema2 = emaArray(ema1Valid, period)
  const ema2Valid = ema2.filter((v) => !isNaN(v))
  const ema3 = emaArray(ema2Valid, period)

  const result = new Array<number>(values.length).fill(NaN)
  const offset = 3 * (period - 1)
  for (let i = offset; i < values.length; i++) {
    const e1 = ema1[i]
    const e2 = ema2[i - (period - 1)]
    const e3 = ema3[i - 2 * (period - 1)]
    if (!isNaN(e1) && !isNaN(e2) && !isNaN(e3)) {
      result[i] = 3 * e1 - 3 * e2 + e3
    }
  }
  return result
}

export const temaMeta: IndicatorMeta = {
  name: 'tema',
  label: 'TEMA',
  category: 'trend',
  display: 'overlay',
  defaultParams: { period: 20, source: 'close' },
  paramSchema: TemaParamsSchema,
  outputs: ['value'],
  defaultColors: ['#ec4899'],
}
