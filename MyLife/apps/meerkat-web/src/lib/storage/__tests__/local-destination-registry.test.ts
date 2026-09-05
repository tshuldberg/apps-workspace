import { describe, expect, it } from 'vitest';
import { InMemoryStorageDestinationAdapter } from '@mylife/sync';
import {
  createDestinationRegistry,
  type DestinationRegistryEntry,
} from '../destination-registry';
import {
  MemoryLocalKeyValueStore,
} from '../local-device-adapter';
import type {
  WebDirectoryHandle,
  WebDirectoryHandleStore,
} from '../web-directory-adapter';

function entry(kind: DestinationRegistryEntry['kind']): DestinationRegistryEntry {
  return { id: `${kind}-destination`, kind };
}

class MemoryHandleStore implements WebDirectoryHandleStore {
  private handle: WebDirectoryHandle | null = null;
  async get(): Promise<WebDirectoryHandle | null> { return this.handle; }
  async put(_key: string, handle: WebDirectoryHandle): Promise<void> { this.handle = handle; }
  async delete(): Promise<void> { this.handle = null; }
}

describe('web destination registry platform matrix', () => {
  it('resolves browser local storage and an injected directory picker', () => {
    const directory = { kind: 'directory', name: 'Backups' } as WebDirectoryHandle;
    const registry = createDestinationRegistry({
      localDevice: { keyValueStore: new MemoryLocalKeyValueStore(), persistence: null },
      webDirectory: {
        picker: async () => directory,
        handleStore: new MemoryHandleStore(),
      },
    });
    expect(registry.resolve(entry('local_device'))).not.toBeNull();
    expect(registry.resolve(entry('web_directory'))).not.toBeNull();
    expect(registry.supports('local_device')).toBe(true);
    expect(registry.supports('web_directory')).toBe(true);
  });

  it('returns null for native-only and unwired remote kinds', () => {
    const registry = createDestinationRegistry({
      localDevice: { keyValueStore: new MemoryLocalKeyValueStore(), persistence: null },
    });
    expect(registry.resolve(entry('icloud_drive'))).toBeNull();
    expect(registry.resolve(entry('file_provider'))).toBeNull();
    expect(registry.resolve(entry('google_drive'))).toBeNull();
    expect(registry.resolve(entry('connected_server'))).toBeNull();
  });

  it('returns configured broker and hosted adapter instances through overrides', () => {
    const connected = new InMemoryStorageDestinationAdapter();
    const dropbox = new InMemoryStorageDestinationAdapter();
    const registry = createDestinationRegistry({
      localDevice: { keyValueStore: new MemoryLocalKeyValueStore(), persistence: null },
      adapterFactories: {
        connected_server: () => connected,
        dropbox: () => dropbox,
      },
    });
    expect(registry.resolve(entry('connected_server'))).toBe(connected);
    expect(registry.resolve(entry('dropbox'))).toBe(dropbox);
    expect(registry.supports('connected_server')).toBe(true);
    expect(registry.supports('dropbox')).toBe(true);
  });

  it('constructs hosted and connected v1 adapters from configured option factories', () => {
    const options = {
      descriptorUrl: 'https://storage.example.test/api/storage/v1/descriptor',
      expectedOperatorKey: 'a'.repeat(64),
      transport: async () => ({ status: 500, headers: {}, body: new Uint8Array() }),
      authorizationProvider: { getRequestHeaders: async () => ({ Authorization: 'Bearer test' }) },
      credentialRef: 'broker://storage/vault-1',
    };
    const registry = createDestinationRegistry({
      hostedStorage: () => options,
      connectedServer: () => options,
    });
    expect(registry.resolve(entry('hosted_storage'))).not.toBeNull();
    expect(registry.resolve(entry('connected_server'))).not.toBeNull();
    expect(registry.supports('hosted_storage')).toBe(true);
    expect(registry.supports('connected_server')).toBe(true);
  });

  it('caches a destination adapter so router authorization survives later calls', () => {
    let creations = 0;
    const registry = createDestinationRegistry({
      adapterFactories: {
        hosted_storage: () => {
          creations += 1;
          return new InMemoryStorageDestinationAdapter();
        },
      },
    });
    const destination = entry('hosted_storage');
    expect(registry.resolve(destination)).toBe(registry.resolve(destination));
    expect(creations).toBe(1);
  });
});
