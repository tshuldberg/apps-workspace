import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { searchSymbols } from '../services/search.js'

export const searchRouter = router({
  /** Fuzzy search symbols via Meilisearch */
  symbols: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        limit: z.number().int().min(1).max(50).optional().default(20),
        type: z
          .enum(['stock', 'etf', 'crypto', 'forex', 'future', 'option'])
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const filter = input.type ? `type = "${input.type}"` : undefined
      return searchSymbols(input.query, { limit: input.limit, filter })
    }),
})
