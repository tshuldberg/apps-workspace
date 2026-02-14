import type { GreeksResult, OptionType } from './types.js'

export type LegSide = 'buy' | 'sell'

export interface StrategyLeg {
  /** Unique identifier for the leg (used for reorder/delete) */
  id: string
  side: LegSide
  type: OptionType
  strike: number
  expiration: string // YYYY-MM-DD
  quantity: number
  premium: number // per-contract price (mid or fill)
  greeks?: GreeksResult
}

export interface Strategy {
  name: string
  legs: StrategyLeg[]
  underlyingPrice: number
}

export type StrikeReference =
  | 'ATM'
  | 'ATM+1'
  | 'ATM+2'
  | 'ATM+3'
  | 'ATM+5'
  | 'ATM+10'
  | 'ATM-1'
  | 'ATM-2'
  | 'ATM-3'
  | 'ATM-5'
  | 'ATM-10'

export type StrategyCategory =
  | 'Directional'
  | 'Spreads'
  | 'Income'
  | 'Volatility'
  | 'Calendar'
  | 'Advanced'

export type RiskProfile = 'defined' | 'undefined' | 'mixed'

export interface StrategyLegPattern {
  side: LegSide
  type: OptionType
  strikeRef: StrikeReference
  quantity: number
}

export interface StrategyTemplate {
  id: string
  name: string
  description: string
  category: StrategyCategory
  riskProfile: RiskProfile
  legPattern: StrategyLegPattern[]
}

export interface PnLPoint {
  price: number
  pnl: number
}
