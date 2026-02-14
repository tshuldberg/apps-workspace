import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, publicProcedure, protectedProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { savedScreeners } from '../db/schema/screeners.js'
import type { ScreenerFilterSet } from '../db/schema/screeners.js'
import { runScreenerScan } from '../services/screener-engine.js'
import { getScreenerTemplates, getScreenerTemplate } from '../services/screener-templates.js'
import {
  FUNDAMENTAL_FILTERS,
  TECHNICAL_FILTERS,
  PRICE_ACTION_FILTERS,
} from '../services/screener-filters/index.js'

const FilterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'between', 'in']),
  value: z.union([z.number(), z.string(), z.array(z.number()), z.array(z.string())]),
  category: z.enum(['fundamental', 'technical', 'price_action']),
})

const FilterSetSchema = z.object({
  logic: z.enum(['AND', 'OR']).default('AND'),
  filters: z.array(FilterSchema).min(1).max(20),
})

const ScanInputSchema = z.object({
  filters: FilterSetSchema,
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
  sortBy: z.string().default('symbol'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
})

const SaveScreenerSchema = z.object({
  name: z.string().min(1).max(128),
  filters: FilterSetSchema,
})

export const screenerRouter = router({
  /** Run a screener scan with the given filters */
  scan: publicProcedure
    .input(ScanInputSchema)
    .query(async ({ ctx, input }) => {
      return runScreenerScan({
        filters: input.filters as ScreenerFilterSet,
        limit: input.limit,
        offset: input.offset,
        sortBy: input.sortBy,
        sortDir: input.sortDir,
        clerkUserId: ctx.userId ?? undefined,
      })
    }),

  /** Save a screener for the current user */
  save: protectedProcedure
    .input(SaveScreenerSchema)
    .mutation(async ({ ctx, input }) => {
      const [screener] = await db
        .insert(savedScreeners)
        .values({
          userId: ctx.userId,
          name: input.name,
          filters: input.filters as ScreenerFilterSet,
          isTemplate: false,
        })
        .returning()
      return screener
    }),

  /** List saved screeners for the current user */
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(savedScreeners)
      .where(
        and(
          eq(savedScreeners.userId, ctx.userId),
          eq(savedScreeners.isTemplate, false),
        ),
      )
      .orderBy(desc(savedScreeners.createdAt))
  }),

  /** Delete a saved screener */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(savedScreeners)
        .where(
          and(
            eq(savedScreeners.id, input.id),
            eq(savedScreeners.userId, ctx.userId),
          ),
        )
        .returning()
      return deleted
    }),

  /** Get pre-built scan templates (public) */
  getTemplates: publicProcedure.query(() => {
    return getScreenerTemplates()
  }),

  /** Get a specific template by ID (public) */
  getTemplate: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => {
      return getScreenerTemplate(input.id) ?? null
    }),

  /** Get all available filter definitions grouped by category (public) */
  getFilterDefinitions: publicProcedure.query(() => {
    return {
      fundamental: FUNDAMENTAL_FILTERS,
      technical: TECHNICAL_FILTERS,
      price_action: PRICE_ACTION_FILTERS,
    }
  }),
})
