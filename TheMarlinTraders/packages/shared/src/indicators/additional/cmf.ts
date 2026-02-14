import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const CmfParamsSchema = z.object({
  period: z.number().int().min(1).default(20),
})

export function cmf(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period } = CmfParamsSchema.parse(params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len < period) return result

  // Money Flow Multiplier * Volume for each bar
  const mfv = new Array<number>(len)
  for (let i = 0; i < len; i++) {
    const hl = data[i].high - data[i].low
    const multiplier = hl !== 0
      ? ((data[i].close - data[i].low) - (data[i].high - data[i].close)) / hl
      : 0
    mfv[i] = multiplier * data[i].volume
  }

  for (let i = period - 1; i < len; i++) {
    let mfvSum = 0
    let volSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      mfvSum += mfv[j]
      volSum += data[j].volume
    }
    result[i] = volSum !== 0 ? mfvSum / volSum : 0
  }

  return result
}

export const cmfMeta: IndicatorMeta = {
  name: 'cmf',
  label: 'Chaikin Money Flow',
  category: 'volume',
  display: 'subchart',
  defaultParams: { period: 20 },
  paramSchema: CmfParamsSchema,
  outputs: ['value'],
  defaultColors: ['#14b8a6'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
