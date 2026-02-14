import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc.js'
import { db } from '../db/connection.js'
import {
  paperPortfolios,
  paperOrders,
  paperPositions,
  paperFills,
} from '../db/schema/paper-trading.js'
import { PaperExecutionEngine } from '../services/paper-execution.js'
import { PositionTracker } from '../services/position-tracker.js'

const engine = new PaperExecutionEngine()
const tracker = new PositionTracker()

const SubmitOrderSchema = z.object({
  portfolioId: z.string().uuid(),
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit', 'stop']),
  quantity: z.number().int().positive(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
})

export const paperTradingRouter = router({
  /** Create a new paper trading portfolio */
  createPortfolio: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        cashBalance: z.number().positive().optional().default(100000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [portfolio] = await db
        .insert(paperPortfolios)
        .values({
          userId: ctx.userId,
          name: input.name,
          cashBalance: input.cashBalance.toFixed(4),
        })
        .returning()

      return portfolio!
    }),

  /** Get the user's portfolio */
  getPortfolio: protectedProcedure
    .input(z.object({ portfolioId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [portfolio] = await db
        .select()
        .from(paperPortfolios)
        .where(
          and(
            eq(paperPortfolios.id, input.portfolioId),
            eq(paperPortfolios.userId, ctx.userId),
          ),
        )

      if (!portfolio) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Portfolio not found' })
      }

      const positions = await db
        .select()
        .from(paperPositions)
        .where(eq(paperPositions.portfolioId, input.portfolioId))

      const positionData = positions.map((p) => ({
        symbol: p.symbol,
        quantity: p.quantity,
        averageCost: parseFloat(p.averageCost),
        currentPrice: parseFloat(p.currentPrice),
      }))

      const summary = tracker.calculatePortfolioSummary(
        positionData,
        parseFloat(portfolio.cashBalance),
      )

      return { portfolio, positions, summary }
    }),

  /** Get the user's portfolios list */
  listPortfolios: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(paperPortfolios)
      .where(eq(paperPortfolios.userId, ctx.userId))
      .orderBy(desc(paperPortfolios.createdAt))
  }),

  /** Submit a new paper order */
  submitOrder: protectedProcedure
    .input(SubmitOrderSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify portfolio ownership
      const [portfolio] = await db
        .select()
        .from(paperPortfolios)
        .where(
          and(
            eq(paperPortfolios.id, input.portfolioId),
            eq(paperPortfolios.userId, ctx.userId),
          ),
        )

      if (!portfolio) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Portfolio not found' })
      }

      // Validate limit/stop price requirements
      if (input.type === 'limit' && !input.limitPrice) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Limit price required for limit orders',
        })
      }
      if (input.type === 'stop' && !input.stopPrice) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Stop price required for stop orders',
        })
      }

      // For sell orders, validate we have enough shares
      if (input.side === 'sell') {
        const [position] = await db
          .select()
          .from(paperPositions)
          .where(
            and(
              eq(paperPositions.portfolioId, input.portfolioId),
              eq(paperPositions.symbol, input.symbol),
            ),
          )

        if (!position || !engine.validateSellQuantity(position.quantity, input.quantity)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient shares for sell order',
          })
        }
      }

      const [order] = await db
        .insert(paperOrders)
        .values({
          portfolioId: input.portfolioId,
          symbol: input.symbol,
          side: input.side,
          type: input.type,
          quantity: input.quantity,
          limitPrice: input.limitPrice?.toFixed(4),
          stopPrice: input.stopPrice?.toFixed(4),
          status: 'pending',
        })
        .returning()

      return order!
    }),

  /** Cancel a pending order */
  cancelOrder: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [order] = await db
        .select()
        .from(paperOrders)
        .where(eq(paperOrders.id, input.orderId))

      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' })
      }

      // Verify ownership through portfolio
      const [portfolio] = await db
        .select()
        .from(paperPortfolios)
        .where(
          and(
            eq(paperPortfolios.id, order.portfolioId),
            eq(paperPortfolios.userId, ctx.userId),
          ),
        )

      if (!portfolio) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Portfolio not found' })
      }

      if (order.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only pending orders can be cancelled',
        })
      }

      const [updated] = await db
        .update(paperOrders)
        .set({ status: 'cancelled' })
        .where(eq(paperOrders.id, input.orderId))
        .returning()

      return updated!
    }),

  /** Get positions for a portfolio */
  getPositions: protectedProcedure
    .input(z.object({ portfolioId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const [portfolio] = await db
        .select()
        .from(paperPortfolios)
        .where(
          and(
            eq(paperPortfolios.id, input.portfolioId),
            eq(paperPortfolios.userId, ctx.userId),
          ),
        )

      if (!portfolio) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Portfolio not found' })
      }

      const positions = await db
        .select()
        .from(paperPositions)
        .where(eq(paperPositions.portfolioId, input.portfolioId))

      return positions.map((p) => {
        const pnl = tracker.calculatePositionPnL({
          symbol: p.symbol,
          quantity: p.quantity,
          averageCost: parseFloat(p.averageCost),
          currentPrice: parseFloat(p.currentPrice),
        })
        return { ...p, ...pnl }
      })
    }),

  /** Get orders for a portfolio */
  getOrders: protectedProcedure
    .input(
      z.object({
        portfolioId: z.string().uuid(),
        status: z.enum(['pending', 'filled', 'partially_filled', 'cancelled']).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [portfolio] = await db
        .select()
        .from(paperPortfolios)
        .where(
          and(
            eq(paperPortfolios.id, input.portfolioId),
            eq(paperPortfolios.userId, ctx.userId),
          ),
        )

      if (!portfolio) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Portfolio not found' })
      }

      const conditions = [eq(paperOrders.portfolioId, input.portfolioId)]
      if (input.status) {
        conditions.push(eq(paperOrders.status, input.status))
      }

      return db
        .select()
        .from(paperOrders)
        .where(and(...conditions))
        .orderBy(desc(paperOrders.createdAt))
    }),

  /** Get order fill history */
  getOrderHistory: protectedProcedure
    .input(z.object({ portfolioId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [portfolio] = await db
        .select()
        .from(paperPortfolios)
        .where(
          and(
            eq(paperPortfolios.id, input.portfolioId),
            eq(paperPortfolios.userId, ctx.userId),
          ),
        )

      if (!portfolio) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Portfolio not found' })
      }

      return db
        .select()
        .from(paperOrders)
        .where(eq(paperOrders.portfolioId, input.portfolioId))
        .orderBy(desc(paperOrders.createdAt))
        .limit(100)
    }),
})
