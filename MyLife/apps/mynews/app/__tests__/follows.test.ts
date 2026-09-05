import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  addFollow,
  isFollowing,
  listFollowedPubkeys,
  listFollows,
  removeFollow,
} from '../(root)/lib/follows';

interface FollowRow {
  id: string;
  journalist_key: string;
  handle: string;
  created_at: string;
}

// Test-only adapter that implements exactly the statements follows.ts issues,
// including the unique-key idempotency the nw_follows index guarantees on device.
function makeFollowsDb(): DatabaseAdapter {
  const rows: FollowRow[] = [];
  return {
    execute(sql: string, params: unknown[] = []): void {
      if (sql.startsWith('INSERT OR IGNORE INTO nw_follows')) {
        const [id, journalist_key, handle, created_at] = params as string[];
        if (!rows.some((r) => r.journalist_key === journalist_key)) {
          rows.push({ id, journalist_key, handle, created_at });
        }
        return;
      }
      if (sql.startsWith('DELETE FROM nw_follows WHERE journalist_key')) {
        const [key] = params as string[];
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (rows[i]?.journalist_key === key) rows.splice(i, 1);
        }
        return;
      }
      throw new Error(`unhandled execute: ${sql}`);
    },
    query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      if (sql.includes('SELECT 1 AS one')) {
        const [key] = params as string[];
        return rows.filter((r) => r.journalist_key === key).map(() => ({ one: 1 })) as T[];
      }
      if (sql.startsWith('SELECT journalist_key')) {
        return rows.map((r) => ({ journalist_key: r.journalist_key })) as T[];
      }
      if (sql.startsWith('SELECT * FROM nw_follows')) {
        return [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) as T[];
      }
      throw new Error(`unhandled query: ${sql}`);
    },
    transaction(fn: () => void): void {
      fn();
    },
  };
}

describe('local follow graph', () => {
  it('adds a follow and reports it as followed', () => {
    const db = makeFollowsDb();
    addFollow(db, { journalistKey: 'pk-1', handle: 'reporter' }, '2026-07-01T00:00:00.000Z');
    expect(isFollowing(db, 'pk-1')).toBe(true);
    expect(listFollowedPubkeys(db)).toEqual(['pk-1']);
  });

  it('is idempotent on the journalist key', () => {
    const db = makeFollowsDb();
    addFollow(db, { journalistKey: 'pk-1', handle: 'reporter' }, '2026-07-01T00:00:00.000Z');
    addFollow(db, { journalistKey: 'pk-1', handle: 'reporter' }, '2026-07-02T00:00:00.000Z');
    expect(listFollows(db)).toHaveLength(1);
  });

  it('removes a follow', () => {
    const db = makeFollowsDb();
    addFollow(db, { journalistKey: 'pk-1', handle: 'reporter' }, '2026-07-01T00:00:00.000Z');
    removeFollow(db, 'pk-1');
    expect(isFollowing(db, 'pk-1')).toBe(false);
    expect(listFollowedPubkeys(db)).toEqual([]);
  });

  it('orders follows newest-first', () => {
    const db = makeFollowsDb();
    addFollow(db, { journalistKey: 'pk-1', handle: 'one' }, '2026-07-01T00:00:00.000Z');
    addFollow(db, { journalistKey: 'pk-2', handle: 'two' }, '2026-07-03T00:00:00.000Z');
    expect(listFollows(db).map((f) => f.journalistKey)).toEqual(['pk-2', 'pk-1']);
  });
});
