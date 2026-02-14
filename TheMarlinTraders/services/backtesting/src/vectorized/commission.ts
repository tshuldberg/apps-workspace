/**
 * Commission Models
 * Sprint 41-42: Vectorized Backtesting Engine
 *
 * Configurable fee structures for backtesting fill simulation.
 * Models replicate real broker fee schedules (Alpaca, IBKR tiered/fixed).
 */

export interface CommissionSchedule {
  /** Display name for the commission model */
  readonly name: string
  /** Fee per share/contract */
  readonly perShare: number
  /** Flat fee per trade (order fill) */
  readonly perTrade: number
  /** Minimum commission per order (floor) */
  readonly minimum: number
  /** Maximum commission per order (cap, 0 = no cap) */
  readonly maximum: number
}

/**
 * Calculate the total commission for a single fill.
 *
 * Formula: max(minimum, min(perShare * quantity + perTrade, maximum || Infinity))
 */
export function calculateCommission(
  schedule: CommissionSchedule,
  quantity: number,
): number {
  if (quantity <= 0) return 0

  const raw = schedule.perShare * quantity + schedule.perTrade
  const floored = Math.max(schedule.minimum, raw)

  if (schedule.maximum > 0) {
    return Math.min(floored, schedule.maximum)
  }

  return floored
}

// ── Preset Commission Models ──────────────────────────────────────────────

/** No commissions — useful for strategy-only analysis */
export const ZERO_COMMISSION: CommissionSchedule = {
  name: 'Zero Commission',
  perShare: 0,
  perTrade: 0,
  minimum: 0,
  maximum: 0,
} as const

/** Alpaca commission-free equities */
export const ALPACA_COMMISSION: CommissionSchedule = {
  name: 'Alpaca',
  perShare: 0,
  perTrade: 0,
  minimum: 0,
  maximum: 0,
} as const

/**
 * Interactive Brokers Tiered pricing (US equities).
 * $0.0035/share, $0.35 min, 1% of trade value max (approximated as $35 cap).
 */
export const IBKR_TIERED: CommissionSchedule = {
  name: 'IBKR Tiered',
  perShare: 0.0035,
  perTrade: 0,
  minimum: 0.35,
  maximum: 35,
} as const

/**
 * Interactive Brokers Fixed pricing (US equities).
 * $0.005/share, $1.00 minimum per order, 1% of trade value max.
 */
export const IBKR_FIXED: CommissionSchedule = {
  name: 'IBKR Fixed',
  perShare: 0.005,
  perTrade: 0,
  minimum: 1.0,
  maximum: 35,
} as const
