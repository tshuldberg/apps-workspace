import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  CM_PUBLIC_FOLLOWS_TABLE,
  COMMUNITY_DDL,
  COMMUNITY_SYNC_POLICY,
  ensureCommunityTables,
} from '../community-core';
import {
  followPublic,
  isFollowingPublic,
  listPublicFollows,
  toggleFollowPublic,
  unfollowPublic,
} from '../public-follows';

const PERSONA_A = 'a'.repeat(64);
const PERSONA_B = 'b'.repeat(64);

let testDb: InMemoryTestDatabase | null = null;

function freshDb(): InMemoryTestDatabase['adapter'] {
  testDb = createInMemoryTestDatabase();
  const db = testDb.adapter;
  ensureCommunityTables(db);
  return db;
}

afterEach(() => {
  testDb?.close?.();
  testDb = null;
});

describe('Plan 39 P10 public follows', () => {
  let db: InMemoryTestDatabase['adapter'];
  beforeEach(() => { db = freshDb(); });

  it('follows a persona and a topic, then lists them newest-first', () => {
    followPublic(db, 'persona', PERSONA_A, '@ridgeway');
    followPublic(db, 'topic', 'gardening', '🌱 gardening');
    expect(isFollowingPublic(db, 'persona', PERSONA_A)).toBe(true);
    expect(isFollowingPublic(db, 'topic', 'gardening')).toBe(true);
    expect(isFollowingPublic(db, 'persona', PERSONA_B)).toBe(false);

    const all = listPublicFollows(db);
    expect(all.map((f) => f.targetId)).toContain(PERSONA_A);
    expect(all.map((f) => f.targetId)).toContain('gardening');
    expect(listPublicFollows(db, 'topic').map((f) => f.targetId)).toEqual(['gardening']);
    expect(listPublicFollows(db, 'persona')[0]?.displayHint).toBe('@ridgeway');
  });

  it('unfollow removes the row; both operations are idempotent', () => {
    followPublic(db, 'persona', PERSONA_A);
    followPublic(db, 'persona', PERSONA_A); // idempotent (PRIMARY KEY)
    expect(listPublicFollows(db, 'persona')).toHaveLength(1);
    unfollowPublic(db, 'persona', PERSONA_A);
    unfollowPublic(db, 'persona', PERSONA_A); // idempotent
    expect(isFollowingPublic(db, 'persona', PERSONA_A)).toBe(false);
  });

  it('re-following preserves created_at (no reorder) and only refreshes the display hint', () => {
    followPublic(db, 'persona', PERSONA_A, 'old hint');
    // Force a distinct, older created_at so the ON CONFLICT preservation is observable.
    db.execute(`UPDATE cm_public_follows SET created_at = '2000-01-01 00:00:00' WHERE target_id = ?`, [PERSONA_A]);
    followPublic(db, 'persona', PERSONA_A, 'new hint');
    const row = listPublicFollows(db, 'persona')[0];
    expect(row?.createdAt).toBe('2000-01-01 00:00:00'); // preserved, not bumped to now
    expect(row?.displayHint).toBe('new hint'); // refreshed
  });

  it('toggle returns the new state', () => {
    expect(toggleFollowPublic(db, 'topic', 'tech')).toBe(true);
    expect(isFollowingPublic(db, 'topic', 'tech')).toBe(true);
    expect(toggleFollowPublic(db, 'topic', 'tech')).toBe(false);
    expect(isFollowingPublic(db, 'topic', 'tech')).toBe(false);
  });

  it('persona targets are case-folded so upper/lower hex match the same follow', () => {
    followPublic(db, 'persona', PERSONA_A.toUpperCase(), '@caps');
    expect(isFollowingPublic(db, 'persona', PERSONA_A)).toBe(true);
    expect(listPublicFollows(db, 'persona')).toHaveLength(1);
  });

  it('a malformed persona target is a no-op, never a stored follow', () => {
    followPublic(db, 'persona', 'not-hex');
    expect(toggleFollowPublic(db, 'persona', 'short')).toBe(false);
    expect(listPublicFollows(db, 'persona')).toHaveLength(0);
  });

  it('cm_public_follows is created AND pinned device_local (never replicates)', () => {
    expect(COMMUNITY_DDL.some((ddl) => ddl.includes('CREATE TABLE IF NOT EXISTS cm_public_follows'))).toBe(true);
    const rule = COMMUNITY_SYNC_POLICY.entityRules.find((r) => r.tableName === CM_PUBLIC_FOLLOWS_TABLE);
    expect(rule?.defaultScope).toBe('device_local');
    expect(rule?.maxScope).toBe('device_local');
  });
});
