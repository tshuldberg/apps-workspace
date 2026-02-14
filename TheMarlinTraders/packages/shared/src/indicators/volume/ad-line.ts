import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const AdLineParamsSchema = z.object({})

export function adLine(data: OHLCV[], _params: Record<string, unknown>): number[] {
  AdLineParamsSchema.parse(_params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len === 0) return result

  let cumAD = 0

  for (let i = 0; i < len; i++) {
    const range = data[i].high - data[i].low
    // Money Flow Multiplier
    const mfm = range === 0 ? 0 : ((data[i].close - data[i].low) - (data[i].high - data[i].close)) / range
    // Money Flow Volume
    const mfv = mfm * data[i].volume
    cumAD += mfv
    result[i] = cumAD
  }

  return result
}

export const adLineMeta: IndicatorMeta = {
  name: 'ad-line',
  label: 'A/D Line',
  category: 'volume',
  display: 'subchart',
  defaultParams: {},
  paramSchema: AdLineParamsSchema,
  outputs: ['value'],
  defaultColors: ['#22c55e'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
