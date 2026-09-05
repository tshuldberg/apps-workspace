/**
 * Device-local share-intake store round-trip + sweep (Plan 20, Phase 8). TC-12.
 *
 * Proves staged rows persist + round-trip through mk_share_intake/mk_share_payload
 * over a real in-memory DB, routing flips status without deleting, and the sweep
 * removes expired/discarded rows and reports only truly-orphaned blob hashes.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  ensureShareIntakeTables,
  getSharePayloads,
  listShareIntakes,
  routeShareIntake,
  stageShareIntake,
  sweepExpiredShareIntakes,
} from '../share/share-intake-store';

let h: InMemoryTestDatabase | null = null;
let db: InMemoryTestDatabase['adapter'];

beforeEach(() => {
  h = createInMemoryTestDatabase();
  db = h.adapter;
  ensureShareIntakeTables(db);
});
afterEach(() => {
  h?.close();
  h = null;
});

const FUTURE = '2999-01-01T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';

it('stages an intake + payloads and lists/round-trips them', () => {
  stageShareIntake(db, {
    id: 'i1',
    source: 'ios_share_extension',
    sourceApp: 'com.apple.mobilesafari',
    createdAt: '2026-06-29T00:00:00.000Z',
    expiresAt: FUTURE,
    payloads: [
      { id: 'p1', kind: 'url', textValue: 'https://example.com' },
      { id: 'p2', kind: 'image', mime: 'image/png', filename: 'a.png', byteLength: 1024, blobHash: 'h-png' },
    ],
  });
  const staged = listShareIntakes(db);
  expect(staged).toHaveLength(1);
  expect(staged[0]!.status).toBe('staged');
  const payloads = getSharePayloads(db, 'i1');
  expect(payloads.map((p) => p.kind).sort()).toEqual(['image', 'url']);
  expect(payloads.find((p) => p.id === 'p2')!.blob_hash).toBe('h-png');
});

it('routing flips status to routed (does not delete) and drops it from the staged list', () => {
  stageShareIntake(db, {
    id: 'i1', source: 'web_file_pick', createdAt: '2026-06-29T00:00:00.000Z', expiresAt: FUTURE,
    payloads: [{ id: 'p1', kind: 'file', filename: 'x.bin', byteLength: 10, blobHash: 'h-bin' }],
  });
  routeShareIntake(db, 'i1', 'channel', 'community-1/general');
  expect(listShareIntakes(db)).toHaveLength(0);
  const routed = listShareIntakes(db, ['routed']);
  expect(routed[0]!.destination).toBe('channel');
  expect(routed[0]!.dest_ref).toBe('community-1/general');
});

describe('sweepExpiredShareIntakes', () => {
  it('removes expired staged rows and reports their orphaned blob hashes', () => {
    stageShareIntake(db, {
      id: 'old', source: 'android_share_intent', createdAt: PAST, expiresAt: PAST,
      payloads: [{ id: 'p1', kind: 'image', byteLength: 5, blobHash: 'h-old' }],
    });
    stageShareIntake(db, {
      id: 'fresh', source: 'android_share_intent', createdAt: '2026-06-29T00:00:00.000Z', expiresAt: FUTURE,
      payloads: [{ id: 'p2', kind: 'image', byteLength: 5, blobHash: 'h-fresh' }],
    });
    const result = sweepExpiredShareIntakes(db, '2026-06-29T00:00:00.000Z');
    expect(result.removedIntakeIds).toEqual(['old']);
    expect(result.orphanedBlobHashes).toEqual(['h-old']);
    expect(listShareIntakes(db).map((r) => r.id)).toEqual(['fresh']);
  });

  it('does NOT report a hash as orphaned when a surviving payload still references it', () => {
    stageShareIntake(db, {
      id: 'old', source: 'web_file_pick', createdAt: PAST, expiresAt: PAST,
      payloads: [{ id: 'p1', kind: 'file', byteLength: 5, blobHash: 'shared-hash' }],
    });
    stageShareIntake(db, {
      id: 'fresh', source: 'web_file_pick', createdAt: '2026-06-29T00:00:00.000Z', expiresAt: FUTURE,
      payloads: [{ id: 'p2', kind: 'file', byteLength: 5, blobHash: 'shared-hash' }],
    });
    const result = sweepExpiredShareIntakes(db, '2026-06-29T00:00:00.000Z');
    expect(result.removedIntakeIds).toEqual(['old']);
    expect(result.orphanedBlobHashes).toEqual([]); // 'fresh' still references it
  });

  it('is a no-op (no orphans) when nothing is expired', () => {
    stageShareIntake(db, {
      id: 'fresh', source: 'web_file_pick', createdAt: '2026-06-29T00:00:00.000Z', expiresAt: FUTURE,
      payloads: [{ id: 'p1', kind: 'text', textValue: 'hi' }],
    });
    expect(sweepExpiredShareIntakes(db, '2026-06-29T00:00:00.000Z')).toEqual({
      removedIntakeIds: [],
      orphanedBlobHashes: [],
    });
  });
});
