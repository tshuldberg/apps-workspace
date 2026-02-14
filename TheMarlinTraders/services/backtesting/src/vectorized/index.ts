export { VectorizedBacktester } from './engine.js'
export type {
  BacktestStrategy,
  BacktestConfig,
  BacktestResult,
  OpenPosition,
  Signal,
  SignalAction,
} from './engine.js'

export {
  simulateMarketFill,
  simulateLimitFill,
  simulateStopFill,
} from './fill-simulator.js'
export type { OrderSide, FillResult } from './fill-simulator.js'

export {
  calculateCommission,
  ZERO_COMMISSION,
  ALPACA_COMMISSION,
  IBKR_TIERED,
  IBKR_FIXED,
} from './commission.js'
export type { CommissionSchedule } from './commission.js'

export { calculateMetrics, calculateSharpeRatio, calculateSortinoRatio } from './metrics.js'
export type {
  BacktestMetrics,
  EquityPoint,
  CompletedTrade,
} from './metrics.js'
