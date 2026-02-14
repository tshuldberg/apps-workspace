import { z } from 'zod'
import { eq, and, asc } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc.js'
import { db } from '../db/index.js'
import { watchlists, watchlistItems, symbols } from '../db/schema/index.js'

export const watchlistRouter = router({
  /** List all watchlists for the current user */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, ctx.userId))
      .orderBy(asc(watchlists.position))

    return rows
  }),

  /** Get a single watchlist with its items */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [list] = await db
        .select()
        .from(watchlists)
        .where(and(eq(watchlists.id, input.id), eq(watchlists.userId, ctx.userId)))
        .limit(1)

      if (!list) return null

      const items = await db
        .select({
          id: watchlistItems.id,
          symbolId: watchlistItems.symbolId,
          position: watchlistItems.position,
          addedAt: watchlistItems.addedAt,
          symbol: symbols.symbol,
          name: symbols.name,
        })
        .from(watchlistItems)
        .innerJoin(symbols, eq(watchlistItems.symbolId, symbols.id))
        .where(eq(watchlistItems.watchlistId, input.id))
        .orderBy(asc(watchlistItems.position))

      return { ...list, items }
    }),

  /** Create a new watchlist */
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      // Get max position
      const existing = await db
        .select({ position: watchlists.position })
        .from(watchlists)
        .where(eq(watchlists.userId, ctx.userId))
        .orderBy(asc(watchlists.position))

      const nextPosition = existing.length > 0 ? existing[existing.length - 1]!.position + 1 : 0

      const [created] = await db
        .insert(watchlists)
        .values({
          userId: ctx.userId,
          name: input.name,
          position: nextPosition,
        })
        .returning()

      return created!
    }),

  /** Rename a watchlist */
  rename: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(watchlists)
        .set({ name: input.name, updatedAt: new Date() })
        .where(and(eq(watchlists.id, input.id), eq(watchlists.userId, ctx.userId)))
        .returning()

      return updated ?? null
    }),

  /** Delete a watchlist */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(watchlists)
        .where(and(eq(watchlists.id, input.id), eq(watchlists.userId, ctx.userId)))

      return { success: true }
    }),

  /** Add a symbol to a watchlist */
  addItem: protectedProcedure
    .input(
      z.object({
        watchlistId: z.string().uuid(),
        symbolId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [list] = await db
        .select({ id: watchlists.id })
        .from(watchlists)
        .where(and(eq(watchlists.id, input.watchlistId), eq(watchlists.userId, ctx.userId)))
        .limit(1)

      if (!list) return null

      // Get max position
      const existing = await db
        .select({ position: watchlistItems.position })
        .from(watchlistItems)
        .where(eq(watchlistItems.watchlistId, input.watchlistId))
        .orderBy(asc(watchlistItems.position))

      const nextPosition =
        existing.length > 0 ? existing[existing.length - 1]!.position + 1 : 0

      const [item] = await db
        .insert(watchlistItems)
        .values({
          watchlistId: input.watchlistId,
          symbolId: input.symbolId,
          position: nextPosition,
        })
        .returning()

      return item!
    }),

  /** Remove a symbol from a watchlist */
  removeItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(watchlistItems).where(eq(watchlistItems.id, input.itemId))
      return { success: true }
    }),

  /** Reorder items in a watchlist */
  reorderItems: protectedProcedure
    .input(
      z.object({
        watchlistId: z.string().uuid(),
        itemIds: z.array(z.string().uuid()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [list] = await db
        .select({ id: watchlists.id })
        .from(watchlists)
        .where(and(eq(watchlists.id, input.watchlistId), eq(watchlists.userId, ctx.userId)))
        .limit(1)

      if (!list) return null

      // Update positions
      await Promise.all(
        input.itemIds.map((id, index) =>
          db
            .update(watchlistItems)
            .set({ position: index })
            .where(
              and(
                eq(watchlistItems.id, id),
                eq(watchlistItems.watchlistId, input.watchlistId),
              ),
            ),
        ),
      )

      return { success: true }
    }),
})
