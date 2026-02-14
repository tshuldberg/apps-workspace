import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const AdxParamsSchema = z.object({
  period: z.number().int().min(1).default(14),
})

export function adx(
  data: OHLCV[],
  params: Record<string, unknown>,
): { adx: number[]; diPlus: number[]; diMinus: number[] } {
  const { period } = AdxParamsSchema.parse(params)
  const len = data.length

  const adxResult = new Array<number>(len).fill(NaN)
  const diPlus = new Array<number>(len).fill(NaN)
  const diMinus = new Array<number>(len).fill(NaN)

  if (len < period * 2) return { adx: adxResult, diPlus, diMinus }

  // True Range, +DM, -DM
  const tr = new Array<number>(len).fill(0)
  const plusDM = new Array<number>(len).fill(0)
  const minusDM = new Array<number>(len).fill(0)

  for (let i = 1; i < len; i++) {
    tr[i] = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    )

    const upMove = data[i].high - data[i - 1].high
    const downMove = data[i - 1].low - data[i].low

    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0
  }

  // Smoothed sums (Wilder's smoothing)
  let smoothTR = 0
  let smoothPlusDM = 0
  let smoothMinusDM = 0

  for (let i = 1; i <= period; i++) {
    smoothTR += tr[i]
    smoothPlusDM += plusDM[i]
    smoothMinusDM += minusDM[i]
  }

  diPlus[period] = smoothTR !== 0 ? (smoothPlusDM / smoothTR) * 100 : 0
  diMinus[period] = smoothTR !== 0 ? (smoothMinusDM / smoothTR) * 100 : 0

  const dx = new Array<number>(len).fill(NaN)
  const diSum = diPlus[period] + diMinus[period]
  dx[period] = diSum !== 0 ? (Math.abs(diPlus[period] - diMinus[period]) / diSum) * 100 : 0

  for (let i = period + 1; i < len; i++) {
    smoothTR = smoothTR - smoothTR / period + tr[i]
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i]
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i]

    diPlus[i] = smoothTR !== 0 ? (smoothPlusDM / smoothTR) * 100 : 0
    diMinus[i] = smoothTR !== 0 ? (smoothMinusDM / smoothTR) * 100 : 0

    const s = diPlus[i] + diMinus[i]
    dx[i] = s !== 0 ? (Math.abs(diPlus[i] - diMinus[i]) / s) * 100 : 0
  }

  // ADX = smoothed DX (first = SMA, then Wilder's)
  let adxSum = 0
  const adxStart = period * 2
  for (let i = period; i < adxStart; i++) {
    adxSum += dx[i]
  }
  if (adxStart - 1 < len) {
    adxResult[adxStart - 1] = adxSum / period
  }

  for (let i = adxStart; i < len; i++) {
    adxResult[i] = (adxResult[i - 1] * (period - 1) + dx[i]) / period
  }

  return { adx: adxResult, diPlus, diMinus }
}

export const adxMeta: IndicatorMeta = {
  name: 'adx',
  label: 'ADX',
  category: 'complex',
  display: 'subchart',
  defaultParams: { period: 14 },
  paramSchema: AdxParamsSchema,
  outputs: ['adx', 'diPlus', 'diMinus'],
  defaultColors: ['#f59e0b', '#22c55e', '#ef4444'],
  referenceLines: [
    { value: 25, color: '#334155', label: 'Trend threshold' },
  ],
}
