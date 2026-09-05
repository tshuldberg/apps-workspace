import type { DatabaseAdapter } from '@mylife/db';
import {
  PreferenceInputSchema,
  PreferenceSchema,
  PreferenceUpdateSchema,
  type Preference,
  type PreferenceCategory,
  type PreferenceInput,
  type PreferenceUpdate,
} from '../../models/schemas';

function nowMs(): number {
  return Date.now();
}

function randomId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function parseInt0(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.length > 0) return Number(raw);
  return 0;
}

function rowToPreference(row: Record<string, unknown>): Preference {
  return PreferenceSchema.parse({
    id: row.id,
    category: row.category,
    key: row.key,
    value: row.value,
    notes: row.notes ?? null,
    createdAt: parseInt0(row.created_at),
    updatedAt: parseInt0(row.updated_at),
  });
}

export function createPreference(
  db: DatabaseAdapter,
  rawInput: PreferenceInput,
): Preference {
  const input = PreferenceInputSchema.parse(rawInput);
  const id = randomId();
  const now = nowMs();

  db.execute(
    `INSERT INTO sh_preferences (
       id, category, key, value, notes, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.category, input.key, input.value, input.notes, now, now],
  );

  return getPreferenceById(db, id)!;
}

export function getPreferenceById(
  db: DatabaseAdapter,
  id: string,
): Preference | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_preferences WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToPreference(rows[0]) : null;
}

export function updatePreference(
  db: DatabaseAdapter,
  id: string,
  rawPatch: PreferenceUpdate,
): Preference | null {
  const existing = getPreferenceById(db, id);
  if (!existing) return null;
  const patch = PreferenceUpdateSchema.parse(rawPatch);

  const next = {
    category: patch.category ?? existing.category,
    key: patch.key ?? existing.key,
    value: patch.value ?? existing.value,
    notes: patch.notes === undefined ? existing.notes : patch.notes,
  };

  const now = nowMs();
  db.execute(
    `UPDATE sh_preferences
       SET category = ?, key = ?, value = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [next.category, next.key, next.value, next.notes, now, id],
  );

  return getPreferenceById(db, id);
}

export function deletePreference(db: DatabaseAdapter, id: string): boolean {
  const existing = getPreferenceById(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM sh_preferences WHERE id = ?`, [id]);
  return true;
}

export function listPreferences(db: DatabaseAdapter): Preference[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_preferences
         ORDER BY category ASC, key ASC
         LIMIT 1000`,
    )
    .map(rowToPreference);
}

export function listPreferencesByCategory(
  db: DatabaseAdapter,
  category: PreferenceCategory,
): Preference[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_preferences WHERE category = ?
         ORDER BY key ASC
         LIMIT 1000`,
      [category],
    )
    .map(rowToPreference);
}

export function getPreference(
  db: DatabaseAdapter,
  category: PreferenceCategory,
  key: string,
): Preference | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_preferences WHERE category = ? AND key = ? LIMIT 1`,
    [category, key],
  );
  return rows[0] ? rowToPreference(rows[0]) : null;
}
