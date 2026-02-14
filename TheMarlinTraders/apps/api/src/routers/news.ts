import { z } from 'zod'
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm'
import { router, publicProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { newsArticles, economicEvents, earningsEvents } from '../db/schema/news.js'

// ── Input Schemas ────────────────────────────────────────────────────────────

const GetArticlesSchema = z.object({
  symbol: z.string().max(10).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

const GetEconomicCalendarSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

const GetEarningsCalendarSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  symbol: z.string().max(10).optional(),
})

// ── Router ───────────────────────────────────────────────────────────────────

export const newsRouter = router({
  /**
   * Get news articles with optional symbol filter and cursor pagination.
   */
  getArticles: publicProcedure
    .input(GetArticlesSchema.optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20
      const conditions: ReturnType<typeof eq>[] = []

      // Filter by symbol using array containment
      if (input?.symbol) {
        const upperSymbol = input.symbol.toUpperCase()
        conditions.push(
          sql`${upperSymbol} = ANY(${newsArticles.symbols})`,
        )
      }

      // Cursor pagination
      if (input?.cursor) {
        const cursorArticle = await db
          .select({ publishedAt: newsArticles.publishedAt })
          .from(newsArticles)
          .where(eq(newsArticles.id, input.cursor))
          .limit(1)

        if (cursorArticle[0]?.publishedAt) {
          conditions.push(
            sql`${newsArticles.publishedAt} < ${cursorArticle[0].publishedAt}`,
          )
        }
      }

      const query = conditions.length > 0
        ? db
            .select()
            .from(newsArticles)
            .where(and(...conditions))
            .orderBy(desc(newsArticles.publishedAt))
            .limit(limit + 1)
        : db
            .select()
            .from(newsArticles)
            .orderBy(desc(newsArticles.publishedAt))
            .limit(limit + 1)

      const results = await query

      const hasMore = results.length > limit
      const items = hasMore ? results.slice(0, limit) : results
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

      return { items, nextCursor }
    }),

  /**
   * Get economic events within a date range.
   */
  getEconomicCalendar: publicProcedure
    .input(GetEconomicCalendarSchema)
    .query(async ({ input }) => {
      const startDate = new Date(input.startDate)
      const endDate = new Date(input.endDate)

      const results = await db
        .select()
        .from(economicEvents)
        .where(
          and(
            gte(economicEvents.eventDate, startDate),
            lte(economicEvents.eventDate, endDate),
          ),
        )
        .orderBy(economicEvents.eventDate)

      return results
    }),

  /**
   * Get earnings events within a date range, optionally filtered by symbol.
   */
  getEarningsCalendar: publicProcedure
    .input(GetEarningsCalendarSchema)
    .query(async ({ input }) => {
      const startDate = new Date(input.startDate)
      const endDate = new Date(input.endDate)

      const conditions = [
        gte(earningsEvents.reportDate, startDate),
        lte(earningsEvents.reportDate, endDate),
      ]

      if (input.symbol) {
        conditions.push(eq(earningsEvents.symbol, input.symbol.toUpperCase()))
      }

      const results = await db
        .select()
        .from(earningsEvents)
        .where(and(...conditions))
        .orderBy(earningsEvents.reportDate)

      return results
    }),
})
