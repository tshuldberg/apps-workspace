import { z } from 'zod'
import { eq, and, asc } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc.js'
import { db } from '../db/index.js'
import { layouts } from '../db/schema/layouts.js'

export const layoutRouter = router({
  /** List all saved layouts for the current user */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(layouts)
      .where(eq(layouts.userId, ctx.userId))
      .orderBy(asc(layouts.createdAt))

    return rows
  }),

  /** Get a single layout by ID */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [layout] = await db
        .select()
        .from(layouts)
        .where(and(eq(layouts.id, input.id), eq(layouts.userId, ctx.userId)))
        .limit(1)

      return layout ?? null
    }),

  /** Get the user's default layout */
  getDefault: protectedProcedure.query(async ({ ctx }) => {
    const [layout] = await db
      .select()
      .from(layouts)
      .where(and(eq(layouts.userId, ctx.userId), eq(layouts.isDefault, true)))
      .limit(1)

    return layout ?? null
  }),

  /** Save a new layout */
  save: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(64),
        layoutJson: z.record(z.unknown()),
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // If setting as default, unset existing defaults
      if (input.isDefault) {
        await db
          .update(layouts)
          .set({ isDefault: false })
          .where(and(eq(layouts.userId, ctx.userId), eq(layouts.isDefault, true)))
      }

      const [created] = await db
        .insert(layouts)
        .values({
          userId: ctx.userId,
          name: input.name,
          layoutJson: input.layoutJson,
          isDefault: input.isDefault ?? false,
        })
        .returning()

      return created!
    }),

  /** Update an existing layout (name, layoutJson, or isDefault) */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(64).optional(),
        layoutJson: z.record(z.unknown()).optional(),
        isDefault: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // If setting as default, unset existing defaults
      if (input.isDefault) {
        await db
          .update(layouts)
          .set({ isDefault: false })
          .where(and(eq(layouts.userId, ctx.userId), eq(layouts.isDefault, true)))
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (input.name !== undefined) updates.name = input.name
      if (input.layoutJson !== undefined) updates.layoutJson = input.layoutJson
      if (input.isDefault !== undefined) updates.isDefault = input.isDefault

      const [updated] = await db
        .update(layouts)
        .set(updates)
        .where(and(eq(layouts.id, input.id), eq(layouts.userId, ctx.userId)))
        .returning()

      return updated ?? null
    }),

  /** Delete a layout */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(layouts)
        .where(and(eq(layouts.id, input.id), eq(layouts.userId, ctx.userId)))

      return { success: true }
    }),

  /** Set a layout as the default */
  setDefault: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Unset existing defaults
      await db
        .update(layouts)
        .set({ isDefault: false })
        .where(and(eq(layouts.userId, ctx.userId), eq(layouts.isDefault, true)))

      // Set new default
      const [updated] = await db
        .update(layouts)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(and(eq(layouts.id, input.id), eq(layouts.userId, ctx.userId)))
        .returning()

      return updated ?? null
    }),
})
