import { z } from 'zod'
import { eq, and, gte, sql } from 'drizzle-orm'
import { router, publicProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { users } from '../db/schema/users.js'
import { profiles } from '../db/schema/profiles.js'
import { privacySettings } from '../db/schema/profiles.js'
import { journalEntries } from '../db/schema/journal.js'
import { calculateMetrics, type JournalEntry } from '../services/performance-analytics.js'

// ── Input Schemas ────────────────────────────────────────────────────────────

const RankingsSchema = z.object({
  timeframe: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  assetClass: z.enum(['equities', 'options', 'crypto', 'all']).default('all'),
  style: z.enum(['day', 'swing', 'all']).default('all'),
  metric: z.enum(['sharpe', 'winRate', 'totalPnl', 'profitFactor']).default('totalPnl'),
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.number().int().min(0).default(0),
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTimeframeDate(timeframe: string): Date | null {
  const now = new Date()
  switch (timeframe) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    case 'all':
    default:
      return null
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

export const leaderboardsRouter = router({
  /**
   * Get ranked leaderboard of traders by the selected metric.
   *
   * Fetches journal entries per user, calculates metrics via
   * the performance-analytics service, filters by privacy settings,
   * sorts by the requested metric, and returns a paginated list.
   */
  getRankings: publicProcedure
    .input(RankingsSchema.optional())
    .query(async ({ input }) => {
      const params = input ?? {}
      const timeframe = params.timeframe ?? '30d'
      const metric = params.metric ?? 'totalPnl'
      const limit = params.limit ?? 25
      const cursor = params.cursor ?? 0

      const timeframeDate = getTimeframeDate(timeframe)

      // Build conditions for journal entries
      const conditions = [eq(journalEntries.isDeleted, false)]
      if (timeframeDate) {
        conditions.push(gte(journalEntries.entryDate, timeframeDate))
      }

      // Fetch all qualifying journal entries
      const entries = await db
        .select()
        .from(journalEntries)
        .where(and(...conditions))

      // Group entries by userId
      const entriesByUser = new Map<string, JournalEntry[]>()
      for (const entry of entries) {
        const list = entriesByUser.get(entry.userId) ?? []
        list.push(entry as unknown as JournalEntry)
        entriesByUser.set(entry.userId, list)
      }

      // Get users who have opted out of showing stats
      const privacyOuts = await db
        .select({ userId: privacySettings.userId })
        .from(privacySettings)
        .where(eq(privacySettings.showStats, false))

      const hiddenUserIds = new Set(privacyOuts.map((p) => p.userId))

      // Calculate metrics per user and build ranked list
      const rankings: Array<{
        userId: string
        metricValue: number
        winRate: number
        sharpeRatio: number
        totalPnl: number
        profitFactor: number
        totalTrades: number
      }> = []

      for (const [userId, userEntries] of entriesByUser) {
        // Skip users who opted out of public stats
        if (hiddenUserIds.has(userId)) continue
        // Require at least 5 trades for leaderboard inclusion
        if (userEntries.length < 5) continue

        const metrics = calculateMetrics(userEntries)

        let metricValue: number
        switch (metric) {
          case 'sharpe':
            metricValue = metrics.sharpeRatio
            break
          case 'winRate':
            metricValue = metrics.winRate
            break
          case 'profitFactor':
            metricValue = metrics.profitFactor
            break
          case 'totalPnl':
          default:
            metricValue = metrics.totalPnl
            break
        }

        rankings.push({
          userId,
          metricValue,
          winRate: metrics.winRate,
          sharpeRatio: metrics.sharpeRatio,
          totalPnl: metrics.totalPnl,
          profitFactor: metrics.profitFactor,
          totalTrades: metrics.totalTrades,
        })
      }

      // Sort by the selected metric descending
      rankings.sort((a, b) => b.metricValue - a.metricValue)

      // Paginate
      const totalCount = rankings.length
      const paged = rankings.slice(cursor, cursor + limit)

      // Hydrate user info for the paged results
      const userIds = paged.map((r) => r.userId)
      const userRows = userIds.length > 0
        ? await db
            .select({
              clerkId: users.clerkId,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(sql`${users.clerkId} = ANY(ARRAY[${sql.join(userIds.map((id) => sql`${id}`), sql`, `)}])`)
        : []

      // Also check for profile overrides (displayName, avatarUrl)
      const profileRows = userIds.length > 0
        ? await db
            .select({
              userId: profiles.userId,
              displayName: profiles.displayName,
              avatarUrl: profiles.avatarUrl,
            })
            .from(profiles)
            .where(sql`${profiles.userId} = ANY(ARRAY[${sql.join(userIds.map((id) => sql`${id}`), sql`, `)}])`)
        : []

      const userMap = new Map(userRows.map((u) => [u.clerkId, u]))
      const profileMap = new Map(profileRows.map((p) => [p.userId, p]))

      const items = paged.map((r, i) => {
        const user = userMap.get(r.userId)
        const profile = profileMap.get(r.userId)
        return {
          rank: cursor + i + 1,
          userId: r.userId,
          displayName: profile?.displayName ?? user?.displayName ?? 'Anonymous',
          avatarUrl: profile?.avatarUrl ?? user?.avatarUrl ?? null,
          metricValue: r.metricValue,
          winRate: r.winRate,
          sharpeRatio: r.sharpeRatio,
          totalPnl: r.totalPnl,
          profitFactor: r.profitFactor,
          totalTrades: r.totalTrades,
        }
      })

      return {
        items,
        totalCount,
        nextCursor: cursor + limit < totalCount ? cursor + limit : undefined,
      }
    }),
})
