/**
 * Journal memory CRUD for MyTravel (v7 journal).
 *
 * Memories are attachments on a journal entry (photo, quote, souvenir, video,
 * audio, other). IDs use the `jm_` prefix. Sort order defaults to the
 * next-highest sort_order in the owning entry.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  JournalMemoryInputSchema,
  JournalMemoryUpdateSchema,
  type JournalMemoryInput,
  type JournalMemoryRow,
  type JournalMemoryUpdate,
} from '../../models/schemas';

// ── ID generation ───────────────────────────────────────────────────

let jmIdCounter = 0;

function generateMemoryId(): string {
  jmIdCounter += 1;
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `jm_${now}${rand}${jmIdCounter.toString(36)}`;
}

// ── Update column whitelist ─────────────────────────────────────────

const MEMORY_UPDATE_COLUMNS = new Set([
  'kind',
  'media_ref',
  'caption',
  'sort_order',
]);

// ── CRUD ────────────────────────────────────────────────────────────

export function createJournalMemory(
  db: DatabaseAdapter,
  input: JournalMemoryInput,
): JournalMemoryRow {
  const parsed = JournalMemoryInputSchema.parse(input);
  const id = generateMemoryId();
  const now = new Date().toISOString();

  let sortOrder = parsed.sort_order;
  if (sortOrder === undefined) {
    const rows = db.query<{ max_order: number | null }>(
      `SELECT MAX(sort_order) as max_order FROM tv_journal_memories WHERE entry_id = ?`,
      [parsed.entry_id],
    );
    const current = rows[0]?.max_order ?? null;
    sortOrder = current === null ? 0 : current + 1;
  }

  const row: JournalMemoryRow = {
    id,
    entry_id: parsed.entry_id,
    kind: parsed.kind,
    media_ref: parsed.media_ref ?? null,
    caption: parsed.caption ?? null,
    sort_order: sortOrder,
    created_at: now,
  };

  db.execute(
    `INSERT INTO tv_journal_memories (
       id, entry_id, kind, media_ref, caption, sort_order, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.entry_id,
      row.kind,
      row.media_ref,
      row.caption,
      row.sort_order,
      row.created_at,
    ],
  );

  return row;
}

export function listJournalMemories(
  db: DatabaseAdapter,
  entryId: string,
): JournalMemoryRow[] {
  return db.query<JournalMemoryRow>(
    `SELECT * FROM tv_journal_memories WHERE entry_id = ? ORDER BY sort_order ASC`,
    [entryId],
  );
}

export function updateJournalMemory(
  db: DatabaseAdapter,
  id: string,
  patch: JournalMemoryUpdate,
): void {
  const parsed = JournalMemoryUpdateSchema.parse(patch);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (!MEMORY_UPDATE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  values.push(id);

  db.execute(
    `UPDATE tv_journal_memories SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteJournalMemory(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_journal_memories WHERE id = ?`, [id]);
}

/**
 * Reassigns sort_order for the given memory ids in the order provided.
 * Transactional. Ids not present in the table are simply no-ops for that row.
 */
export function reorderJournalMemories(
  db: DatabaseAdapter,
  orderedIds: string[],
): void {
  db.transaction(() => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i]!;
      db.execute(
        `UPDATE tv_journal_memories SET sort_order = ? WHERE id = ?`,
        [i, id],
      );
    }
  });
}
