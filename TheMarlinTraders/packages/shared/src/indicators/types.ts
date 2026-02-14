import { z } from 'zod'
import type { OHLCV } from '../types/market-data.js'

export const SourceSchema = z.enum(['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'])
export type Source = z.infer<typeof SourceSchema>

export type IndicatorCategory = 'trend' | 'momentum' | 'volume' | 'volatility' | 'complex'
export type IndicatorDisplay = 'overlay' | 'subchart'

export interface IndicatorMeta {
  name: string
  label: string
  category: IndicatorCategory
  display: IndicatorDisplay
  defaultParams: Record<string, number | string>
  paramSchema: z.ZodType
  outputs: string[]
  defaultColors: string[]
  referenceLines?: { value: number; color: string; label?: string }[]
}

export type IndicatorResult =
  | number[]
  | { [key: string]: number[] }

export type IndicatorFn = (data: OHLCV[], params: Record<string, unknown>) => IndicatorResult

export function getSource(bar: OHLCV, source: Source): number {
  switch (source) {
    case 'close': return bar.close
    case 'open': return bar.open
    case 'high': return bar.high
    case 'low': return bar.low
    case 'hl2': return (bar.high + bar.low) / 2
    case 'hlc3': return (bar.high + bar.low + bar.close) / 3
    case 'ohlc4': return (bar.open + bar.high + bar.low + bar.close) / 4
  }
}

export function extractSource(data: OHLCV[], source: Source = 'close'): number[] {
  return data.map((bar) => getSource(bar, source))
}
