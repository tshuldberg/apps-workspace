import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const VwapBandsParamsSchema = z.object({
  multiplier1: z.number().min(0).default(1),
  multiplier2: z.number().min(0).default(2),
})

export function vwapBands(
  data: OHLCV[],
  params: Record<string, unknown>,
): { vwap: number[]; upper1: number[]; lower1: number[]; upper2: number[]; lower2: number[] } {
  const { multiplier1, multiplier2 } = VwapBandsParamsSchema.parse(params)
  const len = data.length

  const vwapLine = new Array<number>(len).fill(NaN)
  const upper1 = new Array<number>(len).fill(NaN)
  const lower1 = new Array<number>(len).fill(NaN)
  const upper2 = new Array<number>(len).fill(NaN)
  const lower2 = new Array<number>(len).fill(NaN)

  if (len === 0) return { vwap: vwapLine, upper1, lower1, upper2, lower2 }

  let cumPV = 0
  let cumV = 0
  let cumPV2 = 0
  let lastDate = -1

  for (let i = 0; i < len; i++) {
    const date = new Date(data[i].timestamp).getUTCDate()

    if (date !== lastDate) {
      cumPV = 0
      cumV = 0
      cumPV2 = 0
      lastDate = date
    }

    const tp = (data[i].high + data[i].low + data[i].close) / 3
    cumPV += tp * data[i].volume
    cumV += data[i].volume
    cumPV2 += tp * tp * data[i].volume

    if (cumV !== 0) {
      const vwapVal = cumPV / cumV
      const variance = cumPV2 / cumV - vwapVal * vwapVal
      const stdDev = Math.sqrt(Math.max(0, variance))

      vwapLine[i] = vwapVal
      upper1[i] = vwapVal + multiplier1 * stdDev
      lower1[i] = vwapVal - multiplier1 * stdDev
      upper2[i] = vwapVal + multiplier2 * stdDev
      lower2[i] = vwapVal - multiplier2 * stdDev
    }
  }

  return { vwap: vwapLine, upper1, lower1, upper2, lower2 }
}

export const vwapBandsMeta: IndicatorMeta = {
  name: 'vwap-bands',
  label: 'VWAP Bands',
  category: 'volume',
  display: 'overlay',
  defaultParams: { multiplier1: 1, multiplier2: 2 },
  paramSchema: VwapBandsParamsSchema,
  outputs: ['vwap', 'upper1', 'lower1', 'upper2', 'lower2'],
  defaultColors: ['#f59e0b', '#3b82f6', '#3b82f6', '#a855f7', '#a855f7'],
}
