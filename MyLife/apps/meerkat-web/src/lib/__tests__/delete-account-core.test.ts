import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { ensureMeerkatTables, ensureSyncSchema } from '../schema';
import { setSetting, getSetting, FRIEND_CODE_KEY } from '../meerkat-data';
import { reportCommunityContent } from '../community-safety';
import {
  listMeerkatDataTables,
  hasPublicPersonaRecord,
  runDeleteMyData,
  wipeMeerkatDeviceData,
  MEERKAT_DATA_TABLE_PREFIXES,
} from '../delete-account-core';

let db: InMemoryTestDatabase;

beforeEach(() => {
  db = createInMemoryTestDatabase();
  ensureMeerkatTables(db.adapter);
  ensureSyncSchema(db.adapter);
});

afterEach(() => {
  db.close();
});

describe('web delete-account-core (B.2 wipe, twin)', () => {
  it('lists only Meerkat-prefixed tables', () => {
    const tables = listMeerkatDataTables(db.adapter);
    expect(tables.length).toBeGreaterThan(0);
    for (const name of tables) {
      expect(MEERKAT_DATA_TABLE_PREFIXES.some((p) => name.startsWith(p))).toBe(true);
    }
  });

  it('wipes every row leaving a clean first-run with schema intact', () => {
    setSetting(db.adapter, FRIEND_CODE_KEY, 'MEER-A1B2-C3D4-E5F6-G7H8');
    reportCommunityContent(db.adapter, {
      communityId: 'cm-a',
      channelId: 'general',
      targetKind: 'message',
      targetId: 'msg-1',
      targetAuthorDeviceId: 'device-b',
      targetLabel: 'x',
    });
    expect(getSetting(db.adapter, FRIEND_CODE_KEY)).not.toBeNull();

    const result = wipeMeerkatDeviceData(db.adapter);
    expect(result.tablesCleared.length).toBeGreaterThan(0);
    expect(getSetting(db.adapter, FRIEND_CODE_KEY)).toBeNull();
    expect(db.adapter.query('SELECT * FROM cm_safety_actions').length).toBe(0);
    expect(db.adapter.query('SELECT * FROM mk_settings').length).toBe(0);
    expect(listMeerkatDataTables(db.adapter)).toContain('cm_safety_actions');
  });

  it('does not treat a malformed persona row as permission to skip the remote delete', () => {
    setSetting(db.adapter, 'public_persona', '{malformed');
    expect(hasPublicPersonaRecord(db.adapter)).toBe(true);
  });

  it('does not destroy local authorization when remote public-account deletion fails', async () => {
    setSetting(db.adapter, FRIEND_CODE_KEY, 'KEEP-ME');
    setSetting(db.adapter, 'public_persona', JSON.stringify({
      personaPubkey: 'aa'.repeat(32), privateKeyRef: 'persona-secret', alias: 'keeper',
    }));
    const calls: string[] = [];
    const result = await runDeleteMyData({
      db: db.adapter,
      identityPrivateKeyRef: 'identity-secret',
      hasPublicPersona: true,
      deleteRemotePersona: async () => { calls.push('remote'); return { ok: false, reason: 'unreachable' }; },
      deleteStorageData: async () => { calls.push('storage'); return { complete: true, failures: [] }; },
      clearNodeBytes: async () => { calls.push('node'); },
      clearBlobBytes: async () => { calls.push('blobs'); },
      deleteSecret: (ref) => { calls.push(`secret:${ref}`); },
      createFreshIdentity: () => { calls.push('fresh'); },
    });
    expect(result).toEqual({ ok: false, reason: 'public_account_delete_failed:unreachable' });
    expect(calls).toEqual(['remote']);
    expect(getSetting(db.adapter, FRIEND_CODE_KEY)).toBe('KEEP-ME');
  });

  it('runs the complete remote-first wipe including raw blob bytes', async () => {
    setSetting(db.adapter, FRIEND_CODE_KEY, 'DELETE-ME');
    const calls: string[] = [];
    const result = await runDeleteMyData({
      db: db.adapter,
      identityPrivateKeyRef: 'identity-secret',
      hasPublicPersona: true,
      deleteRemotePersona: async () => { calls.push('remote'); return { ok: true }; },
      deleteStorageData: async () => { calls.push('storage'); return { complete: true, failures: [] }; },
      clearNodeBytes: async () => { calls.push('node'); },
      clearBlobBytes: async () => { calls.push('blobs'); },
      deleteSecret: (ref) => { calls.push(`secret:${ref}`); },
      createFreshIdentity: () => { calls.push('fresh'); },
    });
    expect(result).toEqual({ ok: true });
    expect(calls.slice(0, 4)).toEqual(['remote', 'storage', 'node', 'blobs']);
    expect(calls.at(-1)).toBe('fresh');
    expect(getSetting(db.adapter, FRIEND_CODE_KEY)).toBeNull();
  });

  it('fails closed when a storage destination cannot be revoked', async () => {
    setSetting(db.adapter, FRIEND_CODE_KEY, 'STORAGE-RETRY');
    const result = await runDeleteMyData({
      db: db.adapter,
      identityPrivateKeyRef: 'identity-secret',
      hasPublicPersona: false,
      deleteRemotePersona: async () => ({ ok: true }),
      deleteStorageData: async () => ({
        complete: false,
        failures: [{ destinationId: 's3-1', step: 'adapter_revoke' }],
      }),
      clearNodeBytes: async () => { throw new Error('must not run'); },
      clearBlobBytes: async () => { throw new Error('must not run'); },
      deleteSecret: () => { throw new Error('must not run'); },
      createFreshIdentity: () => { throw new Error('must not run'); },
    });
    expect(result).toEqual({
      ok: false,
      reason: 'storage_account_delete_failed:s3-1:adapter_revoke',
    });
    expect(getSetting(db.adapter, FRIEND_CODE_KEY)).toBe('STORAGE-RETRY');
  });
});
