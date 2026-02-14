export type {
  OptionType,
  Strike,
  Expiration,
  GreeksResult,
  OptionsContract,
  OptionsChainData,
  IVData,
} from './types.js'

export {
  blackScholesPrice,
  calculateGreeks,
  impliedVolatility,
  ivRank,
  ivPercentile,
} from './greeks.js'

export type {
  LegSide,
  StrategyLeg,
  Strategy,
  StrikeReference,
  StrategyCategory,
  RiskProfile,
  StrategyLegPattern,
  StrategyTemplate,
  PnLPoint,
} from './strategy-types.js'

export {
  calculatePnLAtExpiry,
  calculatePnLAtDate,
  calculateMaxProfit,
  calculateMaxLoss,
  calculateBreakevens,
  calculateProbOfProfit,
  calculateNetGreeks,
  calculateNetPremium,
  calculateLegPnLAtExpiry,
  getDefaultPriceRange,
} from './pnl-calculator.js'

export {
  STRATEGY_TEMPLATES,
  getTemplatesByCategory,
  getTemplateById,
  buildStrategyFromTemplate,
} from './strategy-templates.js'
