import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, getSource } from '../types.js'

export const VwmaParamsSchema = z.object({
  period: z.number().int().min(1),
  source: SourceSchema.default('close'),
})

export function vwma(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, source } = VwmaParamsSchema.parse(params)
  const result = new Array<number>(data.length).fill(NaN)
  if (data.length < period) return result

  let sumPV = 0
  let sumV = 0

  for (let i = 0; i < period; i++) {
    const price = getSource(data[i], source)
    sumPV += price * data[i].volume
    sumV += data[i].volume
  }
  result[period - 1] = sumV !== 0 ? sumPV / sumV : NaN

  for (let i = period; i < data.length; i++) {
    const addPrice = getSource(data[i], source)
    const removePrice = getSource(data[i - period], source)
    sumPV += addPrice * data[i].volume - removePrice * data[i - period].volume
    sumV += data[i].volume - data[i - period].volume
    result[i] = sumV !== 0 ? sumPV / sumV : NaN
  }
  return result
}

export const vwmaMeta: IndicatorMeta = {
  name: 'vwma',
  label: 'VWMA',
  category: 'trend',
  display: 'overlay',
  defaultParams: { period: 20, source: 'close' },
  paramSchema: VwmaParamsSchema,
  outputs: ['value'],
  defaultColors: ['#14b8a6'],
}
