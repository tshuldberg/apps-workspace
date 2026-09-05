/**
 * MK-014 -- relay-first transport defaults (decisions D1/D2). New installs
 * dial Relay > LAN > Direct > Nearby (BLE stays wake-up-only, last), and the
 * bootstrap seeds preference rows in that order. A user's ranked choices still
 * override the ladder.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { buildTransportLayerDialOrder } from '../transport/transport-manager';
import { ensureSyncBootstrap, migrateTransportDefaultsToV2 } from '../db/bootstrap';
import {
  getTransportPreferences,
  getTransportRungStats,
  setTransportPreferences,
} from '../db/queries';

describe('relay-first dial ladder (MK-014)', () => {
  it('defaults to Relay > LAN > Direct > Nearby > BLE-wake', () => {
    expect(buildTransportLayerDialOrder()).toEqual([5, 1, 4, 2, 3]);
  });

  it('a user ranked choice still leads; the relay-first ladder backfills', () => {
    expect(buildTransportLayerDialOrder([1])).toEqual([1, 5, 4, 2, 3]);
    expect(buildTransportLayerDialOrder([2, 4])).toEqual([2, 4, 5, 1, 3]);
  });

  it('without fallback only the ranked choices are dialed', () => {
    expect(buildTransportLayerDialOrder([4], false)).toEqual([4]);
  });
});

describe('new-install preference seeding (MK-014)', () => {
  let testDb: InMemoryTestDatabase;
  beforeEach(() => { testDb = createInMemoryTestDatabase(); });
  afterEach(() => { testDb.close(); });

  it('bootstrap seeds relay at rank 1', () => {
    const { identity } = ensureSyncBootstrap(testDb.adapter, {
      now: () => new Date('2026-06-11T00:00:00.000Z'),
      idFactory: () => 'ws_personal_test',
    });

    const prefs = getTransportPreferences(testDb.adapter, identity.publicKey)
      .sort((a, b) => a.rank - b.rank);
    expect(prefs.map((p) => p.layerId)).toEqual([5, 1, 4, 2, 3]);
    expect(prefs[0]).toMatchObject({ layerId: 5, rank: 1, enabled: true });
  });
});

describe('existing-install ladder migration (MK-029)', () => {
  let testDb: InMemoryTestDatabase;
  beforeEach(() => { testDb = createInMemoryTestDatabase(); });
  afterEach(() => { testDb.close(); });

  const legacyRows = (deviceId: string) =>
    [1, 2, 3, 4, 5].map((layerId, index) => ({
      deviceId, layerId, rank: index + 1, enabled: true, updatedAt: '2026-01-01T00:00:00.000Z',
    }));

  it('rewrites an install still on the legacy v1 default to relay-first, exactly once', () => {
    // First boot wrote the legacy default (pre-MK-014 install).
    const boot = ensureSyncBootstrap(testDb.adapter, { idFactory: () => 'ws_personal_test' });
    setTransportPreferences(testDb.adapter, boot.identity.publicKey, legacyRows(boot.identity.publicKey));

    const migrated = migrateTransportDefaultsToV2(testDb.adapter, boot.identity.publicKey);
    expect(migrated).toBe(true);
    const prefs = getTransportPreferences(testDb.adapter, boot.identity.publicKey)
      .sort((a, b) => a.rank - b.rank);
    expect(prefs.map((p) => p.layerId)).toEqual([5, 1, 4, 2, 3]);

    // One-shot: a second run is a no-op (the rows are no longer the legacy default).
    expect(migrateTransportDefaultsToV2(testDb.adapter, boot.identity.publicKey)).toBe(false);
  });

  it('bootstrap migrates a legacy install on startup', () => {
    const boot = ensureSyncBootstrap(testDb.adapter, { idFactory: () => 'ws_personal_test' });
    setTransportPreferences(testDb.adapter, boot.identity.publicKey, legacyRows(boot.identity.publicKey));

    ensureSyncBootstrap(testDb.adapter, { idFactory: () => 'ws_personal_test' });

    const prefs = getTransportPreferences(testDb.adapter, boot.identity.publicKey)
      .sort((a, b) => a.rank - b.rank);
    expect(prefs.map((p) => p.layerId)).toEqual([5, 1, 4, 2, 3]);
  });

  it('never touches a user-customized ranking', () => {
    const boot = ensureSyncBootstrap(testDb.adapter, { idFactory: () => 'ws_personal_test' });
    const custom = [2, 1, 5, 4, 3].map((layerId, index) => ({
      deviceId: boot.identity.publicKey, layerId, rank: index + 1, enabled: index !== 4,
      updatedAt: '2026-02-02T00:00:00.000Z',
    }));
    setTransportPreferences(testDb.adapter, boot.identity.publicKey, custom);

    expect(migrateTransportDefaultsToV2(testDb.adapter, boot.identity.publicKey)).toBe(false);
    ensureSyncBootstrap(testDb.adapter, { idFactory: () => 'ws_personal_test' });
    const prefs = getTransportPreferences(testDb.adapter, boot.identity.publicKey)
      .sort((a, b) => a.rank - b.rank);
    expect(prefs.map((p) => p.layerId)).toEqual([2, 1, 5, 4, 3]);
  });
});

describe('per-rung stats from real sessions (MK-029)', () => {
  let testDb: InMemoryTestDatabase;
  beforeEach(() => { testDb = createInMemoryTestDatabase(); });
  afterEach(() => { testDb.close(); });

  it('aggregates attempts and successes per transport, locally', () => {
    ensureSyncBootstrap(testDb.adapter, { idFactory: () => 'ws_personal_test' });
    const session = (id: string, transport: string, status: string, at: string) => {
      testDb.adapter.execute(
        `INSERT INTO sync_sessions (id, peer_device_id, workspace_id, transport, direction, modules_synced,
           changes_sent, changes_received, bytes_sent, bytes_received, blobs_sent, blobs_received,
           duration_ms, status, error, started_at, completed_at)
         VALUES (?, ?, NULL, ?, 'bidirectional', '[]', 0, 0, 0, 0, 0, 0, 10, ?, NULL, ?, ?)`,
        [id, 'peer', transport, status, at, at],
      );
    };
    session('s1', 'wan_relay', 'completed', '2026-06-11T01:00:00.000Z');
    session('s2', 'wan_relay', 'failed', '2026-06-11T02:00:00.000Z');
    session('s3', 'wan_relay', 'completed', '2026-06-11T03:00:00.000Z');
    session('s4', 'lan', 'completed', '2026-06-11T04:00:00.000Z');

    const stats = getTransportRungStats(testDb.adapter);
    expect(stats).toEqual([
      { transport: 'wan_relay', attempts: 3, successes: 2, lastAttemptAt: '2026-06-11T03:00:00.000Z' },
      { transport: 'lan', attempts: 1, successes: 1, lastAttemptAt: '2026-06-11T04:00:00.000Z' },
    ]);
  });
});
