import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc.js'
import {
  fetchCOTReport,
  fetchCOTHistory,
  calculateNetPositions,
  getCOTIndexFromHistory,
  getAvailableCOTSymbols,
} from '../services/cot-data.js'
import {
  getActivePatterns,
  getPatternHistory,
  getPatternAccuracy,
  runScanCycle,
  getScannerConfig,
} from '../services/pattern-scanner.js'
import {
  getContractSpecification,
  getRolloverCalendar,
  buildContinuousContract,
} from '../../../services/market-data/src/providers/futures-provider.js'

// ── Input Schemas ───────────────────────────────────────────────────────────

const SymbolInputSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
})

const ContinuousChartSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  adjustmentMethod: z.enum(['back_adjusted', 'unadjusted', 'ratio_adjusted']).default('back_adjusted'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const COTHistorySchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const ActivePatternsSchema = z.object({
  minConfidence: z.number().min(0).max(1).optional(),
  direction: z.enum(['bullish', 'bearish']).optional(),
  patternType: z.string().optional(),
  assetClass: z.string().optional(),
  sortBy: z.enum(['confidence', 'recency', 'symbol']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
}).optional()

const PatternHistorySchema = z.object({
  symbol: z.string().max(10).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
})

// ── Router ──────────────────────────────────────────────────────────────────

export const futuresRouter = router({
  /**
   * Get contract specifications for a futures symbol.
   */
  getContractSpecs: publicProcedure
    .input(SymbolInputSchema)
    .query(async ({ input }) => {
      const spec = getContractSpecification(input.symbol)
      if (!spec) {
        return { found: false as const, contract: null }
      }
      return { found: true as const, contract: spec }
    }),

  /**
   * Get back-adjusted continuous contract data for charting.
   */
  getContinuousChart: publicProcedure
    .input(ContinuousChartSchema)
    .query(async ({ input }) => {
      const { bars, contract } = await buildContinuousContract(
        input.symbol,
        input.adjustmentMethod,
        input.from,
        input.to,
      )
      return { bars, contract }
    }),

  /**
   * Get upcoming rollover dates for a futures symbol.
   */
  getRolloverCalendar: publicProcedure
    .input(SymbolInputSchema)
    .query(async ({ input }) => {
      return getRolloverCalendar(input.symbol)
    }),

  /**
   * Get the latest COT report for a symbol.
   */
  getCOTReport: publicProcedure
    .input(SymbolInputSchema)
    .query(async ({ input }) => {
      const report = await fetchCOTReport(input.symbol)
      if (!report) {
        return { found: false as const, report: null, netPositions: null, cotIndex: 50 }
      }

      const netPositions = calculateNetPositions(report)

      // Fetch 52-week history for COT index
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      const history = await fetchCOTHistory(
        input.symbol,
        oneYearAgo.toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10),
      )
      const cotIndex = getCOTIndexFromHistory(history)

      return { found: true as const, report, netPositions, cotIndex }
    }),

  /**
   * Get historical COT data with date range.
   */
  getCOTHistory: publicProcedure
    .input(COTHistorySchema)
    .query(async ({ input }) => {
      const history = await fetchCOTHistory(input.symbol, input.startDate, input.endDate)
      const cotIndex = getCOTIndexFromHistory(history)
      return { history, cotIndex }
    }),

  /**
   * Get available COT symbols.
   */
  getCOTSymbols: publicProcedure
    .query(async () => {
      return getAvailableCOTSymbols()
    }),

  /**
   * Get currently detected patterns across all symbols.
   */
  getActivePatterns: publicProcedure
    .input(ActivePatternsSchema)
    .query(async ({ input }) => {
      const patterns = getActivePatterns(input ?? undefined)
      const accuracy = getPatternAccuracy()
      const config = getScannerConfig()
      return { patterns, accuracy, config }
    }),

  /**
   * Get historical pattern accuracy tracking (requires authentication).
   */
  getPatternHistory: protectedProcedure
    .input(PatternHistorySchema)
    .query(async ({ input }) => {
      const { patterns, total } = getPatternHistory({
        symbol: input.symbol,
        limit: input.limit,
        offset: input.offset,
      })
      const accuracy = getPatternAccuracy()
      return { patterns, total, accuracy }
    }),

  /**
   * Trigger an on-demand scan cycle.
   */
  triggerScan: protectedProcedure
    .mutation(async () => {
      const result = await runScanCycle()
      return result
    }),
})
