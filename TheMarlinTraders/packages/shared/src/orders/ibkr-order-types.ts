/**
 * IBKR-Specific Order Types
 *
 * Type definitions and Zod schemas for Interactive Brokers advanced
 * order types: bracket orders, OCA groups, conditional orders, and
 * adaptive algo orders.
 */

import { z } from 'zod'

// ── Common Enums ──────────────────────────────────────────

export type IBKRSecType = 'STK' | 'OPT' | 'FUT' | 'CASH' | 'BOND'
export type IBKROrderAction = 'BUY' | 'SELL'
export type IBKROrderType = 'MKT' | 'LMT' | 'STP' | 'STP_LMT' | 'TRAIL' | 'MIT'
export type IBKRTimeInForce = 'DAY' | 'GTC' | 'IOC' | 'FOK' | 'OPG' | 'DTC'

// ── Contract ──────────────────────────────────────────────

export const ibkrContractSchema = z.object({
  conid: z.number().int().positive(),
  symbol: z.string().min(1),
  secType: z.enum(['STK', 'OPT', 'FUT', 'CASH', 'BOND']),
  exchange: z.string().default('SMART'),
  currency: z.string().default('USD'),
  /** Options-only fields */
  lastTradeDateOrContractMonth: z.string().optional(),
  strike: z.number().optional(),
  right: z.enum(['C', 'P']).optional(),
  multiplier: z.string().optional(),
})

export type IBKRContract = z.infer<typeof ibkrContractSchema>

// ── Bracket Order ─────────────────────────────────────────

export const ibkrBracketOrderSchema = z.object({
  /** Entry order */
  entry: z.object({
    conid: z.number().int().positive(),
    action: z.enum(['BUY', 'SELL']),
    orderType: z.enum(['MKT', 'LMT', 'STP', 'STP_LMT']),
    quantity: z.number().positive(),
    limitPrice: z.number().optional(),
    stopPrice: z.number().optional(),
    timeInForce: z.enum(['DAY', 'GTC', 'IOC', 'FOK']).default('DAY'),
  }),

  /** Profit target (attached to entry) */
  profitTarget: z.object({
    limitPrice: z.number().positive(),
    /** Target as % from entry (alternative to absolute price) */
    percentFromEntry: z.number().optional(),
  }),

  /** Stop loss (attached to entry) */
  stopLoss: z.object({
    stopPrice: z.number().positive(),
    /** Stop as % from entry (alternative to absolute price) */
    percentFromEntry: z.number().optional(),
    /** Optional trailing amount */
    trailingAmount: z.number().optional(),
    trailingType: z.enum(['amount', 'percent']).optional(),
  }),

  /** Human-readable label for this bracket group */
  groupLabel: z.string().optional(),
})

export type IBKRBracketOrder = z.infer<typeof ibkrBracketOrderSchema>

// ── OCA (One-Cancels-All) ─────────────────────────────────

export const ibkrOCAOrderSchema = z.object({
  /** Unique OCA group identifier */
  ocaGroup: z.string().min(1),

  /** Type: 1 = cancel remaining, 2 = reduce remaining, 3 = reduce non-block */
  ocaType: z.number().int().min(1).max(3).default(1),

  /** The orders in this OCA group (2 or more) */
  orders: z
    .array(
      z.object({
        conid: z.number().int().positive(),
        action: z.enum(['BUY', 'SELL']),
        orderType: z.enum(['MKT', 'LMT', 'STP', 'STP_LMT', 'TRAIL', 'MIT']),
        quantity: z.number().positive(),
        limitPrice: z.number().optional(),
        stopPrice: z.number().optional(),
        timeInForce: z.enum(['DAY', 'GTC', 'IOC', 'FOK']).default('GTC'),
      }),
    )
    .min(2, 'OCA group requires at least 2 orders'),
})

export type OCAOrder = z.infer<typeof ibkrOCAOrderSchema>

// ── Conditional Order ─────────────────────────────────────

export const ibkrConditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('price'),
    conid: z.number().int().positive(),
    operator: z.enum(['>=', '<=', '>', '<']),
    value: z.number(),
    exchange: z.string().default('SMART'),
    triggerMethod: z.enum(['default', 'doubleBidAsk', 'last', 'doubleLast', 'bidAsk', 'lastBidAsk', 'midPoint']).default('default'),
  }),
  z.object({
    type: z.literal('time'),
    /** ISO 8601 datetime after which the order becomes active */
    triggerAfter: z.string().datetime(),
  }),
  z.object({
    type: z.literal('margin'),
    /** Minimum margin cushion % (0-100) */
    cushionPercent: z.number().min(0).max(100),
    operator: z.enum(['>=', '<=']),
  }),
  z.object({
    type: z.literal('volume'),
    conid: z.number().int().positive(),
    operator: z.enum(['>=', '<=']),
    value: z.number().int().positive(),
    exchange: z.string().default('SMART'),
  }),
])

export type IBKRCondition = z.infer<typeof ibkrConditionSchema>

export const ibkrConditionalOrderSchema = z.object({
  /** Conditions that must be met before submitting the order */
  conditions: z.array(ibkrConditionSchema).min(1),

  /** Logic operator between conditions */
  conditionsLogic: z.enum(['AND', 'OR']).default('AND'),

  /** The order to submit when conditions are met */
  order: z.object({
    conid: z.number().int().positive(),
    action: z.enum(['BUY', 'SELL']),
    orderType: z.enum(['MKT', 'LMT', 'STP', 'STP_LMT', 'TRAIL']),
    quantity: z.number().positive(),
    limitPrice: z.number().optional(),
    stopPrice: z.number().optional(),
    timeInForce: z.enum(['DAY', 'GTC']).default('GTC'),
  }),
})

export type ConditionalOrder = z.infer<typeof ibkrConditionalOrderSchema>

// ── Adaptive Algo ─────────────────────────────────────────

export const ibkrAdaptiveAlgoSchema = z.object({
  conid: z.number().int().positive(),
  action: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  /** Adaptive algo priority */
  priority: z.enum(['Patient', 'Normal', 'Urgent']).default('Normal'),
  /** Start time (HH:MM:SS format, exchange timezone) */
  startTime: z.string().optional(),
  /** End time (HH:MM:SS format, exchange timezone) */
  endTime: z.string().optional(),
  timeInForce: z.enum(['DAY', 'GTC']).default('DAY'),
})

export type AdaptiveAlgo = z.infer<typeof ibkrAdaptiveAlgoSchema>

// ── Helpers ───────────────────────────────────────────────

/**
 * Calculate the risk:reward ratio for a bracket order.
 * Returns { ratio, riskAmount, rewardAmount } or null if unable to calculate.
 */
export function calculateRiskReward(
  entryPrice: number,
  targetPrice: number,
  stopPrice: number,
  action: IBKROrderAction,
): { ratio: number; riskAmount: number; rewardAmount: number } | null {
  if (entryPrice <= 0 || targetPrice <= 0 || stopPrice <= 0) return null

  let riskAmount: number
  let rewardAmount: number

  if (action === 'BUY') {
    riskAmount = entryPrice - stopPrice
    rewardAmount = targetPrice - entryPrice
  } else {
    riskAmount = stopPrice - entryPrice
    rewardAmount = entryPrice - targetPrice
  }

  if (riskAmount <= 0 || rewardAmount <= 0) return null

  return {
    ratio: rewardAmount / riskAmount,
    riskAmount,
    rewardAmount,
  }
}

/**
 * Generate a unique OCA group name.
 */
export function generateOCAGroupId(userId: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `oca_${userId}_${timestamp}_${random}`
}
