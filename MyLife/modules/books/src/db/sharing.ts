/**
 * Sharing primitives for MyBooks.
 *
 * Visibility semantics:
 * - private: only actor can view
 * - friends: actor + accepted friends can view
 * - public: any viewer can view
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  ShareEvent,
  ShareEventInsert,
  ShareObjectType,
  ShareVisibility,
} from '../models/schemas';

export interface ShareEventFilters {
  viewer_user_id: string;
  actor_user_id?: string;
  object_type?: ShareObjectType;
  object_id?: string;
  limit?: number;
  offset?: number;
}

export function createShareEvent(
  db: DatabaseAdapter,
  id: string,
  input: ShareEventInsert,
): ShareEvent {
  const now = new Date().toISOString();
  const event: ShareEvent = {
    id,
    actor_user_id: input.actor_user_id,
    object_type: input.object_type,
    object_id: input.object_id,
    visibility: input.visibility ?? 'private',
    payload_json: input.payload_json ?? '{}',
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bk_share_events (
       id,
       actor_user_id,
       object_type,
       object_id,
       visibility,
       payload_json,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.actor_user_id,
      event.object_type,
      event.object_id,
      event.visibility,
      event.payload_json,
      event.created_at,
      event.updated_at,
    ],
  );

  return event;
}

export function getShareEvent(
  db: DatabaseAdapter,
  id: string,
): ShareEvent | null {
  const rows = db.query<ShareEvent>(
    `SELECT * FROM bk_share_events WHERE id = ?`,
    [id],
  );

  return rows[0] ?? null;
}

export function getShareEventsForObject(
  db: DatabaseAdapter,
  objectType: ShareObjectType,
  objectId: string,
): ShareEvent[] {
  return db.query<ShareEvent>(
    `SELECT *
     FROM bk_share_events
     WHERE object_type = ?
       AND object_id = ?
     ORDER BY created_at DESC`,
    [objectType, objectId],
  );
}

/**
 * List events visible to a given viewer according to visibility rules.
 * Requires hub_friendships table from @mylife/db hub schema.
 */
export function listShareEventsVisibleToUser(
  db: DatabaseAdapter,
  filters: ShareEventFilters,
): ShareEvent[] {
  const clauses: string[] = [
    `(
      se.actor_user_id = ?
      OR se.visibility = 'public'
      OR (
        se.visibility = 'friends'
        AND EXISTS (
          SELECT 1
          FROM hub_friendships hf
          WHERE hf.user_id = ?
            AND hf.friend_user_id = se.actor_user_id
            AND hf.status = 'accepted'
        )
      )
    )`,
  ];

  const params: unknown[] = [
    filters.viewer_user_id,
    filters.viewer_user_id,
  ];

  if (filters.actor_user_id) {
    clauses.push('se.actor_user_id = ?');
    params.push(filters.actor_user_id);
  }

  if (filters.object_type) {
    clauses.push('se.object_type = ?');
    params.push(filters.object_type);
  }

  if (filters.object_id) {
    clauses.push('se.object_id = ?');
    params.push(filters.object_id);
  }

  let sql = `SELECT se.* FROM bk_share_events se WHERE ${clauses.join(' AND ')} ORDER BY se.created_at DESC`;

  if (filters.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(filters.limit);

    if (filters.offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }
  }

  return db.query<ShareEvent>(sql, params);
}

export function updateShareEvent(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<ShareEvent, 'visibility' | 'payload_json'>>,
): void {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (updates.visibility !== undefined) {
    fields.push('visibility = ?');
    params.push(updates.visibility);
  }

  if (updates.payload_json !== undefined) {
    fields.push('payload_json = ?');
    params.push(updates.payload_json);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE bk_share_events
     SET ${fields.join(', ')}
     WHERE id = ?`,
    params,
  );
}

export function updateShareEventVisibility(
  db: DatabaseAdapter,
  id: string,
  visibility: ShareVisibility,
): void {
  updateShareEvent(db, id, { visibility });
}

export function deleteShareEvent(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM bk_share_events WHERE id = ?`, [id]);
}
