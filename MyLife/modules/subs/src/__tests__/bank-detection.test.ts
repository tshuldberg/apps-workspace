import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SUBS_MODULE } from '../definition';
import {
  saveDetectionResult,
  getDetectedSubscription,
  listDetectedSubscriptions,
  getPendingDetections,
  acceptDetection,
  dismissDetection,
  addDismissedPayee,
  getDismissedPayeeNames,
  listDismissedPayees,
  removeDismissedPayee,
  isDismissedPayee,
} from '../db/detection';
import {
  frequencyToBillingCycle,
  estimateNextRenewal,
  detectionToSubscriptionInput,
  runDetection,
  acceptDetectedSubscription,
  dismissDetectedSubscription,
  acceptAllPendingDetections,
  type BankDetectedSubscription,
} from '../engines/bank-detection';
import { createSubscription, getSubscription } from '../db/crud';
import type { SaveDetectionResultInput } from '../types';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('subs', SUBS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// ── V2 Schema Tests ─────────────────────────────────────────────────

describe('V2 Schema', () => {
  it('creates detection tables', () => {
    const rows = testDb.adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sb_%' ORDER BY name`,
    );
    const names = rows.map(r => r.name);
    expect(names).toContain('sb_detected_subscriptions');
    expect(names).toContain('sb_dismissed_payees');
  });

  it('adds bank_detected column to subscriptions', () => {
    const rows = testDb.adapter.query<{ name: string }>(
      `PRAGMA table_info(sb_subscriptions)`,
    );
    const colNames = rows.map(r => r.name);
    expect(colNames).toContain('bank_detected');
    expect(colNames).toContain('bank_payee');
  });
});

// ── Detection CRUD Tests ────────────────────────────────────────────

describe('Detection CRUD', () => {
  const sampleInput: SaveDetectionResultInput = {
    payee: 'Netflix',
    normalizedPayee: 'netflix',
    amountCents: 1599,
    frequency: 'monthly',
    confidence: 0.85,
    matchedCatalogId: 'cat-netflix',
    transactionDates: ['2026-01-15', '2026-02-15', '2026-03-15'],
    bankConnectionId: 'conn-1',
  };

  it('saves and retrieves a detection result', () => {
    const result = saveDetectionResult(testDb.adapter, 'det-1', sampleInput);
    expect(result.id).toBe('det-1');
    expect(result.status).toBe('pending');
    expect(result.payee).toBe('Netflix');
    expect(result.amountCents).toBe(1599);

    const fetched = getDetectedSubscription(testDb.adapter, 'det-1');
    expect(fetched).not.toBeNull();
    expect(fetched!.normalizedPayee).toBe('netflix');
    expect(fetched!.transactionDates).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('returns null for missing detection', () => {
    const result = getDetectedSubscription(testDb.adapter, 'nonexistent');
    expect(result).toBeNull();
  });

  it('lists detections filtered by status', () => {
    saveDetectionResult(testDb.adapter, 'det-1', sampleInput);
    saveDetectionResult(testDb.adapter, 'det-2', { ...sampleInput, payee: 'Spotify', normalizedPayee: 'spotify' });

    const all = listDetectedSubscriptions(testDb.adapter);
    expect(all).toHaveLength(2);

    const pending = listDetectedSubscriptions(testDb.adapter, 'pending');
    expect(pending).toHaveLength(2);

    createSubscription(testDb.adapter, 'sub-1', { name: 'Netflix', costCents: 1599, startDate: '2026-01-15' });
    acceptDetection(testDb.adapter, 'det-1', 'sub-1');
    const stillPending = listDetectedSubscriptions(testDb.adapter, 'pending');
    expect(stillPending).toHaveLength(1);
    expect(stillPending[0]!.id).toBe('det-2');
  });

  it('accepts a detection', () => {
    saveDetectionResult(testDb.adapter, 'det-1', sampleInput);
    createSubscription(testDb.adapter, 'sub-1', { name: 'Netflix', costCents: 1599, startDate: '2026-01-15' });
    acceptDetection(testDb.adapter, 'det-1', 'sub-1');

    const det = getDetectedSubscription(testDb.adapter, 'det-1');
    expect(det!.status).toBe('accepted');
    expect(det!.acceptedSubscriptionId).toBe('sub-1');
    expect(det!.resolvedAt).not.toBeNull();
  });

  it('dismisses a detection', () => {
    saveDetectionResult(testDb.adapter, 'det-1', sampleInput);
    dismissDetection(testDb.adapter, 'det-1');

    const det = getDetectedSubscription(testDb.adapter, 'det-1');
    expect(det!.status).toBe('dismissed');
    expect(det!.resolvedAt).not.toBeNull();
  });

  it('sorts by confidence descending', () => {
    saveDetectionResult(testDb.adapter, 'det-lo', { ...sampleInput, confidence: 0.3 });
    saveDetectionResult(testDb.adapter, 'det-hi', { ...sampleInput, payee: 'X', normalizedPayee: 'x', confidence: 0.9 });

    const all = getPendingDetections(testDb.adapter);
    expect(all[0]!.id).toBe('det-hi');
    expect(all[1]!.id).toBe('det-lo');
  });
});

// ── Dismissed Payees Tests ──────────────────────────────────────────

describe('Dismissed Payees', () => {
  it('adds and lists dismissed payees', () => {
    addDismissedPayee(testDb.adapter, 'd-1', 'netflix', 'Netflix');
    addDismissedPayee(testDb.adapter, 'd-2', 'spotify', 'Spotify');

    const names = getDismissedPayeeNames(testDb.adapter);
    expect(names).toContain('netflix');
    expect(names).toContain('spotify');

    const payees = listDismissedPayees(testDb.adapter);
    expect(payees).toHaveLength(2);
  });

  it('checks if payee is dismissed', () => {
    addDismissedPayee(testDb.adapter, 'd-1', 'netflix', 'Netflix');
    expect(isDismissedPayee(testDb.adapter, 'netflix')).toBe(true);
    expect(isDismissedPayee(testDb.adapter, 'spotify')).toBe(false);
  });

  it('removes a dismissed payee', () => {
    addDismissedPayee(testDb.adapter, 'd-1', 'netflix', 'Netflix');
    removeDismissedPayee(testDb.adapter, 'netflix');
    expect(isDismissedPayee(testDb.adapter, 'netflix')).toBe(false);
  });

  it('ignores duplicate dismissed payees', () => {
    addDismissedPayee(testDb.adapter, 'd-1', 'netflix', 'Netflix');
    addDismissedPayee(testDb.adapter, 'd-2', 'netflix', 'NETFLIX');
    const names = getDismissedPayeeNames(testDb.adapter);
    expect(names.filter(n => n === 'netflix')).toHaveLength(1);
  });
});

// ── Engine: Frequency Mapping Tests ─────────────────────────────────

describe('frequencyToBillingCycle', () => {
  it('maps weekly to weekly', () => {
    expect(frequencyToBillingCycle('weekly')).toBe('weekly');
  });

  it('maps monthly to monthly', () => {
    expect(frequencyToBillingCycle('monthly')).toBe('monthly');
  });

  it('maps annual to yearly', () => {
    expect(frequencyToBillingCycle('annual')).toBe('yearly');
  });

  it('maps unknown to monthly', () => {
    expect(frequencyToBillingCycle('unknown')).toBe('monthly');
  });
});

// ── Engine: Renewal Estimation Tests ────────────────────────────────

describe('estimateNextRenewal', () => {
  it('estimates monthly renewal from last transaction', () => {
    const result = estimateNextRenewal(['2026-01-15', '2026-02-15'], 'monthly');
    expect(result).toBe('2026-03-15');
  });

  it('estimates weekly renewal', () => {
    const result = estimateNextRenewal(['2026-03-01', '2026-03-08'], 'weekly');
    expect(result).toBe('2026-03-15');
  });

  it('estimates annual renewal', () => {
    const result = estimateNextRenewal(['2025-03-15'], 'annual');
    expect(result).toBe('2026-03-15');
  });

  it('handles unsorted dates', () => {
    const result = estimateNextRenewal(['2026-03-15', '2026-01-15', '2026-02-15'], 'monthly');
    expect(result).toBe('2026-04-15');
  });
});

// ── Engine: Detection-to-Subscription Mapping Tests ─────────────────

describe('detectionToSubscriptionInput', () => {
  it('maps a monthly detection to subscription input', () => {
    const detection: BankDetectedSubscription = {
      payee: 'Netflix',
      normalizedPayee: 'netflix',
      amount: 1599,
      frequency: 'monthly',
      confidence: 0.85,
      matchedCatalogId: 'cat-netflix',
      transactionDates: ['2026-01-15', '2026-02-15', '2026-03-15'],
      isAlreadyTracked: false,
    };

    const input = detectionToSubscriptionInput(detection);
    expect(input.name).toBe('Netflix');
    expect(input.costCents).toBe(1599);
    expect(input.billingCycle).toBe('monthly');
    expect(input.startDate).toBe('2026-01-15');
    expect(input.nextRenewalDate).toBe('2026-04-15');
    expect(input.status).toBe('active');
    expect(input.notes).toContain('85%');
  });

  it('maps an annual detection', () => {
    const detection: BankDetectedSubscription = {
      payee: 'Amazon Prime',
      normalizedPayee: 'amazon prime',
      amount: 13900,
      frequency: 'annual',
      confidence: 0.72,
      matchedCatalogId: null,
      transactionDates: ['2025-03-20'],
      isAlreadyTracked: false,
    };

    const input = detectionToSubscriptionInput(detection);
    expect(input.billingCycle).toBe('yearly');
    expect(input.costCents).toBe(13900);
    expect(input.startDate).toBe('2025-03-20');
    expect(input.nextRenewalDate).toBe('2026-03-20');
  });
});

// ── Engine: Full Detection Run Tests ────────────────────────────────

describe('runDetection', () => {
  let idCounter: number;
  const genId = () => `id-${++idCounter}`;

  beforeEach(() => { idCounter = 0; });

  it('stores new detections and skips already-tracked', () => {
    const detections: BankDetectedSubscription[] = [
      {
        payee: 'Netflix',
        normalizedPayee: 'netflix',
        amount: 1599,
        frequency: 'monthly',
        confidence: 0.85,
        matchedCatalogId: null,
        transactionDates: ['2026-01-15', '2026-02-15'],
        isAlreadyTracked: false,
      },
      {
        payee: 'Spotify',
        normalizedPayee: 'spotify',
        amount: 999,
        frequency: 'monthly',
        confidence: 0.9,
        matchedCatalogId: null,
        transactionDates: ['2026-01-20', '2026-02-20'],
        isAlreadyTracked: true,
      },
    ];

    const result = runDetection(testDb.adapter, detections, 'conn-1', genId);
    expect(result.total).toBe(2);
    expect(result.new).toBe(1);
    expect(result.alreadyTracked).toBe(1);
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0]!.payee).toBe('Netflix');
  });

  it('skips dismissed payees', () => {
    addDismissedPayee(testDb.adapter, 'd-1', 'netflix', 'Netflix');

    const detections: BankDetectedSubscription[] = [
      {
        payee: 'Netflix',
        normalizedPayee: 'netflix',
        amount: 1599,
        frequency: 'monthly',
        confidence: 0.85,
        matchedCatalogId: null,
        transactionDates: ['2026-01-15', '2026-02-15'],
        isAlreadyTracked: false,
      },
    ];

    const result = runDetection(testDb.adapter, detections, undefined, genId);
    expect(result.new).toBe(0);
    expect(result.dismissed).toBe(1);
  });

  it('skips unknown frequency detections', () => {
    const detections: BankDetectedSubscription[] = [
      {
        payee: 'RandomCharge',
        normalizedPayee: 'randomcharge',
        amount: 500,
        frequency: 'unknown',
        confidence: 0.3,
        matchedCatalogId: null,
        transactionDates: ['2026-01-05'],
        isAlreadyTracked: false,
      },
    ];

    const result = runDetection(testDb.adapter, detections, undefined, genId);
    expect(result.new).toBe(0);
  });
});

// ── Engine: Accept/Dismiss Flow Tests ───────────────────────────────

describe('acceptDetectedSubscription', () => {
  let idCounter: number;
  const genId = () => `id-${++idCounter}`;

  beforeEach(() => { idCounter = 0; });

  it('creates a real subscription and marks detection accepted', () => {
    const detections: BankDetectedSubscription[] = [
      {
        payee: 'Netflix',
        normalizedPayee: 'netflix',
        amount: 1599,
        frequency: 'monthly',
        confidence: 0.85,
        matchedCatalogId: null,
        transactionDates: ['2026-01-15', '2026-02-15', '2026-03-15'],
        isAlreadyTracked: false,
      },
    ];

    const run = runDetection(testDb.adapter, detections, 'conn-1', genId);
    const detection = run.pending[0]!;

    const result = acceptDetectedSubscription(testDb.adapter, detection, undefined, genId);
    expect(result.subscriptionId).toBeTruthy();

    const sub = getSubscription(testDb.adapter, result.subscriptionId);
    expect(sub).not.toBeNull();
    expect(sub!.name).toBe('Netflix');
    expect(sub!.costCents).toBe(1599);

    const updated = getDetectedSubscription(testDb.adapter, detection.id);
    expect(updated!.status).toBe('accepted');
    expect(updated!.acceptedSubscriptionId).toBe(result.subscriptionId);
  });

  it('allows overriding subscription fields', () => {
    const detections: BankDetectedSubscription[] = [
      {
        payee: 'NFLX Subscription',
        normalizedPayee: 'nflx',
        amount: 1599,
        frequency: 'monthly',
        confidence: 0.7,
        matchedCatalogId: null,
        transactionDates: ['2026-02-15'],
        isAlreadyTracked: false,
      },
    ];

    const run = runDetection(testDb.adapter, detections, undefined, genId);
    const result = acceptDetectedSubscription(
      testDb.adapter,
      run.pending[0]!,
      { name: 'Netflix Standard', costCents: 1549 },
      genId,
    );

    const sub = getSubscription(testDb.adapter, result.subscriptionId);
    expect(sub!.name).toBe('Netflix Standard');
    expect(sub!.costCents).toBe(1549);
  });
});

describe('dismissDetectedSubscription', () => {
  let idCounter: number;
  const genId = () => `id-${++idCounter}`;

  beforeEach(() => { idCounter = 0; });

  it('dismisses detection and adds payee to dismissed list', () => {
    const detections: BankDetectedSubscription[] = [
      {
        payee: 'Netflix',
        normalizedPayee: 'netflix',
        amount: 1599,
        frequency: 'monthly',
        confidence: 0.85,
        matchedCatalogId: null,
        transactionDates: ['2026-01-15'],
        isAlreadyTracked: false,
      },
    ];

    const run = runDetection(testDb.adapter, detections, undefined, genId);
    dismissDetectedSubscription(testDb.adapter, run.pending[0]!, genId);

    const det = getDetectedSubscription(testDb.adapter, run.pending[0]!.id);
    expect(det!.status).toBe('dismissed');
    expect(isDismissedPayee(testDb.adapter, 'netflix')).toBe(true);
  });
});

describe('acceptAllPendingDetections', () => {
  let idCounter: number;
  const genId = () => `id-${++idCounter}`;

  beforeEach(() => { idCounter = 0; });

  it('accepts only detections above confidence threshold', () => {
    const detections: BankDetectedSubscription[] = [
      {
        payee: 'Netflix',
        normalizedPayee: 'netflix',
        amount: 1599,
        frequency: 'monthly',
        confidence: 0.85,
        matchedCatalogId: null,
        transactionDates: ['2026-01-15', '2026-02-15'],
        isAlreadyTracked: false,
      },
      {
        payee: 'Unknown Charge',
        normalizedPayee: 'unknown charge',
        amount: 299,
        frequency: 'monthly',
        confidence: 0.4,
        matchedCatalogId: null,
        transactionDates: ['2026-01-01', '2026-02-01'],
        isAlreadyTracked: false,
      },
    ];

    runDetection(testDb.adapter, detections, undefined, genId);
    const results = acceptAllPendingDetections(testDb.adapter, 0.6, genId);

    expect(results).toHaveLength(1);
    expect(results[0]!.detection.payee).toBe('Netflix');

    const pending = getPendingDetections(testDb.adapter);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.payee).toBe('Unknown Charge');
  });
});
