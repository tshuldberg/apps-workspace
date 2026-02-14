import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const SarParamsSchema = z.object({
  step: z.number().min(0.001).default(0.02),
  max: z.number().min(0.01).default(0.2),
})

export function sar(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { step, max } = SarParamsSchema.parse(params)
  const result = new Array<number>(data.length).fill(NaN)
  if (data.length < 2) return result

  let isLong = data[1].close >= data[0].close
  let af = step
  let ep = isLong ? data[0].high : data[0].low
  let sarValue = isLong ? data[0].low : data[0].high

  result[0] = sarValue

  for (let i = 1; i < data.length; i++) {
    const prevSar = sarValue

    // Update SAR
    sarValue = prevSar + af * (ep - prevSar)

    if (isLong) {
      // Ensure SAR is not above the prior two lows
      if (i >= 2) {
        sarValue = Math.min(sarValue, data[i - 1].low, data[i - 2].low)
      } else {
        sarValue = Math.min(sarValue, data[i - 1].low)
      }

      // Check for reversal
      if (data[i].low < sarValue) {
        isLong = false
        sarValue = ep
        ep = data[i].low
        af = step
      } else {
        if (data[i].high > ep) {
          ep = data[i].high
          af = Math.min(af + step, max)
        }
      }
    } else {
      // Ensure SAR is not below the prior two highs
      if (i >= 2) {
        sarValue = Math.max(sarValue, data[i - 1].high, data[i - 2].high)
      } else {
        sarValue = Math.max(sarValue, data[i - 1].high)
      }

      // Check for reversal
      if (data[i].high > sarValue) {
        isLong = true
        sarValue = ep
        ep = data[i].high
        af = step
      } else {
        if (data[i].low < ep) {
          ep = data[i].low
          af = Math.min(af + step, max)
        }
      }
    }

    result[i] = sarValue
  }

  return result
}

export const sarMeta: IndicatorMeta = {
  name: 'sar',
  label: 'Parabolic SAR',
  category: 'trend',
  display: 'overlay',
  defaultParams: { step: 0.02, max: 0.2 },
  paramSchema: SarParamsSchema,
  outputs: ['value'],
  defaultColors: ['#06b6d4'],
}
