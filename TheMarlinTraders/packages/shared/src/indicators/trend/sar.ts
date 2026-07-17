import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const SarParamsSchema = z.object({
  step: z.number().min(0.001).default(0.02),
  max: z.number().min(0.01).default(0.2),
})

export function sar(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { step, max } = SarParamsSchema.parse(params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len < 2) return result

  const firstBar = data[0]!
  const secondBar = data[1]!
  let isLong = secondBar.close >= firstBar.close
  let af = step
  let ep = isLong ? firstBar.high : firstBar.low
  let sarValue = isLong ? firstBar.low : firstBar.high

  result[0] = sarValue

  for (let i = 1; i < len; i++) {
    const bar = data[i]!
    const prevBar = data[i - 1]!
    const prevSar = sarValue

    // Update SAR
    sarValue = prevSar + af * (ep - prevSar)

    if (isLong) {
      // Ensure SAR is not above the prior two lows
      if (i >= 2) {
        sarValue = Math.min(sarValue, prevBar.low, data[i - 2]!.low)
      } else {
        sarValue = Math.min(sarValue, prevBar.low)
      }

      // Check for reversal
      if (bar.low < sarValue) {
        isLong = false
        sarValue = ep
        ep = bar.low
        af = step
      } else {
        if (bar.high > ep) {
          ep = bar.high
          af = Math.min(af + step, max)
        }
      }
    } else {
      // Ensure SAR is not below the prior two highs
      if (i >= 2) {
        sarValue = Math.max(sarValue, prevBar.high, data[i - 2]!.high)
      } else {
        sarValue = Math.max(sarValue, prevBar.high)
      }

      // Check for reversal
      if (bar.high > sarValue) {
        isLong = true
        sarValue = ep
        ep = bar.high
        af = step
      } else {
        if (bar.low < ep) {
          ep = bar.low
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
