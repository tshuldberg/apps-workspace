import type { DatabaseAdapter } from '@mylife/db';
import type { Memorabilia, MemorabiliaType } from '../../types';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

interface MemorabiliaRow {
  id: string;
  item_type: MemorabiliaType;
  description: string;
  sport: string | null;
  team: string | null;
  player: string | null;
  acquired_at: number | null;
  purchase_price_cents: number;
  estimated_value_cents: number;
  photo_ids_json: string;
  notes_md: string | null;
  created_at: number;
  updated_at: number;
}

function parseStringArray(json: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((v): v is string => typeof v === 'string');
}

function rowToMemorabilia(row: MemorabiliaRow): Memorabilia {
  return {
    id: row.id,
    item_type: row.item_type,
    description: row.description,
    sport: row.sport ?? null,
    team: row.team ?? null,
    player: row.player ?? null,
    acquired_at: row.acquired_at ?? null,
    purchase_price_cents: row.purchase_price_cents,
    estimated_value_cents: row.estimated_value_cents,
    photo_ids: parseStringArray(row.photo_ids_json),
    notes_md: row.notes_md ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function now(): number {
  return Date.now();
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface CreateMemorabiliaInput {
  id?: string;
  item_type: MemorabiliaType;
  description: string;
  sport?: string | null;
  team?: string | null;
  player?: string | null;
  acquired_at?: number | null;
  purchase_price_cents?: number;
  estimated_value_cents?: number;
  photo_ids?: readonly string[];
  notes_md?: string | null;
}

/**
 * Insert a new memorabilia record.
 */
export function createMemorabilia(
  db: DatabaseAdapter,
  input: CreateMemorabiliaInput,
): Memorabilia {
  const ts = now();
  const id = input.id ?? makeId('mm');

  const row: Memorabilia = {
    id,
    item_type: input.item_type,
    description: input.description,
    sport: input.sport ?? null,
    team: input.team ?? null,
    player: input.player ?? null,
    acquired_at: input.acquired_at ?? null,
    purchase_price_cents: input.purchase_price_cents ?? 0,
    estimated_value_cents: input.estimated_value_cents ?? 0,
    photo_ids: [...(input.photo_ids ?? [])],
    notes_md: input.notes_md ?? null,
    created_at: ts,
    updated_at: ts,
  };

  db.execute(
    `INSERT INTO sp_memorabilia (
      id, item_type, description, sport, team, player,
      acquired_at, purchase_price_cents, estimated_value_cents,
      photo_ids_json, notes_md, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.item_type,
      row.description,
      row.sport,
      row.team,
      row.player,
      row.acquired_at,
      row.purchase_price_cents,
      row.estimated_value_cents,
      JSON.stringify(row.photo_ids),
      row.notes_md,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

export interface UpdateMemorabiliaInput {
  item_type?: MemorabiliaType;
  description?: string;
  sport?: string | null;
  team?: string | null;
  player?: string | null;
  acquired_at?: number | null;
  purchase_price_cents?: number;
  estimated_value_cents?: number;
  photo_ids?: readonly string[];
  notes_md?: string | null;
}

/**
 * Partial update to a memorabilia row. Bumps `updated_at`. Returns the
 * refreshed row, or null if the id doesn't exist.
 */
export function updateMemorabilia(
  db: DatabaseAdapter,
  id: string,
  patch: UpdateMemorabiliaInput,
): Memorabilia | null {
  const existing = getMemorabilia(db, id);
  if (!existing) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.item_type !== undefined) {
    sets.push('item_type = ?');
    params.push(patch.item_type);
  }
  if (patch.description !== undefined) {
    sets.push('description = ?');
    params.push(patch.description);
  }
  if (patch.sport !== undefined) {
    sets.push('sport = ?');
    params.push(patch.sport);
  }
  if (patch.team !== undefined) {
    sets.push('team = ?');
    params.push(patch.team);
  }
  if (patch.player !== undefined) {
    sets.push('player = ?');
    params.push(patch.player);
  }
  if (patch.acquired_at !== undefined) {
    sets.push('acquired_at = ?');
    params.push(patch.acquired_at);
  }
  if (patch.purchase_price_cents !== undefined) {
    sets.push('purchase_price_cents = ?');
    params.push(patch.purchase_price_cents);
  }
  if (patch.estimated_value_cents !== undefined) {
    sets.push('estimated_value_cents = ?');
    params.push(patch.estimated_value_cents);
  }
  if (patch.photo_ids !== undefined) {
    sets.push('photo_ids_json = ?');
    params.push(JSON.stringify(patch.photo_ids));
  }
  if (patch.notes_md !== undefined) {
    sets.push('notes_md = ?');
    params.push(patch.notes_md);
  }

  sets.push('updated_at = ?');
  params.push(now());
  params.push(id);

  db.execute(
    `UPDATE sp_memorabilia SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
  return getMemorabilia(db, id);
}

/**
 * Delete a memorabilia row. Returns true iff a row was removed.
 */
export function deleteMemorabilia(db: DatabaseAdapter, id: string): boolean {
  const existing = getMemorabilia(db, id);
  if (!existing) return false;
  db.execute('DELETE FROM sp_memorabilia WHERE id = ?', [id]);
  return true;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getMemorabilia(
  db: DatabaseAdapter,
  id: string,
): Memorabilia | null {
  const rows = db.query<MemorabiliaRow>(
    'SELECT * FROM sp_memorabilia WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToMemorabilia(rows[0]) : null;
}

export interface ListMemorabiliaFilters {
  itemType?: MemorabiliaType;
  sport?: string;
  team?: string;
}

/**
 * List memorabilia rows ordered by acquired_at DESC, falling back to
 * created_at DESC when acquired_at is null.
 */
export function listMemorabilia(
  db: DatabaseAdapter,
  filters: ListMemorabiliaFilters = {},
): Memorabilia[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.itemType !== undefined) {
    where.push('item_type = ?');
    params.push(filters.itemType);
  }
  if (filters.sport !== undefined) {
    where.push('sport = ?');
    params.push(filters.sport);
  }
  if (filters.team !== undefined) {
    where.push('team = ?');
    params.push(filters.team);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return db
    .query<MemorabiliaRow>(
      `SELECT * FROM sp_memorabilia ${whereClause}
       ORDER BY COALESCE(acquired_at, created_at) DESC`,
      params,
    )
    .map(rowToMemorabilia);
}

export interface CollectionValue {
  itemCount: number;
  purchaseTotalCents: number;
  estimatedTotalCents: number;
  appreciationCents: number;
}

/**
 * Aggregate collection value. `appreciationCents` is
 * `estimatedTotalCents - purchaseTotalCents` (can be negative).
 */
export function getCollectionValue(db: DatabaseAdapter): CollectionValue {
  const rows = db.query<{
    item_count: number;
    purchase_total_cents: number;
    estimated_total_cents: number;
  }>(
    `SELECT
       COUNT(*) AS item_count,
       COALESCE(SUM(purchase_price_cents), 0) AS purchase_total_cents,
       COALESCE(SUM(estimated_value_cents), 0) AS estimated_total_cents
     FROM sp_memorabilia`,
  );

  const row = rows[0];
  const itemCount = Number(row?.item_count ?? 0);
  const purchaseTotalCents = Number(row?.purchase_total_cents ?? 0);
  const estimatedTotalCents = Number(row?.estimated_total_cents ?? 0);
  return {
    itemCount,
    purchaseTotalCents,
    estimatedTotalCents,
    appreciationCents: estimatedTotalCents - purchaseTotalCents,
  };
}
