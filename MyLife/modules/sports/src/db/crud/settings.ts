import type { DatabaseAdapter } from '@mylife/db';

/**
 * CRUD helpers for the `sp_settings` key/value table.
 *
 * The table is a simple { key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER }
 * store seeded in V1. P3-C reuses it to persist responsible-gambling limits
 * (daily / weekly spend caps, cooldown-until, unit size) without adding a
 * new migration. Values are stored as stringified integers (or ISO-ish ms
 * epoch for `bet_cool_down_until`) and parsed on read.
 *
 * Design notes:
 *   * `null` from `setBetLimits` for any individual key DELETES the row,
 *     which is how "clear limit" is modeled without a dedicated tombstone.
 *   * `unit_size_cents` defaults to 1000 ($10) when unset.
 *   * `unit_size_cents` is clamped to [1, 1_000_000] to avoid accidental
 *     giant-limit typos ($0 would zero-divide UI; over $10k is almost
 *     always a mis-tap).
 */

// ---------------------------------------------------------------------------
// Shared row shape
// ---------------------------------------------------------------------------

interface SettingRow {
  key: string;
  value: string | null;
  updated_at: number;
}

function now(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// Generic k/v accessors
// ---------------------------------------------------------------------------

export function getSetting(
  db: DatabaseAdapter,
  key: string,
): string | null {
  const rows = db.query<SettingRow>(
    'SELECT key, value, updated_at FROM sp_settings WHERE key = ? LIMIT 1',
    [key],
  );
  if (rows.length === 0) return null;
  return rows[0].value ?? null;
}

export function setSetting(
  db: DatabaseAdapter,
  key: string,
  value: string | null,
): void {
  if (value === null) {
    db.execute('DELETE FROM sp_settings WHERE key = ?', [key]);
    return;
  }
  db.execute(
    `INSERT INTO sp_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now()],
  );
}

// ---------------------------------------------------------------------------
// Bet-limit typed helpers (P3-C)
// ---------------------------------------------------------------------------

const KEY_DAILY = 'bet_daily_limit_cents';
const KEY_WEEKLY = 'bet_weekly_limit_cents';
const KEY_COOLDOWN = 'bet_cool_down_until';
const KEY_UNIT = 'bet_unit_size_cents';

const DEFAULT_UNIT_SIZE_CENTS = 1000;
const MAX_UNIT_SIZE_CENTS = 1_000_000;
const MIN_UNIT_SIZE_CENTS = 1;

export interface BetLimits {
  daily_cents: number | null;
  weekly_cents: number | null;
  cooldown_until: number | null;
  unit_size_cents: number;
}

export type BetLimitsPatch = Partial<{
  daily_cents: number | null;
  weekly_cents: number | null;
  cooldown_until: number | null;
  unit_size_cents: number;
}>;

function parseIntOrNull(value: string | null): number | null {
  if (value === null || value === '') return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

function clampUnitSize(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_UNIT_SIZE_CENTS;
  const floored = Math.round(raw);
  if (floored < MIN_UNIT_SIZE_CENTS) return MIN_UNIT_SIZE_CENTS;
  if (floored > MAX_UNIT_SIZE_CENTS) return MAX_UNIT_SIZE_CENTS;
  return floored;
}

/**
 * Read the full set of bet-limit settings. Missing values return null;
 * `unit_size_cents` falls back to the default ($10 = 1000 cents) so the
 * units display never divides by zero.
 */
export function getBetLimits(db: DatabaseAdapter): BetLimits {
  const rows = db.query<SettingRow>(
    'SELECT key, value, updated_at FROM sp_settings WHERE key IN (?, ?, ?, ?)',
    [KEY_DAILY, KEY_WEEKLY, KEY_COOLDOWN, KEY_UNIT],
  );
  const byKey = new Map<string, string | null>();
  for (const row of rows) byKey.set(row.key, row.value ?? null);

  const unit = parseIntOrNull(byKey.get(KEY_UNIT) ?? null);
  return {
    daily_cents: parseIntOrNull(byKey.get(KEY_DAILY) ?? null),
    weekly_cents: parseIntOrNull(byKey.get(KEY_WEEKLY) ?? null),
    cooldown_until: parseIntOrNull(byKey.get(KEY_COOLDOWN) ?? null),
    unit_size_cents: unit === null ? DEFAULT_UNIT_SIZE_CENTS : clampUnitSize(unit),
  };
}

/**
 * Upsert any subset of bet-limit keys. Passing `null` for an optional key
 * DELETES its row. Unit size is clamped into a sensible range; other keys
 * accept any non-negative integer.
 */
export function setBetLimits(
  db: DatabaseAdapter,
  patch: BetLimitsPatch,
): void {
  db.transaction(() => {
    if (Object.prototype.hasOwnProperty.call(patch, 'daily_cents')) {
      const v = patch.daily_cents;
      if (v === null || v === undefined) {
        db.execute('DELETE FROM sp_settings WHERE key = ?', [KEY_DAILY]);
      } else {
        const n = Math.max(0, Math.round(v));
        upsertKey(db, KEY_DAILY, String(n));
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'weekly_cents')) {
      const v = patch.weekly_cents;
      if (v === null || v === undefined) {
        db.execute('DELETE FROM sp_settings WHERE key = ?', [KEY_WEEKLY]);
      } else {
        const n = Math.max(0, Math.round(v));
        upsertKey(db, KEY_WEEKLY, String(n));
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'cooldown_until')) {
      const v = patch.cooldown_until;
      if (v === null || v === undefined) {
        db.execute('DELETE FROM sp_settings WHERE key = ?', [KEY_COOLDOWN]);
      } else {
        const n = Math.max(0, Math.round(v));
        upsertKey(db, KEY_COOLDOWN, String(n));
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'unit_size_cents')) {
      const v = patch.unit_size_cents;
      if (v === undefined) {
        // No-op: undefined skips the key (patch semantics).
      } else {
        const clamped = clampUnitSize(v);
        upsertKey(db, KEY_UNIT, String(clamped));
      }
    }
  });
}

function upsertKey(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO sp_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now()],
  );
}

/**
 * Sum the `stake_cents` of every bet placed since `sinceMs` (inclusive).
 * Used to compute daily/weekly allowance without pulling rows into JS.
 */
export function sumStakesSince(
  db: DatabaseAdapter,
  sinceMs: number,
): number {
  const rows = db.query<{ total: number | null }>(
    'SELECT COALESCE(SUM(stake_cents), 0) as total FROM sp_bets WHERE placed_at >= ?',
    [sinceMs],
  );
  return rows[0]?.total ?? 0;
}
