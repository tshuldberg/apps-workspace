import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import { type IndicatorMeta, SourceSchema, extractSource } from '../types.js'
import { smaArray } from '../trend/sma.js'
import { rocArray } from '../additional/roc.js'

export const KstParamsSchema = z.object({
  roc1: z.number().int().min(1).default(10),
  roc2: z.number().int().min(1).default(15),
  roc3: z.number().int().min(1).default(20),
  roc4: z.number().int().min(1).default(30),
  sma1: z.number().int().min(1).default(10),
  sma2: z.number().int().min(1).default(10),
  sma3: z.number().int().min(1).default(10),
  sma4: z.number().int().min(1).default(15),
  signal: z.number().int().min(1).default(9),
  source: SourceSchema.default('close'),
})

export function kst(
  data: OHLCV[],
  params: Record<string, unknown>,
): { kst: number[]; signal: number[] } {
  const p = KstParamsSchema.parse(params)
  const values = extractSource(data, p.source)
  const len = values.length

  const kstLine = new Array<number>(len).fill(NaN)
  const signalLine = new Array<number>(len).fill(NaN)

  const roc1 = rocArray(values, p.roc1)
  const roc2 = rocArray(values, p.roc2)
  const roc3 = rocArray(values, p.roc3)
  const roc4 = rocArray(values, p.roc4)

  const smaRoc1 = smaArray(roc1.map((v) => (isNaN(v) ? 0 : v)), p.sma1)
  const smaRoc2 = smaArray(roc2.map((v) => (isNaN(v) ? 0 : v)), p.sma2)
  const smaRoc3 = smaArray(roc3.map((v) => (isNaN(v) ? 0 : v)), p.sma3)
  const smaRoc4 = smaArray(roc4.map((v) => (isNaN(v) ? 0 : v)), p.sma4)

  const validKst: number[] = []
  for (let i = 0; i < len; i++) {
    if (!isNaN(smaRoc1[i]) && !isNaN(smaRoc2[i]) && !isNaN(smaRoc3[i]) && !isNaN(smaRoc4[i])) {
      kstLine[i] = smaRoc1[i] + 2 * smaRoc2[i] + 3 * smaRoc3[i] + 4 * smaRoc4[i]
      validKst.push(kstLine[i])
    }
  }

  const sigEma = smaArray(validKst, p.signal)
  const kstStart = len - validKst.length
  for (let i = 0; i < sigEma.length; i++) {
    signalLine[kstStart + i] = sigEma[i]
  }

  return { kst: kstLine, signal: signalLine }
}

export const kstMeta: IndicatorMeta = {
  name: 'kst',
  label: 'Know Sure Thing',
  category: 'momentum',
  display: 'subchart',
  defaultParams: {
    roc1: 10, roc2: 15, roc3: 20, roc4: 30,
    sma1: 10, sma2: 10, sma3: 10, sma4: 15,
    signal: 9, source: 'close',
  },
  paramSchema: KstParamsSchema,
  outputs: ['kst', 'signal'],
  defaultColors: ['#3b82f6', '#ef4444'],
  referenceLines: [{ value: 0, color: '#334155' }],
}
