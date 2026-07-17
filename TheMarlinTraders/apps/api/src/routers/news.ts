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

// ── Local Fallback Data (dev-only) ──────────────────────────────────────────

interface FallbackArticle {
  id: string
  externalId: string
  source: 'benzinga' | 'custom'
  title: string
  summary: string
  url: string
  imageUrl: string | null
  symbols: string[]
  categories: string[]
  publishedAt: Date
  createdAt: Date
}

interface FallbackEconomicEvent {
  id: string
  name: string
  description: string | null
  eventDate: Date
  impact: 'low' | 'medium' | 'high'
  actual: string | null
  forecast: string | null
  previous: string | null
  country: string
  createdAt: Date
}

interface FallbackEarningsEvent {
  id: string
  symbol: string
  companyName: string
  reportDate: Date
  quarter: string
  estimatedEps: string | null
  actualEps: string | null
  estimatedRevenue: string | null
  actualRevenue: string | null
  createdAt: Date
}

function getFallbackArticles(): FallbackArticle[] {
  const now = Date.now()
  return [
    {
      id: '20000000-0000-4000-8000-000000000001',
      externalId: 'fallback-news-1',
      source: 'benzinga',
      title: 'S&P 500 Holds Key Range Into Late Session',
      summary:
        'Major indices traded in a narrow range as traders positioned ahead of next week inflation data.',
      url: 'https://www.benzinga.com/',
      imageUrl: null,
      symbols: ['SPY', 'QQQ'],
      categories: ['macro', 'equities'],
      publishedAt: new Date(now - 25 * 60_000),
      createdAt: new Date(now - 25 * 60_000),
    },
    {
      id: '20000000-0000-4000-8000-000000000002',
      externalId: 'fallback-news-2',
      source: 'benzinga',
      title: 'AAPL Sees Heavy Call Activity Ahead Of Product Event',
      summary:
        'Options volume concentrated in near-dated upside strikes as implied volatility firmed.',
      url: 'https://www.benzinga.com/',
      imageUrl: null,
      symbols: ['AAPL'],
      categories: ['options', 'tech'],
      publishedAt: new Date(now - 75 * 60_000),
      createdAt: new Date(now - 75 * 60_000),
    },
    {
      id: '20000000-0000-4000-8000-000000000003',
      externalId: 'fallback-news-3',
      source: 'custom',
      title: 'NVDA Continues Leadership As Semiconductor Breadth Improves',
      summary:
        'Semiconductor complex outperformed broad indices with NVDA, AMD, and SMH extending momentum.',
      url: 'https://www.example.com/',
      imageUrl: null,
      symbols: ['NVDA', 'AMD', 'SMH'],
      categories: ['semis', 'momentum'],
      publishedAt: new Date(now - 2.5 * 60 * 60_000),
      createdAt: new Date(now - 2.5 * 60 * 60_000),
    },
  ]
}

function getFallbackEconomicEvents(): FallbackEconomicEvent[] {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  return [
    {
      id: '21000000-0000-4000-8000-000000000001',
      name: 'Initial Jobless Claims',
      description: 'Weekly first-time unemployment benefit claims',
      eventDate: new Date(`${today.toISOString().slice(0, 10)}T13:30:00.000Z`),
      impact: 'medium',
      actual: '217K',
      forecast: '220K',
      previous: '222K',
      country: 'US',
      createdAt: new Date(),
    },
    {
      id: '21000000-0000-4000-8000-000000000002',
      name: 'FOMC Minutes',
      description: 'Minutes from the latest Federal Reserve policy meeting',
      eventDate: new Date(`${today.toISOString().slice(0, 10)}T19:00:00.000Z`),
      impact: 'high',
      actual: null,
      forecast: null,
      previous: null,
      country: 'US',
      createdAt: new Date(),
    },
    {
      id: '21000000-0000-4000-8000-000000000003',
      name: 'CPI (YoY)',
      description: 'Consumer inflation year-over-year',
      eventDate: new Date(`${tomorrow.toISOString().slice(0, 10)}T13:30:00.000Z`),
      impact: 'high',
      actual: null,
      forecast: '3.1%',
      previous: '3.2%',
      country: 'US',
      createdAt: new Date(),
    },
  ]
}

function getFallbackEarningsEvents(): FallbackEarningsEvent[] {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  return [
    {
      id: '22000000-0000-4000-8000-000000000001',
      symbol: 'NVDA',
      companyName: 'NVIDIA Corporation',
      reportDate: new Date(`${today.toISOString().slice(0, 10)}T21:00:00.000Z`),
      quarter: 'Q4 2025',
      estimatedEps: '4.59',
      actualEps: '5.16',
      estimatedRevenue: '20500000000',
      actualRevenue: '22100000000',
      createdAt: new Date(),
    },
    {
      id: '22000000-0000-4000-8000-000000000002',
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      reportDate: new Date(`${tomorrow.toISOString().slice(0, 10)}T21:00:00.000Z`),
      quarter: 'Q1 2026',
      estimatedEps: '2.10',
      actualEps: null,
      estimatedRevenue: '117800000000',
      actualRevenue: null,
      createdAt: new Date(),
    },
    {
      id: '22000000-0000-4000-8000-000000000003',
      symbol: 'MSFT',
      companyName: 'Microsoft Corporation',
      reportDate: new Date(`${tomorrow.toISOString().slice(0, 10)}T21:00:00.000Z`),
      quarter: 'Q2 2026',
      estimatedEps: '3.22',
      actualEps: null,
      estimatedRevenue: '68600000000',
      actualRevenue: null,
      createdAt: new Date(),
    },
  ]
}

function isMissingNewsTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /relation "(news_articles|economic_events|earnings_events)" does not exist/.test(message)
}

function shouldUseFallbackForMissingTable(error: unknown): boolean {
  return process.env.NODE_ENV !== 'production' && isMissingNewsTableError(error)
}

function fallbackArticlesQuery(input: z.infer<typeof GetArticlesSchema> | undefined) {
  const limit = input?.limit ?? 20
  const symbol = input?.symbol?.toUpperCase()
  const cursor = input?.cursor

  let rows = [...getFallbackArticles()].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  )

  if (symbol) {
    rows = rows.filter((row) => row.symbols.includes(symbol))
  }

  if (cursor) {
    const cursorIdx = rows.findIndex((row) => row.id === cursor)
    if (cursorIdx >= 0) {
      rows = rows.slice(cursorIdx + 1)
    }
  }

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

  return { items, nextCursor }
}

function fallbackEconomicQuery(input: z.infer<typeof GetEconomicCalendarSchema>) {
  const start = new Date(input.startDate)
  const end = new Date(input.endDate)
  return getFallbackEconomicEvents()
    .filter((row) => row.eventDate >= start && row.eventDate <= end)
    .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())
}

function fallbackEarningsQuery(input: z.infer<typeof GetEarningsCalendarSchema>) {
  const start = new Date(input.startDate)
  const end = new Date(input.endDate)
  const symbol = input.symbol?.toUpperCase()

  return getFallbackEarningsEvents()
    .filter((row) => row.reportDate >= start && row.reportDate <= end)
    .filter((row) => (symbol ? row.symbol === symbol : true))
    .sort((a, b) => a.reportDate.getTime() - b.reportDate.getTime())
}

// ── Router ───────────────────────────────────────────────────────────────────

export const newsRouter = router({
  /**
   * Get news articles with optional symbol filter and cursor pagination.
   */
  getArticles: publicProcedure
    .input(GetArticlesSchema.optional())
    .query(async ({ input }) => {
      try {
        const limit = input?.limit ?? 20
        const conditions: ReturnType<typeof eq>[] = []

        if (input?.symbol) {
          const upperSymbol = input.symbol.toUpperCase()
          conditions.push(sql`${upperSymbol} = ANY(${newsArticles.symbols})`)
        }

        if (input?.cursor) {
          const cursorArticle = await db
            .select({ publishedAt: newsArticles.publishedAt })
            .from(newsArticles)
            .where(eq(newsArticles.id, input.cursor))
            .limit(1)

          if (cursorArticle[0]?.publishedAt) {
            conditions.push(sql`${newsArticles.publishedAt} < ${cursorArticle[0].publishedAt}`)
          }
        }

        const query =
          conditions.length > 0
            ? db
                .select()
                .from(newsArticles)
                .where(and(...conditions))
                .orderBy(desc(newsArticles.publishedAt))
                .limit(limit + 1)
            : db.select().from(newsArticles).orderBy(desc(newsArticles.publishedAt)).limit(limit + 1)

        const results = await query

        const hasMore = results.length > limit
        const items = hasMore ? results.slice(0, limit) : results
        const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

        return { items, nextCursor }
      } catch (error) {
        if (shouldUseFallbackForMissingTable(error)) {
          console.warn('[news] Using in-memory fallback for news articles')
          return fallbackArticlesQuery(input)
        }
        throw error
      }
    }),

  /**
   * Get economic events within a date range.
   */
  getEconomicCalendar: publicProcedure
    .input(GetEconomicCalendarSchema)
    .query(async ({ input }) => {
      try {
        const startDate = new Date(input.startDate)
        const endDate = new Date(input.endDate)
        const results = await db
          .select()
          .from(economicEvents)
          .where(and(gte(economicEvents.eventDate, startDate), lte(economicEvents.eventDate, endDate)))
          .orderBy(economicEvents.eventDate)
        return results
      } catch (error) {
        if (shouldUseFallbackForMissingTable(error)) {
          console.warn('[news] Using in-memory fallback for economic calendar')
          return fallbackEconomicQuery(input)
        }
        throw error
      }
    }),

  /**
   * Get earnings events within a date range, optionally filtered by symbol.
   */
  getEarningsCalendar: publicProcedure
    .input(GetEarningsCalendarSchema)
    .query(async ({ input }) => {
      try {
        const startDate = new Date(input.startDate)
        const endDate = new Date(input.endDate)

        const conditions = [gte(earningsEvents.reportDate, startDate), lte(earningsEvents.reportDate, endDate)]

        if (input.symbol) {
          conditions.push(eq(earningsEvents.symbol, input.symbol.toUpperCase()))
        }

        const results = await db
          .select()
          .from(earningsEvents)
          .where(and(...conditions))
          .orderBy(earningsEvents.reportDate)
        return results
      } catch (error) {
        if (shouldUseFallbackForMissingTable(error)) {
          console.warn('[news] Using in-memory fallback for earnings calendar')
          return fallbackEarningsQuery(input)
        }
        throw error
      }
    }),
})
