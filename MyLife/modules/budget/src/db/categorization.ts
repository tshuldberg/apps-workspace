/**
 * CRUD operations for ML Categorization Feedback.
 * Table: bg_categorization_feedback
 *
 * Tracks user feedback on auto-categorization predictions to improve
 * ML accuracy over time. Each row records whether the user accepted
 * or corrected a predicted envelope assignment.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { CategorizationFeedback, CategorizationFeedbackInsert } from '../types';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function createCategorizationFeedback(
  db: DatabaseAdapter,
  id: string,
  input: CategorizationFeedbackInsert,
): CategorizationFeedback {
  const now = new Date().toISOString();
  const record: CategorizationFeedback = {
    id,
    transaction_id: input.transaction_id,
    merchant_normalized: input.merchant_normalized,
    predicted_envelope_id: input.predicted_envelope_id ?? null,
    actual_envelope_id: input.actual_envelope_id ?? null,
    confidence: input.confidence,
    was_accepted: input.was_accepted,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bg_categorization_feedback
      (id, transaction_id, merchant_normalized, predicted_envelope_id,
       actual_envelope_id, confidence, was_accepted, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id, record.transaction_id, record.merchant_normalized,
      record.predicted_envelope_id, record.actual_envelope_id,
      record.confidence, record.was_accepted, record.created_at,
    ],
  );

  return record;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get all feedback for a normalized merchant, ordered by most recent first.
 */
export function getFeedbackByMerchant(
  db: DatabaseAdapter,
  merchantNormalized: string,
): CategorizationFeedback[] {
  return db.query<CategorizationFeedback>(
    `SELECT * FROM bg_categorization_feedback
     WHERE merchant_normalized = ?
     ORDER BY created_at DESC`,
    [merchantNormalized],
  );
}

/**
 * Calculate categorization accuracy stats.
 * Returns total feedback count, accepted count, and accuracy percentage.
 */
export function getCategorizationAccuracy(
  db: DatabaseAdapter,
): { total: number; accepted: number; accuracy: number } {
  const rows = db.query<{ total: number; accepted: number }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN was_accepted = 1 THEN 1 ELSE 0 END) as accepted
     FROM bg_categorization_feedback`,
  );
  const row = rows[0];
  if (!row || row.total === 0) {
    return { total: 0, accepted: 0, accuracy: 0 };
  }
  return {
    total: row.total,
    accepted: row.accepted,
    accuracy: Math.round((row.accepted / row.total) * 100),
  };
}
