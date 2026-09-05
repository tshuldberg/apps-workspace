/**
 * MyBudget <- MyShop integration adapters (P8-A).
 *
 * Subscriber-style helpers that ingest BudgetTransactionSuggestion shapes
 * produced by @mylife/shop. Helpers are pure unless they explicitly accept
 * a `db` adapter.
 *
 * Schema constraint: bg_transactions has no source_module / source_id columns
 * today. We do NOT add a migration here. Instead, provenance is encoded into
 * the `note` field with a stable prefix:
 *
 *     note = `[shop:<sourcePurchaseId>] <descriptor>`
 *
 * Filters and dedup logic in this file rely on that prefix. A future Budget
 * schema bump can promote provenance to first-class columns without breaking
 * the adapter surface.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { BudgetTransaction, Envelope } from '../types';
import {
  createEnvelope,
  createTransaction,
  getEnvelopes,
} from '../db/crud';

/**
 * Mirror of @mylife/shop's BudgetTransactionSuggestion. Duplicated here so
 * @mylife/budget does not depend on @mylife/shop at compile time. The shape
 * is the public contract.
 */
export interface BudgetTransactionSuggestion {
  categoryName: string;
  amountCents: number;
  descriptor: string;
  occurredAt: string;
  sourceModule: 'shop';
  sourcePurchaseId: string;
}

/** Stable prefix used to tag bg_transactions.note with shop provenance. */
const SHOP_NOTE_PREFIX = '[shop:';

/** Build the provenance-tagged note value for a suggestion. */
function buildProvenanceNote(suggestion: BudgetTransactionSuggestion): string {
  return `[shop:${suggestion.sourcePurchaseId}] ${suggestion.descriptor}`;
}

/**
 * Extract the source purchase id from a budget transaction's note field, if it
 * was inserted by this adapter. Returns null when the note does not match.
 */
export function extractShopSourceId(
  note: string | null | undefined,
): string | null {
  if (!note || !note.startsWith(SHOP_NOTE_PREFIX)) return null;
  const end = note.indexOf(']');
  if (end <= SHOP_NOTE_PREFIX.length) return null;
  return note.slice(SHOP_NOTE_PREFIX.length, end);
}

/**
 * Pure filter: return suggestions whose `sourcePurchaseId` is not yet present
 * in the supplied existing transactions list. Caller fetches both sides; this
 * helper does no IO.
 *
 * Empty/missing inputs return an empty array (graceful no-op when MyShop is
 * disabled or has no purchases yet).
 */
export function getShopPendingSuggestions(
  suggestions: BudgetTransactionSuggestion[],
  existingTransactions: BudgetTransaction[],
): BudgetTransactionSuggestion[] {
  if (!suggestions || suggestions.length === 0) return [];

  const seen = new Set<string>();
  for (const tx of existingTransactions ?? []) {
    const sourceId = extractShopSourceId(tx.note);
    if (sourceId) seen.add(sourceId);
  }

  return suggestions.filter((s) => !seen.has(s.sourcePurchaseId));
}

/**
 * Find or create an envelope by display name. Used to land Shop suggestions
 * into a sensible budget category. Read-only against bg_envelopes when the
 * category already exists; creates a zero-budget envelope otherwise.
 */
function findOrCreateEnvelopeByName(
  db: DatabaseAdapter,
  name: string,
): Envelope {
  const envelopes = getEnvelopes(db, true);
  const match = envelopes.find(
    (e) => e.name.toLowerCase() === name.toLowerCase(),
  );
  if (match) return match;

  const id = `env_shop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return createEnvelope(db, id, {
    name,
    monthly_budget: 0,
  });
}

/**
 * Accept a Shop-originated suggestion and insert a budget transaction.
 *
 * Side effects: writes to bg_envelopes (only when the named envelope is
 * missing) and bg_transactions. Idempotency is the caller's responsibility:
 * use `getShopPendingSuggestions` first to avoid duplicates.
 *
 * Returns the inserted transaction. Returns `null` only when MyBudget's CRUD
 * cannot land the row safely (currently never, but reserved for future schema
 * tightening that might reject untagged sources).
 */
export function acceptShopTransactionSuggestion(
  db: DatabaseAdapter,
  suggestion: BudgetTransactionSuggestion,
): BudgetTransaction | null {
  if (!suggestion) return null;

  const envelope = findOrCreateEnvelopeByName(db, suggestion.categoryName);
  const id = `tx_shop_${suggestion.sourcePurchaseId}_${Date.now()}`;

  // TODO(v7): once bg_transactions gains source_module / source_id columns,
  // populate them directly instead of encoding provenance into `note`.
  return createTransaction(db, id, {
    envelope_id: envelope.id,
    account_id: null,
    amount: suggestion.amountCents,
    direction: 'outflow',
    merchant: null,
    note: buildProvenanceNote(suggestion),
    occurred_on: suggestion.occurredAt,
  });
}
