import { describe, expect, it } from 'vitest';
import {
  runStorageAdapterConformance,
  StorageAdapterError,
  type EncryptedStorageObject,
  type StorageAdapterConformanceControls,
  type StorageAdapterOperation,
  type StorageDestinationAdapter,
  type StorageHealth,
  type StorageWriteResult,
} from '@mylife/sync';
import { sha512Hex } from '@mylife/sync/src/node/hkdf';
import {
  WEB_LOCAL_STORAGE_CAVEAT,
  createWebLocalDeviceDestinationAdapter,
  type BrowserLocalKeyValueStore,
  type BrowserStoragePersistence,
} from '../local-device-adapter';
import { resetDurableLayer } from './helpers';

class MemoryPersistentStore implements BrowserLocalKeyValueStore {
  readonly persistentCapable = true;
  readonly values = new Map<string, Uint8Array>();

  async get(key: string): Promise<Uint8Array | null> {
    const value = this.values.get(key);
    return value ? new Uint8Array(value) : null;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    this.values.set(key, new Uint8Array(bytes));
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async keys(prefix: string): Promise<string[]> {
    return [...this.values.keys()].filter((key) => key.startsWith(prefix)).sort();
  }
}

function controlledFixture() {
  const keyValueStore = new MemoryPersistentStore();
  let persisted = true;
  const persistence: BrowserStoragePersistence = {
    persisted: async () => persisted,
    persist: async () => { persisted = true; return true; },
    estimate: async () => ({ usage: 100, quota: 8_292 }),
  };
  const core = createWebLocalDeviceDestinationAdapter({
    destinationId: 'conformance',
    keyValueStore,
    persistence,
    maximumObjectBytes: 1_024,
    pageSize: 2,
    now: () => '2026-07-14T12:00:00.000Z',
  });
  const failures = new Map<StorageAdapterOperation, StorageAdapterError>();
  let verification: 'read_back' | 'provider_checksum' | 'none' = 'read_back';
  let quota: { usedBytes: number | null; capBytes: number | null } | null = null;
  let health: { state: StorageHealth['state']; errorCode?: string } | null = null;

  function takeFailure(operation: StorageAdapterOperation): void {
    const error = failures.get(operation);
    if (!error) return;
    failures.delete(operation);
    throw error;
  }

  const adapter: StorageDestinationAdapter = {
    authorize: (input) => core.authorize(input),
    revoke: (options) => core.revoke(options),
    capabilities: () => core.capabilities(),
    async health() {
      if (!health) return core.health();
      return {
        state: health.state,
        verifiedReadWrite: health.state === 'ok',
        checkedAt: '2026-07-14T12:00:00.000Z',
        ...(health.errorCode === undefined ? {} : { errorCode: health.errorCode }),
      };
    },
    async quota() {
      if (!quota) return core.quota();
      return { ...quota, estimated: quota.capBytes === null };
    },
    async putObject(input, resume): Promise<StorageWriteResult> {
      takeFailure('putObject');
      const result = await core.putObject(input, resume);
      if (verification !== 'none' || !result.complete) return result;
      return {
        complete: true,
        verified: false,
        verification: { kind: 'none' },
        remoteRef: result.remoteRef,
        remoteVersion: result.remoteVersion,
        encryptedBytes: result.encryptedBytes,
        ciphertextHash: result.ciphertextHash,
      };
    },
    headObject: (ref) => core.headObject(ref),
    getObject: (ref, range) => core.getObject(ref, range),
    listObjects: (cursor) => core.listObjects(cursor),
    deleteObject: (ref) => core.deleteObject(ref),
  };
  const controls: StorageAdapterConformanceControls = {
    failNext(operation, error): void { failures.set(operation, error); },
    setQuota(usedBytes, capBytes): void { quota = { usedBytes, capBytes }; },
    setVerificationMode(mode): void { verification = mode; },
    setPartialPutBytes(): void {},
    setConflictMode(): void {},
    setHealthState(state, errorCode): void {
      health = state === null ? null : { state, ...(errorCode === undefined ? {} : { errorCode }) };
    },
  };
  return { adapter, controls, keyValueStore, core, setPersisted: (value: boolean) => { persisted = value; } };
}

runStorageAdapterConformance(
  'web local device',
  () => controlledFixture(),
  { testApi: { describe, it } },
);

function encryptedObject(objectId: string, bytes: Uint8Array): EncryptedStorageObject {
  return {
    objectId,
    dataClass: 'backup_chunk',
    ciphertext: bytes,
    ciphertextHash: sha512Hex(bytes),
    encryptedBytes: bytes.length,
  };
}

describe('web local destination persistence honesty', () => {
  it('does not claim durable verification when browser storage is evictable', async () => {
    const fixture = controlledFixture();
    fixture.setPersisted(false);
    await fixture.core.authorize({ kind: 'stored_credential', credentialRef: 'browser-local:test' });
    const result = await fixture.core.putObject(
      encryptedObject('evictable', new Uint8Array([5, 8, 13])),
    );
    expect(result).toMatchObject({ complete: true, verified: false, verification: { kind: 'none' } });
    await expect(fixture.core.health()).resolves.toMatchObject({
      state: 'degraded',
      verifiedReadWrite: false,
      errorCode: 'browser_storage_evictable',
    });
    expect(WEB_LOCAL_STORAGE_CAVEAT).toContain('cleared');
  });

  it('reports estimated quota and exact destination usage', async () => {
    const fixture = controlledFixture();
    await fixture.core.authorize({ kind: 'interactive' });
    await fixture.core.putObject(encryptedObject('usage', new Uint8Array([1, 2, 3, 4])));
    const exact = [...fixture.keyValueStore.values.values()]
      .reduce((total, bytes) => total + bytes.length, 0);
    await expect(fixture.core.quota()).resolves.toEqual({
      usedBytes: exact,
      capBytes: exact + 8_192,
      estimated: true,
    });
  });

  it('reopens bytes from the shared IndexedDB blob store after adapter restart', async () => {
    await resetDurableLayer();
    const persistence: BrowserStoragePersistence = {
      persisted: async () => true,
      persist: async () => true,
      estimate: async () => ({ usage: 0, quota: 1_000_000 }),
    };
    const first = createWebLocalDeviceDestinationAdapter({
      destinationId: 'restart-proof',
      persistence,
    });
    await first.authorize({ kind: 'interactive' });
    const input = encryptedObject('persisted', new Uint8Array([21, 34, 55]));
    await first.putObject(input);

    const restarted = createWebLocalDeviceDestinationAdapter({
      destinationId: 'restart-proof',
      persistence,
    });
    await restarted.authorize({
      kind: 'stored_credential',
      credentialRef: 'browser-local:restart-proof',
    });
    await expect(restarted.getObject({ objectId: input.objectId })).resolves.toEqual(input.ciphertext);
  });
});
