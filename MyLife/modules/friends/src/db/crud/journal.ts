/**
 * Journal CRUD operations for gratitude, conflict, and growth entries.
 *
 * Journal entries are stored in fn_memories with a type column
 * distinguishing them from regular memories.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  JournalEntryInputSchema,
  type JournalEntryInput,
  type JournalEntryRow,
  type JournalEntryRecord,
  type JournalCountByType,
  type JournalType,
} from '../../models/journal-schemas';

// ── Helpers ─────────────────────────────────────────────────────────

function deserialize(row: JournalEntryRow): JournalEntryRecord {
  return {
    id: row.id,
    person_ids: JSON.parse(row.person_ids) as string[],
    type: row.type as JournalType,
    title: row.title,
    description_md: row.description_md,
    happened_at: row.happened_at,
    created_at: row.created_at,
  };
}

// ── CRUD ────────────────────────────────────────────────────────────

export function createJournalEntry(
  db: DatabaseAdapter,
  input: JournalEntryInput,
): JournalEntryRecord {
  const parsed = JournalEntryInputSchema.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const personIds = JSON.stringify([parsed.person_id]);

  db.execute(
    `INSERT INTO fn_memories
       (id, person_ids, title, description_md, happened_at, type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      personIds,
      parsed.title,
      parsed.description_md ?? null,
      now,
      parsed.type,
      now,
    ],
  );

  return {
    id,
    person_ids: [parsed.person_id],
    type: parsed.type,
    title: parsed.title,
    description_md: parsed.description_md ?? null,
    happened_at: now,
    created_at: now,
  };
}

export function listJournalForPerson(
  db: DatabaseAdapter,
  personId: string,
  type?: JournalType,
): JournalEntryRecord[] {
  const where: string[] = [
    "type IN ('gratitude','conflict','growth')",
    "person_ids LIKE ?",
  ];
  const params: unknown[] = [`%${personId}%`];

  if (type) {
    where.push('type = ?');
    params.push(type);
  }

  const rows = db.query<JournalEntryRow>(
    `SELECT * FROM fn_memories WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
    params,
  );
  return rows.map(deserialize);
}

export function deleteJournalEntry(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM fn_memories WHERE id = ?`, [id]);
}

export function countJournalByType(
  db: DatabaseAdapter,
  personId: string,
): JournalCountByType {
  const rows = db.query<{ type: string; cnt: number }>(
    `SELECT type, COUNT(*) as cnt FROM fn_memories
     WHERE type IN ('gratitude','conflict','growth')
       AND person_ids LIKE ?
     GROUP BY type`,
    [`%${personId}%`],
  );

  const counts: JournalCountByType = { gratitude: 0, conflict: 0, growth: 0 };
  for (const row of rows) {
    if (row.type === 'gratitude' || row.type === 'conflict' || row.type === 'growth') {
      counts[row.type] = row.cnt;
    }
  }
  return counts;
}
