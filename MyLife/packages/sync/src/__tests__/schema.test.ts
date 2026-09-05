import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SYNC_TABLES,
  TORRENT_TABLES,
  ALL_P2P_TABLES,
  createSyncTables,
  CREATE_SYNC_DEVICE_IDENTITY,
  CREATE_SYNC_PAIRED_DEVICES,
  CREATE_SYNC_CHANGE_LOG,
  CREATE_SYNC_CHANGE_LOG_INDEXES,
  CREATE_SYNC_PEER_MODULE_STATE,
  CREATE_SYNC_DEVICE_REVOCATIONS,
  CREATE_SYNC_BLOBS,
  CREATE_SYNC_BLOBS_INDEX,
  CREATE_SYNC_BLOB_POLICY,
  CREATE_SYNC_SESSIONS,
  CREATE_SYNC_SECURITY_PREFERENCES,
  CREATE_SYNC_SECURITY_CONFIRMATIONS,
  CREATE_SYNC_EXPIRING_ENTITIES,
  CREATE_SYNC_EXPIRING_ENTITIES_INDEX,
  CREATE_SYNC_INBOUND_AUDIT,
  CREATE_SYNC_INBOUND_AUDIT_INDEX,
  CREATE_TORRENT_PUBLISHED,
  CREATE_TORRENT_DOWNLOADS,
  CREATE_TORRENT_SEEDING,
  CREATE_TORRENT_PIECES,
  CREATE_TORRENT_PIECES_INDEX,
  CREATE_TORRENT_PEERS,
  CREATE_TORRENT_PAYMENTS,
  CREATE_TORRENT_SEEDING_POLICY,
} from '../db/schema';
import { SYNC_MIGRATION } from '../db/migration';
import {
  getDeviceIdentity,
  upsertDeviceIdentity,
  getPairedDevices,
  getPairedDevice,
  insertPairedDevice,
  updatePairedDeviceLastSeen,
  deactivatePairedDevice,
  insertChangeRecord,
  getUnsyncedChanges,
  getUnsyncedChangesByModule,
  markChangesSynced,
  pruneOldSyncedChanges,
  getPeerModuleState,
  upsertPeerModuleState,
  insertRevocation,
  isDeviceRevoked,
  getRevocations,
  insertBlob,
  getBlob,
  getBlobsByModule,
  incrementBlobRefCount,
  decrementBlobRefCount,
  deleteBlob,
  getBlobPolicy,
  upsertBlobPolicy,
  insertSyncSession,
  getRecentSyncSessions,
  getSeedingPolicy,
  upsertSeedingPolicy,
  getSecurityPreference,
  getSecurityPreferenceWithDefault,
  getSecurityPreferences,
  upsertSecurityPreference,
  recordSecurityConfirmation,
  getSecurityConfirmation,
  upsertExpiringEntity,
  getExpiredEntities,
  deleteExpiringEntity,
} from '../db/queries';
import type { DatabaseAdapter } from '@mylife/db';
import type {
  DeviceIdentity,
  PairedDevice,
  ChangeRecord,
  PeerModuleState,
  DeviceRevocation,
  BlobRef,
  BlobPolicyEntry,
  SyncSession,
  SeedingPolicy,
  SyncSecurityConfirmation,
  SyncSecurityPreference,
  SyncExpiringEntity,
} from '../types';

// ---------------------------------------------------------------------------
// Mock DatabaseAdapter
// ---------------------------------------------------------------------------

function createMockDb(): DatabaseAdapter {
  return {
    execute: vi.fn(),
    query: vi.fn().mockReturnValue([]),
    transaction: vi.fn((fn: () => void) => fn()),
  };
}

// ---------------------------------------------------------------------------
// Schema DDL Arrays
// ---------------------------------------------------------------------------

describe('schema DDL arrays', () => {
  it('SYNC_TABLES has 35 entries', () => {
    expect(SYNC_TABLES).toHaveLength(35);
  });

  it('TORRENT_TABLES has 8 entries', () => {
    expect(TORRENT_TABLES).toHaveLength(8);
  });

  it('ALL_P2P_TABLES has 43 total entries (sync + torrent)', () => {
    expect(ALL_P2P_TABLES).toHaveLength(43);
    expect(ALL_P2P_TABLES).toHaveLength(SYNC_TABLES.length + TORRENT_TABLES.length);
  });

  it('SYNC_TABLES contains all sync DDL constants in order', () => {
    expect(SYNC_TABLES[0]).toBe(CREATE_SYNC_DEVICE_IDENTITY);
    expect(SYNC_TABLES[1]).toBe(CREATE_SYNC_PAIRED_DEVICES);
    expect(SYNC_TABLES[2]).toBe(CREATE_SYNC_CHANGE_LOG);
    expect(SYNC_TABLES[3]).toBe(CREATE_SYNC_CHANGE_LOG_INDEXES);
    expect(SYNC_TABLES[4]).toBe(CREATE_SYNC_PEER_MODULE_STATE);
    expect(SYNC_TABLES[5]).toBe(CREATE_SYNC_DEVICE_REVOCATIONS);
    expect(SYNC_TABLES[6]).toBe(CREATE_SYNC_BLOBS);
    expect(SYNC_TABLES[7]).toBe(CREATE_SYNC_BLOBS_INDEX);
    expect(SYNC_TABLES[8]).toBe(CREATE_SYNC_BLOB_POLICY);
    expect(SYNC_TABLES[9]).toBe(CREATE_SYNC_SESSIONS);
    expect(SYNC_TABLES).toContain(CREATE_SYNC_SECURITY_PREFERENCES);
    expect(SYNC_TABLES).toContain(CREATE_SYNC_SECURITY_CONFIRMATIONS);
    expect(SYNC_TABLES).toContain(CREATE_SYNC_EXPIRING_ENTITIES);
    expect(SYNC_TABLES).toContain(CREATE_SYNC_EXPIRING_ENTITIES_INDEX);
    expect(SYNC_TABLES).toContain(CREATE_SYNC_INBOUND_AUDIT);
    expect(SYNC_TABLES).toContain(CREATE_SYNC_INBOUND_AUDIT_INDEX);
  });

  it('TORRENT_TABLES contains all torrent DDL constants in order', () => {
    expect(TORRENT_TABLES[0]).toBe(CREATE_TORRENT_PUBLISHED);
    expect(TORRENT_TABLES[1]).toBe(CREATE_TORRENT_DOWNLOADS);
    expect(TORRENT_TABLES[2]).toBe(CREATE_TORRENT_SEEDING);
    expect(TORRENT_TABLES[3]).toBe(CREATE_TORRENT_PIECES);
    expect(TORRENT_TABLES[4]).toBe(CREATE_TORRENT_PIECES_INDEX);
    expect(TORRENT_TABLES[5]).toBe(CREATE_TORRENT_PEERS);
    expect(TORRENT_TABLES[6]).toBe(CREATE_TORRENT_PAYMENTS);
    expect(TORRENT_TABLES[7]).toBe(CREATE_TORRENT_SEEDING_POLICY);
  });

  it('all sync DDL strings contain CREATE TABLE or CREATE INDEX', () => {
    for (const ddl of SYNC_TABLES) {
      expect(ddl).toMatch(/CREATE (TABLE|INDEX)/);
    }
  });

  it('all torrent DDL strings contain CREATE TABLE or CREATE INDEX', () => {
    for (const ddl of TORRENT_TABLES) {
      expect(ddl).toMatch(/CREATE (TABLE|INDEX)/);
    }
  });

  it('all DDL uses IF NOT EXISTS for safe re-runs', () => {
    for (const ddl of ALL_P2P_TABLES) {
      expect(ddl).toContain('IF NOT EXISTS');
    }
  });
});

// ---------------------------------------------------------------------------
// createSyncTables
// ---------------------------------------------------------------------------

describe('createSyncTables()', () => {
  it('calls execute for every DDL statement', () => {
    const db = { execute: vi.fn() };
    createSyncTables(db);
    // Should have called execute at least once per DDL entry
    expect(db.execute).toHaveBeenCalled();
    // Total calls should be >= ALL_P2P_TABLES.length because multi-statement
    // DDLs (indexes) get split into individual calls
    expect(db.execute.mock.calls.length).toBeGreaterThanOrEqual(ALL_P2P_TABLES.length);
  });

  it('splits multi-statement DDL (indexes) into separate execute calls', () => {
    const db = { execute: vi.fn() };
    createSyncTables(db);
    // CREATE_SYNC_CHANGE_LOG_INDEXES has 2 statements, CREATE_SYNC_BLOBS_INDEX has 1,
    // CREATE_TORRENT_PIECES_INDEX has 1.
    // Single-table DDLs: 15 entries with 1 statement each = 15
    // Multi-statement: CREATE_SYNC_CHANGE_LOG_INDEXES has 2 = 2
    // Total should be at least 18 + extra from multi-statement splits
    const totalCalls = db.execute.mock.calls.length;
    // 18 DDL entries, but CHANGE_LOG_INDEXES has 2 statements, so at least 19
    expect(totalCalls).toBeGreaterThanOrEqual(19);
  });

  it('does not pass empty strings to execute', () => {
    const db = { execute: vi.fn() };
    createSyncTables(db);
    for (const call of db.execute.mock.calls) {
      const sql = call[0] as string;
      expect(sql.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// SYNC_MIGRATION
// ---------------------------------------------------------------------------

describe('SYNC_MIGRATION', () => {
  it('has version 1', () => {
    expect(SYNC_MIGRATION.version).toBe(1);
  });

  it('has a description string', () => {
    expect(typeof SYNC_MIGRATION.description).toBe('string');
    expect(SYNC_MIGRATION.description.length).toBeGreaterThan(0);
  });

  it('up is an array of strings', () => {
    expect(Array.isArray(SYNC_MIGRATION.up)).toBe(true);
    for (const stmt of SYNC_MIGRATION.up) {
      expect(typeof stmt).toBe('string');
    }
  });

  it('down is an array of strings', () => {
    expect(Array.isArray(SYNC_MIGRATION.down)).toBe(true);
    for (const stmt of SYNC_MIGRATION.down) {
      expect(typeof stmt).toBe('string');
    }
  });

  it('up statements each end with a semicolon', () => {
    for (const stmt of SYNC_MIGRATION.up) {
      expect(stmt.trimEnd()).toMatch(/;$/);
    }
  });

  it('down statements each end with a semicolon', () => {
    for (const stmt of SYNC_MIGRATION.down) {
      expect(stmt.trimEnd()).toMatch(/;$/);
    }
  });

  it('down statements are all DROP TABLE IF EXISTS', () => {
    for (const stmt of SYNC_MIGRATION.down) {
      expect(stmt).toMatch(/^DROP TABLE IF EXISTS/);
    }
  });

  it('down drops all sync and torrent tables', () => {
    const droppedTables = SYNC_MIGRATION.down.map((stmt) => {
      const match = stmt.match(/DROP TABLE IF EXISTS (\w+)/);
      return match?.[1];
    }).filter(Boolean);
    expect(droppedTables).toContain('sync_device_identity');
    expect(droppedTables).toContain('sync_paired_devices');
    expect(droppedTables).toContain('sync_change_log');
    expect(droppedTables).toContain('sync_sessions');
    expect(droppedTables).toContain('torrent_published');
    expect(droppedTables).toContain('torrent_downloads');
    expect(droppedTables).toContain('torrent_seeding_policy');
  });
});

// ---------------------------------------------------------------------------
// Query functions -- Device Identity
// ---------------------------------------------------------------------------

describe('device identity queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('getDeviceIdentity returns null when no rows', () => {
    const result = getDeviceIdentity(db);
    expect(result).toBeNull();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('sync_device_identity'),
      ['self'],
    );
  });

  it('getDeviceIdentity maps row fields to camelCase', () => {
    vi.mocked(db.query).mockReturnValueOnce([{
      public_key: 'pk1',
      private_key_ref: 'secure.sync.device.pk1',
      dh_public_key: 'dhpk1',
      display_name: 'My iPhone',
      created_at: '2026-01-01T00:00:00Z',
    }]);
    const result = getDeviceIdentity(db);
    expect(result).toEqual({
      publicKey: 'pk1',
      privateKeyRef: 'secure.sync.device.pk1',
      dhPublicKey: 'dhpk1',
      displayName: 'My iPhone',
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('upsertDeviceIdentity calls execute with INSERT OR REPLACE', () => {
    const identity: DeviceIdentity = {
      publicKey: 'pk1',
      privateKeyRef: 'secure.sync.device.pk1',
      dhPublicKey: 'dhpk1',
      displayName: 'My iPhone',
      createdAt: '2026-01-01T00:00:00Z',
    };
    upsertDeviceIdentity(db, identity);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO sync_device_identity'),
      expect.arrayContaining(['pk1', 'secure.sync.device.pk1', 'dhpk1', 'My iPhone']),
    );
  });
});

// ---------------------------------------------------------------------------
// Query functions -- Paired Devices
// ---------------------------------------------------------------------------

describe('paired device queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('getPairedDevices queries sync_paired_devices', () => {
    const result = getPairedDevices(db);
    expect(result).toEqual([]);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('sync_paired_devices'),
    );
  });

  it('getPairedDevice queries by device_id', () => {
    getPairedDevice(db, 'dev123');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE device_id = ?'),
      ['dev123'],
    );
  });

  it('insertPairedDevice calls execute with INSERT', () => {
    const device: PairedDevice = {
      deviceId: 'dev123',
      displayName: 'iPad',
      dhPublicKey: 'dhkey',
      sharedSecretRef: 'ref',
      lastSeenAt: null,
      lastSyncAt: null,
      lastSyncModule: null,
      bytesSent: 0,
      bytesReceived: 0,
      isActive: true,
      pairedAt: '2026-01-01T00:00:00Z',
    };
    insertPairedDevice(db, device);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_paired_devices'),
      expect.arrayContaining(['dev123', 'iPad', 'dhkey']),
    );
  });

  it('updatePairedDeviceLastSeen calls execute with UPDATE', () => {
    updatePairedDeviceLastSeen(db, 'dev123', '2026-03-11T12:00:00Z');
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sync_paired_devices SET last_seen_at'),
      ['2026-03-11T12:00:00Z', 'dev123'],
    );
  });

  it('deactivatePairedDevice sets is_active = 0', () => {
    deactivatePairedDevice(db, 'dev123');
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('is_active = 0'),
      ['dev123'],
    );
  });
});

// ---------------------------------------------------------------------------
// Query functions -- Change Log
// ---------------------------------------------------------------------------

describe('change log queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('insertChangeRecord calls execute with INSERT', () => {
    const record: ChangeRecord = {
      id: 'cr1',
      moduleId: 'books',
      tableName: 'bk_books',
      operation: 'INSERT',
      rowId: 'row1',
      dataJson: '{"title":"Test"}',
      deviceId: 'dev1',
      timestamp: 1000,
      synced: false,
      createdAt: '2026-01-01T00:00:00Z',
    };
    insertChangeRecord(db, record);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_change_log'),
      expect.arrayContaining(['cr1', 'books', 'bk_books', 'INSERT', 'row1']),
    );
  });

  it('getUnsyncedChanges queries with synced = 0', () => {
    getUnsyncedChanges(db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE synced = 0'),
      [100],
    );
  });

  it('getUnsyncedChanges accepts a custom limit', () => {
    getUnsyncedChanges(db, 25);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT ?'),
      [25],
    );
  });

  it('getUnsyncedChangesByModule filters by module_id', () => {
    getUnsyncedChangesByModule(db, 'budget');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('module_id = ?'),
      ['budget', 100],
    );
  });

  it('markChangesSynced is a no-op for empty array', () => {
    markChangesSynced(db, []);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('markChangesSynced builds IN clause with placeholders', () => {
    markChangesSynced(db, ['id1', 'id2', 'id3']);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('IN (?, ?, ?)'),
      ['id1', 'id2', 'id3'],
    );
  });

  it('pruneOldSyncedChanges queries count then deletes', () => {
    vi.mocked(db.query).mockReturnValueOnce([{ c: 5 }]);
    const count = pruneOldSyncedChanges(db, 500);
    expect(count).toBe(5);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('COUNT(*)'),
      [500],
    );
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sync_change_log'),
      [500],
    );
  });
});

// ---------------------------------------------------------------------------
// Query functions -- Peer Module State
// ---------------------------------------------------------------------------

describe('peer module state queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('getPeerModuleState returns null when no rows', () => {
    const result = getPeerModuleState(db, 'dev1', 'books');
    expect(result).toBeNull();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('sync_peer_module_state'),
      ['dev1', 'books'],
    );
  });

  it('upsertPeerModuleState calls execute with INSERT OR REPLACE', () => {
    const state: PeerModuleState = {
      deviceId: 'dev1',
      moduleId: 'books',
      lastSyncedVersion: 42,
      lastSyncedAt: '2026-01-01T00:00:00Z',
      automergeHeads: null,
    };
    upsertPeerModuleState(db, state);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO sync_peer_module_state'),
      expect.arrayContaining(['dev1', 'books', 42]),
    );
  });
});

// ---------------------------------------------------------------------------
// Query functions -- Revocations
// ---------------------------------------------------------------------------

describe('revocation queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('insertRevocation calls execute with INSERT', () => {
    const revocation: DeviceRevocation = {
      deviceId: 'dev1',
      revokedByDeviceId: 'dev2',
      reason: 'lost device',
      revokedAt: '2026-01-01T00:00:00Z',
    };
    insertRevocation(db, revocation);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_device_revocations'),
      expect.arrayContaining(['dev1', 'dev2', 'lost device']),
    );
  });

  it('isDeviceRevoked returns false when no rows', () => {
    expect(isDeviceRevoked(db, 'dev1')).toBe(false);
  });

  it('isDeviceRevoked returns true when rows exist', () => {
    vi.mocked(db.query).mockReturnValueOnce([{ device_id: 'dev1' }]);
    expect(isDeviceRevoked(db, 'dev1')).toBe(true);
  });

  it('getRevocations queries sync_device_revocations', () => {
    getRevocations(db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('sync_device_revocations'),
    );
  });
});

// ---------------------------------------------------------------------------
// Query functions -- Blobs
// ---------------------------------------------------------------------------

describe('blob queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('insertBlob calls execute with INSERT OR IGNORE', () => {
    const blob: BlobRef = {
      hash: 'sha256abc',
      size: 1024,
      mimeType: 'image/png',
      moduleId: 'books',
      refCount: 1,
      storedAt: '2026-01-01T00:00:00Z',
    };
    insertBlob(db, blob);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO sync_blobs'),
      expect.arrayContaining(['sha256abc', 1024, 'image/png', 'books']),
    );
  });

  it('getBlob returns null when no rows', () => {
    expect(getBlob(db, 'sha256abc')).toBeNull();
  });

  it('getBlob maps row fields to camelCase', () => {
    vi.mocked(db.query).mockReturnValueOnce([{
      hash: 'sha256abc',
      size: 1024,
      mime_type: 'image/png',
      module_id: 'books',
      ref_count: 3,
      stored_at: '2026-01-01T00:00:00Z',
    }]);
    const result = getBlob(db, 'sha256abc');
    expect(result).toEqual({
      hash: 'sha256abc',
      size: 1024,
      mimeType: 'image/png',
      moduleId: 'books',
      refCount: 3,
      storedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('getBlobsByModule queries with module_id filter', () => {
    getBlobsByModule(db, 'books');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE module_id = ?'),
      ['books'],
    );
  });

  it('incrementBlobRefCount calls execute with ref_count + 1', () => {
    incrementBlobRefCount(db, 'sha256abc');
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('ref_count = ref_count + 1'),
      ['sha256abc'],
    );
  });

  it('decrementBlobRefCount returns remaining ref count', () => {
    vi.mocked(db.query).mockReturnValueOnce([{ ref_count: 2 }]);
    const remaining = decrementBlobRefCount(db, 'sha256abc');
    expect(remaining).toBe(2);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('ref_count = ref_count - 1'),
      ['sha256abc'],
    );
  });

  it('deleteBlob calls execute with DELETE', () => {
    deleteBlob(db, 'sha256abc');
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sync_blobs'),
      ['sha256abc'],
    );
  });
});

// ---------------------------------------------------------------------------
// Query functions -- Blob Policy
// ---------------------------------------------------------------------------

describe('blob policy queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('getBlobPolicy returns null when no rows', () => {
    expect(getBlobPolicy(db, 'books')).toBeNull();
  });

  it('getBlobPolicy maps row fields correctly', () => {
    vi.mocked(db.query).mockReturnValueOnce([{
      module_id: 'books',
      policy: 'wifi_only',
      max_blob_size_bytes: 52428800,
      updated_at: '2026-01-01T00:00:00Z',
    }]);
    const result = getBlobPolicy(db, 'books');
    expect(result).toEqual({
      moduleId: 'books',
      policy: 'wifi_only',
      maxBlobSizeBytes: 52428800,
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('upsertBlobPolicy calls execute with INSERT OR REPLACE', () => {
    const entry: BlobPolicyEntry = {
      moduleId: 'books',
      policy: 'always',
      maxBlobSizeBytes: 10485760,
      updatedAt: '2026-01-01T00:00:00Z',
    };
    upsertBlobPolicy(db, entry);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO sync_blob_policy'),
      expect.arrayContaining(['books', 'always', 10485760]),
    );
  });
});

// ---------------------------------------------------------------------------
// Query functions -- Sync Sessions
// ---------------------------------------------------------------------------

describe('sync session queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('insertSyncSession calls execute with INSERT and JSON-stringifies modulesSynced', () => {
    const session: SyncSession = {
      id: 'sess1',
      peerDeviceId: 'dev1',
      transport: 'lan',
      direction: 'bidirectional',
      modulesSynced: ['books', 'budget'],
      changesSent: 10,
      changesReceived: 5,
      bytesSent: 2048,
      bytesReceived: 1024,
      blobsSent: 1,
      blobsReceived: 0,
      durationMs: 500,
      status: 'completed',
      error: null,
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:00:01Z',
    };
    insertSyncSession(db, session);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_sessions'),
      expect.arrayContaining([
        'sess1', 'dev1', 'lan', 'bidirectional',
        JSON.stringify(['books', 'budget']),
      ]),
    );
  });

  it('getRecentSyncSessions queries with ORDER BY and LIMIT', () => {
    getRecentSyncSessions(db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY completed_at DESC LIMIT ?'),
      [50],
    );
  });

  it('getRecentSyncSessions accepts a custom limit', () => {
    getRecentSyncSessions(db, 10);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT ?'),
      [10],
    );
  });
});

// ---------------------------------------------------------------------------
// Query functions -- Security Preferences
// ---------------------------------------------------------------------------

describe('security preference queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('getSecurityPreference returns null when no rows', () => {
    expect(getSecurityPreference(db, 'direct', 'default')).toBeNull();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('sync_security_preferences'),
      ['direct', 'default'],
    );
  });

  it('getSecurityPreference maps row fields', () => {
    vi.mocked(db.query).mockReturnValueOnce([{
      subject_type: 'workspace',
      subject_id: 'ws1',
      encryption_mode: 'required',
      disappearing_messages_enabled: 1,
      disappear_after_seconds: 86400,
      updated_at: '2026-01-01T00:00:00Z',
    }]);

    expect(getSecurityPreference(db, 'workspace', 'ws1')).toEqual({
      subjectType: 'workspace',
      subjectId: 'ws1',
      encryptionMode: 'required',
      disappearingMessagesEnabled: true,
      disappearAfterSeconds: 86400,
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('getSecurityPreferenceWithDefault falls back to global default', () => {
    vi.mocked(db.query)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{
        subject_type: 'default',
        subject_id: 'default',
        encryption_mode: 'opportunistic',
        disappearing_messages_enabled: 0,
        disappear_after_seconds: null,
        updated_at: '2026-01-01T00:00:00Z',
      }]);

    expect(getSecurityPreferenceWithDefault(db, 'direct', 'dev1')).toEqual(
      expect.objectContaining({ subjectType: 'default', subjectId: 'default' }),
    );
  });

  it('getSecurityPreferences can filter by subject type', () => {
    getSecurityPreferences(db, 'workspace');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE subject_type = ?'),
      ['workspace'],
    );
  });

  it('upsertSecurityPreference calls execute with INSERT OR REPLACE', () => {
    const pref: SyncSecurityPreference = {
      subjectType: 'direct',
      subjectId: 'default',
      encryptionMode: 'required',
      disappearingMessagesEnabled: true,
      disappearAfterSeconds: 604800,
      updatedAt: '2026-01-01T00:00:00Z',
    };

    upsertSecurityPreference(db, pref);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO sync_security_preferences'),
      expect.arrayContaining(['direct', 'default', 'required', 1, 604800]),
    );
  });

  it('records and reads security confirmations', () => {
    const confirmation: SyncSecurityConfirmation = {
      subjectType: 'direct',
      subjectId: 'dev1',
      peerDeviceId: 'dev1',
      localEncryptionMode: 'required',
      remoteEncryptionMode: 'opportunistic',
      encryptionConfirmed: true,
      disappearingMessagesConfirmed: true,
      disappearAfterSeconds: 86400,
      confirmedAt: '2026-01-01T00:00:00Z',
    };

    recordSecurityConfirmation(db, confirmation);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO sync_security_confirmations'),
      expect.arrayContaining(['direct', 'dev1', 'dev1', 'required', 'opportunistic', 1, 1, 86400]),
    );

    vi.mocked(db.query).mockReturnValueOnce([{
      subject_type: 'direct',
      subject_id: 'dev1',
      peer_device_id: 'dev1',
      local_encryption_mode: 'required',
      remote_encryption_mode: 'opportunistic',
      encryption_confirmed: 1,
      disappearing_messages_confirmed: 1,
      disappear_after_seconds: 86400,
      confirmed_at: '2026-01-01T00:00:00Z',
    }]);
    expect(getSecurityConfirmation(db, 'direct', 'dev1', 'dev1')).toEqual(confirmation);
  });
});

// ---------------------------------------------------------------------------
// Query functions -- Expiring Entities
// ---------------------------------------------------------------------------

describe('expiring entity queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('upserts expiring entities', () => {
    const entity: SyncExpiringEntity = {
      moduleId: 'friends',
      tableName: 'hub_friend_messages',
      rowId: 'msg1',
      expiresAt: '2026-01-02T00:00:00Z',
      deleteAfterSync: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    upsertExpiringEntity(db, entity);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO sync_expiring_entities'),
      expect.arrayContaining(['friends', 'hub_friend_messages', 'msg1', '2026-01-02T00:00:00Z', 1]),
    );
  });

  it('gets expired entities', () => {
    vi.mocked(db.query).mockReturnValueOnce([{
      module_id: 'friends',
      table_name: 'hub_friend_messages',
      row_id: 'msg1',
      expires_at: '2026-01-02T00:00:00Z',
      delete_after_sync: 1,
      created_at: '2026-01-01T00:00:00Z',
    }]);

    expect(getExpiredEntities(db, '2026-01-03T00:00:00Z')).toEqual([{
      moduleId: 'friends',
      tableName: 'hub_friend_messages',
      rowId: 'msg1',
      expiresAt: '2026-01-02T00:00:00Z',
      deleteAfterSync: true,
      createdAt: '2026-01-01T00:00:00Z',
    }]);
  });

  it('deletes expiring entity markers', () => {
    deleteExpiringEntity(db, 'friends', 'hub_friend_messages', 'msg1');
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sync_expiring_entities'),
      ['friends', 'hub_friend_messages', 'msg1'],
    );
  });
});

// ---------------------------------------------------------------------------
// Query functions -- Seeding Policy
// ---------------------------------------------------------------------------

describe('seeding policy queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('getSeedingPolicy returns null when no rows', () => {
    expect(getSeedingPolicy(db)).toBeNull();
  });

  it('getSeedingPolicy maps boolean fields correctly', () => {
    vi.mocked(db.query).mockReturnValueOnce([{
      enabled: 1,
      max_upload_kbps: 0,
      max_seed_storage_mb: 5120,
      auto_delete_days: 30,
      seed_on_cellular: 0,
      seed_while_charging: 1,
      updated_at: '2026-01-01T00:00:00Z',
    }]);
    const result = getSeedingPolicy(db);
    expect(result).toEqual({
      enabled: true,
      maxUploadKbps: 0,
      maxSeedStorageMB: 5120,
      autoDeleteDays: 30,
      seedOnCellular: false,
      seedWhileCharging: true,
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('upsertSeedingPolicy calls execute with INSERT OR REPLACE', () => {
    const policy: SeedingPolicy = {
      enabled: true,
      maxUploadKbps: 500,
      maxSeedStorageMB: 1024,
      autoDeleteDays: 7,
      seedOnCellular: false,
      seedWhileCharging: true,
      updatedAt: '2026-01-01T00:00:00Z',
    };
    upsertSeedingPolicy(db, policy);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO torrent_seeding_policy'),
      expect.arrayContaining([1, 500, 1024, 7, 0, 1]),
    );
  });
});
