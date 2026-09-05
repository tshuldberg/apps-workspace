/**
 * Loyalty program CRUD for MyTravel logistics (airlines, hotels, car rentals).
 *
 * Pure functions of (DatabaseAdapter, input). Rows mirror the SQLite columns.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  LoyaltyProgramInputSchema,
  LoyaltyProgramUpdateSchema,
  type LoyaltyProgramInput,
  type LoyaltyProgramRow,
  type LoyaltyProgramUpdate,
  type LoyaltyType,
} from '../../models/schemas';

// ── Update column whitelist ─────────────────────────────────────────

const UPDATE_COLUMNS = new Set([
  'type',
  'provider',
  'member_number',
  'status_tier',
  'points_balance',
  'miles_balance',
  'expiry_date',
  'notes',
]);

// ── Create ──────────────────────────────────────────────────────────

export function createLoyaltyProgram(
  db: DatabaseAdapter,
  input: LoyaltyProgramInput,
): LoyaltyProgramRow {
  const parsed = LoyaltyProgramInputSchema.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const row: LoyaltyProgramRow = {
    id,
    type: parsed.type,
    provider: parsed.provider,
    member_number: parsed.member_number ?? null,
    status_tier: parsed.status_tier ?? null,
    points_balance: parsed.points_balance ?? 0,
    miles_balance: parsed.miles_balance ?? 0,
    expiry_date: parsed.expiry_date ?? null,
    notes: parsed.notes ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO tv_loyalty_programs (
       id, type, provider, member_number, status_tier,
       points_balance, miles_balance, expiry_date, notes,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.type,
      row.provider,
      row.member_number,
      row.status_tier,
      row.points_balance,
      row.miles_balance,
      row.expiry_date,
      row.notes,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

// ── Read ────────────────────────────────────────────────────────────

export function getLoyaltyProgram(
  db: DatabaseAdapter,
  id: string,
): LoyaltyProgramRow | null {
  const rows = db.query<LoyaltyProgramRow>(
    `SELECT * FROM tv_loyalty_programs WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

// ── Update ──────────────────────────────────────────────────────────

export function updateLoyaltyProgram(
  db: DatabaseAdapter,
  id: string,
  patch: LoyaltyProgramUpdate,
): void {
  const parsed = LoyaltyProgramUpdateSchema.parse(patch);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (!UPDATE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE tv_loyalty_programs SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

// ── Delete ──────────────────────────────────────────────────────────

export function deleteLoyaltyProgram(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_loyalty_programs WHERE id = ?`, [id]);
}

// ── List ────────────────────────────────────────────────────────────

export interface ListLoyaltyOptions {
  type?: LoyaltyType;
}

export function listLoyaltyPrograms(
  db: DatabaseAdapter,
  opts: ListLoyaltyOptions = {},
): LoyaltyProgramRow[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.type) {
    where.push('type = ?');
    params.push(opts.type);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return db.query<LoyaltyProgramRow>(
    `SELECT * FROM tv_loyalty_programs ${whereClause} ORDER BY provider ASC`,
    params,
  );
}

export function listLoyaltyByType(
  db: DatabaseAdapter,
  type: LoyaltyType,
): LoyaltyProgramRow[] {
  return listLoyaltyPrograms(db, { type });
}

// ── Balance totals ──────────────────────────────────────────────────

/**
 * Sum of points_balance across loyalty programs. Optionally filter by type.
 * (Practically, points live on hotel/car programs, but this function does not
 * constrain which type contributes.)
 */
export function getTotalPoints(
  db: DatabaseAdapter,
  type?: 'hotel' | 'airline' | 'car',
): number {
  const where = type ? 'WHERE type = ?' : '';
  const params = type ? [type] : [];
  const rows = db.query<{ total: number | null }>(
    `SELECT COALESCE(SUM(points_balance), 0) AS total FROM tv_loyalty_programs ${where}`,
    params,
  );
  return rows[0]?.total ?? 0;
}

/**
 * Sum of miles_balance across loyalty programs. Optionally filter to airline.
 */
export function getTotalMiles(
  db: DatabaseAdapter,
  type?: 'airline',
): number {
  const where = type ? 'WHERE type = ?' : '';
  const params = type ? [type] : [];
  const rows = db.query<{ total: number | null }>(
    `SELECT COALESCE(SUM(miles_balance), 0) AS total FROM tv_loyalty_programs ${where}`,
    params,
  );
  return rows[0]?.total ?? 0;
}

// ── Balance update ──────────────────────────────────────────────────

export interface BalanceUpdate {
  points?: number;
  miles?: number;
}

export function updateBalance(
  db: DatabaseAdapter,
  id: string,
  balance: BalanceUpdate,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (balance.points !== undefined) {
    fields.push('points_balance = ?');
    values.push(balance.points);
  }
  if (balance.miles !== undefined) {
    fields.push('miles_balance = ?');
    values.push(balance.miles);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE tv_loyalty_programs SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}
