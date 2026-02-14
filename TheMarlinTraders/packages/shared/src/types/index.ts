export type {
  Timeframe,
  OHLCV,
  NormalizedTrade,
  NormalizedBar,
  NormalizedQuote,
  SymbolInfo,
} from './market-data.js'
export { TimeframeSchema } from './market-data.js'

export type {
  AssetClass,
  CryptoSymbol,
  ForexPair,
  SessionDefinition,
  CurrencyStrength,
  MajorCurrency,
  LotType,
  CorrelationPeriod,
  CorrelationEntry,
  CorrelationMatrix,
} from './multi-asset.js'
export {
  AssetClassSchema,
  TOP_CRYPTO_PAIRS,
  MAJOR_FOREX_PAIRS,
  CROSS_FOREX_PAIRS,
  EXOTIC_FOREX_PAIRS,
  ALL_FOREX_PAIRS,
  FOREX_SESSIONS,
  MAJOR_CURRENCIES,
  LOT_SIZES,
  parseForexPair,
} from './multi-asset.js'

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
