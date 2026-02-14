import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'
import { smaArray } from '../trend/sma.js'

export const AwesomeOscillatorParamsSchema = z.object({})

export function awesomeOscillator(data: OHLCV[], _params: Record<string, unknown>): number[] {
  AwesomeOscillatorParamsSchema.parse(_params)
  const len = data.length
  const result = new Array<number>(len).fill(NaN)
  if (len < 34) return result

  // Median price = (high + low) / 2
  const median = data.map((bar) => (bar.high + bar.low) / 2)

  const sma5 = smaArray(median, 5)
  const sma34 = smaArray(median, 34)

  for (let i = 0; i < len; i++) {
    if (!isNaN(sma5[i]) && !isNaN(sma34[i])) {
      result[i] = sma5[i] - sma34[i]
    }
  }

  return result
}

export const awesomeOscillatorMeta: IndicatorMeta = {
  name: 'awesome-oscillator',
  label: 'Awesome Oscillator',
  category: 'momentum',
  display: 'subchart',
  defaultParams: {},
  paramSchema: AwesomeOscillatorParamsSchema,
  outputs: ['value'],
  defaultColors: ['#22c55e'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
