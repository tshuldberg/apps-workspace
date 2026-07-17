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
    const fastValue = emaFast[i]
    const slowValue = emaSlow[i]
    if (fastValue !== undefined && slowValue !== undefined && !isNaN(fastValue) && !isNaN(slowValue) && slowValue !== 0) {
      ppoLine[i] = ((fastValue - slowValue) / slowValue) * 100
      validPpo.push(ppoLine[i]!)
    }
  }

  const signalEma = emaArray(validPpo, signal)
  const signalLine = new Array<number>(len).fill(NaN)
  const histogram = new Array<number>(len).fill(NaN)
  const ppoStart = len - validPpo.length

  for (let i = 0; i < signalEma.length; i++) {
    const idx = ppoStart + i
    const signalValue = signalEma[i]
    const ppoValue = ppoLine[idx]
    if (signalValue === undefined || ppoValue === undefined) continue
    signalLine[idx] = signalValue
    if (!isNaN(ppoValue) && !isNaN(signalValue)) {
      histogram[idx] = ppoValue - signalValue
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
