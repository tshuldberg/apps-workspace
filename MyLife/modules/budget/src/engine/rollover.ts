/**
 * Budget rollover (carry-forward) engine.
 *
 * At month close, calculates what carries forward from each category/envelope
 * to the next month. Positive available balances carry forward; negative
 * balances reset to zero (overspending absorbed by Ready to Assign).
 *
 * All amounts in integer cents.
 */

import type { MonthBudgetState } from './budget';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RolloverRecord {
  envelopeId: string;
  fromMonth: string;  // YYYY-MM
  toMonth: string;    // YYYY-MM
  amount: number;     // cents (always >= 0)
}

export interface RolloverInput {
  envelopeId: string;
  available: number; // cents (can be negative)
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Calculate the rollover amount for a single envelope.
 * Positive available carries forward; negative resets to zero.
 */
export function calculateRollover(available: number): number {
  return available > 0 ? available : 0;
}

/**
 * Process month-end rollover for all envelopes using the full budget state.
 * Returns records to persist.
 */
export function processMonthRollover(
  state: MonthBudgetState,
  toMonth: string,
): RolloverRecord[] {
  const records: RolloverRecord[] = [];

  for (const group of state.groups) {
    for (const category of group.categories) {
      const amount = calculateRollover(category.available);
      if (amount > 0) {
        records.push({
          envelopeId: category.categoryId,
          fromMonth: state.month,
          toMonth,
          amount,
        });
      }
    }
  }

  return records;
}

/**
 * Build rollover amounts from a list of envelope inputs.
 */
export function applyRollovers(
  inputs: RolloverInput[],
  fromMonth: string,
  toMonth: string,
): RolloverRecord[] {
  const records: RolloverRecord[] = [];

  for (const input of inputs) {
    const amount = calculateRollover(input.available);
    if (amount > 0) {
      records.push({
        envelopeId: input.envelopeId,
        fromMonth,
        toMonth,
        amount,
      });
    }
  }

  return records;
}
