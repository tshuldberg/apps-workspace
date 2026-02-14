import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { getChain, getExpirations, getQuote, getIVAnalytics } from '../adapters/options-data.js'

export const optionsRouter = router({
  getChain: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
        expiration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    )
    .query(async ({ input }) => {
      return getChain(input.symbol, input.expiration)
    }),

  getExpirations: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
      }),
    )
    .query(async ({ input }) => {
      return getExpirations(input.symbol)
    }),

  getQuote: publicProcedure
    .input(
      z.object({
        contractSymbol: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      return getQuote(input.contractSymbol)
    }),

  getIVData: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
      }),
    )
    .query(async ({ input }) => {
      return getIVAnalytics(input.symbol)
    }),
})
