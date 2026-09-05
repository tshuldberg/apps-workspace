import type { DatabaseAdapter } from '@mylife/db';
import type { TherapyTopic, TherapyTopicSection } from '../therapy/types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `jn_tt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function rowToTherapyTopic(row: Record<string, unknown>): TherapyTopic {
  return {
    id: row.id as string,
    entryId: row.entry_id as string,
    section: row.section as TherapyTopic['section'],
    content: row.content as string,
    sortOrder: row.sort_order as number,
    isCompleted: Number(row.is_completed ?? 0) === 1,
    createdAt: row.created_at as string,
  };
}

export function addTherapyTopic(
  db: DatabaseAdapter,
  entryId: string,
  section: TherapyTopicSection,
  content: string,
  sortOrder = 0,
): TherapyTopic {
  const id = createId();

  db.execute(
    `INSERT INTO jn_therapy_topics (id, entry_id, section, content, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [id, entryId, section, content, sortOrder],
  );

  return getTherapyTopicById(db, id)!;
}

export function getTherapyTopicById(db: DatabaseAdapter, id: string): TherapyTopic | null {
  const row = db.query<Record<string, unknown>>(
    `SELECT * FROM jn_therapy_topics WHERE id = ?`,
    [id],
  )[0];
  return row ? rowToTherapyTopic(row) : null;
}

export function listTherapyTopicsForEntry(
  db: DatabaseAdapter,
  entryId: string,
  section?: TherapyTopicSection,
): TherapyTopic[] {
  if (section) {
    return db
      .query<Record<string, unknown>>(
        `SELECT * FROM jn_therapy_topics WHERE entry_id = ? AND section = ? ORDER BY sort_order ASC`,
        [entryId, section],
      )
      .map(rowToTherapyTopic);
  }

  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM jn_therapy_topics WHERE entry_id = ? ORDER BY section ASC, sort_order ASC`,
      [entryId],
    )
    .map(rowToTherapyTopic);
}

export function updateTherapyTopicContent(
  db: DatabaseAdapter,
  id: string,
  content: string,
): void {
  db.execute(`UPDATE jn_therapy_topics SET content = ? WHERE id = ?`, [content, id]);
}

export function updateTherapyTopicOrder(
  db: DatabaseAdapter,
  id: string,
  sortOrder: number,
): void {
  db.execute(`UPDATE jn_therapy_topics SET sort_order = ? WHERE id = ?`, [sortOrder, id]);
}

export function toggleTherapyTopicCompleted(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(
    `UPDATE jn_therapy_topics SET is_completed = CASE WHEN is_completed = 0 THEN 1 ELSE 0 END WHERE id = ?`,
    [id],
  );
}

export function deleteTherapyTopic(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM jn_therapy_topics WHERE id = ?`, [id]);
}

export function deleteTherapyTopicsForEntry(db: DatabaseAdapter, entryId: string): void {
  db.execute(`DELETE FROM jn_therapy_topics WHERE entry_id = ?`, [entryId]);
}

/**
 * Reorder topics within a section by swapping sort_order values.
 */
export function reorderTherapyTopics(
  db: DatabaseAdapter,
  topicIdA: string,
  topicIdB: string,
): void {
  const a = getTherapyTopicById(db, topicIdA);
  const b = getTherapyTopicById(db, topicIdB);
  if (!a || !b) return;

  db.transaction(() => {
    db.execute(`UPDATE jn_therapy_topics SET sort_order = ? WHERE id = ?`, [b.sortOrder, topicIdA]);
    db.execute(`UPDATE jn_therapy_topics SET sort_order = ? WHERE id = ?`, [a.sortOrder, topicIdB]);
  });
}
