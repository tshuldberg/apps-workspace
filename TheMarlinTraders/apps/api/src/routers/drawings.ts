import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { drawings } from '../db/schema/drawings.js'

const PointSchema = z.object({
  time: z.number(),
  price: z.number(),
})

const StyleSchema = z.object({
  color: z.string(),
  lineWidth: z.number().min(0.5).max(10),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']),
  fillColor: z.string().optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  textColor: z.string().optional(),
})

const CreateDrawingSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  timeframe: z.string().min(1),
  toolType: z.string().min(1),
  points: z.array(PointSchema).min(1).max(10),
  style: StyleSchema,
  text: z.string().max(1000).optional(),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
})

const UpdateDrawingSchema = z.object({
  id: z.string().uuid(),
  points: z.array(PointSchema).min(1).max(10).optional(),
  style: StyleSchema.partial().optional(),
  text: z.string().max(1000).nullable().optional(),
  locked: z.boolean().optional(),
  visible: z.boolean().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
})

export const drawingsRouter = router({
  save: protectedProcedure
    .input(CreateDrawingSchema)
    .mutation(async ({ ctx, input }) => {
      const [drawing] = await db
        .insert(drawings)
        .values({
          userId: ctx.userId,
          symbol: input.symbol,
          timeframe: input.timeframe,
          toolType: input.toolType,
          points: input.points,
          style: input.style,
          text: input.text,
          locked: String(input.locked),
          visible: String(input.visible),
          metadata: input.metadata,
        })
        .returning()
      return drawing
    }),

  load: protectedProcedure
    .input(
      z.object({
        symbol: z.string().transform((s) => s.toUpperCase()),
        timeframe: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      return db
        .select()
        .from(drawings)
        .where(
          and(
            eq(drawings.userId, ctx.userId),
            eq(drawings.symbol, input.symbol),
            eq(drawings.timeframe, input.timeframe),
          ),
        )
        .orderBy(desc(drawings.createdAt))
    }),

  update: protectedProcedure
    .input(UpdateDrawingSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input
      const setValues: Record<string, unknown> = { updatedAt: new Date() }

      if (updates.points !== undefined) setValues.points = updates.points
      if (updates.style !== undefined) setValues.style = updates.style
      if (updates.text !== undefined) setValues.text = updates.text
      if (updates.locked !== undefined) setValues.locked = String(updates.locked)
      if (updates.visible !== undefined) setValues.visible = String(updates.visible)
      if (updates.metadata !== undefined) setValues.metadata = updates.metadata

      const [updated] = await db
        .update(drawings)
        .set(setValues)
        .where(and(eq(drawings.id, id), eq(drawings.userId, ctx.userId)))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(drawings)
        .where(and(eq(drawings.id, input.id), eq(drawings.userId, ctx.userId)))
        .returning()
      return deleted
    }),

  deleteAllForSymbol: protectedProcedure
    .input(
      z.object({
        symbol: z.string().transform((s) => s.toUpperCase()),
        timeframe: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const deleted = await db
        .delete(drawings)
        .where(
          and(
            eq(drawings.userId, ctx.userId),
            eq(drawings.symbol, input.symbol),
            eq(drawings.timeframe, input.timeframe),
          ),
        )
        .returning()
      return { count: deleted.length }
    }),
})
