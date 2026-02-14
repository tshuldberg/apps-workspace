import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'
import { smaArray } from '../trend/sma.js'

export const DpoParamsSchema = z.object({
  period: z.number().int().min(1).default(20),
  source: SourceSchema.default('close'),
})

export function dpo(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, source } = DpoParamsSchema.parse(params)
  const values = extractSource(data, source)
  const len = values.length
  const result = new Array<number>(len).fill(NaN)

  const smaValues = smaArray(values, period)
  const shift = Math.floor(period / 2) + 1

  for (let i = 0; i < len; i++) {
    const smaIdx = i + shift
    if (smaIdx < len && !isNaN(smaValues[smaIdx])) {
      // DPO[i] = close[i] - SMA[i + period/2 + 1]
      // Traditionally plotted shifted back
      result[i] = values[i] - smaValues[smaIdx]
    } else if (i >= period - 1 && !isNaN(smaValues[i])) {
      result[i] = values[i] - smaValues[i]
    }
  }

  return result
}

export const dpoMeta: IndicatorMeta = {
  name: 'dpo',
  label: 'Detrended Price Oscillator',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { period: 20, source: 'close' },
  paramSchema: DpoParamsSchema,
  outputs: ['value'],
  defaultColors: ['#f59e0b'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
