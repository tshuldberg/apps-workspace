import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, publicProcedure } from '../trpc.js'
import {
  SubmitTrailingStopSchema,
  SubmitBracketSchema,
  SubmitConditionalSchema,
  ModifyOrderSchema,
} from '@marlin/shared'
import {
  calculateSpread,
  volumeWeightedMidPrice,
  getDOM,
  emptyOrderBook,
} from '../../../../services/market-data/src/aggregation/order-book.js'

export const advancedOrdersRouter = router({
  /** Submit a trailing stop order */
  submitTrailingStop: protectedProcedure
    .input(SubmitTrailingStopSchema)
    .mutation(async ({ ctx, input }) => {
      const { portfolioId, order } = input

      // Validate that at least one trail parameter is set (Zod refine handles this,
      // but we add a runtime guard for clarity in error messages)
      if (!order.trailAmount && !order.trailPercent) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Either trailAmount or trailPercent must be provided',
        })
      }

      // TODO: Persist to paper_orders with type 'trailing_stop' and attach trail metadata
      // TODO: Wire into PaperExecutionEngine for trailing logic

      return {
        id: crypto.randomUUID(),
        portfolioId,
        symbol: order.symbol,
        side: order.side,
        type: 'trailing_stop' as const,
        quantity: order.quantity,
        trailAmount: order.trailAmount,
        trailPercent: order.trailPercent,
        activationPrice: order.activationPrice,
        timeInForce: order.timeInForce,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      }
    }),

  /** Submit a bracket order (entry + take-profit + stop-loss) */
  submitBracket: protectedProcedure
    .input(SubmitBracketSchema)
    .mutation(async ({ ctx, input }) => {
      const { portfolioId, bracket } = input

      // Validate that TP and SL are on the correct sides relative to entry
      const isLong = bracket.entryOrder.side === 'buy'

      if (bracket.takeProfitOrder.limitPrice && bracket.entryOrder.limitPrice) {
        const tpValid = isLong
          ? bracket.takeProfitOrder.limitPrice > bracket.entryOrder.limitPrice
          : bracket.takeProfitOrder.limitPrice < bracket.entryOrder.limitPrice
        if (!tpValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Take-profit price must be favorable relative to entry price',
          })
        }
      }

      if (bracket.stopLossOrder.stopPrice && bracket.entryOrder.limitPrice) {
        const slValid = isLong
          ? bracket.stopLossOrder.stopPrice < bracket.entryOrder.limitPrice
          : bracket.stopLossOrder.stopPrice > bracket.entryOrder.limitPrice
        if (!slValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Stop-loss price must be adverse relative to entry price',
          })
        }
      }

      // TODO: Persist all three orders linked by ocoGroupId
      // TODO: Wire OCO logic — when TP fills, cancel SL and vice versa

      return {
        ocoGroupId: bracket.ocoGroupId,
        portfolioId,
        entryOrder: {
          id: crypto.randomUUID(),
          ...bracket.entryOrder,
          status: 'pending' as const,
        },
        takeProfitOrder: {
          id: crypto.randomUUID(),
          ...bracket.takeProfitOrder,
          status: 'pending' as const,
        },
        stopLossOrder: {
          id: crypto.randomUUID(),
          ...bracket.stopLossOrder,
          status: 'pending' as const,
        },
        createdAt: new Date().toISOString(),
      }
    }),

  /** Submit a conditional order (trigger condition + order) */
  submitConditional: protectedProcedure
    .input(SubmitConditionalSchema)
    .mutation(async ({ ctx, input }) => {
      const { portfolioId, conditional } = input

      // Validate condition value type matches condition type
      if (conditional.condition.type === 'price' && typeof conditional.condition.value !== 'number') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Price condition requires a numeric value',
        })
      }
      if (conditional.condition.type === 'time' && typeof conditional.condition.value !== 'string') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Time condition requires a string value (ISO datetime)',
        })
      }

      // TODO: Persist condition + order, register with condition evaluator service

      return {
        id: crypto.randomUUID(),
        portfolioId,
        condition: conditional.condition,
        thenOrder: {
          id: crypto.randomUUID(),
          ...conditional.thenOrder,
          status: 'waiting' as const,
        },
        createdAt: new Date().toISOString(),
      }
    }),

  /** Modify an existing pending order (price, quantity, or stop price) */
  modifyOrder: protectedProcedure
    .input(ModifyOrderSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: Look up order by ID, verify ownership, apply modifications
      // For now, return the modification acknowledgement

      if (!input.newPrice && !input.newQuantity && !input.newStopPrice) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'At least one modification field must be provided',
        })
      }

      return {
        orderId: input.orderId,
        modifications: {
          ...(input.newPrice !== undefined && { limitPrice: input.newPrice }),
          ...(input.newQuantity !== undefined && { quantity: input.newQuantity }),
          ...(input.newStopPrice !== undefined && { stopPrice: input.newStopPrice }),
        },
        status: 'modified' as const,
        modifiedAt: new Date().toISOString(),
      }
    }),

  /** Get the current Level 2 order book for a symbol */
  getOrderBook: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
        depth: z.number().int().min(1).max(50).optional().default(20),
      }),
    )
    .query(async ({ input }) => {
      // TODO: Read from Redis-cached order book maintained by Level2Provider
      // For now, return an empty book structure
      const book = emptyOrderBook(input.symbol)
      const dom = getDOM(book, input.depth, 0.01)

      return {
        symbol: input.symbol,
        book,
        dom,
        timestamp: Date.now(),
      }
    }),

  /** Get the current bid-ask spread for a symbol */
  getSpread: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
      }),
    )
    .query(async ({ input }) => {
      // TODO: Read live order book from Redis cache
      const book = emptyOrderBook(input.symbol)
      const spread = calculateSpread(book)
      const vwmp = volumeWeightedMidPrice(book)

      return {
        symbol: input.symbol,
        ...spread,
        volumeWeightedMidPrice: vwmp,
        timestamp: Date.now(),
      }
    }),
})
