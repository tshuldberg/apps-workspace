export {
  EventDrivenBacktester,
  EventQueue,
  PositionManager,
  type EventType,
  type BaseEvent,
  type PriceEvent,
  type FillEvent,
  type TimerEvent,
  type BarEvent,
  type BacktestEvent,
  type OrderSide,
  type OrderType,
  type OrderStatus,
  type Order,
  type Position,
  type CompletedTrade,
  type EngineConfig,
  type EngineCallbacks,
  type Strategy,
} from './engine.js'

export {
  OrderMatcher,
  type OrderMatcherConfig,
  type MatchResult,
} from './order-matching.js'

export {
  WalkForwardOptimizer,
  type WalkForwardConfig,
  type ParamGrid,
  type ParamSet,
  type StrategyFactory,
  type WindowMetrics,
  type WindowResult,
  type WalkForwardResult,
} from './walk-forward.js'

export {
  MonteCarloSimulator,
  type MonteCarloConfig,
  type PercentileDistribution,
  type SimulationPath,
  type MonteCarloResult,
  type RuinResult,
} from './monte-carlo.js'
