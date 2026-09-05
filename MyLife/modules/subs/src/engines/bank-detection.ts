import type { DatabaseAdapter } from '@mylife/db';
import type {
  DetectedSubscription as StoredDetection,
  SaveDetectionResultInput,
  CreateSubscriptionInput,
  BillingCycle,
} from '../types';
import {
  saveDetectionResults,
  getPendingDetections,
  acceptDetection,
  dismissDetection,
  getDismissedPayeeNames,
  addDismissedPayee,
} from '../db/detection';
import { createSubscription } from '../db/crud';

/**
 * Shape produced by Budget module's recurring-detector.
 * Imported as a structural type to avoid a hard cross-module dependency.
 */
export interface BankDetectedSubscription {
  payee: string;
  normalizedPayee: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'annual' | 'unknown';
  confidence: number;
  matchedCatalogId: string | null;
  transactionDates: string[];
  isAlreadyTracked: boolean;
}

export interface DetectionRunResult {
  total: number;
  new: number;
  alreadyTracked: number;
  dismissed: number;
  pending: StoredDetection[];
}

export interface AcceptDetectionResult {
  detection: StoredDetection;
  subscriptionId: string;
}

/**
 * Map a detected frequency to the Subs billing cycle enum.
 */
export function frequencyToBillingCycle(
  frequency: 'weekly' | 'monthly' | 'annual' | 'unknown',
): BillingCycle {
  switch (frequency) {
    case 'weekly': return 'weekly';
    case 'monthly': return 'monthly';
    case 'annual': return 'yearly';
    default: return 'monthly';
  }
}

/**
 * Calculate the next renewal date from transaction history and frequency.
 */
export function estimateNextRenewal(
  transactionDates: string[],
  frequency: 'weekly' | 'monthly' | 'annual',
): string {
  if (transactionDates.length === 0) {
    return new Date().toISOString().slice(0, 10);
  }

  const sorted = [...transactionDates].sort();
  const lastDate = new Date(sorted[sorted.length - 1]! + 'T00:00:00Z');

  switch (frequency) {
    case 'weekly':
      lastDate.setUTCDate(lastDate.getUTCDate() + 7);
      break;
    case 'monthly':
      lastDate.setUTCMonth(lastDate.getUTCMonth() + 1);
      break;
    case 'annual':
      lastDate.setUTCFullYear(lastDate.getUTCFullYear() + 1);
      break;
  }

  return lastDate.toISOString().slice(0, 10);
}

/**
 * Convert a bank-detected subscription into a CreateSubscriptionInput
 * suitable for the Subs module CRUD.
 */
export function detectionToSubscriptionInput(
  detection: BankDetectedSubscription,
): CreateSubscriptionInput {
  const frequency = detection.frequency === 'unknown' ? 'monthly' : detection.frequency;
  const billingCycle = frequencyToBillingCycle(frequency);
  const sorted = [...detection.transactionDates].sort();
  const startDate = sorted[0] ?? new Date().toISOString().slice(0, 10);
  const nextRenewalDate = estimateNextRenewal(sorted, frequency);

  return {
    name: detection.payee,
    costCents: detection.amount,
    billingCycle,
    startDate,
    nextRenewalDate,
    status: 'active',
    notes: `Auto-detected from bank transactions (confidence: ${Math.round(detection.confidence * 100)}%)`,
  };
}

/**
 * Run subscription detection on bank transaction results.
 * Takes the output of Budget's `detectRecurringCharges` or `getSubscriptionSuggestions`
 * and stores new detection results in the Subs database.
 *
 * @param db - Subs module database adapter
 * @param detections - Output from Budget's recurring detector
 * @param bankConnectionId - Optional bank connection ID for tracking
 * @param generateId - ID generator function (defaults to crypto.randomUUID)
 */
export function runDetection(
  db: DatabaseAdapter,
  detections: BankDetectedSubscription[],
  bankConnectionId?: string,
  generateId: () => string = () => crypto.randomUUID(),
): DetectionRunResult {
  const dismissedPayees = new Set(getDismissedPayeeNames(db));

  let alreadyTracked = 0;
  let dismissed = 0;
  const newInputs: Array<{ id: string; input: SaveDetectionResultInput }> = [];

  for (const detection of detections) {
    if (detection.isAlreadyTracked) {
      alreadyTracked++;
      continue;
    }

    if (detection.frequency === 'unknown') {
      continue;
    }

    if (dismissedPayees.has(detection.normalizedPayee)) {
      dismissed++;
      continue;
    }

    newInputs.push({
      id: generateId(),
      input: {
        payee: detection.payee,
        normalizedPayee: detection.normalizedPayee,
        amountCents: detection.amount,
        frequency: detection.frequency,
        confidence: detection.confidence,
        matchedCatalogId: detection.matchedCatalogId,
        transactionDates: detection.transactionDates,
        bankConnectionId: bankConnectionId ?? null,
      },
    });
  }

  saveDetectionResults(db, newInputs);
  const pending = getPendingDetections(db);

  return {
    total: detections.length,
    new: newInputs.length,
    alreadyTracked,
    dismissed,
    pending,
  };
}

/**
 * Accept a detected subscription: create a real Subs subscription
 * and mark the detection as accepted.
 */
export function acceptDetectedSubscription(
  db: DatabaseAdapter,
  detection: StoredDetection,
  overrides?: Partial<CreateSubscriptionInput>,
  generateId: () => string = () => crypto.randomUUID(),
): AcceptDetectionResult {
  const bankDetection: BankDetectedSubscription = {
    payee: detection.payee,
    normalizedPayee: detection.normalizedPayee,
    amount: detection.amountCents,
    frequency: detection.frequency === 'annual' ? 'annual' : detection.frequency,
    confidence: detection.confidence,
    matchedCatalogId: detection.matchedCatalogId,
    transactionDates: detection.transactionDates,
    isAlreadyTracked: false,
  };

  const input = { ...detectionToSubscriptionInput(bankDetection), ...overrides };
  const subscriptionId = generateId();
  createSubscription(db, subscriptionId, input);

  // Mark the subscription as bank-detected
  db.execute(
    'UPDATE sb_subscriptions SET bank_detected = 1, bank_payee = ? WHERE id = ?',
    [detection.normalizedPayee, subscriptionId],
  );

  acceptDetection(db, detection.id, subscriptionId);

  return { detection, subscriptionId };
}

/**
 * Dismiss a detected subscription and add the payee to the dismissed list
 * so it won't be suggested again.
 */
export function dismissDetectedSubscription(
  db: DatabaseAdapter,
  detection: StoredDetection,
  generateId: () => string = () => crypto.randomUUID(),
): void {
  dismissDetection(db, detection.id);
  addDismissedPayee(
    db,
    generateId(),
    detection.normalizedPayee,
    detection.payee,
  );
}

/**
 * Accept multiple detections at once.
 */
export function acceptAllPendingDetections(
  db: DatabaseAdapter,
  minConfidence: number = 0.6,
  generateId: () => string = () => crypto.randomUUID(),
): AcceptDetectionResult[] {
  const pending = getPendingDetections(db);
  const results: AcceptDetectionResult[] = [];

  for (const detection of pending) {
    if (detection.confidence >= minConfidence) {
      results.push(acceptDetectedSubscription(db, detection, undefined, generateId));
    }
  }

  return results;
}
