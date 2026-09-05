/**
 * People CRUD operations.
 *
 * JSON fields (contact_info, quick_facts, interests) are stored as TEXT
 * in SQLite. All reads deserialize; all writes serialize.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  PersonInputSchema,
  PersonUpdateSchema,
  type PersonInput,
  type PersonUpdate,
  type PersonFilter,
  type PersonSort,
  type PersonRow,
  type PersonRecord,
} from '../../models/schemas';

// ── Helpers ─────────────────────────────────────────────────────────

function deserialize(row: PersonRow): PersonRecord {
  return {
    ...row,
    contact_info: row.contact_info ? (JSON.parse(row.contact_info) as Record<string, string>) : null,
    quick_facts: row.quick_facts ? (JSON.parse(row.quick_facts) as Record<string, string>) : null,
    interests: row.interests ? (JSON.parse(row.interests) as string[]) : null,
    is_archived: row.is_archived === 1,
  };
}

function serializeJson(value: unknown): string | null {
  return value != null ? JSON.stringify(value) : null;
}

// ── Updatable columns (guard against SQL injection via allowlist) ───

const PERSON_UPDATE_COLUMNS = new Set([
  'display_name',
  'photo_local_uri',
  'relationship_type',
  'how_met',
  'where_met',
  'when_met',
  'birthday',
  'anniversary',
  'city',
  'communication_preference',
  'energy_tag',
  'frequency_goal_days',
  'notes_md',
]);

// JSON-serialized columns handled separately
const JSON_COLUMNS = new Set(['contact_info', 'quick_facts', 'interests']);

// ── CRUD ────────────────────────────────────────────────────────────

export function createPerson(
  db: DatabaseAdapter,
  input: PersonInput,
): PersonRecord {
  const parsed = PersonInputSchema.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO fn_people
       (id, display_name, photo_local_uri, relationship_type,
        how_met, where_met, when_met, birthday, anniversary, city,
        contact_info, quick_facts, interests,
        communication_preference, energy_tag, frequency_goal_days,
        notes_md, is_archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      parsed.display_name,
      parsed.photo_local_uri ?? null,
      parsed.relationship_type,
      parsed.how_met ?? null,
      parsed.where_met ?? null,
      parsed.when_met ?? null,
      parsed.birthday ?? null,
      parsed.anniversary ?? null,
      parsed.city ?? null,
      serializeJson(parsed.contact_info),
      serializeJson(parsed.quick_facts),
      serializeJson(parsed.interests),
      parsed.communication_preference ?? null,
      parsed.energy_tag ?? null,
      parsed.frequency_goal_days ?? null,
      parsed.notes_md ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    display_name: parsed.display_name,
    photo_local_uri: parsed.photo_local_uri ?? null,
    relationship_type: parsed.relationship_type,
    how_met: parsed.how_met ?? null,
    where_met: parsed.where_met ?? null,
    when_met: parsed.when_met ?? null,
    birthday: parsed.birthday ?? null,
    anniversary: parsed.anniversary ?? null,
    city: parsed.city ?? null,
    contact_info: parsed.contact_info ?? null,
    quick_facts: parsed.quick_facts ?? null,
    interests: parsed.interests ?? null,
    communication_preference: parsed.communication_preference ?? null,
    energy_tag: parsed.energy_tag ?? null,
    frequency_goal_days: parsed.frequency_goal_days ?? null,
    is_archived: false,
    notes_md: parsed.notes_md ?? null,
    created_at: now,
    updated_at: now,
  };
}

export function getPerson(
  db: DatabaseAdapter,
  id: string,
): PersonRecord | null {
  const rows = db.query<PersonRow>(
    `SELECT * FROM fn_people WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? deserialize(rows[0]) : null;
}

export function updatePerson(
  db: DatabaseAdapter,
  id: string,
  updates: PersonUpdate,
): void {
  const parsed = PersonUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;

    if (JSON_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(serializeJson(value));
    } else if (PERSON_UPDATE_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE fn_people SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deletePerson(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM fn_people WHERE id = ?`, [id]);
}

export function archivePerson(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE fn_people SET is_archived = 1, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}

export function unarchivePerson(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE fn_people SET is_archived = 0, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}

// ── Sort mapping ────────────────────────────────────────────────────

const SORT_SQL: Record<string, string> = {
  name_asc: 'display_name ASC',
  name_desc: 'display_name DESC',
  created_at_desc: 'created_at DESC',
  last_seen_desc: 'updated_at DESC', // proxy: updated_at until hangouts wired
  birthday_upcoming: `
    CASE
      WHEN birthday IS NULL THEN 1
      ELSE 0
    END ASC,
    CASE
      WHEN CAST(strftime('%j', birthday, 'start of day',
           '+' || ((CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', birthday) AS INTEGER)) || ' years')) AS INTEGER)
           >= CAST(strftime('%j','now') AS INTEGER)
      THEN CAST(strftime('%j', birthday, 'start of day',
           '+' || ((CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', birthday) AS INTEGER)) || ' years')) AS INTEGER)
           - CAST(strftime('%j','now') AS INTEGER)
      ELSE 366 + CAST(strftime('%j', birthday, 'start of day',
           '+' || ((CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', birthday) AS INTEGER)) || ' years')) AS INTEGER)
           - CAST(strftime('%j','now') AS INTEGER)
    END ASC`,
};

// ── List with filters and sort ──────────────────────────────────────

export function listPeople(
  db: DatabaseAdapter,
  filters?: PersonFilter,
  sort?: PersonSort,
): PersonRecord[] {
  let sql = 'SELECT * FROM fn_people';
  const params: unknown[] = [];
  const where: string[] = [];

  if (filters?.relationship_type) {
    where.push('relationship_type = ?');
    params.push(filters.relationship_type);
  }

  if (filters?.energy_tag) {
    where.push('energy_tag = ?');
    params.push(filters.energy_tag);
  }

  if (filters?.city) {
    where.push('city = ?');
    params.push(filters.city);
  }

  if (filters?.is_archived !== undefined) {
    where.push('is_archived = ?');
    params.push(filters.is_archived ? 1 : 0);
  }

  if (filters?.search) {
    where.push('display_name LIKE ?');
    params.push(`%${filters.search}%`);
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  const orderBy = SORT_SQL[sort ?? 'name_asc'] ?? SORT_SQL.name_asc;
  sql += ` ORDER BY ${orderBy}`;

  const rows = db.query<PersonRow>(sql, params);
  return rows.map(deserialize);
}

// ── Search (convenience wrapper) ────────────────────────────────────

export function searchPeople(
  db: DatabaseAdapter,
  query: string,
): PersonRecord[] {
  const rows = db.query<PersonRow>(
    `SELECT * FROM fn_people WHERE display_name LIKE ? ORDER BY display_name ASC`,
    [`%${query}%`],
  );
  return rows.map(deserialize);
}
