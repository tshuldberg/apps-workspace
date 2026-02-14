import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'
import { emaArray } from '../trend/ema.js'

export const ForceIndexParamsSchema = z.object({
  period: z.number().int().min(1).default(13),
})

export function forceIndex(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period } = ForceIndexParamsSchema.parse(params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len < 2) return result

  // Raw force index = (close - prev close) * volume
  const raw = new Array<number>(len).fill(0)
  for (let i = 1; i < len; i++) {
    raw[i] = (data[i].close - data[i - 1].close) * data[i].volume
  }

  const smoothed = emaArray(raw, period)
  return smoothed
}

export const forceIndexMeta: IndicatorMeta = {
  name: 'force-index',
  label: 'Force Index',
  category: 'volume',
  display: 'subchart',
  defaultParams: { period: 13 },
  paramSchema: ForceIndexParamsSchema,
  outputs: ['value'],
  defaultColors: ['#3b82f6'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
