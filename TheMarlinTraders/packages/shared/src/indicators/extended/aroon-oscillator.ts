import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'
import { aroon } from '../complex/aroon.js'

export const AroonOscillatorParamsSchema = z.object({
  period: z.number().int().min(1).default(25),
})

export function aroonOscillator(data: OHLCV[], params: Record<string, unknown>): number[] {
  const parsed = AroonOscillatorParamsSchema.parse(params)
  const { up, down } = aroon(data, { period: parsed.period })
  const len = data.length
  const result = new Array<number>(len).fill(NaN)

  for (let i = 0; i < len; i++) {
    if (!isNaN(up[i]) && !isNaN(down[i])) {
      result[i] = up[i] - down[i]
    }
  }

  return result
}

export const aroonOscillatorMeta: IndicatorMeta = {
  name: 'aroon-oscillator',
  label: 'Aroon Oscillator',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { period: 25 },
  paramSchema: AroonOscillatorParamsSchema,
  outputs: ['value'],
  defaultColors: ['#a855f7'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
