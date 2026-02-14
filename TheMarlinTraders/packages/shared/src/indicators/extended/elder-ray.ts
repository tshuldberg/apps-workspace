import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, extractSource } from '../types.js'
import { emaArray } from '../trend/ema.js'

export const ElderRayParamsSchema = z.object({
  period: z.number().int().min(1).default(13),
})

export function elderRay(
  data: OHLCV[],
  params: Record<string, unknown>,
): { bullPower: number[]; bearPower: number[] } {
  const { period } = ElderRayParamsSchema.parse(params)
  const closes = extractSource(data, 'close')
  const len = data.length
  const bullPower = new Array<number>(len).fill(NaN)
  const bearPower = new Array<number>(len).fill(NaN)

  const emaValues = emaArray(closes, period)

  for (let i = 0; i < len; i++) {
    if (!isNaN(emaValues[i])) {
      bullPower[i] = data[i].high - emaValues[i]
      bearPower[i] = data[i].low - emaValues[i]
    }
  }

  return { bullPower, bearPower }
}

export const elderRayMeta: IndicatorMeta = {
  name: 'elder-ray',
  label: 'Elder Ray',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { period: 13 },
  paramSchema: ElderRayParamsSchema,
  outputs: ['bullPower', 'bearPower'],
  defaultColors: ['#22c55e', '#ef4444'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
