import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { TimeframeSchema } from '@marlin/shared'
import { MarketDataService } from '../services/market-data.js'
import { db } from '../db/index.js'

const marketDataService = new MarketDataService(db)

export const marketRouter = router({
  getBars: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
        timeframe: TimeframeSchema,
        from: z
          .string()
          .optional()
          .default(() => {
            const d = new Date()
            d.setMonth(d.getMonth() - 3)
            return d.toISOString().slice(0, 10)
          }),
        to: z
          .string()
          .optional()
          .default(() => new Date().toISOString().slice(0, 10)),
      }),
    )
    .query(async ({ input }) => {
      return marketDataService.getBars(input.symbol, input.timeframe, input.from, input.to)
    }),
})
