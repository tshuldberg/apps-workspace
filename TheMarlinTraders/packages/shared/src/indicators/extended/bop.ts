import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'
import { smaArray } from '../trend/sma.js'

export const BopParamsSchema = z.object({
  smoothing: z.number().int().min(1).default(14),
})

export function bop(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { smoothing } = BopParamsSchema.parse(params)
  const len = data.length
  const raw = new Array<number>(len)

  for (let i = 0; i < len; i++) {
    const range = data[i].high - data[i].low
    raw[i] = range !== 0 ? (data[i].close - data[i].open) / range : 0
  }

  return smoothing > 1 ? smaArray(raw, smoothing) : raw
}

export const bopMeta: IndicatorMeta = {
  name: 'bop',
  label: 'Balance of Power',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { smoothing: 14 },
  paramSchema: BopParamsSchema,
  outputs: ['value'],
  defaultColors: ['#06b6d4'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
