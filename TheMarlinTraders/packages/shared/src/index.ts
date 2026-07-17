export * from './types/index.js'
export * from './utils/index.js'
export * from './constants/index.js'
export * from './indicators/index.js'
export * from './options/index.js'
export * from './patterns/index.js'
export * from './orders/index.js'
export * from './futures/index.js'
export * from './strategy/index.js'

// Export non-conflicting forex utilities from the root barrel.
export {
  calculatePipValue,
  calculateLotSize,
  pipToPrice,
  priceToPip,
  unitsToLotLabel,
  calculateCurrencyStrength,
  computePairChanges,
  STRENGTH_PAIRS,
  calculateCorrelation,
  buildCorrelationMatrix,
  correlationLabel,
} from './forex/index.js'

// Disambiguate colliding exports from star barrels.
export {
  calculatePnL as calculateFuturesPnL,
  calculateMarginRequired as calculateFuturesMarginRequired,
} from './futures/index.js'

export {
  calculatePnL as calculateForexPnL,
  calculateMarginRequired as calculateForexMarginRequired,
} from './forex/index.js'

export {
  OPTIONS_STRATEGY_TEMPLATES,
  getTemplatesByCategory as getOptionsTemplatesByCategory,
  getTemplateById as getOptionsTemplateById,
  buildStrategyFromTemplate as buildOptionsStrategyFromTemplate,
} from './options/index.js'

export {
  STRATEGY_TEMPLATES as ALGO_STRATEGY_TEMPLATES,
  MA_CROSSOVER_TEMPLATE,
  RSI_MEAN_REVERSION_TEMPLATE,
  BREAKOUT_TEMPLATE,
  MACD_MOMENTUM_TEMPLATE,
  BOLLINGER_SQUEEZE_TEMPLATE,
  getStrategyTemplateById,
  getStrategyTemplatesByCategory,
} from './strategy/index.js'

export type {
  StrategyTemplate as AlgoStrategyTemplate,
} from './strategy/index.js'
