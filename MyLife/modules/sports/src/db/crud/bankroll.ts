import type { DatabaseAdapter } from '@mylife/db';
import type { Bankroll } from '../../types';

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface BankrollRow {
  id: string;
  name: string;
  starting_cents: number;
  current_cents: number;
  unit_size_cents: number;
  created_at: number;
  updated_at: number;
}

function rowToBankroll(row: BankrollRow): Bankroll {
  return {
    id: row.id,
    name: row.name,
    starting_cents: row.starting_cents,
    current_cents: row.current_cents,
    unit_size_cents: row.unit_size_cents,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function now(): number {
  return Date.now();
}

function makeId(): string {
  return `bk_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getBankroll(
  db: DatabaseAdapter,
  name: string = 'default',
): Bankroll | null {
  const rows = db.query<BankrollRow>(
    'SELECT * FROM sp_bankroll WHERE name = ? LIMIT 1',
    [name],
  );
  return rows.length > 0 ? rowToBankroll(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Idempotent upsert for the default bookkeeping profile. If a row with
 * name='default' already exists, it is returned unchanged. Otherwise a
 * fresh row is inserted with the supplied seed values.
 */
export function ensureDefaultBankroll(
  db: DatabaseAdapter,
  startingCents: number = 0,
  unitSizeCents: number = 1000,
): Bankroll {
  const existing = getBankroll(db, 'default');
  if (existing) return existing;

  const ts = now();
  const row: Bankroll = {
    id: makeId(),
    name: 'default',
    starting_cents: startingCents,
    current_cents: startingCents,
    unit_size_cents: unitSizeCents,
    created_at: ts,
    updated_at: ts,
  };
  db.execute(
    `INSERT INTO sp_bankroll (
      id, name, starting_cents, current_cents, unit_size_cents, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.name,
      row.starting_cents,
      row.current_cents,
      row.unit_size_cents,
      row.created_at,
      row.updated_at,
    ],
  );
  return row;
}

export interface UpdateBankrollPatch {
  starting_cents?: number;
  current_cents?: number;
  unit_size_cents?: number;
}

/**
 * Narrow patch update for a single bookkeeping profile. Throws if the
 * profile does not exist (callers should `ensureDefaultBankroll` first).
 */
export function updateBankroll(
  db: DatabaseAdapter,
  name: string,
  patch: UpdateBankrollPatch,
): Bankroll {
  const existing = getBankroll(db, name);
  if (!existing) {
    throw new Error(`updateBankroll: bankroll '${name}' not found`);
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.starting_cents !== undefined) {
    sets.push('starting_cents = ?');
    params.push(patch.starting_cents);
  }
  if (patch.current_cents !== undefined) {
    sets.push('current_cents = ?');
    params.push(patch.current_cents);
  }
  if (patch.unit_size_cents !== undefined) {
    sets.push('unit_size_cents = ?');
    params.push(patch.unit_size_cents);
  }
  if (sets.length === 0) return existing;
  const ts = now();
  sets.push('updated_at = ?');
  params.push(ts);
  params.push(name);
  db.execute(
    `UPDATE sp_bankroll SET ${sets.join(', ')} WHERE name = ?`,
    params,
  );
  return getBankroll(db, name) as Bankroll;
}
