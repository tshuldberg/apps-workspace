import { z } from 'zod'

// ── Time In Force ──────────────────────────────────────────────────────────

export const TimeInForceSchema = z.enum(['DAY', 'GTC', 'IOC', 'FOK', 'GTD', 'OPG', 'CLS'])
export type TimeInForce = z.infer<typeof TimeInForceSchema>

// ── Order Condition ────────────────────────────────────────────────────────

export const OrderConditionSchema = z.object({
  type: z.enum(['price', 'time', 'indicator']),
  /** Symbol to watch (defaults to the order's own symbol if omitted) */
  symbol: z.string().min(1).max(10).optional(),
  operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']),
  /** Threshold value — number for price/indicator, ISO string for time */
  value: z.union([z.number(), z.string()]),
})
export type OrderCondition = z.infer<typeof OrderConditionSchema>

// ── Base Order Reference ───────────────────────────────────────────────────

export const OrderReferenceSchema = z.object({
  id: z.string().uuid().optional(),
  symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit', 'stop', 'stop_limit', 'trailing_stop']),
  quantity: z.number().int().positive(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  timeInForce: TimeInForceSchema.optional().default('DAY'),
})
export type OrderReference = z.infer<typeof OrderReferenceSchema>

// ── Trailing Stop Order ────────────────────────────────────────────────────

export const TrailingStopOrderSchema = z
  .object({
    symbol: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
    side: z.enum(['buy', 'sell']),
    quantity: z.number().int().positive(),
    /** Trail by a fixed dollar amount */
    trailAmount: z.number().positive().optional(),
    /** Trail by a percentage (e.g. 0.02 = 2%) */
    trailPercent: z.number().positive().max(1).optional(),
    /** Only activate the trailing stop once price reaches this level */
    activationPrice: z.number().positive().optional(),
    timeInForce: TimeInForceSchema.optional().default('GTC'),
  })
  .refine((data) => data.trailAmount !== undefined || data.trailPercent !== undefined, {
    message: 'Either trailAmount or trailPercent must be provided',
  })
export type TrailingStopOrder = z.infer<typeof TrailingStopOrderSchema>

// ── Bracket Order Group ────────────────────────────────────────────────────

export const BracketOrderGroupSchema = z.object({
  entryOrder: OrderReferenceSchema,
  takeProfitOrder: OrderReferenceSchema,
  stopLossOrder: OrderReferenceSchema,
  /** OCO (One Cancels Other) group identifier linking TP and SL */
  ocoGroupId: z.string().uuid(),
})
export type BracketOrderGroup = z.infer<typeof BracketOrderGroupSchema>

// ── Conditional Order ──────────────────────────────────────────────────────

export const ConditionalOrderSchema = z.object({
  condition: OrderConditionSchema,
  thenOrder: OrderReferenceSchema,
})
export type ConditionalOrder = z.infer<typeof ConditionalOrderSchema>

// ── Advanced Order Submission Schemas ──────────────────────────────────────

export const SubmitTrailingStopSchema = z.object({
  portfolioId: z.string().uuid(),
  order: TrailingStopOrderSchema,
})

export const SubmitBracketSchema = z.object({
  portfolioId: z.string().uuid(),
  bracket: BracketOrderGroupSchema,
})

export const SubmitConditionalSchema = z.object({
  portfolioId: z.string().uuid(),
  conditional: ConditionalOrderSchema,
})

export const ModifyOrderSchema = z.object({
  orderId: z.string().uuid(),
  newPrice: z.number().positive().optional(),
  newQuantity: z.number().int().positive().optional(),
  newStopPrice: z.number().positive().optional(),
})
