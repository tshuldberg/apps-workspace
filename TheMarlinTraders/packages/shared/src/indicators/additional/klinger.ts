import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'
import { emaArray } from '../trend/ema.js'

export const KlingerParamsSchema = z.object({
  fast: z.number().int().min(1).default(34),
  slow: z.number().int().min(1).default(55),
  signal: z.number().int().min(1).default(13),
})

export function klinger(
  data: OHLCV[],
  params: Record<string, unknown>,
): { kvo: number[]; signal: number[] } {
  const { fast, slow, signal } = KlingerParamsSchema.parse(params)
  const len = data.length
  const kvoLine = new Array<number>(len).fill(NaN)
  const signalLine = new Array<number>(len).fill(NaN)

  if (len < 2) return { kvo: kvoLine, signal: signalLine }

  // Volume Force
  const vf = new Array<number>(len).fill(0)
  let prevTrend = 0

  for (let i = 1; i < len; i++) {
    const bar = data[i]!
    const prevBar = data[i - 1]!
    const hlc = bar.high + bar.low + bar.close
    const prevHlc = prevBar.high + prevBar.low + prevBar.close
    const trend = hlc > prevHlc ? 1 : hlc < prevHlc ? -1 : prevTrend
    const dm = bar.high - bar.low
    const cm = i > 0 && trend === prevTrend
      ? (vf[i - 1]! !== 0 ? dm + Math.abs(dm) : dm)
      : dm
    vf[i] = cm !== 0 ? bar.volume * Math.abs(2 * (dm / cm) - 1) * trend : 0
    prevTrend = trend
  }

  const emaFast = emaArray(vf, fast)
  const emaSlow = emaArray(vf, slow)

  const validKvo: number[] = []
  for (let i = 0; i < len; i++) {
    const fastValue = emaFast[i]
    const slowValue = emaSlow[i]
    if (fastValue !== undefined && slowValue !== undefined && !isNaN(fastValue) && !isNaN(slowValue)) {
      kvoLine[i] = fastValue - slowValue
      validKvo.push(kvoLine[i]!)
    }
  }

  const signalEma = emaArray(validKvo, signal)
  const kvoStart = len - validKvo.length
  for (let i = 0; i < signalEma.length; i++) {
    signalLine[kvoStart + i] = signalEma[i]!
  }

  return { kvo: kvoLine, signal: signalLine }
}

export const klingerMeta: IndicatorMeta = {
  name: 'klinger',
  label: 'Klinger Volume Oscillator',
  category: 'volume',
  display: 'subchart',
  defaultParams: { fast: 34, slow: 55, signal: 13 },
  paramSchema: KlingerParamsSchema,
  outputs: ['kvo', 'signal'],
  defaultColors: ['#3b82f6', '#f59e0b'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
