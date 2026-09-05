import { describe, expect, it, vi } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  ensureStorageTables,
  generateDeviceIdentity,
  getStorageDestination,
  insertStorageDestination,
  serializeCredentialDestinationConfig,
  serializeWebdavCredentials,
} from '@mylife/sync';
import {
  migrateBrowserStorageCredentials,
  createBrowserStorageCredentialBroker,
  webWebdavOptions,
  type BrowserStorageCredentialBroker,
  type BrowserStorageSecretAccess,
} from '../credential-store';

describe('browser storage credential custody migration', () => {
  it('rejects plaintext, credential-bearing, redirected-origin, query, and fragment broker URLs', () => {
    const identity = generateDeviceIdentity('credential broker');
    const create = (baseUrl: string, expectedOrigin = 'https://hosted.example') => () => (
      createBrowserStorageCredentialBroker({ baseUrl, expectedOrigin, identity, fetchImpl: vi.fn() as never })
    );
    expect(create('http://hosted.example')).toThrow('trusted HTTPS');
    expect(create('https://user:secret@hosted.example')).toThrow('trusted HTTPS');
    expect(create('https://hosted.example?redirect=evil')).toThrow('trusted HTTPS');
    expect(create('https://hosted.example/#fragment')).toThrow('trusted HTTPS');
    expect(create('https://evil.example')).toThrow('pinned hosted origin');
    expect(create('https://hosted.example')).not.toThrow();
  });

  it('permits plaintext loopback only when the explicit development switch is set', () => {
    const identity = generateDeviceIdentity('loopback broker');
    expect(() => createBrowserStorageCredentialBroker({
      baseUrl: 'http://127.0.0.1:3000', identity, fetchImpl: vi.fn() as never,
    })).toThrow('trusted HTTPS');
    expect(() => createBrowserStorageCredentialBroker({
      baseUrl: 'http://127.0.0.1:3000', identity, allowInsecureLoopback: true,
      fetchImpl: vi.fn() as never,
    })).not.toThrow();
  });
  it('replaces a legacy local secret with a broker reference before deleting local custody', async () => {
    const db = createInMemoryTestDatabase().adapter;
    ensureStorageTables(db);
    const legacyRef = 'securestore://meerkat.storage.dav-old';
    const secret = serializeWebdavCredentials({ username: 'alice', password: 'canary-password' });
    const local = new Map([[legacyRef, secret]]);
    const access: BrowserStorageSecretAccess = {
      get: (ref) => local.get(ref) ?? null,
      set: (ref, value) => { local.set(ref, value); },
      delete: (ref) => { local.delete(ref); },
      flush: async () => undefined,
    };
    let brokerSecret: string | null = null;
    const broker: BrowserStorageCredentialBroker = {
      async put(kind, value) {
        expect(kind).toBe('webdav');
        brokerSecret = value;
        return 'broker://storage/vault-1';
      },
      async get() { return brokerSecret; },
      async revoke() { brokerSecret = null; },
    };
    insertStorageDestination(db, {
      id: 'dav-1',
      kind: 'webdav',
      label: 'DAV',
      account_hint: null,
      credential_ref: legacyRef,
      root_ref: null,
      state: 'ready',
      capability_json: '{}',
      created_at: '2026-07-15T00:00:00.000Z',
      updated_at: '2026-07-15T00:00:00.000Z',
    });

    await expect(migrateBrowserStorageCredentials(db, access, broker)).resolves.toBe(1);

    expect(local.has(legacyRef)).toBe(false);
    expect(brokerSecret).toBe(secret);
    expect(getStorageDestination(db, 'dav-1')?.credential_ref).toBe('broker://storage/vault-1');
  });

  it('restores the legacy reference and revokes the new vault if DB persistence fails', async () => {
    const base = createInMemoryTestDatabase().adapter;
    ensureStorageTables(base);
    let flushCalls = 0;
    const db = Object.assign(base, {
      async flush(): Promise<void> {
        flushCalls += 1;
        if (flushCalls === 1) throw new Error('persistence failed');
      },
    });
    const legacyRef = 'securestore://meerkat.storage.dav-rollback';
    const local = new Map([[legacyRef, 'legacy-secret']]);
    const access: BrowserStorageSecretAccess = {
      get: (ref) => local.get(ref) ?? null,
      set: (ref, value) => { local.set(ref, value); },
      delete: (ref) => { local.delete(ref); },
      flush: async () => undefined,
    };
    let revoked = false;
    const broker: BrowserStorageCredentialBroker = {
      async put() { return 'broker://storage/vault-rollback'; },
      async get() { return null; },
      async revoke() { revoked = true; },
    };
    insertStorageDestination(db, {
      id: 'dav-rollback',
      kind: 'webdav',
      label: 'DAV rollback',
      account_hint: null,
      credential_ref: legacyRef,
      root_ref: null,
      state: 'ready',
      capability_json: '{}',
      created_at: '2026-07-15T00:00:00.000Z',
      updated_at: '2026-07-15T00:00:00.000Z',
    });

    await expect(migrateBrowserStorageCredentials(db, access, broker)).rejects.toThrow('persistence failed');

    expect(getStorageDestination(db, 'dav-rollback')?.credential_ref).toBe(legacyRef);
    expect(local.get(legacyRef)).toBe('legacy-secret');
    expect(revoked).toBe(true);
  });

  it('requests broker credentials for the exact adapter operation', async () => {
    const operations: string[] = [];
    const broker: BrowserStorageCredentialBroker = {
      async put() { return 'broker://storage/vault-op'; },
      async get(_ref, _destinationId, operation) {
        operations.push(operation);
        return serializeWebdavCredentials({ username: 'alice', password: 'secret' });
      },
      async revoke() { return undefined; },
    };
    const options = webWebdavOptions({
      id: 'dav-op',
      kind: 'webdav',
      credentialRef: 'broker://storage/vault-op',
      rootRef: serializeCredentialDestinationConfig({
        kind: 'webdav',
        baseUrl: 'https://dav.example.test/',
      }),
    }, broker);

    await expect(options?.credentialProvider.get('delete')).resolves.toEqual({
      username: 'alice',
      password: 'secret',
    });
    expect(operations).toEqual(['delete']);
  });
});
