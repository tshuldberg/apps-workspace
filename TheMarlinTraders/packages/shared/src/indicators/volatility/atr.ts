import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const AtrParamsSchema = z.object({
  period: z.number().int().min(1).default(14),
})

export function atr(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period } = AtrParamsSchema.parse(params)
  return atrArray(data, period)
}

export function atrArray(data: OHLCV[], period: number): number[] {
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len < period) return result

  // True Range
  const tr = new Array<number>(len)
  tr[0] = data[0].high - data[0].low
  for (let i = 1; i < len; i++) {
    tr[i] = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    )
  }

  // First ATR = simple average
  let sum = 0
  for (let i = 0; i < period; i++) sum += tr[i]
  result[period - 1] = sum / period

  // Subsequent = Wilder's smoothing
  for (let i = period; i < len; i++) {
    result[i] = (result[i - 1] * (period - 1) + tr[i]) / period
  }

  return result
}

export const atrMeta: IndicatorMeta = {
  name: 'atr',
  label: 'ATR',
  category: 'volatility',
  display: 'subchart',
  defaultParams: { period: 14 },
  paramSchema: AtrParamsSchema,
  outputs: ['value'],
  defaultColors: ['#f97316'],
}
