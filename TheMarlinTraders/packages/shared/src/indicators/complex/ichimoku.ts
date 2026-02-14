import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const IchimokuParamsSchema = z.object({
  tenkan: z.number().int().min(1).default(9),
  kijun: z.number().int().min(1).default(26),
  senkou: z.number().int().min(1).default(52),
})

function highLowMid(data: OHLCV[], start: number, period: number): number {
  let highest = -Infinity
  let lowest = Infinity
  for (let j = start; j < start + period; j++) {
    if (data[j].high > highest) highest = data[j].high
    if (data[j].low < lowest) lowest = data[j].low
  }
  return (highest + lowest) / 2
}

export function ichimoku(
  data: OHLCV[],
  params: Record<string, unknown>,
): { tenkan: number[]; kijun: number[]; senkouA: number[]; senkouB: number[]; chikou: number[] } {
  const { tenkan: tenkanPeriod, kijun: kijunPeriod, senkou: senkouPeriod } = IchimokuParamsSchema.parse(params)
  const len = data.length

  const tenkan = new Array<number>(len).fill(NaN)
  const kijun = new Array<number>(len).fill(NaN)
  const senkouA = new Array<number>(len).fill(NaN)
  const senkouB = new Array<number>(len).fill(NaN)
  const chikou = new Array<number>(len).fill(NaN)

  // Tenkan-sen (Conversion Line)
  for (let i = tenkanPeriod - 1; i < len; i++) {
    tenkan[i] = highLowMid(data, i - tenkanPeriod + 1, tenkanPeriod)
  }

  // Kijun-sen (Base Line)
  for (let i = kijunPeriod - 1; i < len; i++) {
    kijun[i] = highLowMid(data, i - kijunPeriod + 1, kijunPeriod)
  }

  // Senkou Span A (Leading Span A) — plotted kijunPeriod ahead
  for (let i = 0; i < len; i++) {
    if (!isNaN(tenkan[i]) && !isNaN(kijun[i])) {
      const targetIdx = i + kijunPeriod
      if (targetIdx < len) {
        senkouA[targetIdx] = (tenkan[i] + kijun[i]) / 2
      }
    }
  }

  // Senkou Span B (Leading Span B) — plotted kijunPeriod ahead
  for (let i = senkouPeriod - 1; i < len; i++) {
    const targetIdx = i + kijunPeriod
    if (targetIdx < len) {
      senkouB[targetIdx] = highLowMid(data, i - senkouPeriod + 1, senkouPeriod)
    }
  }

  // Chikou Span (Lagging Span) — plotted kijunPeriod behind
  for (let i = 0; i < len; i++) {
    const targetIdx = i - kijunPeriod
    if (targetIdx >= 0) {
      chikou[targetIdx] = data[i].close
    }
  }

  return { tenkan, kijun, senkouA, senkouB, chikou }
}

export const ichimokuMeta: IndicatorMeta = {
  name: 'ichimoku',
  label: 'Ichimoku Cloud',
  category: 'complex',
  display: 'overlay',
  defaultParams: { tenkan: 9, kijun: 26, senkou: 52 },
  paramSchema: IchimokuParamsSchema,
  outputs: ['tenkan', 'kijun', 'senkouA', 'senkouB', 'chikou'],
  defaultColors: ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7'],
}
