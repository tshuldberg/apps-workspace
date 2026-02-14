import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'
import { emaArray } from '../trend/ema.js'

export const TrixParamsSchema = z.object({
  period: z.number().int().min(1).default(15),
  source: SourceSchema.default('close'),
})

export function trix(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, source } = TrixParamsSchema.parse(params)
  const values = extractSource(data, source)
  return trixArray(values, period)
}

export function trixArray(values: number[], period: number): number[] {
  const len = values.length
  const result = new Array<number>(len).fill(NaN)

  // Triple EMA
  const ema1 = emaArray(values, period)
  const ema2 = emaArray(ema1.map((v) => (isNaN(v) ? 0 : v)), period)
  const ema3 = emaArray(ema2.map((v) => (isNaN(v) ? 0 : v)), period)

  // TRIX = percentage change of triple EMA
  for (let i = 1; i < len; i++) {
    if (!isNaN(ema3[i]) && !isNaN(ema3[i - 1]) && ema3[i - 1] !== 0) {
      result[i] = ((ema3[i] - ema3[i - 1]) / ema3[i - 1]) * 100
    }
  }

  return result
}

export const trixMeta: IndicatorMeta = {
  name: 'trix',
  label: 'TRIX',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { period: 15, source: 'close' },
  paramSchema: TrixParamsSchema,
  outputs: ['value'],
  defaultColors: ['#ec4899'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
