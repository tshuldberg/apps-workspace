/**
 * Memory CRUD operations for shared memories and inside jokes.
 *
 * Memory entries are stored in fn_memories with type='memory'.
 * Journal entries (gratitude, conflict, growth) use the same table
 * but are excluded from all queries here via the type filter.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  MemoryInputSchema,
  MemoryUpdateSchema,
  type MemoryInput,
  type MemoryUpdate,
  type MemoryRow,
  type MemoryRecord,
  type MemoryFilter,
} from '../../models/memory-schemas';

// ── Helpers ─────────────────────────────────────────────────────────

function deserialize(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    person_ids: JSON.parse(row.person_ids) as string[],
    circle_id: row.circle_id,
    title: row.title,
    description_md: row.description_md,
    happened_at: row.happened_at,
    photo_ids: JSON.parse(row.photo_ids) as string[],
    voice_memo_id: row.voice_memo_id,
    tags: JSON.parse(row.tags) as string[],
    is_inside_joke: row.is_inside_joke === 1,
    type: 'memory',
    created_at: row.created_at,
  };
}

// ── Updatable columns ───────────────────────────────────────────────

const SCALAR_COLUMNS = new Set([
  'title',
  'description_md',
  'circle_id',
  'happened_at',
  'voice_memo_id',
  'is_inside_joke',
]);

const JSON_COLUMNS = new Set(['person_ids', 'photo_ids', 'tags']);

// ── CRUD ────────────────────────────────────────────────────────────

export function createMemory(
  db: DatabaseAdapter,
  input: MemoryInput,
): MemoryRecord {
  const parsed = MemoryInputSchema.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const happenedAt = parsed.happened_at ?? now;

  const personIds = parsed.person_ids ?? [];
  const photoIds = parsed.photo_ids ?? [];
  const tags = parsed.tags ?? [];
  const isInsideJoke = parsed.is_inside_joke ?? false;

  db.execute(
    `INSERT INTO fn_memories
       (id, person_ids, circle_id, title, description_md, happened_at,
        photo_ids, voice_memo_id, tags, is_inside_joke, type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'memory', ?)`,
    [
      id,
      JSON.stringify(personIds),
      parsed.circle_id ?? null,
      parsed.title,
      parsed.description_md ?? null,
      happenedAt,
      JSON.stringify(photoIds),
      parsed.voice_memo_id ?? null,
      JSON.stringify(tags),
      isInsideJoke ? 1 : 0,
      now,
    ],
  );

  return {
    id,
    person_ids: personIds,
    circle_id: parsed.circle_id ?? null,
    title: parsed.title,
    description_md: parsed.description_md ?? null,
    happened_at: happenedAt,
    photo_ids: photoIds,
    voice_memo_id: parsed.voice_memo_id ?? null,
    tags,
    is_inside_joke: isInsideJoke,
    type: 'memory',
    created_at: now,
  };
}

export function getMemory(
  db: DatabaseAdapter,
  id: string,
): MemoryRecord | null {
  const rows = db.query<MemoryRow>(
    `SELECT * FROM fn_memories WHERE id = ? AND type = 'memory'`,
    [id],
  );
  return rows.length > 0 ? deserialize(rows[0]) : null;
}

export function updateMemory(
  db: DatabaseAdapter,
  id: string,
  updates: MemoryUpdate,
): void {
  const parsed = MemoryUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;

    if (JSON_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(JSON.stringify(value));
    } else if (key === 'is_inside_joke') {
      fields.push(`${key} = ?`);
      values.push(value ? 1 : 0);
    } else if (SCALAR_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  values.push(id);

  db.execute(
    `UPDATE fn_memories SET ${fields.join(', ')} WHERE id = ? AND type = 'memory'`,
    values,
  );
}

export function deleteMemory(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM fn_memories WHERE id = ? AND type = 'memory'`, [id]);
}

// ── List with filters ──────────────────────────────────────────────

export function listMemories(
  db: DatabaseAdapter,
  filters?: MemoryFilter,
): MemoryRecord[] {
  const where: string[] = ["type = 'memory'"];
  const params: unknown[] = [];

  if (filters?.person_id) {
    where.push('person_ids LIKE ?');
    params.push(`%"${filters.person_id}"%`);
  }

  if (filters?.circle_id) {
    where.push('circle_id = ?');
    params.push(filters.circle_id);
  }

  if (filters?.is_inside_joke !== undefined) {
    where.push('is_inside_joke = ?');
    params.push(filters.is_inside_joke ? 1 : 0);
  }

  if (filters?.tag) {
    where.push('tags LIKE ?');
    params.push(`%"${filters.tag}"%`);
  }

  if (filters?.date_from) {
    where.push('happened_at >= ?');
    params.push(filters.date_from);
  }

  if (filters?.date_to) {
    where.push('happened_at <= ?');
    params.push(filters.date_to);
  }

  const sql = `SELECT * FROM fn_memories WHERE ${where.join(' AND ')} ORDER BY happened_at DESC, created_at DESC`;

  const rows = db.query<MemoryRow>(sql, params);
  return rows.map(deserialize);
}

export function listMemoriesForPerson(
  db: DatabaseAdapter,
  personId: string,
): MemoryRecord[] {
  const rows = db.query<MemoryRow>(
    `SELECT * FROM fn_memories WHERE type = 'memory' AND person_ids LIKE ? ORDER BY happened_at DESC, created_at DESC`,
    [`%"${personId}"%`],
  );
  return rows.map(deserialize);
}

export function getInsideJokes(
  db: DatabaseAdapter,
  personId?: string,
): MemoryRecord[] {
  const where: string[] = ["type = 'memory'", 'is_inside_joke = 1'];
  const params: unknown[] = [];

  if (personId) {
    where.push('person_ids LIKE ?');
    params.push(`%"${personId}"%`);
  }

  const rows = db.query<MemoryRow>(
    `SELECT * FROM fn_memories WHERE ${where.join(' AND ')} ORDER BY happened_at DESC, created_at DESC`,
    params,
  );
  return rows.map(deserialize);
}

export function getMemoryAnniversaries(
  db: DatabaseAdapter,
  referenceDate?: Date,
): MemoryRecord[] {
  const ref = referenceDate ?? new Date();
  // Get all memories with a happened_at date, then filter in JS for anniversary proximity
  const rows = db.query<MemoryRow>(
    `SELECT * FROM fn_memories WHERE type = 'memory' AND happened_at IS NOT NULL ORDER BY happened_at DESC`,
    [],
  );

  const results: MemoryRecord[] = [];
  const refMonth = ref.getMonth();
  const refDay = ref.getDate();

  for (const row of rows) {
    const happened = new Date(row.happened_at!);
    // Skip memories from the current year (no anniversary yet)
    if (happened.getFullYear() === ref.getFullYear()) continue;

    const mMonth = happened.getMonth();
    const mDay = happened.getDate();

    // Check if anniversary is within 7 days of reference date
    const anniversaryThisYear = new Date(ref.getFullYear(), mMonth, mDay);
    const refDate = new Date(ref.getFullYear(), refMonth, refDay);
    const diffMs = anniversaryThisYear.getTime() - refDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= -7 && diffDays <= 7) {
      results.push(deserialize(row));
    }
  }

  return results;
}
