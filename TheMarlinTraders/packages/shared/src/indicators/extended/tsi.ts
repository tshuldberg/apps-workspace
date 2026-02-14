import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, extractSource } from '../types.js'
import { emaArray } from '../trend/ema.js'

export const TsiParamsSchema = z.object({
  longPeriod: z.number().int().min(1).default(25),
  shortPeriod: z.number().int().min(1).default(13),
  signal: z.number().int().min(1).default(7),
})

export function tsi(
  data: OHLCV[],
  params: Record<string, unknown>,
): { tsi: number[]; signal: number[] } {
  const { longPeriod, shortPeriod, signal } = TsiParamsSchema.parse(params)
  const closes = extractSource(data, 'close')
  const len = closes.length

  const tsiLine = new Array<number>(len).fill(NaN)
  const signalLine = new Array<number>(len).fill(NaN)

  if (len < 2) return { tsi: tsiLine, signal: signalLine }

  // Price change
  const pc = new Array<number>(len).fill(0)
  const absPC = new Array<number>(len).fill(0)
  for (let i = 1; i < len; i++) {
    pc[i] = closes[i] - closes[i - 1]
    absPC[i] = Math.abs(pc[i])
  }

  // Double smoothed
  const pcSmooth1 = emaArray(pc, longPeriod)
  const pcSmooth2 = emaArray(pcSmooth1.map((v) => (isNaN(v) ? 0 : v)), shortPeriod)

  const absPcSmooth1 = emaArray(absPC, longPeriod)
  const absPcSmooth2 = emaArray(absPcSmooth1.map((v) => (isNaN(v) ? 0 : v)), shortPeriod)

  const validTsi: number[] = []
  for (let i = 0; i < len; i++) {
    if (!isNaN(pcSmooth2[i]) && !isNaN(absPcSmooth2[i]) && absPcSmooth2[i] !== 0) {
      tsiLine[i] = (pcSmooth2[i] / absPcSmooth2[i]) * 100
      validTsi.push(tsiLine[i])
    }
  }

  const sigEma = emaArray(validTsi, signal)
  const tsiStart = len - validTsi.length
  for (let i = 0; i < sigEma.length; i++) {
    signalLine[tsiStart + i] = sigEma[i]
  }

  return { tsi: tsiLine, signal: signalLine }
}

export const tsiMeta: IndicatorMeta = {
  name: 'tsi',
  label: 'True Strength Index',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { longPeriod: 25, shortPeriod: 13, signal: 7 },
  paramSchema: TsiParamsSchema,
  outputs: ['tsi', 'signal'],
  defaultColors: ['#3b82f6', '#ef4444'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
