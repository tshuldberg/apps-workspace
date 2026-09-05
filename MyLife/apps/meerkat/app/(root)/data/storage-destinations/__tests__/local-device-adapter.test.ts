import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system/legacy', () => ({ documentDirectory: null }));

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
  createLocalDeviceDestinationAdapter,
  type MobileLocalFileInfo,
  type MobileLocalFileSystem,
} from '../local-device-adapter';

class MemoryMobileFileSystem implements MobileLocalFileSystem {
  readonly documentDirectory = 'file:///documents/';
  readonly files = new Map<string, Uint8Array>();
  readonly directories = new Set<string>();
  availableBytes = 8_192;

  async ensureDirectory(uri: string): Promise<void> {
    this.directories.add(uri);
  }

  async info(uri: string): Promise<MobileLocalFileInfo> {
    const bytes = this.files.get(uri);
    return { exists: bytes !== undefined || this.directories.has(uri), size: bytes?.length ?? 0 };
  }

  async readBytes(uri: string): Promise<Uint8Array> {
    const bytes = this.files.get(uri);
    if (!bytes) throw new Error(`Missing file: ${uri}`);
    return new Uint8Array(bytes);
  }

  async writeBytes(uri: string, bytes: Uint8Array): Promise<void> {
    this.files.set(uri, new Uint8Array(bytes));
  }

  async delete(uri: string): Promise<boolean> {
    if (this.files.delete(uri)) return true;
    const entries = [...this.files.keys()].filter((key) => key.startsWith(uri));
    for (const entry of entries) this.files.delete(entry);
    return this.directories.delete(uri) || entries.length > 0;
  }

  async list(uri: string): Promise<string[]> {
    return [...this.files.keys()]
      .filter((key) => key.startsWith(uri) && !key.slice(uri.length).includes('/'))
      .map((key) => key.slice(uri.length));
  }

  async freeBytes(): Promise<number> {
    return this.availableBytes;
  }
}

function controlledFixture() {
  const fileSystem = new MemoryMobileFileSystem();
  const core = createLocalDeviceDestinationAdapter({
    destinationId: 'conformance',
    fileSystem,
    maximumObjectBytes: 1_024,
    pageSize: 2,
    now: () => '2026-07-14T12:00:00.000Z',
  });
  if (!core) throw new Error('The in-memory local adapter was not created.');
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
  return { adapter, controls, fileSystem, core };
}

runStorageAdapterConformance(
  'mobile local device',
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

describe('mobile local destination accounting', () => {
  it('reports the exact bytes written and device free-space quota', async () => {
    const fixture = controlledFixture();
    await fixture.core.authorize({ kind: 'interactive' });
    await fixture.core.putObject(encryptedObject('accounted', new Uint8Array([2, 4, 6, 8])));

    const storedBytes = [...fixture.fileSystem.files.values()]
      .reduce((total, bytes) => total + bytes.length, 0);
    await expect(fixture.core.quota()).resolves.toEqual({
      usedBytes: storedBytes,
      capBytes: storedBytes + fixture.fileSystem.availableBytes,
      estimated: false,
    });
  });

  it('returns read-back evidence only after bytes can be reopened', async () => {
    const fixture = controlledFixture();
    await fixture.core.authorize({ kind: 'interactive' });
    const input = encryptedObject('durable', new Uint8Array([1, 3, 3, 7]));
    await expect(fixture.core.putObject(input)).resolves.toMatchObject({
      complete: true,
      verified: true,
      verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash },
    });
    await expect(fixture.core.health()).resolves.toMatchObject({
      state: 'ok',
      verifiedReadWrite: true,
    });
  });
});
