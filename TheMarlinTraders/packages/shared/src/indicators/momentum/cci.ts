import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const CciParamsSchema = z.object({
  period: z.number().int().min(1).default(20),
})

export function cci(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period } = CciParamsSchema.parse(params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len < period) return result

  // Typical price
  const tp = data.map((bar) => (bar.high + bar.low + bar.close) / 3)

  for (let i = period - 1; i < len; i++) {
    // SMA of typical price
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += tp[j]
    }
    const mean = sum / period

    // Mean deviation
    let meanDev = 0
    for (let j = i - period + 1; j <= i; j++) {
      meanDev += Math.abs(tp[j] - mean)
    }
    meanDev /= period

    result[i] = meanDev === 0 ? 0 : (tp[i] - mean) / (0.015 * meanDev)
  }

  return result
}

export const cciMeta: IndicatorMeta = {
  name: 'cci',
  label: 'CCI',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { period: 20 },
  paramSchema: CciParamsSchema,
  outputs: ['value'],
  defaultColors: ['#14b8a6'],
  referenceLines: [
    { value: 100, color: '#ef4444', label: '+100' },
    { value: -100, color: '#22c55e', label: '-100' },
    { value: 0, color: '#334155' },
  ],
}
