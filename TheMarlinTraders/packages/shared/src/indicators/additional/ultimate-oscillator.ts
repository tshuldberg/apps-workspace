import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const UltimateOscillatorParamsSchema = z.object({
  period1: z.number().int().min(1).default(7),
  period2: z.number().int().min(1).default(14),
  period3: z.number().int().min(1).default(28),
})

export function ultimateOscillator(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period1, period2, period3 } = UltimateOscillatorParamsSchema.parse(params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  const maxPeriod = Math.max(period1, period2, period3)
  if (len < maxPeriod + 1) return result

  // Buying Pressure and True Range
  const bp = new Array<number>(len).fill(0)
  const tr = new Array<number>(len).fill(0)

  for (let i = 1; i < len; i++) {
    const low = Math.min(data[i].low, data[i - 1].close)
    bp[i] = data[i].close - low
    tr[i] = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    )
  }

  for (let i = maxPeriod; i < len; i++) {
    let bpSum1 = 0, trSum1 = 0
    let bpSum2 = 0, trSum2 = 0
    let bpSum3 = 0, trSum3 = 0

    for (let j = i - period1 + 1; j <= i; j++) {
      bpSum1 += bp[j]
      trSum1 += tr[j]
    }
    for (let j = i - period2 + 1; j <= i; j++) {
      bpSum2 += bp[j]
      trSum2 += tr[j]
    }
    for (let j = i - period3 + 1; j <= i; j++) {
      bpSum3 += bp[j]
      trSum3 += tr[j]
    }

    const avg1 = trSum1 !== 0 ? bpSum1 / trSum1 : 0
    const avg2 = trSum2 !== 0 ? bpSum2 / trSum2 : 0
    const avg3 = trSum3 !== 0 ? bpSum3 / trSum3 : 0

    result[i] = (100 * (4 * avg1 + 2 * avg2 + avg3)) / 7
  }

  return result
}

export const ultimateOscillatorMeta: IndicatorMeta = {
  name: 'ultimate-oscillator',
  label: 'Ultimate Oscillator',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { period1: 7, period2: 14, period3: 28 },
  paramSchema: UltimateOscillatorParamsSchema,
  outputs: ['value'],
  defaultColors: ['#06b6d4'],
  referenceLines: [
    { value: 70, color: '#ef4444', label: 'Overbought' },
    { value: 30, color: '#22c55e', label: 'Oversold' },
  ],
}
