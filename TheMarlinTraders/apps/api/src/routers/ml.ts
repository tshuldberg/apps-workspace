import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc.js'
import {
  TrainingConfigSchema,
  MLFeatureSchema,
  PREBUILT_FEATURE_SETS,
} from '@marlin/shared'
import { MLModelService } from '../services/ml-model.js'
import { DriftDetector } from '../services/ml-drift.js'

// ── Service instances ──────────────────────────────────────

const mlModelService = new MLModelService()
const driftDetector = new DriftDetector()

// ── Router ─────────────────────────────────────────────────

export const mlRouter = router({
  /** List all ML models for the authenticated user */
  listModels: protectedProcedure.query(({ ctx }) => {
    return mlModelService.listModels(ctx.userId)
  }),

  /** Create a new ML model from a training configuration */
  createModel: protectedProcedure
    .input(TrainingConfigSchema)
    .mutation(({ ctx, input }) => {
      return mlModelService.createModel(ctx.userId, input)
    }),

  /** Train a model (mock training, generates realistic metrics) */
  trainModel: protectedProcedure
    .input(
      z.object({
        modelId: z.string().uuid(),
        data: z
          .object({
            features: z.array(z.array(z.number())),
            targets: z.array(z.number()),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return mlModelService.trainModel(input.modelId, ctx.userId, input.data)
    }),

  /** Generate a prediction from a trained model */
  predict: protectedProcedure
    .input(
      z.object({
        modelId: z.string().uuid(),
        symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
        features: z.record(z.number()),
      }),
    )
    .mutation(({ ctx, input }) => {
      return mlModelService.predict(input.modelId, ctx.userId, input.symbol, input.features)
    }),

  /** Get training metrics for a model */
  getModelMetrics: protectedProcedure
    .input(z.object({ modelId: z.string().uuid() }))
    .query(({ ctx, input }) => {
      return mlModelService.getModelMetrics(input.modelId, ctx.userId)
    }),

  /** Delete a model and its prediction history */
  deleteModel: protectedProcedure
    .input(z.object({ modelId: z.string().uuid() }))
    .mutation(({ ctx, input }) => {
      mlModelService.deleteModel(input.modelId, ctx.userId)
      return { success: true }
    }),

  /** Check for model drift by comparing recent performance to baseline */
  checkDrift: protectedProcedure
    .input(
      z.object({
        modelId: z.string().uuid(),
        recentPredictions: z.array(
          z.object({
            id: z.string().uuid(),
            modelId: z.string().uuid(),
            timestamp: z.string().datetime(),
            symbol: z.string(),
            signal: z.enum(['bullish', 'bearish', 'neutral']),
            confidence: z.number().min(0).max(1),
            features: z.record(z.number()),
          }),
        ),
        recentOutcomes: z.array(z.enum(['bullish', 'bearish', 'neutral'])),
      }),
    )
    .query(({ ctx, input }) => {
      const metrics = mlModelService.getModelMetrics(input.modelId, ctx.userId)
      const report = driftDetector.checkDrift(
        input.modelId,
        metrics,
        input.recentPredictions,
        input.recentOutcomes,
      )

      // If critical drift, mark model as degraded
      if (report?.severity === 'critical') {
        mlModelService.updateModelStatus(input.modelId, 'degraded')
      }

      return report
    }),

  /** Get drift detection history for a model */
  getDriftHistory: protectedProcedure
    .input(z.object({ modelId: z.string().uuid() }))
    .query(({ input }) => {
      return driftDetector.getDriftHistory(input.modelId)
    }),

  /** List pre-built feature sets (public — no auth required) */
  listFeatureSets: publicProcedure.query(() => {
    return PREBUILT_FEATURE_SETS
  }),
})
