// Local follow graph over the nw_follows cache table. Follows are device-local
// (they shape the Today feed only); nothing here reaches the network. The
// unique index on journalist_key makes add idempotent.

import type { DatabaseAdapter } from '@mylife/db';
import { newFollowId } from './ids';

export interface Follow {
  id: string;
  journalistKey: string;
  handle: string;
  createdAt: string;
}

interface FollowRow {
  id: string;
  journalist_key: string;
  handle: string;
  created_at: string;
}

function rowToFollow(row: FollowRow): Follow {
  return {
    id: row.id,
    journalistKey: row.journalist_key,
    handle: row.handle,
    createdAt: row.created_at,
  };
}

export function listFollows(db: DatabaseAdapter): Follow[] {
  return db
    .query<FollowRow>('SELECT * FROM nw_follows ORDER BY created_at DESC')
    .map(rowToFollow);
}

export function listFollowedPubkeys(db: DatabaseAdapter): string[] {
  return db
    .query<{ journalist_key: string }>('SELECT journalist_key FROM nw_follows')
    .map((row) => row.journalist_key);
}

export function isFollowing(db: DatabaseAdapter, journalistKey: string): boolean {
  return (
    db.query<{ one: number }>(
      'SELECT 1 AS one FROM nw_follows WHERE journalist_key = ? LIMIT 1',
      [journalistKey],
    ).length > 0
  );
}

export function addFollow(
  db: DatabaseAdapter,
  input: { journalistKey: string; handle: string },
  nowIso: string,
): void {
  db.execute(
    'INSERT OR IGNORE INTO nw_follows (id, journalist_key, handle, created_at) VALUES (?, ?, ?, ?)',
    [newFollowId(), input.journalistKey, input.handle, nowIso],
  );
}

export function removeFollow(db: DatabaseAdapter, journalistKey: string): void {
  db.execute('DELETE FROM nw_follows WHERE journalist_key = ?', [journalistKey]);
}
