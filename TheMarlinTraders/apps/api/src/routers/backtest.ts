/**
 * Backtest Router
 * Sprint 41-42: Vectorized Backtesting Engine
 *
 * tRPC router for running backtests, retrieving results, and comparing
 * multiple backtest runs side-by-side.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc.js'
import { VectorizedBacktester } from '@marlin/backtesting/vectorized'
import { generateMockBars } from '@marlin/backtesting/data'
import type { BacktestStrategy, BacktestResult, Signal, OpenPosition } from '@marlin/backtesting/vectorized'
import type { OHLCV, Timeframe } from '@marlin/shared'

// ── Schemas ───────────────────────────────────────────────────────────────

const BacktestConfigSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W', '1M']).default('1D'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  initialCapital: z.number().positive().default(100_000),
  positionSize: z.number().int().positive().default(100),
  slippageBps: z.number().min(0).max(100).default(0),
  commission: z
    .object({
      perShare: z.number().min(0).default(0),
      perTrade: z.number().min(0).default(0),
      minimum: z.number().min(0).default(0),
      maximum: z.number().min(0).default(0),
    })
    .optional(),
})

const StrategyCodeSchema = z.object({
  /** Strategy type identifier */
  type: z.enum(['buy_and_hold', 'ma_crossover', 'rsi_mean_reversion']),
  /** Strategy-specific parameters */
  params: z.record(z.number()).default({}),
})

const RunBacktestSchema = z.object({
  strategy: StrategyCodeSchema,
  config: BacktestConfigSchema,
})

const GetHistorySchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
})

const GetResultSchema = z.object({
  id: z.string().uuid(),
})

const CompareSchema = z.object({
  ids: z.array(z.string().uuid()).min(2).max(3),
})

// ── In-Memory Store (until DB schema is wired) ────────────────────────────

interface StoredBacktestRun {
  id: string
  userId: string
  strategyType: string
  strategyParams: Record<string, number>
  symbol: string
  timeframe: string
  result: BacktestResult
  createdAt: Date
}

const backtestStore = new Map<string, StoredBacktestRun>()

// ── Strategy Factory ──────────────────────────────────────────────────────

function createStrategy(
  type: string,
  params: Record<string, number>,
): BacktestStrategy {
  switch (type) {
    case 'buy_and_hold':
      return createBuyAndHoldStrategy()
    case 'ma_crossover':
      return createMACrossoverStrategy(
        params.fastPeriod ?? 10,
        params.slowPeriod ?? 30,
      )
    case 'rsi_mean_reversion':
      return createRSIMeanReversionStrategy(
        params.period ?? 14,
        params.oversold ?? 30,
        params.overbought ?? 70,
      )
    default:
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Unknown strategy type: ${type}`,
      })
  }
}

function createBuyAndHoldStrategy(): BacktestStrategy {
  return {
    name: 'Buy and Hold',
    onBar(_bar: OHLCV, index: number, _bars: OHLCV[], position: OpenPosition | null): Signal {
      if (index === 0 && !position) {
        return { action: 'buy' }
      }
      return { action: 'none' }
    },
  }
}

function createMACrossoverStrategy(fastPeriod: number, slowPeriod: number): BacktestStrategy {
  return {
    name: `MA Crossover (${fastPeriod}/${slowPeriod})`,
    onBar(_bar: OHLCV, index: number, bars: OHLCV[], position: OpenPosition | null): Signal {
      if (index < slowPeriod) return { action: 'none' }

      const fastMA = sma(bars, index, fastPeriod)
      const slowMA = sma(bars, index, slowPeriod)
      const prevFastMA = sma(bars, index - 1, fastPeriod)
      const prevSlowMA = sma(bars, index - 1, slowPeriod)

      // Golden cross: fast crosses above slow
      if (prevFastMA <= prevSlowMA && fastMA > slowMA && !position) {
        return { action: 'buy' }
      }

      // Death cross: fast crosses below slow
      if (prevFastMA >= prevSlowMA && fastMA < slowMA && position?.side === 'long') {
        return { action: 'sell' }
      }

      return { action: 'none' }
    },
  }
}

function createRSIMeanReversionStrategy(
  period: number,
  oversold: number,
  overbought: number,
): BacktestStrategy {
  return {
    name: `RSI Mean Reversion (${period}, ${oversold}/${overbought})`,
    onBar(_bar: OHLCV, index: number, bars: OHLCV[], position: OpenPosition | null): Signal {
      if (index < period + 1) return { action: 'none' }

      const rsi = calculateRSI(bars, index, period)

      if (rsi <= oversold && !position) {
        return { action: 'buy' }
      }
      if (rsi >= overbought && position?.side === 'long') {
        return { action: 'sell' }
      }

      return { action: 'none' }
    },
  }
}

// ── Indicator Helpers ─────────────────────────────────────────────────────

function sma(bars: OHLCV[], endIndex: number, period: number): number {
  let sum = 0
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    sum += bars[i]!.close
  }
  return sum / period
}

function calculateRSI(bars: OHLCV[], endIndex: number, period: number): number {
  let gains = 0
  let losses = 0

  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    const change = bars[i]!.close - bars[i - 1]!.close
    if (change > 0) gains += change
    else losses -= change
  }

  const avgGain = gains / period
  const avgLoss = losses / period

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

// ── Router ────────────────────────────────────────────────────────────────

export const backtestRouter = router({
  /** Run a new backtest */
  run: protectedProcedure
    .input(RunBacktestSchema)
    .mutation(async ({ ctx, input }) => {
      const { strategy: strategyInput, config } = input

      // Generate bars (mock implementation — replace with loadHistoricalBars in production)
      const start = new Date(config.startDate).getTime()
      const end = new Date(config.endDate).getTime()

      if (end <= start) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'End date must be after start date',
        })
      }

      const bars = generateMockBars(config.symbol, estimateBarCount(start, end, config.timeframe as Timeframe), {
        startTimestamp: start,
        timeframe: config.timeframe as Timeframe,
        seed: hashString(config.symbol + config.startDate),
      })

      const strategy = createStrategy(strategyInput.type, strategyInput.params)

      const backtester = new VectorizedBacktester()
      const result = backtester.run(strategy, {
        initialCapital: config.initialCapital,
        positionSize: config.positionSize,
        slippageBps: config.slippageBps,
        commission: config.commission
          ? { name: 'Custom', ...config.commission }
          : undefined,
        symbol: config.symbol,
      }, bars)

      // Store the result
      const id = crypto.randomUUID()
      backtestStore.set(id, {
        id,
        userId: ctx.userId,
        strategyType: strategyInput.type,
        strategyParams: strategyInput.params,
        symbol: config.symbol,
        timeframe: config.timeframe,
        result,
        createdAt: new Date(),
      })

      return { id, result }
    }),

  /** List past backtest runs for the current user */
  getHistory: protectedProcedure
    .input(GetHistorySchema.optional())
    .query(({ ctx, input }) => {
      const limit = input?.limit ?? 20
      const offset = input?.offset ?? 0

      const userRuns = Array.from(backtestStore.values())
        .filter((run) => run.userId === ctx.userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      const page = userRuns.slice(offset, offset + limit)

      return {
        runs: page.map((run) => ({
          id: run.id,
          strategyType: run.strategyType,
          strategyParams: run.strategyParams,
          symbol: run.symbol,
          timeframe: run.timeframe,
          totalReturn: run.result.metrics.totalReturnPct,
          sharpeRatio: run.result.metrics.sharpeRatio,
          maxDrawdown: run.result.metrics.maxDrawdownPct,
          totalTrades: run.result.metrics.totalTrades,
          createdAt: run.createdAt.toISOString(),
        })),
        total: userRuns.length,
      }
    }),

  /** Get a specific backtest result by ID */
  getResult: protectedProcedure
    .input(GetResultSchema)
    .query(({ ctx, input }) => {
      const run = backtestStore.get(input.id)

      if (!run) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Backtest run not found' })
      }

      if (run.userId !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Backtest run not found' })
      }

      return {
        id: run.id,
        strategyType: run.strategyType,
        strategyParams: run.strategyParams,
        symbol: run.symbol,
        timeframe: run.timeframe,
        result: run.result,
        createdAt: run.createdAt.toISOString(),
      }
    }),

  /** Compare 2-3 backtest results side by side */
  compare: protectedProcedure
    .input(CompareSchema)
    .query(({ ctx, input }) => {
      const runs = input.ids.map((id) => {
        const run = backtestStore.get(id)
        if (!run || run.userId !== ctx.userId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Backtest run ${id} not found` })
        }
        return run
      })

      return {
        comparisons: runs.map((run) => ({
          id: run.id,
          strategyType: run.strategyType,
          strategyParams: run.strategyParams,
          symbol: run.symbol,
          timeframe: run.timeframe,
          metrics: run.result.metrics,
          createdAt: run.createdAt.toISOString(),
        })),
      }
    }),
})

// ── Utility ───────────────────────────────────────────────────────────────

function estimateBarCount(startMs: number, endMs: number, timeframe: Timeframe): number {
  const tfMs: Record<Timeframe, number> = {
    '1m': 60_000,
    '5m': 5 * 60_000,
    '15m': 15 * 60_000,
    '30m': 30 * 60_000,
    '1h': 60 * 60_000,
    '4h': 4 * 60 * 60_000,
    '1D': 24 * 60 * 60_000,
    '1W': 7 * 24 * 60 * 60_000,
    '1M': 30 * 24 * 60 * 60_000,
  }

  return Math.max(1, Math.floor((endMs - startMs) / tfMs[timeframe]))
}

/** Simple string hash for reproducible mock data per symbol */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}
