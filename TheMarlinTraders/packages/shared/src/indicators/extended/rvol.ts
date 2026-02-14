import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'
import { smaArray } from '../trend/sma.js'

export const RvolParamsSchema = z.object({
  period: z.number().int().min(1).default(20),
})

export function rvol(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period } = RvolParamsSchema.parse(params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)

  const volumes = data.map((bar) => bar.volume)
  const avgVol = smaArray(volumes, period)

  for (let i = 0; i < len; i++) {
    if (!isNaN(avgVol[i]) && avgVol[i] !== 0) {
      result[i] = volumes[i] / avgVol[i]
    }
  }

  return result
}

export const rvolMeta: IndicatorMeta = {
  name: 'rvol',
  label: 'Relative Volume',
  category: 'volume',
  display: 'subchart',
  defaultParams: { period: 20 },
  paramSchema: RvolParamsSchema,
  outputs: ['value'],
  defaultColors: ['#8b5cf6'],
  referenceLines: [
    { value: 1, color: '#334155', label: 'Average' },
    { value: 2, color: '#f59e0b', label: 'High' },
  ],
}
