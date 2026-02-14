import type { OptionType } from './types.js'

export type FlowSide = 'buy' | 'sell'
export type FlowSentiment = 'bullish' | 'bearish' | 'neutral'
export type FlowType = 'sweep' | 'block' | 'split' | 'multi_leg'

export interface FlowEntry {
  id: string
  timestamp: number
  symbol: string
  expiration: string // YYYY-MM-DD
  strike: number
  type: OptionType
  side: FlowSide
  volume: number
  openInterest: number
  premium: number // total premium in dollars
  sentiment: FlowSentiment
  flowType: FlowType
  unusualScore: number // 0-100
  exchange?: string
}

export interface FlowFilter {
  symbol?: string
  minPremium?: number
  flowType?: FlowType
  sentiment?: FlowSentiment
  timeRange?: number // minutes
}

export interface PutCallRatio {
  symbol: string
  ratio: number
  callVolume: number
  putVolume: number
  indexRatio?: number
}

export interface FlowSummary {
  totalPremium: number
  callPremium: number
  putPremium: number
  topBullish: FlowEntry[]
  topBearish: FlowEntry[]
}
