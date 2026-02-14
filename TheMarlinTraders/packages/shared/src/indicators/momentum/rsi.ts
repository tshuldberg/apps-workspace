import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, extractSource } from '../types.js'

export const RsiParamsSchema = z.object({
  period: z.number().int().min(1).default(14),
})

export function rsi(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period } = RsiParamsSchema.parse(params)
  const closes = extractSource(data, 'close')
  return rsiArray(closes, period)
}

export function rsiArray(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(NaN)
  if (values.length < period + 1) return result

  let avgGain = 0
  let avgLoss = 0

  // First average: simple average of first `period` changes
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1]
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  // Subsequent values use smoothed (Wilder's) method
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }

  return result
}

export const rsiMeta: IndicatorMeta = {
  name: 'rsi',
  label: 'RSI',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { period: 14 },
  paramSchema: RsiParamsSchema,
  outputs: ['value'],
  defaultColors: ['#a855f7'],
  referenceLines: [
    { value: 70, color: '#ef4444', label: 'Overbought' },
    { value: 30, color: '#22c55e', label: 'Oversold' },
  ],
}
