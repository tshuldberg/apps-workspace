import {
  GoogleDriveStorageAdapter,
  S3StorageAdapter,
  WebdavStorageAdapter,
  type GoogleDriveAdapterOptions,
  type S3AdapterOptions,
  type StorageDestinationAdapter,
  type StorageDestinationKind,
  type StorageDestinationRow,
  type WebdavAdapterOptions,
  ConnectedServerStorageAdapter,
  type ConnectedServerAdapterOptions,
} from '@mylife/sync';
import {
  DropboxStorageAdapter,
  type DropboxAdapterOptions,
} from '@mylife/sync/src/storage/adapters/dropbox';
import {
  OneDriveStorageAdapter,
  type OneDriveAdapterOptions,
} from '@mylife/sync/src/storage/adapters/onedrive';
import {
  BoxStorageAdapter,
  type BoxAdapterOptions,
} from '@mylife/sync/src/storage/adapters/box';
import {
  createFileProviderDestinationAdapter,
  type FileProviderAdapterOptions,
} from './file-provider-adapter';
import {
  createICloudDestinationAdapter,
  type ICloudAdapterOptions,
} from './icloud-adapter';
import {
  createLocalDeviceDestinationAdapter,
  type MobileLocalDeviceAdapterOptions,
} from './local-device-adapter';

export type MeerkatDestinationKind = StorageDestinationKind | 'web_directory';

export interface DestinationRegistryEntry {
  id: string;
  kind: MeerkatDestinationKind;
  credentialRef?: string | null;
  rootRef?: string | null;
}

export type DestinationAdapterFactory = (
  destination: DestinationRegistryEntry,
) => StorageDestinationAdapter | null;

type DestinationOptionsFactory<T> = (destination: DestinationRegistryEntry) => T | null;

export interface MobileDestinationRegistryOptions {
  platformOS?: string;
  localDevice?: Omit<MobileLocalDeviceAdapterOptions, 'destinationId'>;
  iCloudDrive?: Omit<ICloudAdapterOptions, 'platformOS'>;
  fileProvider?: Omit<FileProviderAdapterOptions, 'platformOS' | 'initialCredentialRef'>;
  googleDrive?: DestinationOptionsFactory<GoogleDriveAdapterOptions>;
  dropbox?: DestinationOptionsFactory<DropboxAdapterOptions>;
  oneDrive?: DestinationOptionsFactory<OneDriveAdapterOptions>;
  box?: DestinationOptionsFactory<BoxAdapterOptions>;
  webdav?: DestinationOptionsFactory<WebdavAdapterOptions>;
  s3?: DestinationOptionsFactory<S3AdapterOptions>;
  hostedStorage?: DestinationOptionsFactory<ConnectedServerAdapterOptions>;
  connectedServer?: DestinationOptionsFactory<ConnectedServerAdapterOptions>;
  adapterFactories?: Partial<Record<MeerkatDestinationKind, DestinationAdapterFactory>>;
}

export interface DestinationRegistry {
  resolve(destination: DestinationRegistryEntry): StorageDestinationAdapter | null;
  resolveRouterDestination(destination: StorageDestinationRow): StorageDestinationAdapter | null;
  invalidate(destinationId: string): void;
  supports(kind: MeerkatDestinationKind): boolean;
  readonly kinds: readonly MeerkatDestinationKind[];
}

export const DESTINATION_KINDS: readonly MeerkatDestinationKind[] = [
  'local_device',
  'icloud_drive',
  'google_drive',
  'dropbox',
  'onedrive',
  'box',
  'file_provider',
  'webdav',
  's3',
  'hosted_storage',
  'connected_server',
  'web_directory',
] as const;

function routerEntry(destination: StorageDestinationRow): DestinationRegistryEntry {
  return {
    id: destination.id,
    kind: destination.kind,
    credentialRef: destination.credential_ref,
    rootRef: destination.root_ref,
  };
}

function runtimePlatformOS(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('react-native') as { Platform?: { OS?: string } };
    return module.Platform?.OS ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function createDestinationRegistry(
  options: MobileDestinationRegistryOptions = {},
): DestinationRegistry {
  const platformOS = options.platformOS ?? runtimePlatformOS();
  const factoryConfigured = new Set<MeerkatDestinationKind>(
    Object.keys(options.adapterFactories ?? {}) as MeerkatDestinationKind[],
  );
  const builtins: Record<MeerkatDestinationKind, DestinationAdapterFactory> = {
    local_device: (destination) => createLocalDeviceDestinationAdapter({
      ...options.localDevice,
      destinationId: destination.id,
    }),
    icloud_drive: () => createICloudDestinationAdapter({
      ...options.iCloudDrive,
      platformOS,
    }),
    file_provider: (destination) => createFileProviderDestinationAdapter({
      ...options.fileProvider,
      platformOS,
      ...(destination.credentialRef == null
        ? {}
        : { initialCredentialRef: destination.credentialRef }),
    }),
    google_drive: (destination) => {
      const configured = options.googleDrive?.(destination) ?? null;
      return configured ? new GoogleDriveStorageAdapter(configured) : null;
    },
    dropbox: (destination) => {
      const configured = options.dropbox?.(destination) ?? null;
      return configured ? new DropboxStorageAdapter(configured) : null;
    },
    onedrive: (destination) => {
      const configured = options.oneDrive?.(destination) ?? null;
      return configured ? new OneDriveStorageAdapter(configured) : null;
    },
    box: (destination) => {
      const configured = options.box?.(destination) ?? null;
      return configured ? new BoxStorageAdapter(configured) : null;
    },
    webdav: (destination) => {
      const configured = options.webdav?.(destination) ?? null;
      return configured ? new WebdavStorageAdapter(configured) : null;
    },
    s3: (destination) => {
      const configured = options.s3?.(destination) ?? null;
      return configured ? new S3StorageAdapter(configured) : null;
    },
    hosted_storage: (destination) => {
      const configured = options.hostedStorage?.(destination) ?? null;
      return configured ? new ConnectedServerStorageAdapter(configured) : null;
    },
    connected_server: (destination) => {
      const configured = options.connectedServer?.(destination) ?? null;
      return configured ? new ConnectedServerStorageAdapter(configured) : null;
    },
    web_directory: () => null,
  };

  const configuredKinds = new Set<MeerkatDestinationKind>(factoryConfigured);
  configuredKinds.add('local_device');
  if (platformOS === 'ios') {
    configuredKinds.add('icloud_drive');
    configuredKinds.add('file_provider');
  } else if (platformOS === 'android') {
    configuredKinds.add('file_provider');
  }
  if (options.googleDrive) configuredKinds.add('google_drive');
  if (options.dropbox) configuredKinds.add('dropbox');
  if (options.oneDrive) configuredKinds.add('onedrive');
  if (options.box) configuredKinds.add('box');
  if (options.webdav) configuredKinds.add('webdav');
  if (options.s3) configuredKinds.add('s3');
  if (options.hostedStorage) configuredKinds.add('hosted_storage');
  if (options.connectedServer) configuredKinds.add('connected_server');
  const cache = new Map<string, {
    kind: MeerkatDestinationKind;
    credentialRef: string | null | undefined;
    rootRef: string | null | undefined;
    adapter: StorageDestinationAdapter;
  }>();

  const resolve = (destination: DestinationRegistryEntry): StorageDestinationAdapter | null => {
    const cached = cache.get(destination.id);
    if (
      cached?.kind === destination.kind
      && cached.credentialRef === destination.credentialRef
      && cached.rootRef === destination.rootRef
    ) return cached.adapter;
    if (cached) cache.delete(destination.id);
    const override = options.adapterFactories?.[destination.kind];
    const adapter = override ? override(destination) : builtins[destination.kind](destination);
    if (adapter) cache.set(destination.id, {
      kind: destination.kind,
      credentialRef: destination.credentialRef,
      rootRef: destination.rootRef,
      adapter,
    });
    return adapter;
  };

  return {
    kinds: DESTINATION_KINDS,
    resolve,
    resolveRouterDestination: (destination) => resolve(routerEntry(destination)),
    invalidate(destinationId): void { cache.delete(destinationId); },
    supports(kind): boolean {
      return configuredKinds.has(kind);
    },
  };
}
