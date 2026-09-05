/**
 * Currency rate CRUD for MyTravel (v5 extended logistics).
 *
 * Rates are stored as `1 base = rate quote`. `upsertRate` merges by
 * (base, quote, trip_id) so fetching fresh quotes replaces the prior row.
 * IDs use `fx_` prefix.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  CurrencyRateInputSchema,
  type CurrencyRateInput,
  type CurrencyRateRow,
} from '../../models/schemas';

// ── ID generation ───────────────────────────────────────────────────

let fxIdCounter = 0;
function generateCurrencyId(): string {
  fxIdCounter += 1;
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `fx_${now}${rand}${fxIdCounter.toString(36)}`;
}

// ── Normalize ──────────────────────────────────────────────────────

function norm(code: string): string {
  return code.toUpperCase();
}

// ── Upsert ─────────────────────────────────────────────────────────

/**
 * Upsert a rate for the given (base, quote, tripId) triple. Any existing
 * row for the same triple is replaced.
 */
export function upsertRate(
  db: DatabaseAdapter,
  input: CurrencyRateInput,
): CurrencyRateRow {
  const parsed = CurrencyRateInputSchema.parse(input);
  const base = norm(parsed.base);
  const quote = norm(parsed.quote);
  const tripId = parsed.trip_id ?? null;

  // Delete any existing row for the same triple.
  if (tripId === null) {
    db.execute(
      `DELETE FROM tv_currencies WHERE base = ? AND quote = ? AND trip_id IS NULL`,
      [base, quote],
    );
  } else {
    db.execute(
      `DELETE FROM tv_currencies WHERE base = ? AND quote = ? AND trip_id = ?`,
      [base, quote, tripId],
    );
  }

  const id = generateCurrencyId();
  const now = new Date().toISOString();

  const row: CurrencyRateRow = {
    id,
    trip_id: tripId,
    base,
    quote,
    rate: parsed.rate,
    fetched_at: parsed.fetched_at,
    source: parsed.source ?? null,
    created_at: now,
  };

  db.execute(
    `INSERT INTO tv_currencies (
       id, trip_id, base, quote, rate, fetched_at, source, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.trip_id,
      row.base,
      row.quote,
      row.rate,
      row.fetched_at,
      row.source,
      row.created_at,
    ],
  );

  return row;
}

// ── Get ────────────────────────────────────────────────────────────

/**
 * Returns the most recent rate for the (base, quote, tripId) triple, or
 * null if none exists. If tripId is undefined, looks up the global row
 * (trip_id IS NULL).
 */
export function getRate(
  db: DatabaseAdapter,
  base: string,
  quote: string,
  tripId?: string,
): CurrencyRateRow | null {
  const b = norm(base);
  const q = norm(quote);

  if (tripId === undefined) {
    const rows = db.query<CurrencyRateRow>(
      `SELECT * FROM tv_currencies
        WHERE base = ? AND quote = ? AND trip_id IS NULL
        ORDER BY fetched_at DESC
        LIMIT 1`,
      [b, q],
    );
    return rows[0] ?? null;
  }

  const rows = db.query<CurrencyRateRow>(
    `SELECT * FROM tv_currencies
      WHERE base = ? AND quote = ? AND trip_id = ?
      ORDER BY fetched_at DESC
      LIMIT 1`,
    [b, q, tripId],
  );
  return rows[0] ?? null;
}

// ── List ────────────────────────────────────────────────────────────

export function listRates(
  db: DatabaseAdapter,
  tripId?: string,
): CurrencyRateRow[] {
  if (tripId === undefined) {
    return db.query<CurrencyRateRow>(
      `SELECT * FROM tv_currencies ORDER BY fetched_at DESC`,
    );
  }
  return db.query<CurrencyRateRow>(
    `SELECT * FROM tv_currencies WHERE trip_id = ? ORDER BY fetched_at DESC`,
    [tripId],
  );
}

// ── Delete ──────────────────────────────────────────────────────────

export function deleteRate(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_currencies WHERE id = ?`, [id]);
}
