import { z } from 'zod'

export const TimeframeSchema = z.enum([
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1D',
  '1W',
  '1M',
])
export type Timeframe = z.infer<typeof TimeframeSchema>

export interface OHLCV {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

export interface NormalizedTrade {
  symbol: string
  price: number
  size: number
  timestamp: number
  conditions?: string[]
  exchange?: string
}

export interface NormalizedBar extends OHLCV {
  symbol: string
  timeframe: Timeframe
  vwap?: number
  tradeCount?: number
}

export interface NormalizedQuote {
  symbol: string
  bidPrice: number
  bidSize: number
  askPrice: number
  askSize: number
  timestamp: number
}

export interface SymbolInfo {
  symbol: string
  name: string
  exchange: string
  type: 'stock' | 'etf' | 'crypto' | 'forex' | 'future' | 'option'
  currency: string
  marketCap?: number
  sector?: string
  industry?: string
}
