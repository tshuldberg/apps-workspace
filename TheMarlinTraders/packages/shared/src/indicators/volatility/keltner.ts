import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, extractSource } from '../types.js'
import { emaArray } from '../trend/ema.js'
import { atrArray } from './atr.js'

export const KeltnerParamsSchema = z.object({
  period: z.number().int().min(1).default(20),
  multiplier: z.number().min(0).default(1.5),
  atrPeriod: z.number().int().min(1).default(10),
})

export function keltner(
  data: OHLCV[],
  params: Record<string, unknown>,
): { upper: number[]; middle: number[]; lower: number[] } {
  const { period, multiplier, atrPeriod } = KeltnerParamsSchema.parse(params)
  const closes = extractSource(data, 'close')
  const len = closes.length

  const upper = new Array<number>(len).fill(NaN)
  const middle = new Array<number>(len).fill(NaN)
  const lower = new Array<number>(len).fill(NaN)

  const emaLine = emaArray(closes, period)
  const atrLine = atrArray(data, atrPeriod)

  for (let i = 0; i < len; i++) {
    if (!isNaN(emaLine[i]) && !isNaN(atrLine[i])) {
      middle[i] = emaLine[i]
      upper[i] = emaLine[i] + multiplier * atrLine[i]
      lower[i] = emaLine[i] - multiplier * atrLine[i]
    }
  }

  return { upper, middle, lower }
}

export const keltnerMeta: IndicatorMeta = {
  name: 'keltner',
  label: 'Keltner Channels',
  category: 'volatility',
  display: 'overlay',
  defaultParams: { period: 20, multiplier: 1.5, atrPeriod: 10 },
  paramSchema: KeltnerParamsSchema,
  outputs: ['upper', 'middle', 'lower'],
  defaultColors: ['#a855f7', '#a855f7', '#a855f7'],
}
