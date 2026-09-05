import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import type { ChangeRecord, PairedDevice } from '../types';
import {
  createSecureJsonMessage,
  parseSecureJsonPayload,
  resolvePayloadEncryptionKey,
} from '../protocol/payload-security';
import { encodeMessage, decodeMessage } from '../protocol/message-codec';
import { bytesToHex, generateSessionKey } from '../encryption/keys';
import {
  createExpiringEntityFromChange,
  pruneExpiredEntities,
  recordExpiringEntitiesForChanges,
} from '../expiry/disappearing-messages';

function pairedDevice(deviceId: string, sharedSecretHex: string): PairedDevice {
  return {
    deviceId,
    displayName: 'Peer',
    dhPublicKey: 'dh',
    sharedSecretRef: `local:shared:${sharedSecretHex}`,
    lastSeenAt: null,
    lastSyncAt: null,
    lastSyncModule: null,
    bytesSent: 0,
    bytesReceived: 0,
    isActive: true,
    pairedAt: '2026-01-01T00:00:00Z',
  };
}

function change(overrides: Partial<ChangeRecord> = {}): ChangeRecord {
  return {
    id: 'change1',
    moduleId: 'friends',
    tableName: 'hub_friend_messages',
    operation: 'INSERT',
    rowId: 'msg1',
    dataJson: '{"content":"hello"}',
    deviceId: 'local',
    timestamp: 1,
    synced: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('payload security', () => {
  it('encrypts and decrypts JSON payloads with a resolved paired-device key', () => {
    const sharedSecretHex = bytesToHex(generateSessionKey());
    const key = resolvePayloadEncryptionKey({
      pairedDevices: [pairedDevice('remote-device', sharedSecretHex)],
      localDeviceId: 'local-device',
      remoteDeviceId: 'remote-device',
      subjectType: 'direct',
      subjectId: 'remote-device',
    });

    expect(key).not.toBeNull();

    const message = createSecureJsonMessage(
      'SYNC_DATA',
      'local-device',
      '',
      { moduleId: 'friends', syncData: [1, 2, 3] },
      { enabled: true, key },
    );
    const decoded = decodeMessage(encodeMessage(message));
    expect(decoded).not.toBeNull();

    const payload = parseSecureJsonPayload<{ moduleId: string; syncData: number[] }>(
      decoded!,
      { enabled: true, key },
    );

    expect(payload).toEqual({ moduleId: 'friends', syncData: [1, 2, 3] });
  });

  it('rejects plaintext payloads when encryption is enabled', () => {
    const plaintext = createSecureJsonMessage(
      'SYNC_DATA',
      'local-device',
      '',
      { moduleId: 'friends', syncData: [1] },
      { enabled: false, key: null },
    );

    expect(parseSecureJsonPayload(plaintext, { enabled: true, key: generateSessionKey() })).toBeNull();
  });

  it('does not accept placeholder shared-secret refs as encryption keys', () => {
    const key = resolvePayloadEncryptionKey({
      pairedDevices: [pairedDevice('remote-device', 'remote-device')],
      localDeviceId: 'local-device',
      remoteDeviceId: 'remote-device',
      subjectType: 'direct',
      subjectId: 'remote-device',
    });

    expect(key).toBeNull();
  });
});

describe('disappearing message expiry', () => {
  it('creates expiring entities only for known message tables', () => {
    expect(createExpiringEntityFromChange(change(), 60)).toMatchObject({
      moduleId: 'friends',
      tableName: 'hub_friend_messages',
      rowId: 'msg1',
      expiresAt: '2026-01-01T00:01:00.000Z',
    });
    expect(createExpiringEntityFromChange(change({ tableName: 'bk_books' }), 60)).toBeNull();
    expect(createExpiringEntityFromChange(change({ operation: 'DELETE' }), 60)).toBeNull();
  });

  it('records expiring entities for outgoing message changes', () => {
    const db = {
      execute: vi.fn(),
      query: vi.fn().mockReturnValue([]),
      transaction: vi.fn((fn: () => void) => fn()),
    } as unknown as DatabaseAdapter;

    const count = recordExpiringEntitiesForChanges(db, [change()], 60);

    expect(count).toBe(1);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO sync_expiring_entities'),
      expect.arrayContaining(['friends', 'hub_friend_messages', 'msg1']),
    );
  });

  it('prunes only allow-listed expired message rows', () => {
    const db = {
      execute: vi.fn(),
      query: vi.fn().mockReturnValue([
        {
          module_id: 'friends',
          table_name: 'hub_friend_messages',
          row_id: 'msg1',
          expires_at: '2026-01-01T00:00:00.000Z',
          delete_after_sync: 1,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ]),
      transaction: vi.fn((fn: () => void) => fn()),
    } as unknown as DatabaseAdapter;

    expect(pruneExpiredEntities(db, { nowIso: '2026-01-01T00:01:00.000Z' })).toEqual({
      deleted: 1,
      skipped: 0,
    });
    expect(db.execute).toHaveBeenCalledWith('DELETE FROM hub_friend_messages WHERE id = ?', ['msg1']);
  });
});
