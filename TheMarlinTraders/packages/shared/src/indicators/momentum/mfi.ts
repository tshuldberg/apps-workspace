import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const MfiParamsSchema = z.object({
  period: z.number().int().min(1).default(14),
})

export function mfi(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period } = MfiParamsSchema.parse(params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len < period + 1) return result

  // Typical price * volume = raw money flow
  const tp = data.map((bar) => (bar.high + bar.low + bar.close) / 3)

  for (let i = period; i < len; i++) {
    let posFlow = 0
    let negFlow = 0
    for (let j = i - period + 1; j <= i; j++) {
      const flow = tp[j] * data[j].volume
      if (tp[j] > tp[j - 1]) {
        posFlow += flow
      } else if (tp[j] < tp[j - 1]) {
        negFlow += flow
      }
    }

    result[i] = negFlow === 0 ? 100 : 100 - 100 / (1 + posFlow / negFlow)
  }

  return result
}

export const mfiMeta: IndicatorMeta = {
  name: 'mfi',
  label: 'MFI',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { period: 14 },
  paramSchema: MfiParamsSchema,
  outputs: ['value'],
  defaultColors: ['#f97316'],
  referenceLines: [
    { value: 80, color: '#ef4444', label: 'Overbought' },
    { value: 20, color: '#22c55e', label: 'Oversold' },
  ],
}
