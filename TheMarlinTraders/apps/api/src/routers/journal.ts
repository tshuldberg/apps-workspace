import { z } from 'zod'
import { eq, and, desc, gte, lte, sql, isNull } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { journalEntries, journalTags } from '../db/schema/journal.js'

const CreateEntrySchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  side: z.enum(['buy', 'sell']),
  entryPrice: z.string().min(1),
  exitPrice: z.string().optional(),
  quantity: z.string().min(1),
  pnl: z.string().optional(),
  rMultiple: z.string().optional(),
  setupType: z.enum(['breakout', 'pullback', 'reversal', 'range', 'momentum', 'other']).default('other'),
  emotionalState: z.enum(['calm', 'fomo', 'fearful', 'greedy', 'disciplined', 'other']).default('calm'),
  marketCondition: z.enum(['trending_up', 'trending_down', 'ranging', 'volatile', 'low_volume']).default('ranging'),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']).optional(),
  notes: z.string().optional(),
  chartSnapshotUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  entryDate: z.string().datetime(),
  exitDate: z.string().datetime().optional(),
})

const UpdateEntrySchema = z.object({
  id: z.string().uuid(),
  exitPrice: z.string().optional(),
  pnl: z.string().optional(),
  rMultiple: z.string().optional(),
  setupType: z.enum(['breakout', 'pullback', 'reversal', 'range', 'momentum', 'other']).optional(),
  emotionalState: z.enum(['calm', 'fomo', 'fearful', 'greedy', 'disciplined', 'other']).optional(),
  marketCondition: z.enum(['trending_up', 'trending_down', 'ranging', 'volatile', 'low_volume']).optional(),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']).nullable().optional(),
  notes: z.string().nullable().optional(),
  chartSnapshotUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string()).optional(),
  exitDate: z.string().datetime().optional(),
})

const ListEntriesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  setupType: z.enum(['breakout', 'pullback', 'reversal', 'range', 'momentum', 'other']).optional(),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']).optional(),
  tag: z.string().optional(),
})

export const journalRouter = router({
  list: protectedProcedure
    .input(ListEntriesSchema.optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(journalEntries.userId, ctx.userId),
        eq(journalEntries.isDeleted, false),
      ]

      if (input?.startDate) {
        conditions.push(gte(journalEntries.entryDate, new Date(input.startDate)))
      }
      if (input?.endDate) {
        conditions.push(lte(journalEntries.entryDate, new Date(input.endDate)))
      }
      if (input?.setupType) {
        conditions.push(eq(journalEntries.setupType, input.setupType))
      }
      if (input?.grade) {
        conditions.push(eq(journalEntries.grade, input.grade))
      }

      const limit = input?.limit ?? 50
      const offset = input?.offset ?? 0

      const entries = await db
        .select()
        .from(journalEntries)
        .where(and(...conditions))
        .orderBy(desc(journalEntries.entryDate))
        .limit(limit)
        .offset(offset)

      if (input?.tag) {
        return entries.filter((e) => e.tags.includes(input.tag!))
      }

      return entries
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [entry] = await db
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.id, input.id),
            eq(journalEntries.userId, ctx.userId),
            eq(journalEntries.isDeleted, false),
          ),
        )
        .limit(1)

      if (!entry) {
        throw new Error('Journal entry not found')
      }

      return entry
    }),

  create: protectedProcedure
    .input(CreateEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const [entry] = await db
        .insert(journalEntries)
        .values({
          userId: ctx.userId,
          symbol: input.symbol,
          side: input.side,
          entryPrice: input.entryPrice,
          exitPrice: input.exitPrice,
          quantity: input.quantity,
          pnl: input.pnl,
          rMultiple: input.rMultiple,
          setupType: input.setupType,
          emotionalState: input.emotionalState,
          marketCondition: input.marketCondition,
          grade: input.grade,
          notes: input.notes,
          chartSnapshotUrl: input.chartSnapshotUrl,
          tags: input.tags,
          entryDate: new Date(input.entryDate),
          exitDate: input.exitDate ? new Date(input.exitDate) : undefined,
        })
        .returning()

      return entry
    }),

  update: protectedProcedure
    .input(UpdateEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input
      const filtered = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined),
      )

      if (Object.keys(filtered).length === 0) {
        throw new Error('No fields to update')
      }

      // Convert exitDate string to Date if present
      if ('exitDate' in filtered && filtered.exitDate) {
        filtered.exitDate = new Date(filtered.exitDate as string) as unknown as string
      }

      const [updated] = await db
        .update(journalEntries)
        .set({ ...filtered, updatedAt: new Date() })
        .where(
          and(
            eq(journalEntries.id, id),
            eq(journalEntries.userId, ctx.userId),
            eq(journalEntries.isDeleted, false),
          ),
        )
        .returning()

      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .update(journalEntries)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(
          and(
            eq(journalEntries.id, input.id),
            eq(journalEntries.userId, ctx.userId),
          ),
        )
        .returning()

      return deleted
    }),

  getTags: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(journalTags)
      .where(eq(journalTags.userId, ctx.userId))
      .orderBy(journalTags.name)
  }),

  createTag: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#3b82f6'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [tag] = await db
        .insert(journalTags)
        .values({
          userId: ctx.userId,
          name: input.name,
          color: input.color,
        })
        .returning()

      return tag
    }),

  getStats: protectedProcedure
    .input(
      z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(journalEntries.userId, ctx.userId),
        eq(journalEntries.isDeleted, false),
      ]

      if (input?.startDate) {
        conditions.push(gte(journalEntries.entryDate, new Date(input.startDate)))
      }
      if (input?.endDate) {
        conditions.push(lte(journalEntries.entryDate, new Date(input.endDate)))
      }

      const entries = await db
        .select()
        .from(journalEntries)
        .where(and(...conditions))
        .orderBy(desc(journalEntries.entryDate))

      const totalTrades = entries.length
      const tradesWithPnl = entries.filter((e) => e.pnl !== null)
      const winners = tradesWithPnl.filter((e) => parseFloat(e.pnl!) > 0)
      const losers = tradesWithPnl.filter((e) => parseFloat(e.pnl!) < 0)

      const totalPnl = tradesWithPnl.reduce((sum, e) => sum + parseFloat(e.pnl!), 0)
      const avgPnl = tradesWithPnl.length > 0 ? totalPnl / tradesWithPnl.length : 0
      const winRate = tradesWithPnl.length > 0 ? (winners.length / tradesWithPnl.length) * 100 : 0

      const avgWin = winners.length > 0
        ? winners.reduce((sum, e) => sum + parseFloat(e.pnl!), 0) / winners.length
        : 0
      const avgLoss = losers.length > 0
        ? losers.reduce((sum, e) => sum + parseFloat(e.pnl!), 0) / losers.length
        : 0

      const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0

      // Stats by setup type
      const setupTypes = ['breakout', 'pullback', 'reversal', 'range', 'momentum', 'other'] as const
      const bySetupType = setupTypes.map((setup) => {
        const setupEntries = tradesWithPnl.filter((e) => e.setupType === setup)
        const setupWinners = setupEntries.filter((e) => parseFloat(e.pnl!) > 0)
        return {
          setupType: setup,
          count: setupEntries.length,
          winRate: setupEntries.length > 0 ? (setupWinners.length / setupEntries.length) * 100 : 0,
          totalPnl: setupEntries.reduce((sum, e) => sum + parseFloat(e.pnl!), 0),
        }
      }).filter((s) => s.count > 0)

      // Stats by day of week (0 = Sunday, 6 = Saturday)
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const byDayOfWeek = dayNames.map((name, index) => {
        const dayEntries = tradesWithPnl.filter((e) => e.entryDate.getDay() === index)
        const dayWinners = dayEntries.filter((e) => parseFloat(e.pnl!) > 0)
        return {
          day: name,
          count: dayEntries.length,
          winRate: dayEntries.length > 0 ? (dayWinners.length / dayEntries.length) * 100 : 0,
          totalPnl: dayEntries.reduce((sum, e) => sum + parseFloat(e.pnl!), 0),
        }
      }).filter((d) => d.count > 0)

      // Average R-multiple
      const tradesWithR = entries.filter((e) => e.rMultiple !== null)
      const avgRMultiple = tradesWithR.length > 0
        ? tradesWithR.reduce((sum, e) => sum + parseFloat(e.rMultiple!), 0) / tradesWithR.length
        : null

      return {
        totalTrades,
        winners: winners.length,
        losers: losers.length,
        winRate: Math.round(winRate * 100) / 100,
        totalPnl: Math.round(totalPnl * 100) / 100,
        avgPnl: Math.round(avgPnl * 100) / 100,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        avgRMultiple: avgRMultiple !== null ? Math.round(avgRMultiple * 100) / 100 : null,
        bySetupType,
        byDayOfWeek,
      }
    }),
})
