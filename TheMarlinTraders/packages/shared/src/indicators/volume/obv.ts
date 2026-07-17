import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const ObvParamsSchema = z.object({})

export function obv(data: OHLCV[], _params: Record<string, unknown>): number[] {
  ObvParamsSchema.parse(_params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len === 0) return result

  result[0] = data[0]!.volume

  for (let i = 1; i < len; i++) {
    const bar = data[i]!
    const prevBar = data[i - 1]!
    const prevObv = result[i - 1]!
    if (bar.close > prevBar.close) {
      result[i] = prevObv + bar.volume
    } else if (bar.close < prevBar.close) {
      result[i] = prevObv - bar.volume
    } else {
      result[i] = prevObv
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
