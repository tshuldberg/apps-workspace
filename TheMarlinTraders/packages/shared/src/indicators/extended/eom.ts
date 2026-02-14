import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'
import { smaArray } from '../trend/sma.js'

export const EomParamsSchema = z.object({
  period: z.number().int().min(1).default(14),
  divisor: z.number().default(100_000_000),
})

export function eom(data: OHLCV[], params: Record<string, unknown>): number[] {
  const { period, divisor } = EomParamsSchema.parse(params)
  const len = data.length
  const raw = new Array<number>(len).fill(NaN)

  for (let i = 1; i < len; i++) {
    const midMove = ((data[i].high + data[i].low) / 2) - ((data[i - 1].high + data[i - 1].low) / 2)
    const boxRatio = data[i].high - data[i].low
    if (boxRatio !== 0 && data[i].volume !== 0) {
      raw[i] = (midMove / (data[i].volume / divisor)) * boxRatio
    } else {
      raw[i] = 0
    }
  }

  // Smooth with SMA
  const validRaw = raw.map((v) => (isNaN(v) ? 0 : v))
  return smaArray(validRaw, period)
}

export const eomMeta: IndicatorMeta = {
  name: 'eom',
  label: 'Ease of Movement',
  category: 'volume',
  display: 'subchart',
  defaultParams: { period: 14, divisor: 100_000_000 },
  paramSchema: EomParamsSchema,
  outputs: ['value'],
  defaultColors: ['#22c55e'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
