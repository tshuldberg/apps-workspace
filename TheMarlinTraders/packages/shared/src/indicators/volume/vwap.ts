import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const VwapParamsSchema = z.object({})

export function vwap(data: OHLCV[], _params: Record<string, unknown>): number[] {
  VwapParamsSchema.parse(_params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len === 0) return result

  // Session-anchored VWAP: resets each day
  let cumPV = 0
  let cumV = 0
  let lastDate = -1

  for (let i = 0; i < len; i++) {
    const date = new Date(data[i].timestamp).getUTCDate()

    // Detect new session (new day)
    if (date !== lastDate) {
      cumPV = 0
      cumV = 0
      lastDate = date
    }

    const tp = (data[i].high + data[i].low + data[i].close) / 3
    cumPV += tp * data[i].volume
    cumV += data[i].volume

    result[i] = cumV !== 0 ? cumPV / cumV : NaN
  }

  return result
}

export const vwapMeta: IndicatorMeta = {
  name: 'vwap',
  label: 'VWAP',
  category: 'volume',
  display: 'overlay',
  defaultParams: {},
  paramSchema: VwapParamsSchema,
  outputs: ['value'],
  defaultColors: ['#f59e0b'],
}
