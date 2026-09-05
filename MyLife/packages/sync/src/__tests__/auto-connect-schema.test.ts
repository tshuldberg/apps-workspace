/**
 * Plan 29 Phase 0: auto_connect column + sync_auto_connect_state table +
 * queries, exercised against a REAL in-memory SQLite adapter (not a mock), so
 * the DDL, the additive-column migration, and the query SQL are all verified
 * end to end.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { createSyncTables, migrateSyncSchema } from '../db/schema';
import {
  getAutoConnectPeers,
  insertPairedDevice,
  isPeerAutoConnectEnabled,
  readAllAutoConnectState,
  readAutoConnectState,
  setPeerAutoConnect,
  writeAutoConnectState,
  type AutoConnectState,
} from '../db/queries';
import type { PairedDevice } from '../types';

function device(id: string, overrides: Partial<PairedDevice> = {}): PairedDevice {
  return {
    deviceId: id,
    displayName: id,
    dhPublicKey: `dh-${id}`,
    sharedSecretRef: `ref-${id}`,
    lastSeenAt: null,
    lastSyncAt: null,
    lastSyncModule: null,
    bytesSent: 0,
    bytesReceived: 0,
    isActive: true,
    pairedAt: '2026-07-04T00:00:00.000Z',
    ...overrides,
  };
}

describe('Plan 29 Phase 0 schema', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createInMemoryTestDatabase();
    createSyncTables(db.adapter);
    migrateSyncSchema(db.adapter);
  });

  it('a fresh paired device is auto-connect-enabled by default', () => {
    insertPairedDevice(db.adapter, device('peer-a'));
    expect(isPeerAutoConnectEnabled(db.adapter, 'peer-a')).toBe(true);
    expect(getAutoConnectPeers(db.adapter).map((p) => p.deviceId)).toEqual(['peer-a']);
  });

  it('setPeerAutoConnect(false) removes a peer from the auto-connect set (AC-4)', () => {
    insertPairedDevice(db.adapter, device('peer-a'));
    insertPairedDevice(db.adapter, device('peer-b'));
    setPeerAutoConnect(db.adapter, 'peer-a', false);
    expect(isPeerAutoConnectEnabled(db.adapter, 'peer-a')).toBe(false);
    expect(getAutoConnectPeers(db.adapter).map((p) => p.deviceId)).toEqual(['peer-b']);
  });

  it('an inactive peer is never in the auto-connect set', () => {
    insertPairedDevice(db.adapter, device('peer-a', { isActive: false }));
    expect(getAutoConnectPeers(db.adapter)).toEqual([]);
  });

  it('an unpaired device is not auto-connect-eligible', () => {
    expect(isPeerAutoConnectEnabled(db.adapter, 'nope')).toBe(false);
  });

  it('auto-connect state round-trips and defaults to null before any attempt', () => {
    expect(readAutoConnectState(db.adapter, 'peer-a')).toBeNull();
    const state: AutoConnectState = {
      peerDeviceId: 'peer-a',
      failureCount: 2,
      nextAttemptAt: 1_700_000_600_000,
      lastAttemptAt: 1_700_000_000_000,
      lastResult: 'failed',
    };
    writeAutoConnectState(db.adapter, state);
    expect(readAutoConnectState(db.adapter, 'peer-a')).toEqual(state);
    // Upsert overwrites in place.
    writeAutoConnectState(db.adapter, { ...state, failureCount: 0, nextAttemptAt: null, lastResult: 'completed' });
    expect(readAutoConnectState(db.adapter, 'peer-a')).toEqual({
      peerDeviceId: 'peer-a',
      failureCount: 0,
      nextAttemptAt: null,
      lastAttemptAt: 1_700_000_000_000,
      lastResult: 'completed',
    });
    expect(readAllAutoConnectState(db.adapter)).toHaveLength(1);
  });
});

describe('Plan 29 Phase 0 additive-column migration', () => {
  it('adds auto_connect to an upgraded install that predates the column, idempotently', () => {
    const db = createInMemoryTestDatabase();
    // Simulate an OLD install: sync_paired_devices WITHOUT the auto_connect column.
    db.adapter.execute(`
      CREATE TABLE sync_paired_devices (
        device_id TEXT PRIMARY KEY NOT NULL,
        display_name TEXT NOT NULL,
        dh_public_key TEXT NOT NULL,
        shared_secret_ref TEXT NOT NULL,
        last_seen_at TEXT,
        last_sync_at TEXT,
        last_sync_module TEXT,
        bytes_sent INTEGER NOT NULL DEFAULT 0,
        bytes_received INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        paired_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`);
    db.adapter.execute(
      `INSERT INTO sync_paired_devices (device_id, display_name, dh_public_key, shared_secret_ref, is_active, paired_at)
       VALUES ('legacy', 'legacy', 'dh', 'ref', 1, '2026-01-01T00:00:00.000Z')`,
    );
    // createSyncTables is a no-op on the existing table (IF NOT EXISTS); the
    // rest of the sync tables get created. The migration adds the column.
    createSyncTables(db.adapter);
    migrateSyncSchema(db.adapter);

    const cols = db.adapter.query<{ name: string }>('PRAGMA table_info(sync_paired_devices)');
    expect(cols.some((c) => c.name === 'auto_connect')).toBe(true);
    // The pre-existing row backfills to the DEFAULT (enabled).
    expect(isPeerAutoConnectEnabled(db.adapter, 'legacy')).toBe(true);

    // Running the migration again is a safe no-op (no duplicate-column error).
    expect(() => migrateSyncSchema(db.adapter)).not.toThrow();
  });
});
