export type {
  Timeframe,
  OHLCV,
  NormalizedTrade,
  NormalizedBar,
  NormalizedQuote,
  SymbolInfo,
} from './market-data.js'
export { TimeframeSchema } from './market-data.js'

export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  tier: 'free' | 'pro' | 'elite'
  createdAt: Date
}

export interface Workspace {
  id: string
  name: string
  ownerId: string
  layouts: string[]
  createdAt: Date
  updatedAt: Date
}
