import { z } from 'zod'

// ── Strategy Parameter ─────────────────────────────────────────────────────

export const StrategyParameterSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(['number', 'string', 'boolean']),
  default: z.union([z.number(), z.string(), z.boolean()]),
  min: z.number().optional(),
  max: z.number().optional(),
  description: z.string().optional(),
})

export type StrategyParameter = z.infer<typeof StrategyParameterSchema>

// ── Strategy Language ──────────────────────────────────────────────────────

export const StrategyLanguageSchema = z.enum(['typescript', 'python', 'pine'])

export type StrategyLanguage = z.infer<typeof StrategyLanguageSchema>

// ── Strategy Config ────────────────────────────────────────────────────────

export const StrategyConfigSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(1024).optional(),
  language: StrategyLanguageSchema,
  parameters: z.array(StrategyParameterSchema).default([]),
})

export type StrategyConfig = z.infer<typeof StrategyConfigSchema>

// ── Strategy Signal ────────────────────────────────────────────────────────

export const StrategySignalSchema = z.object({
  timestamp: z.string().datetime(),
  action: z.enum(['buy', 'sell', 'hold']),
  symbol: z.string().min(1).max(20),
  quantity: z.number().positive(),
  price: z.number().positive(),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
})

export type StrategySignal = z.infer<typeof StrategySignalSchema>

// ── Backtest Config ────────────────────────────────────────────────────────

export const BacktestConfigSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  initialCapital: z.number().positive().default(100_000),
  commission: z.object({
    perShare: z.number().min(0).default(0),
    perTrade: z.number().min(0).default(0),
  }).default({ perShare: 0, perTrade: 0 }),
  slippage: z.number().min(0).max(1).default(0.001),
})

export type BacktestConfig = z.infer<typeof BacktestConfigSchema>

// ── Backtest Trade ─────────────────────────────────────────────────────────

export const BacktestTradeSchema = z.object({
  id: z.string(),
  entryDate: z.string().datetime(),
  exitDate: z.string().datetime(),
  side: z.enum(['long', 'short']),
  entryPrice: z.number().positive(),
  exitPrice: z.number().positive(),
  quantity: z.number().positive(),
  pnl: z.number(),
  pnlPercent: z.number(),
  commission: z.number().min(0),
  holdingPeriodBars: z.number().int().positive(),
  reason: z.string().optional(),
})

export type BacktestTrade = z.infer<typeof BacktestTradeSchema>

// ── Equity Point ───────────────────────────────────────────────────────────

export const EquityPointSchema = z.object({
  date: z.string(),
  equity: z.number(),
  drawdown: z.number(),
})

export type EquityPoint = z.infer<typeof EquityPointSchema>

// ── Backtest Metrics ───────────────────────────────────────────────────────

export const BacktestMetricsSchema = z.object({
  totalReturn: z.number(),
  sharpe: z.number(),
  sortino: z.number(),
  maxDrawdown: z.number(),
  winRate: z.number().min(0).max(1),
  profitFactor: z.number(),
  totalTrades: z.number().int().min(0),
  avgWin: z.number(),
  avgLoss: z.number(),
  expectancy: z.number(),
})

export type BacktestMetrics = z.infer<typeof BacktestMetricsSchema>

// ── Backtest Result ────────────────────────────────────────────────────────

export const BacktestResultSchema = z.object({
  trades: z.array(BacktestTradeSchema),
  equity: z.array(EquityPointSchema),
  metrics: BacktestMetricsSchema,
})

export type BacktestResult = z.infer<typeof BacktestResultSchema>

// ── Strategy Category ──────────────────────────────────────────────────────

export const StrategyCategorySchema = z.enum([
  'trend',
  'mean-reversion',
  'breakout',
  'momentum',
  'volatility',
])

export type StrategyCategory = z.infer<typeof StrategyCategorySchema>

// ── Strategy Template ──────────────────────────────────────────────────────

export const StrategyTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(128),
  description: z.string().max(1024),
  language: StrategyLanguageSchema,
  category: StrategyCategorySchema,
  code: z.string().min(1),
  parameters: z.array(StrategyParameterSchema),
})

export type StrategyTemplate = z.infer<typeof StrategyTemplateSchema>

// ── Strategy File ──────────────────────────────────────────────────────────

export const StrategyFileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  name: z.string().min(1).max(128),
  description: z.string().max(1024).optional(),
  language: StrategyLanguageSchema,
  code: z.string(),
  parameters: z.array(StrategyParameterSchema).default([]),
  isPublic: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type StrategyFile = z.infer<typeof StrategyFileSchema>

// ── Strategy Run Status ────────────────────────────────────────────────────

export const StrategyRunStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
])

export type StrategyRunStatus = z.infer<typeof StrategyRunStatusSchema>
