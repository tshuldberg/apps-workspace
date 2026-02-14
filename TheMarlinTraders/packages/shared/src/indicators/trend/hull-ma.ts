import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'
import { wmaArray } from './wma.js'

export const HullMaParamsSchema = z.object({
  period: z.number().int().min(2),
  source: SourceSchema.default('close'),
})

export function hullMa(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, source } = HullMaParamsSchema.parse(params)
  const values = extractSource(data, source)
  return hullMaArray(values, period)
}

export function hullMaArray(values: number[], period: number): number[] {
  const halfPeriod = Math.floor(period / 2)
  const sqrtPeriod = Math.floor(Math.sqrt(period))

  const wmaHalf = wmaArray(values, halfPeriod)
  const wmaFull = wmaArray(values, period)

  // diff = 2 * WMA(half) - WMA(full)
  const diff: number[] = new Array(values.length)
  for (let i = 0; i < values.length; i++) {
    if (isNaN(wmaHalf[i]) || isNaN(wmaFull[i])) {
      diff[i] = NaN
    } else {
      diff[i] = 2 * wmaHalf[i] - wmaFull[i]
    }
  }

  // Filter valid diff values and apply WMA(sqrt)
  const validDiff = diff.filter((v) => !isNaN(v))
  const hullValid = wmaArray(validDiff, sqrtPeriod)

  // Map back to original indices
  const result = new Array<number>(values.length).fill(NaN)
  const startIdx = values.length - validDiff.length
  for (let i = 0; i < hullValid.length; i++) {
    result[startIdx + i] = hullValid[i]
  }
  return result
}

export const hullMaMeta: IndicatorMeta = {
  name: 'hull-ma',
  label: 'Hull MA',
  category: 'trend',
  display: 'overlay',
  defaultParams: { period: 9, source: 'close' },
  paramSchema: HullMaParamsSchema,
  outputs: ['value'],
  defaultColors: ['#a855f7'],
}
