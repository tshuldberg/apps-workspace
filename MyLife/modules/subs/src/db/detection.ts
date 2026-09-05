import type { DatabaseAdapter } from '@mylife/db';
import type {
  DetectedSubscription,
  DismissedPayee,
  SaveDetectionResultInput,
  DetectionStatus,
  DetectionFrequency,
} from '../types';

// ── Helpers ────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function rowToDetectedSubscription(row: Record<string, unknown>): DetectedSubscription {
  let transactionDates: string[] = [];
  try {
    transactionDates = JSON.parse(row.transaction_dates as string);
  } catch {
    transactionDates = [];
  }

  return {
    id: row.id as string,
    payee: row.payee as string,
    normalizedPayee: row.normalized_payee as string,
    amountCents: row.amount_cents as number,
    frequency: row.frequency as DetectionFrequency,
    confidence: row.confidence as number,
    matchedCatalogId: (row.matched_catalog_id as string) ?? null,
    transactionDates,
    status: row.status as DetectionStatus,
    acceptedSubscriptionId: (row.accepted_subscription_id as string) ?? null,
    bankConnectionId: (row.bank_connection_id as string) ?? null,
    detectedAt: row.detected_at as string,
    resolvedAt: (row.resolved_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToDismissedPayee(row: Record<string, unknown>): DismissedPayee {
  return {
    id: row.id as string,
    normalizedPayee: row.normalized_payee as string,
    rawPayee: row.raw_payee as string,
    dismissedAt: row.dismissed_at as string,
  };
}

// ── Detection Results CRUD ────────────────────────────────────────────

export function saveDetectionResult(
  db: DatabaseAdapter,
  id: string,
  input: SaveDetectionResultInput,
): DetectedSubscription {
  const now = nowIso();
  db.execute(
    `INSERT INTO sb_detected_subscriptions
      (id, payee, normalized_payee, amount_cents, frequency, confidence,
       matched_catalog_id, transaction_dates, status, bank_connection_id, detected_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      id,
      input.payee,
      input.normalizedPayee,
      input.amountCents,
      input.frequency,
      input.confidence,
      input.matchedCatalogId ?? null,
      JSON.stringify(input.transactionDates),
      input.bankConnectionId ?? null,
      now,
      now,
    ],
  );
  return {
    id,
    payee: input.payee,
    normalizedPayee: input.normalizedPayee,
    amountCents: input.amountCents,
    frequency: input.frequency,
    confidence: input.confidence,
    matchedCatalogId: input.matchedCatalogId ?? null,
    transactionDates: input.transactionDates,
    status: 'pending',
    acceptedSubscriptionId: null,
    bankConnectionId: input.bankConnectionId ?? null,
    detectedAt: now,
    resolvedAt: null,
    createdAt: now,
  };
}

export function saveDetectionResults(
  db: DatabaseAdapter,
  inputs: Array<{ id: string; input: SaveDetectionResultInput }>,
): DetectedSubscription[] {
  return inputs.map(({ id, input }) => saveDetectionResult(db, id, input));
}

export function getDetectedSubscription(
  db: DatabaseAdapter,
  id: string,
): DetectedSubscription | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sb_detected_subscriptions WHERE id = ?',
    [id],
  );
  return rows[0] ? rowToDetectedSubscription(rows[0]) : null;
}

export function listDetectedSubscriptions(
  db: DatabaseAdapter,
  status?: DetectionStatus,
): DetectedSubscription[] {
  const sql = status
    ? 'SELECT * FROM sb_detected_subscriptions WHERE status = ? ORDER BY confidence DESC LIMIT 500'
    : 'SELECT * FROM sb_detected_subscriptions ORDER BY confidence DESC LIMIT 500';
  const params = status ? [status] : [];
  const rows = db.query<Record<string, unknown>>(sql, params);
  return rows.map(rowToDetectedSubscription);
}

export function getPendingDetections(
  db: DatabaseAdapter,
): DetectedSubscription[] {
  return listDetectedSubscriptions(db, 'pending');
}

export function acceptDetection(
  db: DatabaseAdapter,
  detectionId: string,
  subscriptionId: string,
): void {
  const now = nowIso();
  db.execute(
    `UPDATE sb_detected_subscriptions
     SET status = 'accepted', accepted_subscription_id = ?, resolved_at = ?
     WHERE id = ?`,
    [subscriptionId, now, detectionId],
  );
}

export function dismissDetection(
  db: DatabaseAdapter,
  detectionId: string,
): void {
  const now = nowIso();
  db.execute(
    `UPDATE sb_detected_subscriptions
     SET status = 'dismissed', resolved_at = ?
     WHERE id = ?`,
    [now, detectionId],
  );
}

export function deleteDetectedSubscription(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute('DELETE FROM sb_detected_subscriptions WHERE id = ?', [id]);
}

export function clearOldDetections(
  db: DatabaseAdapter,
  olderThanIso: string,
): number {
  const countRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM sb_detected_subscriptions
     WHERE status IN ('accepted', 'dismissed') AND resolved_at < ?`,
    [olderThanIso],
  );
  const count = countRows[0]?.count ?? 0;
  if (count > 0) {
    db.execute(
      `DELETE FROM sb_detected_subscriptions
       WHERE status IN ('accepted', 'dismissed') AND resolved_at < ?`,
      [olderThanIso],
    );
  }
  return count;
}

// ── Dismissed Payees CRUD ─────────────────────────────────────────────

export function addDismissedPayee(
  db: DatabaseAdapter,
  id: string,
  normalizedPayee: string,
  rawPayee: string,
): DismissedPayee {
  const now = nowIso();
  db.execute(
    `INSERT OR IGNORE INTO sb_dismissed_payees (id, normalized_payee, raw_payee, dismissed_at)
     VALUES (?, ?, ?, ?)`,
    [id, normalizedPayee, rawPayee, now],
  );
  return { id, normalizedPayee, rawPayee, dismissedAt: now };
}

export function listDismissedPayees(
  db: DatabaseAdapter,
): DismissedPayee[] {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sb_dismissed_payees ORDER BY dismissed_at DESC LIMIT 500',
    [],
  );
  return rows.map(rowToDismissedPayee);
}

export function getDismissedPayeeNames(
  db: DatabaseAdapter,
): string[] {
  const rows = db.query<Record<string, unknown>>(
    'SELECT normalized_payee FROM sb_dismissed_payees',
    [],
  );
  return rows.map((r) => r.normalized_payee as string);
}

export function removeDismissedPayee(
  db: DatabaseAdapter,
  normalizedPayee: string,
): void {
  db.execute(
    'DELETE FROM sb_dismissed_payees WHERE normalized_payee = ?',
    [normalizedPayee],
  );
}

export function isDismissedPayee(
  db: DatabaseAdapter,
  normalizedPayee: string,
): boolean {
  const rows = db.query<Record<string, unknown>>(
    'SELECT 1 FROM sb_dismissed_payees WHERE normalized_payee = ? LIMIT 1',
    [normalizedPayee],
  );
  return rows.length > 0;
}
