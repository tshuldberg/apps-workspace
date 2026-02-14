import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'
import { emaArray } from '../trend/ema.js'

export const PpoParamsSchema = z.object({
  fast: z.number().int().min(1).default(12),
  slow: z.number().int().min(1).default(26),
  signal: z.number().int().min(1).default(9),
  source: SourceSchema.default('close'),
})

export function ppo(
  data: OHLCV[],
  params: Record<string, unknown>,
): { ppo: number[]; signal: number[]; histogram: number[] } {
  const { fast, slow, signal, source } = PpoParamsSchema.parse(params)
  const values = extractSource(data, source)
  const len = values.length

  const emaFast = emaArray(values, fast)
  const emaSlow = emaArray(values, slow)

  const ppoLine = new Array<number>(len).fill(NaN)
  const validPpo: number[] = []

  for (let i = 0; i < len; i++) {
    if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i]) && emaSlow[i] !== 0) {
      ppoLine[i] = ((emaFast[i] - emaSlow[i]) / emaSlow[i]) * 100
      validPpo.push(ppoLine[i])
    }
  }

  const signalEma = emaArray(validPpo, signal)
  const signalLine = new Array<number>(len).fill(NaN)
  const histogram = new Array<number>(len).fill(NaN)
  const ppoStart = len - validPpo.length

  for (let i = 0; i < signalEma.length; i++) {
    const idx = ppoStart + i
    signalLine[idx] = signalEma[i]
    if (!isNaN(ppoLine[idx]) && !isNaN(signalEma[i])) {
      histogram[idx] = ppoLine[idx] - signalEma[i]
    }
  }

  return { ppo: ppoLine, signal: signalLine, histogram }
}

export const ppoMeta: IndicatorMeta = {
  name: 'ppo',
  label: 'Percentage Price Oscillator',
  category: 'momentum',
  display: 'subchart',
  defaultParams: { fast: 12, slow: 26, signal: 9, source: 'close' },
  paramSchema: PpoParamsSchema,
  outputs: ['ppo', 'signal', 'histogram'],
  defaultColors: ['#3b82f6', '#f59e0b', '#94a3b8'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
