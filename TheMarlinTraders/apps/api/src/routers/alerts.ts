import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { alerts } from '../db/schema/alerts.js'
import { alertTriggers } from '../db/schema/alert-triggers.js'

const CreateAlertSchema = z.object({
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  conditionType: z.enum([
    'price_above',
    'price_below',
    'price_crossing_up',
    'price_crossing_down',
    'volume_above',
    'rvol_above',
    'rsi_above',
    'rsi_below',
    'macd_crossover',
    'ma_crossover',
  ]),
  threshold: z.string().min(1),
  deliveryMethod: z.enum(['in_app', 'email', 'webhook', 'push']).default('in_app'),
  webhookUrl: z.string().url().optional(),
  message: z.string().max(500).optional(),
})

const UpdateAlertSchema = z.object({
  id: z.string().uuid(),
  conditionType: z.enum([
    'price_above',
    'price_below',
    'price_crossing_up',
    'price_crossing_down',
    'volume_above',
    'rvol_above',
    'rsi_above',
    'rsi_below',
    'macd_crossover',
    'ma_crossover',
  ]).optional(),
  threshold: z.string().min(1).optional(),
  deliveryMethod: z.enum(['in_app', 'email', 'webhook', 'push']).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  message: z.string().max(500).nullable().optional(),
})

export const alertsRouter = router({
  create: protectedProcedure
    .input(CreateAlertSchema)
    .mutation(async ({ ctx, input }) => {
      const [alert] = await db
        .insert(alerts)
        .values({
          userId: ctx.userId,
          symbol: input.symbol,
          conditionType: input.conditionType,
          threshold: input.threshold,
          deliveryMethod: input.deliveryMethod,
          webhookUrl: input.webhookUrl,
          message: input.message,
        })
        .returning()
      return alert
    }),

  list: protectedProcedure
    .input(
      z.object({
        symbol: z.string().transform((s) => s.toUpperCase()).optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(alerts.userId, ctx.userId)]
      if (input?.symbol) {
        conditions.push(eq(alerts.symbol, input.symbol))
      }
      return db
        .select()
        .from(alerts)
        .where(and(...conditions))
        .orderBy(desc(alerts.createdAt))
    }),

  update: protectedProcedure
    .input(UpdateAlertSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input
      const filtered = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined),
      )
      if (Object.keys(filtered).length === 0) {
        throw new Error('No fields to update')
      }
      const [updated] = await db
        .update(alerts)
        .set({ ...filtered, updatedAt: new Date() })
        .where(and(eq(alerts.id, id), eq(alerts.userId, ctx.userId)))
        .returning()
      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(alerts)
        .where(and(eq(alerts.id, input.id), eq(alerts.userId, ctx.userId)))
        .returning()
      return deleted
    }),

  pause: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(alerts)
        .set({ status: 'paused', updatedAt: new Date() })
        .where(and(eq(alerts.id, input.id), eq(alerts.userId, ctx.userId)))
        .returning()
      return updated
    }),

  resume: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(alerts)
        .set({ status: 'active', updatedAt: new Date() })
        .where(and(eq(alerts.id, input.id), eq(alerts.userId, ctx.userId)))
        .returning()
      return updated
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        alertId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify the alert belongs to the user
      const [alert] = await db
        .select()
        .from(alerts)
        .where(and(eq(alerts.id, input.alertId), eq(alerts.userId, ctx.userId)))
        .limit(1)

      if (!alert) {
        throw new Error('Alert not found')
      }

      return db
        .select()
        .from(alertTriggers)
        .where(eq(alertTriggers.alertId, input.alertId))
        .orderBy(desc(alertTriggers.triggeredAt))
        .limit(input.limit)
    }),
})
