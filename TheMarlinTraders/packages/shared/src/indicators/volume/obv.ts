import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const ObvParamsSchema = z.object({})

export function obv(data: OHLCV[], _params: Record<string, unknown>): number[] {
  ObvParamsSchema.parse(_params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len === 0) return result

  result[0] = data[0].volume

  for (let i = 1; i < len; i++) {
    if (data[i].close > data[i - 1].close) {
      result[i] = result[i - 1] + data[i].volume
    } else if (data[i].close < data[i - 1].close) {
      result[i] = result[i - 1] - data[i].volume
    } else {
      result[i] = result[i - 1]
    }
  }

  return result
}

export const obvMeta: IndicatorMeta = {
  name: 'obv',
  label: 'OBV',
  category: 'volume',
  display: 'subchart',
  defaultParams: {},
  paramSchema: ObvParamsSchema,
  outputs: ['value'],
  defaultColors: ['#3b82f6'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
