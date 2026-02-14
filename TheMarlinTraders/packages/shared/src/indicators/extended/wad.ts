import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const WadParamsSchema = z.object({})

export function wad(data: OHLCV[], _params: Record<string, unknown>): number[] {
  WadParamsSchema.parse(_params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len === 0) return result

  result[0] = 0

  for (let i = 1; i < len; i++) {
    const trueHigh = Math.max(data[i].high, data[i - 1].close)
    const trueLow = Math.min(data[i].low, data[i - 1].close)

    let ad: number
    if (data[i].close > data[i - 1].close) {
      ad = data[i].close - trueLow
    } else if (data[i].close < data[i - 1].close) {
      ad = data[i].close - trueHigh
    } else {
      ad = 0
    }

    result[i] = result[i - 1] + ad
  }

  return result
}

export const wadMeta: IndicatorMeta = {
  name: 'wad',
  label: 'Williams Accumulation/Distribution',
  category: 'volume',
  display: 'subchart',
  defaultParams: {},
  paramSchema: WadParamsSchema,
  outputs: ['value'],
  defaultColors: ['#14b8a6'],
}
