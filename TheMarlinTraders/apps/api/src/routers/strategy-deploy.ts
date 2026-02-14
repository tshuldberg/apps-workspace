import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc.js'
import { StrategyDeployer } from '../services/strategy-deployer.js'
import type { RiskConfig } from '../services/strategy-risk.js'

// ── Singleton deployer ───────────────────────────────────────

const deployer = new StrategyDeployer()

// ── Zod Schemas ──────────────────────────────────────────────

const DeploySchema = z.object({
  strategyId: z.string().min(1),
  strategyName: z.string().min(1).max(100),
  code: z.string().min(1).max(65_536),
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  mode: z.enum(['paper', 'live']),
  brokerConnectionId: z.string().uuid().optional(),
  equity: z.number().positive().default(100_000),
  riskConfig: z
    .object({
      maxPositionSizePercent: z.number().min(1).max(100).optional(),
      maxTotalExposurePercent: z.number().min(1).max(500).optional(),
      maxDailyLossPercent: z.number().min(0.1).max(100).optional(),
      maxDrawdownPercent: z.number().min(0.1).max(100).optional(),
    })
    .optional(),
})

const StopSchema = z.object({
  deploymentId: z.string().min(1),
})

const DeploymentIdSchema = z.object({
  deploymentId: z.string().min(1),
})

const UpdateRiskConfigSchema = z.object({
  deploymentId: z.string().min(1),
  config: z.object({
    maxPositionSizePercent: z.number().min(1).max(100).optional(),
    maxTotalExposurePercent: z.number().min(1).max(500).optional(),
    maxDailyLossPercent: z.number().min(0.1).max(100).optional(),
    maxDrawdownPercent: z.number().min(0.1).max(100).optional(),
  }),
})

// ── Router ───────────────────────────────────────────────────

export const strategyDeployRouter = router({
  /** Deploy a strategy in paper or live mode */
  deploy: protectedProcedure
    .input(DeploySchema)
    .mutation(async ({ ctx, input }) => {
      // Live mode safety gate
      if (input.mode === 'live' && !input.brokerConnectionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Live mode requires a broker connection ID',
        })
      }

      const result = deployer.deploy({
        strategyId: input.strategyId,
        strategyName: input.strategyName,
        code: input.code,
        symbol: input.symbol,
        mode: input.mode,
        brokerConnectionId: input.brokerConnectionId,
        equity: input.equity,
        riskConfig: input.riskConfig,
      })

      if ('error' in result) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error,
        })
      }

      return {
        deploymentId: result.deploymentId,
        mode: input.mode,
        symbol: input.symbol,
      }
    }),

  /** Stop a running strategy deployment */
  stop: protectedProcedure
    .input(StopSchema)
    .mutation(async ({ ctx, input }) => {
      const result = deployer.stop(input.deploymentId)
      if (!result.success) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: result.error ?? 'Failed to stop deployment',
        })
      }
      return { success: true }
    }),

  /** Emergency kill: stop ALL active deployments */
  stopAll: protectedProcedure.mutation(async () => {
    return deployer.stopAll()
  }),

  /** List active deployments */
  getActive: protectedProcedure.query(async () => {
    return deployer.getActive()
  }),

  /** List all deployments (any status) */
  getAll: protectedProcedure.query(async () => {
    return deployer.getAll()
  }),

  /** Get detailed status for a specific deployment */
  getDeploymentStatus: protectedProcedure
    .input(DeploymentIdSchema)
    .query(async ({ input }) => {
      const detail = deployer.getStatus(input.deploymentId)
      if (!detail) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deployment not found',
        })
      }
      return detail
    }),

  /** Get risk config for a deployment */
  getRiskConfig: protectedProcedure
    .input(DeploymentIdSchema)
    .query(async ({ input }) => {
      const config = deployer.getRiskConfig(input.deploymentId)
      if (!config) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deployment not found',
        })
      }
      return config
    }),

  /** Update risk config for a deployment */
  updateRiskConfig: protectedProcedure
    .input(UpdateRiskConfigSchema)
    .mutation(async ({ input }) => {
      const result = deployer.updateRiskConfig(input.deploymentId, input.config)
      if (!result.success) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: result.error ?? 'Failed to update risk config',
        })
      }
      return { success: true }
    }),

  /** Reset kill switch and resume a deployment */
  resetKillSwitch: protectedProcedure
    .input(DeploymentIdSchema)
    .mutation(async ({ input }) => {
      const result = deployer.resetKillSwitch(input.deploymentId)
      if (!result.success) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: result.error ?? 'Failed to reset kill switch',
        })
      }
      return { success: true }
    }),
})
