export {
  pearson,
  queryCorrelation,
  queryTrends,
  querySummary,
  discoverInsights,
} from './engine';
export type {
  CorrelationResult,
  TrendResult,
  TrendPoint,
  SummaryResult,
  InsightCard,
} from './types';
export { MIN_CORRELATION_POINTS, CORRELATION_THRESHOLD } from './types';
