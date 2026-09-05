/**
 * Payee cache for autocomplete suggestions.
 *
 * Tracks payee usage frequency and their last-used envelope.
 * After a payee is used 3+ times with the same envelope,
 * getCategorySuggestion returns that envelope for auto-fill.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { PayeeCache } from '../types';

const SUGGESTION_THRESHOLD = 3;

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

/**
 * Upsert payee usage. Call after each transaction is created.
 */
export function updatePayeeCache(
  db: DatabaseAdapter,
  payee: string,
  envelopeId: string | null,
): void {
  db.execute(
    `INSERT INTO bg_payee_cache (payee, last_envelope_id, use_count, last_used)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(payee) DO UPDATE SET
       last_envelope_id = excluded.last_envelope_id,
       use_count = use_count + 1,
       last_used = excluded.last_used`,
    [payee, envelopeId, new Date().toISOString()],
  );
}

/**
 * Get payee suggestions matching a prefix (for autocomplete).
 */
export function getPayeeSuggestions(
  db: DatabaseAdapter,
  prefix: string,
  limit = 10,
): PayeeCache[] {
  return db.query<PayeeCache>(
    `SELECT * FROM bg_payee_cache WHERE payee LIKE ? ESCAPE '\\' ORDER BY use_count DESC, last_used DESC LIMIT ?`,
    [`${escapeLike(prefix)}%`, limit],
  );
}

/**
 * Suggest an envelope for a payee based on usage history.
 * Returns the envelope_id if the payee has been used 3+ times
 * with the same envelope; null otherwise.
 */
export function getEnvelopeSuggestion(
  db: DatabaseAdapter,
  payee: string,
): string | null {
  const rows = db.query<PayeeCache>(
    `SELECT * FROM bg_payee_cache WHERE payee = ? AND use_count >= ?`,
    [payee, SUGGESTION_THRESHOLD],
  );
  return rows[0]?.last_envelope_id ?? null;
}
