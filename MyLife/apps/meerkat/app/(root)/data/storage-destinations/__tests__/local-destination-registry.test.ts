import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system/legacy', () => ({ documentDirectory: null }));

import {
  InMemoryStorageDestinationAdapter,
  type StorageDestinationRow,
} from '@mylife/sync';
import {
  createDestinationRegistry,
  type DestinationRegistryEntry,
} from '../destination-registry';
import type { MobileLocalFileInfo, MobileLocalFileSystem } from '../local-device-adapter';

class RegistryFileSystem implements MobileLocalFileSystem {
  readonly documentDirectory = 'file:///documents/';
  private readonly files = new Map<string, Uint8Array>();

  async ensureDirectory(): Promise<void> {}
  async info(uri: string): Promise<MobileLocalFileInfo> {
    const bytes = this.files.get(uri);
    return { exists: bytes !== undefined, size: bytes?.length ?? 0 };
  }
  async readBytes(uri: string): Promise<Uint8Array> {
    const bytes = this.files.get(uri);
    if (!bytes) throw new Error('missing');
    return new Uint8Array(bytes);
  }
  async writeBytes(uri: string, bytes: Uint8Array): Promise<void> {
    this.files.set(uri, new Uint8Array(bytes));
  }
  async delete(uri: string): Promise<boolean> { return this.files.delete(uri); }
  async list(uri: string): Promise<string[]> {
    return [...this.files.keys()].filter((key) => key.startsWith(uri)).map((key) => key.slice(uri.length));
  }
  async freeBytes(): Promise<number> { return 1_000_000; }
}

function entry(kind: DestinationRegistryEntry['kind']): DestinationRegistryEntry {
  return { id: `${kind}-destination`, kind };
}

function row(kind: StorageDestinationRow['kind']): StorageDestinationRow {
  return {
    id: `${kind}-row`,
    kind,
    label: kind,
    account_hint: null,
    credential_ref: null,
    root_ref: null,
    state: 'ready',
    capability_json: '{}',
    created_at: '2026-07-14T12:00:00.000Z',
    updated_at: '2026-07-14T12:00:00.000Z',
  };
}

describe('mobile destination registry platform matrix', () => {
  it('resolves built-in local and router-row destinations to adapter instances', () => {
    const registry = createDestinationRegistry({
      platformOS: 'android',
      localDevice: { fileSystem: new RegistryFileSystem() },
    });
    expect(registry.resolve(entry('local_device'))).not.toBeNull();
    const routerResolver = registry.resolveRouterDestination;
    expect(routerResolver(row('local_device'))).not.toBeNull();
    expect(registry.supports('local_device')).toBe(true);
  });

  it('returns null for kinds unsupported or unwired on mobile', () => {
    const registry = createDestinationRegistry({
      platformOS: 'android',
      localDevice: { fileSystem: new RegistryFileSystem() },
    });
    expect(registry.resolve(entry('icloud_drive'))).toBeNull();
    expect(registry.resolve(entry('web_directory'))).toBeNull();
    expect(registry.resolve(entry('google_drive'))).toBeNull();
    expect(registry.resolve(entry('hosted_storage'))).toBeNull();
  });

  it('uses one data-driven override seam for broker and hosted clients when wired', () => {
    const hosted = new InMemoryStorageDestinationAdapter();
    const google = new InMemoryStorageDestinationAdapter();
    const registry = createDestinationRegistry({
      platformOS: 'android',
      localDevice: { fileSystem: new RegistryFileSystem() },
      adapterFactories: {
        hosted_storage: () => hosted,
        google_drive: () => google,
      },
    });
    expect(registry.resolve(entry('hosted_storage'))).toBe(hosted);
    expect(registry.resolve(entry('google_drive'))).toBe(google);
    expect(registry.supports('hosted_storage')).toBe(true);
    expect(registry.supports('google_drive')).toBe(true);
  });

  it('constructs hosted and connected v1 adapters from configured option factories', () => {
    const options = {
      descriptorUrl: 'https://storage.example.test/api/storage/v1/descriptor',
      expectedOperatorKey: 'a'.repeat(64),
      transport: async () => ({ status: 500, headers: {}, body: new Uint8Array() }),
      authorizationProvider: { getRequestHeaders: async () => ({ Authorization: 'Bearer test' }) },
      credentialRef: 'securestore://meerkat.storage.connected',
    };
    const registry = createDestinationRegistry({
      platformOS: 'android',
      hostedStorage: () => options,
      connectedServer: () => options,
    });
    expect(registry.resolve(entry('hosted_storage'))).not.toBeNull();
    expect(registry.resolve(entry('connected_server'))).not.toBeNull();
    expect(registry.supports('hosted_storage')).toBe(true);
    expect(registry.supports('connected_server')).toBe(true);
  });

  it('keeps router authorization state stable until explicit invalidation', () => {
    let creations = 0;
    const registry = createDestinationRegistry({
      adapterFactories: {
        connected_server: () => {
          creations += 1;
          return new InMemoryStorageDestinationAdapter();
        },
      },
    });
    const destination = entry('connected_server');
    const first = registry.resolve(destination);
    expect(registry.resolve(destination)).toBe(first);
    expect(creations).toBe(1);
    registry.invalidate(destination.id);
    expect(registry.resolve(destination)).not.toBe(first);
    expect(creations).toBe(2);
  });
});
