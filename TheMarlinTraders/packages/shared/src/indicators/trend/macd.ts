import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, extractSource } from '../types.js'
import { emaArray } from './ema.js'

export const MacdParamsSchema = z.object({
  fast: z.number().int().min(1).default(12),
  slow: z.number().int().min(1).default(26),
  signal: z.number().int().min(1).default(9),
})

export function macd(
  data: OHLCV[],
  params: Record<string, unknown>,
): { macd: number[]; signal: number[]; histogram: number[] } {
  const { fast, slow, signal } = MacdParamsSchema.parse(params)
  const closes = extractSource(data, 'close')

  const emaFast = emaArray(closes, fast)
  const emaSlow = emaArray(closes, slow)

  // MACD line = fast EMA - slow EMA
  const macdLine = new Array<number>(closes.length).fill(NaN)
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) {
      macdLine[i] = emaFast[i] - emaSlow[i]
    }
  }

  // Signal line = EMA of MACD line
  const validMacd = macdLine.filter((v) => !isNaN(v))
  const signalValid = emaArray(validMacd, signal)

  const signalLine = new Array<number>(closes.length).fill(NaN)
  const histogram = new Array<number>(closes.length).fill(NaN)
  const macdStart = closes.length - validMacd.length

  for (let i = 0; i < signalValid.length; i++) {
    const idx = macdStart + i
    signalLine[idx] = signalValid[i]
    if (!isNaN(macdLine[idx]) && !isNaN(signalValid[i])) {
      histogram[idx] = macdLine[idx] - signalValid[i]
    }
  }

  return { macd: macdLine, signal: signalLine, histogram }
}

export const macdMeta: IndicatorMeta = {
  name: 'macd',
  label: 'MACD',
  category: 'trend',
  display: 'subchart',
  defaultParams: { fast: 12, slow: 26, signal: 9 },
  paramSchema: MacdParamsSchema,
  outputs: ['macd', 'signal', 'histogram'],
  defaultColors: ['#3b82f6', '#f59e0b', '#94a3b8'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
