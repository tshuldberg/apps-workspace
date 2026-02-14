import { z } from 'zod'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { journalEntries } from '../db/schema/journal.js'
import {
  calculateMetrics,
  timeOfDayAnalysis,
  setupTypeBreakdown,
  rollingSharpe,
  holdingTimeAnalysis,
  equityCurve,
  type JournalEntry,
} from '../services/performance-analytics.js'

const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

async function fetchClosedEntries(
  userId: string,
  dateRange?: { startDate?: string; endDate?: string },
): Promise<JournalEntry[]> {
  const conditions = [
    eq(journalEntries.userId, userId),
    eq(journalEntries.isDeleted, false),
  ]

  if (dateRange?.startDate) {
    conditions.push(gte(journalEntries.entryDate, new Date(dateRange.startDate)))
  }
  if (dateRange?.endDate) {
    conditions.push(lte(journalEntries.entryDate, new Date(dateRange.endDate)))
  }

  const rows = await db
    .select()
    .from(journalEntries)
    .where(and(...conditions))
    .orderBy(desc(journalEntries.entryDate))

  // Cast Drizzle rows to the service's JournalEntry type
  return rows as unknown as JournalEntry[]
}

export const performanceRouter = router({
  getOverview: protectedProcedure
    .input(DateRangeSchema.optional())
    .query(async ({ ctx, input }) => {
      const entries = await fetchClosedEntries(ctx.userId, input)
      return calculateMetrics(entries)
    }),

  getTimeOfDay: protectedProcedure
    .input(DateRangeSchema.optional())
    .query(async ({ ctx, input }) => {
      const entries = await fetchClosedEntries(ctx.userId, input)
      return timeOfDayAnalysis(entries)
    }),

  getSetupBreakdown: protectedProcedure
    .input(DateRangeSchema.optional())
    .query(async ({ ctx, input }) => {
      const entries = await fetchClosedEntries(ctx.userId, input)
      return setupTypeBreakdown(entries)
    }),

  getRollingSharpe: protectedProcedure
    .input(
      z
        .object({
          windowDays: z.number().int().min(5).max(365).default(30),
          startDate: z.string().datetime().optional(),
          endDate: z.string().datetime().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const entries = await fetchClosedEntries(ctx.userId, input)
      return rollingSharpe(entries, input?.windowDays ?? 30)
    }),

  getHoldingTime: protectedProcedure
    .input(DateRangeSchema.optional())
    .query(async ({ ctx, input }) => {
      const entries = await fetchClosedEntries(ctx.userId, input)
      return holdingTimeAnalysis(entries)
    }),

  getEquityCurve: protectedProcedure
    .input(DateRangeSchema.optional())
    .query(async ({ ctx, input }) => {
      const entries = await fetchClosedEntries(ctx.userId, input)
      return equityCurve(entries)
    }),
})
