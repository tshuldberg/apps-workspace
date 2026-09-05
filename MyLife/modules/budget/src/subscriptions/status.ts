/**
 * Subscription status state machine.
 *
 * Valid transitions:
 *   trial   -> active     (trial converts)
 *   trial   -> cancelled  (trial expired or user cancelled)
 *   active  -> paused     (stop renewals, exclude from totals)
 *   active  -> cancelled  (cancel: mark cancelled_date, keep in history)
 *   paused  -> active     (resume: re-enable renewals)
 *   paused  -> cancelled  (cancel from paused)
 *
 * Terminal state: cancelled (must delete and re-create to resubscribe)
 */

import type { SubscriptionStatus } from '../types';

/** Map of valid transitions: currentStatus -> allowed next statuses. */
const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  trial: ['active', 'cancelled'],
  active: ['paused', 'cancelled'],
  paused: ['active', 'cancelled'],
  cancelled: [],
};

/**
 * Check if a status transition is valid.
 */
export function validateTransition(
  currentStatus: SubscriptionStatus,
  newStatus: SubscriptionStatus,
): boolean {
  return VALID_TRANSITIONS[currentStatus].includes(newStatus);
}

/**
 * Get the list of valid next statuses from a given status.
 */
export function getValidTransitions(status: SubscriptionStatus): SubscriptionStatus[] {
  return [...VALID_TRANSITIONS[status]];
}
