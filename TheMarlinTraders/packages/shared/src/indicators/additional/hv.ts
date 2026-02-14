import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, extractSource } from '../types.js'

export const HvParamsSchema = z.object({
  period: z.number().int().min(2).default(20),
})

export function hv(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period } = HvParamsSchema.parse(params)
  const closes = extractSource(data, 'close')
  return hvArray(closes, period)
}

export function hvArray(values: number[], period: number): number[] {
  const len = values.length
  const result = new Array<number>(len).fill(NaN)
  if (len < period + 1) return result

  // Log returns
  const logReturns = new Array<number>(len).fill(NaN)
  for (let i = 1; i < len; i++) {
    if (values[i - 1] > 0 && values[i] > 0) {
      logReturns[i] = Math.log(values[i] / values[i - 1])
    }
  }

  for (let i = period; i < len; i++) {
    let sum = 0
    let count = 0
    for (let j = i - period + 1; j <= i; j++) {
      if (!isNaN(logReturns[j])) {
        sum += logReturns[j]
        count++
      }
    }
    if (count < 2) continue
    const mean = sum / count

    let sqSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      if (!isNaN(logReturns[j])) {
        sqSum += (logReturns[j] - mean) ** 2
      }
    }

    // Annualize: multiply by sqrt(252 trading days)
    const variance = sqSum / (count - 1)
    result[i] = Math.sqrt(variance * 252) * 100
  }

  return result
}

export const hvMeta: IndicatorMeta = {
  name: 'hv',
  label: 'Historical Volatility',
  category: 'volatility',
  display: 'subchart',
  defaultParams: { period: 20 },
  paramSchema: HvParamsSchema,
  outputs: ['value'],
  defaultColors: ['#eab308'],
}
