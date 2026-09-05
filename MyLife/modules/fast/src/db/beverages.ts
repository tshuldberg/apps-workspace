import type { DatabaseAdapter } from '@mylife/db';
import type { BeverageType, BeverageLog, HydrationSummary, CaffeineSnapshot } from '../types';

// ── Row types ──

interface BeverageTypeRow {
  id: string;
  name: string;
  icon: string;
  default_oz: number;
  coefficient: number;
  caffeine_mg: number | null;
  is_builtin: number;
  sort_order: number;
  created_at: string;
}

interface BeverageLogRow {
  id: string;
  date: string;
  beverage_type_id: string;
  volume_oz: number;
  hydration_oz: number;
  logged_at: string;
}

interface CaffeineLogRow {
  beverage_type_id: string;
  beverage_name: string;
  caffeine_mg: number;
  volume_oz: number;
  default_oz: number;
  logged_at: string;
}

// ── Helpers ──

function toISODate(date?: Date): string {
  return (date ?? new Date()).toISOString().slice(0, 10);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function rowToBeverageType(row: BeverageTypeRow): BeverageType {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    defaultOz: row.default_oz,
    coefficient: row.coefficient,
    caffeineMg: row.caffeine_mg,
    isBuiltin: row.is_builtin === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function rowToBeverageLog(row: BeverageLogRow): BeverageLog {
  return {
    id: row.id,
    date: row.date,
    beverageTypeId: row.beverage_type_id,
    volumeOz: row.volume_oz,
    hydrationOz: row.hydration_oz,
    loggedAt: row.logged_at,
  };
}

// ── Beverage Types CRUD ──

/** List all beverage types ordered by sort_order */
export function getBeverageTypes(db: DatabaseAdapter): BeverageType[] {
  const rows = db.query<BeverageTypeRow>(
    `SELECT * FROM ft_beverage_types ORDER BY sort_order ASC`,
  );
  return rows.map(rowToBeverageType);
}

/** Get a single beverage type by ID */
export function getBeverageType(db: DatabaseAdapter, id: string): BeverageType | null {
  const rows = db.query<BeverageTypeRow>(
    `SELECT * FROM ft_beverage_types WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToBeverageType(rows[0]) : null;
}

/** Create a custom beverage type. Returns the created type. */
export function createBeverageType(
  db: DatabaseAdapter,
  input: { name: string; icon: string; defaultOz: number; coefficient: number; caffeineMg?: number | null },
): BeverageType {
  if (!input.name.trim()) throw new Error('Name is required');
  if (input.name.length > 50) throw new Error('Name must be 50 characters or less');
  if (input.defaultOz <= 0) throw new Error('Volume must be positive');
  if (input.defaultOz > 128) throw new Error('Volume cannot exceed 128 oz');
  if (input.coefficient < -1.0 || input.coefficient > 2.0) {
    throw new Error('Coefficient must be between -1.0 and 2.0');
  }

  const id = generateId();
  const maxSort = db.query<{ m: number }>(`SELECT COALESCE(MAX(sort_order), 0) as m FROM ft_beverage_types`);
  const sortOrder = (maxSort[0]?.m ?? 0) + 1;

  db.execute(
    `INSERT INTO ft_beverage_types (id, name, icon, default_oz, coefficient, caffeine_mg, is_builtin, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, input.name.trim(), input.icon, input.defaultOz, input.coefficient, input.caffeineMg ?? null, sortOrder],
  );

  return getBeverageType(db, id)!;
}

/** Update a beverage type. Built-in types allow only defaultOz changes. */
export function updateBeverageType(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{ name: string; icon: string; defaultOz: number; coefficient: number; caffeineMg: number | null }>,
): BeverageType | null {
  const existing = getBeverageType(db, id);
  if (!existing) return null;

  if (updates.defaultOz !== undefined) {
    if (updates.defaultOz <= 0) throw new Error('Volume must be positive');
    if (updates.defaultOz > 128) throw new Error('Volume cannot exceed 128 oz');
  }
  if (updates.coefficient !== undefined) {
    if (updates.coefficient < -1.0 || updates.coefficient > 2.0) {
      throw new Error('Coefficient must be between -1.0 and 2.0');
    }
  }
  if (updates.name !== undefined) {
    if (!updates.name.trim()) throw new Error('Name is required');
    if (updates.name.length > 50) throw new Error('Name must be 50 characters or less');
  }

  const name = updates.name?.trim() ?? existing.name;
  const icon = updates.icon ?? existing.icon;
  const defaultOz = updates.defaultOz ?? existing.defaultOz;
  const coefficient = existing.isBuiltin ? existing.coefficient : (updates.coefficient ?? existing.coefficient);
  const caffeineMg = updates.caffeineMg !== undefined ? updates.caffeineMg : existing.caffeineMg;

  db.execute(
    `UPDATE ft_beverage_types SET name = ?, icon = ?, default_oz = ?, coefficient = ?, caffeine_mg = ? WHERE id = ?`,
    [name, icon, defaultOz, coefficient, caffeineMg, id],
  );

  return getBeverageType(db, id);
}

/** Delete a custom beverage type. Rejects built-in types. */
export function deleteBeverageType(db: DatabaseAdapter, id: string): boolean {
  const existing = getBeverageType(db, id);
  if (!existing) return false;
  if (existing.isBuiltin) throw new Error('Cannot delete built-in beverage type');

  db.execute(`DELETE FROM ft_beverage_types WHERE id = ?`, [id]);
  return true;
}

// ── Beverage Log CRUD ──

/** Log a beverage. Computes hydration_oz automatically. */
export function logBeverage(
  db: DatabaseAdapter,
  input: { beverageTypeId: string; volumeOz: number; date?: Date },
): BeverageLog {
  const btype = getBeverageType(db, input.beverageTypeId);
  if (!btype) throw new Error(`Unknown beverage type: ${input.beverageTypeId}`);
  if (input.volumeOz <= 0) throw new Error('Volume must be positive');
  if (input.volumeOz > 128) throw new Error('Volume cannot exceed 128 oz');

  const id = generateId();
  const dateStr = toISODate(input.date);
  const hydrationOz = input.volumeOz * btype.coefficient;

  db.execute(
    `INSERT INTO ft_beverage_log (id, date, beverage_type_id, volume_oz, hydration_oz, logged_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, dateStr, input.beverageTypeId, input.volumeOz, hydrationOz, new Date().toISOString()],
  );

  return rowToBeverageLog(
    db.query<BeverageLogRow>(`SELECT * FROM ft_beverage_log WHERE id = ?`, [id])[0]!,
  );
}

/** List beverage logs for a given date */
export function getBeverageLogs(db: DatabaseAdapter, date?: Date): BeverageLog[] {
  const dateStr = toISODate(date);
  const rows = db.query<BeverageLogRow>(
    `SELECT * FROM ft_beverage_log WHERE date = ? ORDER BY logged_at ASC`,
    [dateStr],
  );
  return rows.map(rowToBeverageLog);
}

/** Delete a beverage log entry */
export function deleteBeverageLog(db: DatabaseAdapter, id: string): boolean {
  const rows = db.query<{ id: string }>(`SELECT id FROM ft_beverage_log WHERE id = ?`, [id]);
  if (rows.length === 0) return false;
  db.execute(`DELETE FROM ft_beverage_log WHERE id = ?`, [id]);
  return true;
}

/** Compute daily hydration summary from beverage logs */
export function getDailyHydration(db: DatabaseAdapter, target: number, date?: Date): HydrationSummary {
  const dateStr = toISODate(date);
  const rows = db.query<{ total: number; cnt: number }>(
    `SELECT COALESCE(SUM(hydration_oz), 0) as total, COUNT(*) as cnt FROM ft_beverage_log WHERE date = ?`,
    [dateStr],
  );
  const totalHydrationOz = Math.max(0, rows[0]?.total ?? 0);
  const totalGlasses = totalHydrationOz / 8.0;
  return {
    totalHydrationOz,
    totalGlasses,
    meetsTarget: totalGlasses >= target,
    logCount: rows[0]?.cnt ?? 0,
  };
}

/** Get up to N most recently used beverage types */
export function getMostRecentBeverageTypes(db: DatabaseAdapter, limit: number = 4): BeverageType[] {
  const rows = db.query<BeverageTypeRow>(
    `SELECT bt.* FROM ft_beverage_types bt
     INNER JOIN (
       SELECT beverage_type_id, MAX(logged_at) as last_used
       FROM ft_beverage_log
       GROUP BY beverage_type_id
     ) recent ON bt.id = recent.beverage_type_id
     ORDER BY recent.last_used DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map(rowToBeverageType);
}

// ── Caffeine Queries ──

/** Get caffeinated beverage logs for a date (joins beverage type for caffeine_mg) */
export function getCaffeineLogsForDate(db: DatabaseAdapter, date?: Date): CaffeineSnapshot[] {
  const dateStr = toISODate(date);
  const rows = db.query<CaffeineLogRow>(
    `SELECT bl.beverage_type_id, bt.name as beverage_name, bt.caffeine_mg, bl.volume_oz, bt.default_oz, bl.logged_at
     FROM ft_beverage_log bl
     INNER JOIN ft_beverage_types bt ON bl.beverage_type_id = bt.id
     WHERE bl.date = ? AND bt.caffeine_mg IS NOT NULL AND bt.caffeine_mg > 0
     ORDER BY bl.logged_at ASC`,
    [dateStr],
  );
  return rows.map((r) => ({
    beverageTypeId: r.beverage_type_id,
    beverageName: r.beverage_name,
    caffeineMg: r.default_oz > 0 ? r.caffeine_mg * (r.volume_oz / r.default_oz) : 0,
    volumeOz: r.volume_oz,
    loggedAt: r.logged_at,
  }));
}
