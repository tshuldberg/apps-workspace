import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import {
  getMarketHeatmap,
  getSectorHeatmap,
  getStockMetrics,
} from '../services/heatmap-data.js'

const TimeframeSchema = z.enum(['1D', '1W', '1M', '3M', 'YTD', '1Y'])
const ColorMetricSchema = z.enum(['changePercent', 'peRatio', 'rsi', 'ivRank', 'marketCap'])

export const heatmapRouter = router({
  /** Get full S&P 500 heatmap data grouped by sector */
  getSectors: publicProcedure
    .input(
      z.object({
        timeframe: TimeframeSchema.default('1D'),
      }),
    )
    .query(async ({ input }) => {
      return getMarketHeatmap(input.timeframe)
    }),

  /** Get heatmap data for a single sector */
  getConstituents: publicProcedure
    .input(
      z.object({
        sector: z.string().min(1),
        timeframe: TimeframeSchema.default('1D'),
      }),
    )
    .query(async ({ input }) => {
      return getSectorHeatmap(input.sector, input.timeframe)
    }),

  /** Get specific metric data for a set of symbols */
  getMetrics: publicProcedure
    .input(
      z.object({
        symbols: z.array(z.string().min(1)).min(1).max(500),
        metric: ColorMetricSchema,
      }),
    )
    .query(async ({ input }) => {
      return getStockMetrics(input.symbols, input.metric)
    }),

  // Keep the legacy endpoints for backward compatibility
  /** @deprecated Use getSectors instead */
  getMarketHeatmap: publicProcedure.query(async () => {
    return getMarketHeatmap()
  }),

  /** @deprecated Use getConstituents instead */
  getSectorHeatmap: publicProcedure
    .input(z.object({ sector: z.string().min(1) }))
    .query(async ({ input }) => {
      return getSectorHeatmap(input.sector)
    }),
})
