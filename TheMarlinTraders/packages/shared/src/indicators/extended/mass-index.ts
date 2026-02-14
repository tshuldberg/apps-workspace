import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'
import { emaArray } from '../trend/ema.js'

export const MassIndexParamsSchema = z.object({
  emaPeriod: z.number().int().min(1).default(9),
  sumPeriod: z.number().int().min(1).default(25),
})

export function massIndex(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { emaPeriod, sumPeriod } = MassIndexParamsSchema.parse(params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)

  // High - Low range
  const range = data.map((bar) => bar.high - bar.low)

  const singleEma = emaArray(range, emaPeriod)
  const doubleEma = emaArray(singleEma.map((v) => (isNaN(v) ? 0 : v)), emaPeriod)

  // EMA ratio
  const ratio = new Array<number>(len).fill(NaN)
  for (let i = 0; i < len; i++) {
    if (!isNaN(singleEma[i]) && !isNaN(doubleEma[i]) && doubleEma[i] !== 0) {
      ratio[i] = singleEma[i] / doubleEma[i]
    }
  }

  // Sum of ratios over sumPeriod
  for (let i = sumPeriod - 1; i < len; i++) {
    let sum = 0
    let valid = true
    for (let j = i - sumPeriod + 1; j <= i; j++) {
      if (isNaN(ratio[j])) {
        valid = false
        break
      }
      sum += ratio[j]
    }
    if (valid) result[i] = sum
  }

  return result
}

export const massIndexMeta: IndicatorMeta = {
  name: 'mass-index',
  label: 'Mass Index',
  category: 'volatility',
  display: 'subchart',
  defaultParams: { emaPeriod: 9, sumPeriod: 25 },
  paramSchema: MassIndexParamsSchema,
  outputs: ['value'],
  defaultColors: ['#a855f7'],
  referenceLines: [
    { value: 27, color: '#ef4444', label: 'Reversal Bulge' },
    { value: 26.5, color: '#334155' },
  ],
}
