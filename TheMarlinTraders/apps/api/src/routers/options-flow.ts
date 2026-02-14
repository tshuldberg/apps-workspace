import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { detectUnusualActivity, buildPutCallRatio } from '../services/options-flow.js'
import {
  calculateIVRank,
  calculateIVPercentile,
  buildIVSurface,
  buildSkew,
  buildTermStructure,
  buildVolatilityCone,
  calculateExpectedMove,
} from '../services/iv-analytics.js'
import { getChain, getIVAnalytics } from '../adapters/options-data.js'
import type { FlowEntry, FlowSummary } from '@marlin/shared'
import type { OptionTrade } from '../services/options-flow.js'

// ---------------------------------------------------------------------------
// Mock data helpers (in production, these would query the real-time data store)
// ---------------------------------------------------------------------------

/**
 * In production this would query the real-time options flow data store
 * (e.g., Redis sorted set or TimescaleDB) for recent unusual options activity.
 * For now we return structured mock data.
 */
async function getRecentFlow(
  filter?: {
    symbol?: string
    minPremium?: number
    flowType?: string
    sentiment?: string
    limit?: number
    offset?: number
  },
): Promise<{ entries: FlowEntry[]; total: number }> {
  // Placeholder: in production, fetch from data pipeline
  return { entries: [], total: 0 }
}

/**
 * In production this would fetch from the stored daily IV snapshots.
 */
async function getHistoricalIVs(_symbol: string): Promise<number[]> {
  // Placeholder: would query 252 trading days of IV history
  return []
}

/**
 * In production this would fetch from stored daily close prices.
 */
async function getHistoricalPrices(_symbol: string): Promise<number[]> {
  // Placeholder: would query historical daily closes
  return []
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const optionsFlowRouter = router({
  /** Paginated unusual options flow (all symbols or filtered) */
  getFlow: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()).optional(),
        minPremium: z.number().min(0).optional(),
        flowType: z.enum(['sweep', 'block', 'split', 'multi_leg']).optional(),
        sentiment: z.enum(['bullish', 'bearish', 'neutral']).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      return getRecentFlow({
        symbol: input.symbol,
        minPremium: input.minPremium,
        flowType: input.flowType,
        sentiment: input.sentiment,
        limit: input.limit,
        offset: input.offset,
      })
    }),

  /** Flow for a specific symbol */
  getFlowBySymbol: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      return getRecentFlow({ symbol: input.symbol, limit: input.limit })
    }),

  /** Aggregate flow stats: total premium, top plays */
  getFlowSummary: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()).optional(),
      }).optional(),
    )
    .query(async ({ input }): Promise<FlowSummary> => {
      const { entries } = await getRecentFlow({
        symbol: input?.symbol,
        limit: 100,
      })

      let totalPremium = 0
      let callPremium = 0
      let putPremium = 0

      for (const entry of entries) {
        totalPremium += entry.premium
        if (entry.type === 'call') callPremium += entry.premium
        else putPremium += entry.premium
      }

      const bullish = entries
        .filter((e) => e.sentiment === 'bullish')
        .sort((a, b) => b.premium - a.premium)
        .slice(0, 5)

      const bearish = entries
        .filter((e) => e.sentiment === 'bearish')
        .sort((a, b) => b.premium - a.premium)
        .slice(0, 5)

      return {
        totalPremium,
        callPremium,
        putPremium,
        topBullish: bullish,
        topBearish: bearish,
      }
    }),

  /** Current put/call ratio for a symbol */
  getPutCallRatio: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
      }),
    )
    .query(async ({ input }) => {
      // In production, this would query real-time trade data
      // For now, derive from the options chain
      const chain = await getChain(input.symbol)
      let callVolume = 0
      let putVolume = 0
      for (const strike of chain.strikes) {
        callVolume += strike.call?.volume ?? 0
        putVolume += strike.put?.volume ?? 0
      }
      return {
        symbol: input.symbol,
        ratio: callVolume > 0 ? putVolume / callVolume : 0,
        callVolume,
        putVolume,
      }
    }),

  /** IV rank, percentile, HV comparison for a symbol */
  getIVData: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
      }),
    )
    .query(async ({ input }) => {
      const ivData = await getIVAnalytics(input.symbol)
      const historicalIVs = await getHistoricalIVs(input.symbol)

      const rank = historicalIVs.length > 0
        ? calculateIVRank(ivData.currentIV, historicalIVs)
        : ivData.ivRank

      const percentile = historicalIVs.length > 0
        ? calculateIVPercentile(ivData.currentIV, historicalIVs)
        : ivData.ivPercentile

      return {
        symbol: input.symbol,
        currentIV: ivData.currentIV,
        ivRank: rank,
        ivPercentile: percentile,
        hv20: 0, // Would be calculated from historical prices
        hv50: 0,
        hv100: 0,
      }
    }),

  /** 3D IV surface data */
  getIVSurface: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
      }),
    )
    .query(async ({ input }) => {
      // Fetch chains for multiple expirations
      // In production, this would batch-fetch efficiently
      const chain = await getChain(input.symbol)
      return buildIVSurface([chain])
    }),

  /** IV skew for a given expiration */
  getSkew: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
        expiration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    )
    .query(async ({ input }) => {
      const chain = await getChain(input.symbol, input.expiration)
      return buildSkew(chain, chain.expiration)
    }),

  /** IV term structure */
  getTermStructure: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
      }),
    )
    .query(async ({ input }) => {
      // In production, fetch chains for all expirations
      const chain = await getChain(input.symbol)
      return buildTermStructure([chain])
    }),

  /** Volatility cone with current HV position */
  getVolatilityCone: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
      }),
    )
    .query(async ({ input }) => {
      const historicalPrices = await getHistoricalPrices(input.symbol)
      return buildVolatilityCone(historicalPrices)
    }),

  /** Expected move for next expiration */
  getExpectedMove: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
        stdDev: z.enum(['1', '2']).default('1'),
      }),
    )
    .query(async ({ input }) => {
      const chain = await getChain(input.symbol)
      const ivData = await getIVAnalytics(input.symbol)

      // Find nearest expiration DTE
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const expDate = new Date(chain.expiration + 'T00:00:00')
      const dte = Math.max(1, Math.ceil((expDate.getTime() - now.getTime()) / 86_400_000))

      const probability = input.stdDev === '2' ? 0.9545 : 0.6827
      return calculateExpectedMove(
        ivData.currentIV,
        chain.underlyingPrice,
        dte,
        input.symbol,
        chain.expiration,
        probability,
      )
    }),
})
