import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import {
  brokerConnections,
  liveOrders,
  livePositions,
} from '../db/schema/broker-connections.js'
import { AlpacaAdapter } from '../adapters/broker/alpaca.js'
import { IBKRAdapter } from '../adapters/broker/ibkr.js'
import { RiskConfirmationService } from '../services/risk-confirmation.js'
import { MultiAccountManager } from '../services/multi-account.js'
import type { BrokerAdapter } from '../adapters/broker/broker.interface.js'
import {
  ibkrBracketOrderSchema,
  ibkrOCAOrderSchema,
  ibkrConditionalOrderSchema,
  ibkrAdaptiveAlgoSchema,
} from '@marlin/shared'

// ── Adapter Cache (per-connection) ─────────────────────────

const adapterCache = new Map<string, BrokerAdapter>()
const multiAccountMgr = new MultiAccountManager()

async function getAdapter(connectionId: string, userId: string): Promise<BrokerAdapter> {
  const cached = adapterCache.get(connectionId)
  if (cached) return cached

  const [connection] = await db
    .select()
    .from(brokerConnections)
    .where(
      and(
        eq(brokerConnections.id, connectionId),
        eq(brokerConnections.userId, userId),
        eq(brokerConnections.isActive, true),
      ),
    )

  if (!connection) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'No active broker connection found',
    })
  }

  let adapter: BrokerAdapter

  if (connection.provider === 'alpaca') {
    const alpaca = new AlpacaAdapter()
    await alpaca.authenticate({
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken ?? undefined,
      paper: connection.isPaper,
    })
    adapter = alpaca
  } else if (connection.provider === 'ibkr') {
    const ibkr = new IBKRAdapter()
    await ibkr.authenticate({
      accessToken: connection.accessToken,
      paper: connection.isPaper,
    })
    adapter = ibkr
    // Register with multi-account manager
    multiAccountMgr.registerAdapter(connectionId, ibkr)
  } else {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Broker provider "${connection.provider}" is not yet supported`,
    })
  }

  adapterCache.set(connectionId, adapter)
  return adapter
}

/**
 * Get an IBKR-specific adapter (throws if connection is not IBKR).
 */
async function getIBKRAdapter(connectionId: string, userId: string): Promise<IBKRAdapter> {
  const adapter = await getAdapter(connectionId, userId)
  if (!(adapter instanceof IBKRAdapter)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'This endpoint is only available for IBKR connections',
    })
  }
  return adapter
}

// ── Zod Schemas ────────────────────────────────────────────

const ConnectSchema = z.object({
  provider: z.enum(['alpaca', 'ibkr', 'tradier']),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  paper: z.boolean().optional().default(false),
})

const SubmitOrderSchema = z.object({
  connectionId: z.string().uuid(),
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit', 'stop', 'stop_limit', 'trailing_stop']),
  quantity: z.number().int().positive(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  trailPercent: z.number().positive().optional(),
  trailPrice: z.number().positive().optional(),
  timeInForce: z.enum(['day', 'gtc', 'ioc', 'fok']).optional().default('day'),
  extendedHours: z.boolean().optional(),
  /** User acknowledged the risk warnings */
  riskAcknowledged: z.boolean().optional().default(false),
  /** Current price estimate for risk calculations (market orders) */
  estimatedPrice: z.number().positive().optional(),
})

// ── Router ─────────────────────────────────────────────────

export const brokerRouter = router({
  /** Initiate a broker connection via OAuth tokens */
  connect: protectedProcedure
    .input(ConnectSchema)
    .mutation(async ({ ctx, input }) => {
      let adapter: BrokerAdapter
      let session

      if (input.provider === 'alpaca') {
        const alpaca = new AlpacaAdapter()
        session = await alpaca.authenticate({
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          paper: input.paper,
        })
        adapter = alpaca
      } else if (input.provider === 'ibkr') {
        const ibkr = new IBKRAdapter()
        session = await ibkr.authenticate({
          accessToken: input.accessToken,
          paper: input.paper,
        })
        adapter = ibkr
      } else {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Broker "${input.provider}" is not yet supported`,
        })
      }

      // Store the connection
      const [connection] = await db
        .insert(brokerConnections)
        .values({
          userId: ctx.userId,
          provider: input.provider,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          accountId: session.accountId,
          isActive: true,
          isPaper: input.paper,
        })
        .returning()

      // Cache the adapter
      adapterCache.set(connection!.id, adapter)

      // Register IBKR adapter with multi-account manager
      if (input.provider === 'ibkr' && adapter instanceof IBKRAdapter) {
        multiAccountMgr.registerAdapter(connection!.id, adapter)
      }

      return {
        connectionId: connection!.id,
        accountId: session.accountId,
        provider: input.provider,
      }
    }),

  /** Disconnect a broker and revoke tokens */
  disconnect: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [connection] = await db
        .select()
        .from(brokerConnections)
        .where(
          and(
            eq(brokerConnections.id, input.connectionId),
            eq(brokerConnections.userId, ctx.userId),
          ),
        )

      if (!connection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Broker connection not found' })
      }

      // Clean up the adapter
      const cached = adapterCache.get(input.connectionId)
      if (cached) {
        cached.disconnect()
        adapterCache.delete(input.connectionId)
      }

      // Mark inactive
      await db
        .update(brokerConnections)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(brokerConnections.id, input.connectionId))

      return { success: true }
    }),

  /** Get broker account info (balance, buying power, etc.) */
  getAccount: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const adapter = await getAdapter(input.connectionId, ctx.userId)
      return adapter.getAccount()
    }),

  /** Fetch live positions from the broker */
  getPositions: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const adapter = await getAdapter(input.connectionId, ctx.userId)
      return adapter.getPositions()
    }),

  /** Submit a live order through the broker */
  submitOrder: protectedProcedure
    .input(SubmitOrderSchema)
    .mutation(async ({ ctx, input }) => {
      const adapter = await getAdapter(input.connectionId, ctx.userId)

      // Fetch current account + positions for risk check
      const [account, positions, existingOrders] = await Promise.all([
        adapter.getAccount(),
        adapter.getPositions(),
        adapter.getOrders('new'),
      ])

      // Build the order with estimated price for market orders
      const orderToSubmit = {
        symbol: input.symbol,
        side: input.side as 'buy' | 'sell',
        type: input.type as 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop',
        quantity: input.quantity,
        limitPrice: input.limitPrice,
        stopPrice: input.stopPrice,
        trailPercent: input.trailPercent,
        trailPrice: input.trailPrice,
        timeInForce: input.timeInForce as 'day' | 'gtc' | 'ioc' | 'fok',
        extendedHours: input.extendedHours,
      }

      // For risk calculation, use estimated price for market orders
      const riskOrder = {
        ...orderToSubmit,
        limitPrice: input.limitPrice ?? input.estimatedPrice,
        stopPrice: input.stopPrice ?? input.estimatedPrice,
      }

      // Calculate daily P&L from account equity change
      const dailyPnL = account.equity - account.lastEquity

      // Run risk checks
      const riskService = new RiskConfirmationService()
      const riskResult = riskService.check(
        riskOrder,
        account,
        positions,
        existingOrders.length,
        dailyPnL,
      )

      if (riskResult.blocked) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: riskResult.blockReason ?? 'Order blocked by risk checks',
        })
      }

      // If medium risk and user hasn't acknowledged warnings, return warnings
      if (riskResult.level === 'medium' && !input.riskAcknowledged) {
        return {
          requiresConfirmation: true as const,
          riskLevel: riskResult.level,
          warnings: riskResult.warnings,
          order: null,
        }
      }

      // Submit to broker
      const result = await adapter.submitOrder(orderToSubmit)

      // Persist to local DB
      await db.insert(liveOrders).values({
        userId: ctx.userId,
        brokerId: input.connectionId,
        brokerOrderId: result.orderId,
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        quantity: input.quantity,
        limitPrice: input.limitPrice?.toFixed(4),
        stopPrice: input.stopPrice?.toFixed(4),
        status: result.status,
        filledQty: result.filledQuantity,
        avgFillPrice: result.avgFillPrice?.toFixed(4),
      })

      return {
        requiresConfirmation: false as const,
        riskLevel: riskResult.level,
        warnings: riskResult.warnings,
        order: result,
      }
    }),

  /** Cancel a pending order */
  cancelOrder: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        orderId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adapter = await getAdapter(input.connectionId, ctx.userId)
      await adapter.cancelOrder(input.orderId)

      // Update local DB
      await db
        .update(liveOrders)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(
          and(
            eq(liveOrders.brokerOrderId, input.orderId),
            eq(liveOrders.userId, ctx.userId),
          ),
        )

      return { success: true }
    }),

  /** Get orders from the broker with optional status filter */
  getOrders: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        status: z
          .enum([
            'new',
            'accepted',
            'pending_new',
            'partially_filled',
            'filled',
            'cancelled',
            'expired',
            'rejected',
            'replaced',
          ])
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const adapter = await getAdapter(input.connectionId, ctx.userId)
      return adapter.getOrders(input.status)
    }),

  /** Force sync positions from broker to local DB */
  syncPositions: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const adapter = await getAdapter(input.connectionId, ctx.userId)
      const brokerPositions = await adapter.getPositions()

      // Delete existing positions for this connection
      await db
        .delete(livePositions)
        .where(
          and(
            eq(livePositions.brokerId, input.connectionId),
            eq(livePositions.userId, ctx.userId),
          ),
        )

      // Insert fresh positions
      if (brokerPositions.length > 0) {
        await db.insert(livePositions).values(
          brokerPositions.map((p) => ({
            userId: ctx.userId,
            brokerId: input.connectionId,
            symbol: p.symbol,
            quantity: Math.abs(p.quantity),
            avgEntryPrice: p.avgEntryPrice.toFixed(4),
            currentPrice: p.currentPrice.toFixed(4),
            unrealizedPnl: p.unrealizedPnL.toFixed(4),
          })),
        )
      }

      return {
        synced: brokerPositions.length,
        positions: brokerPositions,
      }
    }),

  /** List all broker connections for the user */
  listConnections: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(brokerConnections)
      .where(eq(brokerConnections.userId, ctx.userId))
      .orderBy(desc(brokerConnections.connectedAt))
  }),

  // ── IBKR-Specific Endpoints ────────────────────────────

  /** Search for an IBKR contract by symbol */
  ibkrSearchContract: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        query: z.string().min(1),
        secType: z.enum(['STK', 'OPT', 'FUT', 'CASH', 'BOND']).default('STK'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const adapter = await getIBKRAdapter(input.connectionId, ctx.userId)
      const results = await adapter.contractResolver.searchContract(input.query)
      return results.map((r) => ({
        conid: r.conid,
        symbol: r.symbol,
        description: r.companyName || r.description,
        secType: r.sections?.[0]?.secType ?? 'STK',
      }))
    }),

  /** Resolve a standard symbol to an IBKR conid */
  ibkrResolveContract: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        symbol: z.string().min(1),
        secType: z.enum(['STK', 'OPT', 'FUT', 'CASH', 'BOND']).default('STK'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const adapter = await getIBKRAdapter(input.connectionId, ctx.userId)
      return adapter.contractResolver.resolveContract(input.symbol, input.secType)
    }),

  /** Resolve an options contract to an IBKR conid */
  ibkrResolveOptions: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        underlying: z.string().min(1),
        expiry: z.string().min(6),
        strike: z.number().positive(),
        right: z.enum(['C', 'P']),
      }),
    )
    .query(async ({ ctx, input }) => {
      const adapter = await getIBKRAdapter(input.connectionId, ctx.userId)
      return adapter.contractResolver.resolveOptionsContract(
        input.underlying,
        input.expiry,
        input.strike,
        input.right,
      )
    }),

  /** List all IBKR sub-accounts */
  ibkrListAccounts: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const adapter = await getIBKRAdapter(input.connectionId, ctx.userId)
      const ibkrAccounts = await adapter.listAccounts()
      return ibkrAccounts.map((a) => ({
        accountId: a.accountId,
        displayName: a.displayName || a.accountId,
        alias: a.accountAlias || '',
        type: a.type,
        tradingType: a.tradingType,
        isPaper: a.type === 'DEMO',
        isActive: a.accountStatus === 1,
      }))
    }),

  /** Switch the active IBKR account for order submission */
  ibkrSwitchAccount: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        accountId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adapter = await getIBKRAdapter(input.connectionId, ctx.userId)
      adapter.switchAccount(input.accountId)
      multiAccountMgr.switchAccount(input.connectionId, input.accountId)
      return { success: true, activeAccountId: input.accountId }
    }),

  /** Set a user-friendly alias for an IBKR account */
  ibkrSetAlias: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        alias: z.string().min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await multiAccountMgr.setAlias(ctx.userId, input.accountId, input.alias)
      return { success: true }
    }),

  /** Get aggregated portfolio across all IBKR sub-accounts */
  ibkrAggregatedPortfolio: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Ensure the adapter is loaded
      await getIBKRAdapter(input.connectionId, ctx.userId)
      return multiAccountMgr.getAggregatedPortfolio(input.connectionId)
    }),

  /** Submit a bracket order (entry + profit target + stop loss) */
  submitBracketOrder: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        bracket: ibkrBracketOrderSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adapter = await getIBKRAdapter(input.connectionId, ctx.userId)
      return adapter.submitBracketOrder(input.bracket)
    }),

  /** Submit an OCA (One-Cancels-All) order group */
  submitOCAOrder: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        oca: ibkrOCAOrderSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adapter = await getIBKRAdapter(input.connectionId, ctx.userId)
      return adapter.submitOCAOrder(input.oca)
    }),

  /** Submit a conditional order */
  submitConditionalOrder: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        conditional: ibkrConditionalOrderSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adapter = await getIBKRAdapter(input.connectionId, ctx.userId)
      return adapter.submitConditionalOrder(input.conditional)
    }),

  /** Submit an adaptive algo order */
  submitAdaptiveAlgo: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        algo: ibkrAdaptiveAlgoSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adapter = await getIBKRAdapter(input.connectionId, ctx.userId)
      return adapter.submitAdaptiveAlgoOrder(input.algo)
    }),

  /** Cancel all pending orders for a connection */
  cancelAllOrders: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const adapter = await getAdapter(input.connectionId, ctx.userId)
      const pendingOrders = await adapter.getOrders('new')
      let cancelledCount = 0

      for (const order of pendingOrders) {
        try {
          await adapter.cancelOrder(order.orderId)
          cancelledCount++
        } catch {
          // Continue cancelling others even if one fails
        }
      }

      return { cancelledCount }
    }),
})
