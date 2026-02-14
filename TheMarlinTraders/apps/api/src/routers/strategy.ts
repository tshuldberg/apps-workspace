import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { router, protectedProcedure, publicProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import { strategies, strategyRuns } from '../db/schema/strategies.js'
import {
  StrategyLanguageSchema,
  StrategyParameterSchema,
  STRATEGY_TEMPLATES,
} from '@marlin/shared'

// ── Input Schemas ──────────────────────────────────────────────────────────

const CreateStrategySchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(1024).optional(),
  language: StrategyLanguageSchema.default('typescript'),
  code: z.string().default(''),
  parameters: z.array(StrategyParameterSchema).default([]),
  isPublic: z.boolean().default(false),
})

const UpdateStrategySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(1024).nullable().optional(),
  language: StrategyLanguageSchema.optional(),
  code: z.string().optional(),
  parameters: z.array(StrategyParameterSchema).optional(),
  isPublic: z.boolean().optional(),
})

const ListStrategiesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
}).optional()

const ValidateCodeSchema = z.object({
  code: z.string(),
  language: StrategyLanguageSchema.default('typescript'),
})

// ── Router ─────────────────────────────────────────────────────────────────

export const strategyRouter = router({
  list: protectedProcedure
    .input(ListStrategiesSchema)
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50
      const offset = input?.offset ?? 0

      return db
        .select()
        .from(strategies)
        .where(eq(strategies.userId, ctx.userId))
        .orderBy(desc(strategies.updatedAt))
        .limit(limit)
        .offset(offset)
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [strategy] = await db
        .select()
        .from(strategies)
        .where(
          and(
            eq(strategies.id, input.id),
            eq(strategies.userId, ctx.userId),
          ),
        )
        .limit(1)

      if (!strategy) {
        throw new Error('Strategy not found')
      }

      return strategy
    }),

  create: protectedProcedure
    .input(CreateStrategySchema)
    .mutation(async ({ ctx, input }) => {
      const [strategy] = await db
        .insert(strategies)
        .values({
          userId: ctx.userId,
          name: input.name,
          description: input.description,
          language: input.language,
          code: input.code,
          parameters: input.parameters,
          isPublic: input.isPublic,
        })
        .returning()

      return strategy
    }),

  update: protectedProcedure
    .input(UpdateStrategySchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input
      const filtered = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined),
      )

      if (Object.keys(filtered).length === 0) {
        throw new Error('No fields to update')
      }

      const [updated] = await db
        .update(strategies)
        .set({ ...filtered, updatedAt: new Date() })
        .where(
          and(
            eq(strategies.id, id),
            eq(strategies.userId, ctx.userId),
          ),
        )
        .returning()

      if (!updated) {
        throw new Error('Strategy not found')
      }

      return updated
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(strategies)
        .where(
          and(
            eq(strategies.id, input.id),
            eq(strategies.userId, ctx.userId),
          ),
        )
        .returning()

      if (!deleted) {
        throw new Error('Strategy not found')
      }

      return deleted
    }),

  getTemplates: publicProcedure.query(() => {
    return STRATEGY_TEMPLATES
  }),

  validate: protectedProcedure
    .input(ValidateCodeSchema)
    .mutation(({ input }) => {
      const errors: { line: number; message: string }[] = []

      if (input.language === 'typescript') {
        // Basic structural validation for TypeScript strategies
        const code = input.code

        // Must contain an onBar function
        if (!code.includes('onBar')) {
          errors.push({
            line: 1,
            message: 'Strategy must define an onBar(bar, indicators, context) function',
          })
        }

        // Check for balanced braces
        let braceCount = 0
        const lines = code.split('\n')
        for (let i = 0; i < lines.length; i++) {
          for (const char of lines[i]!) {
            if (char === '{') braceCount++
            if (char === '}') braceCount--
          }
          if (braceCount < 0) {
            errors.push({ line: i + 1, message: 'Unexpected closing brace' })
            break
          }
        }
        if (braceCount > 0) {
          errors.push({
            line: lines.length,
            message: `${braceCount} unclosed brace(s)`,
          })
        }

        // Check for common syntax errors — unclosed strings
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!
          const singleQuotes = (line.match(/'/g) || []).length
          const doubleQuotes = (line.match(/"/g) || []).length
          const backticks = (line.match(/`/g) || []).length

          // Odd number of unescaped quotes (rough heuristic)
          if (singleQuotes % 2 !== 0 && !line.includes('//') && !line.includes("'s")) {
            // Skip lines that look like comments or contractions
            if (!line.trimStart().startsWith('//') && !line.trimStart().startsWith('*')) {
              errors.push({ line: i + 1, message: 'Possible unclosed string literal' })
            }
          }
        }

        // Check for forbidden API usage
        const forbidden = ['eval(', 'Function(', 'require(', 'import(', 'fetch(', 'XMLHttpRequest']
        for (let i = 0; i < lines.length; i++) {
          for (const pattern of forbidden) {
            if (lines[i]!.includes(pattern)) {
              errors.push({
                line: i + 1,
                message: `'${pattern.replace('(', '')}' is not allowed in strategies`,
              })
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    }),
})
