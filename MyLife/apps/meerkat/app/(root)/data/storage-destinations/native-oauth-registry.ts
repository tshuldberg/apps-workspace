import type {
  AccessTokenOperation,
  AccessTokenProvider,
  BoxAdapterOptions,
  DropboxAdapterOptions,
  GoogleDriveAdapterOptions,
  HttpTransport,
  OneDriveAdapterOptions,
} from '@mylife/sync';
import type { DatabaseAdapter } from '@mylife/db';
import { getSetting, setSetting } from '../db';
import type { DestinationRegistryEntry } from './destination-registry';
import { createMobileHttpTransport } from './credential-store';
import {
  createGoogleDriveNativeTokenSource,
  type GoogleDriveNativeTokenSource,
} from './google-drive-source';
import { createDropboxNativeTokenSource, type DropboxNativeTokenSource } from './dropbox-source';
import { createOneDriveNativeTokenSource, type OneDriveNativeTokenSource } from './onedrive-source';
import { createBoxNativeTokenSource, type BoxNativeTokenSource } from './box-source';

export type MobileOAuthDestinationKind = 'google_drive' | 'dropbox' | 'onedrive' | 'box';
type NativeSource = GoogleDriveNativeTokenSource | DropboxNativeTokenSource
  | OneDriveNativeTokenSource | BoxNativeTokenSource;

export interface MobileOAuthConfiguration {
  googleClientId: string;
  dropboxClientId: string;
  oneDriveClientId: string;
  boxClientId: string;
  redirectBase: string;
}

export interface MobileOAuthConnectResult {
  credentialRef: string;
  accountHint: string | null;
}

function clean(value: string): string {
  return value.trim();
}

export class MobileNativeOAuthRegistry {
  private readonly sources = new Map<string, Promise<NativeSource | null>>();
  private readonly transport = createMobileHttpTransport();

  constructor(
    private readonly config: MobileOAuthConfiguration,
    private readonly db: DatabaseAdapter,
  ) {}

  supports(kind: MobileOAuthDestinationKind): boolean {
    return this.clientId(kind).length > 0 && clean(this.config.redirectBase).length > 0;
  }

  async connect(kind: MobileOAuthDestinationKind, destinationId: string): Promise<MobileOAuthConnectResult> {
    const source = await this.source(kind, destinationId);
    if (source === null) {
      throw new Error('This build is missing its OAuth client registration or native auth session support.');
    }
    const result = await source.connect();
    if (result === null) throw new Error('Provider sign-in was cancelled or did not return offline access.');
    return result;
  }

  googleDriveOptions(destination: DestinationRegistryEntry): GoogleDriveAdapterOptions | null {
    if (!this.supports('google_drive')) return null;
    return this.tokenOptions('google_drive', destination) as GoogleDriveAdapterOptions;
  }

  dropboxOptions(destination: DestinationRegistryEntry): DropboxAdapterOptions | null {
    if (!this.supports('dropbox')) return null;
    return this.tokenOptions('dropbox', destination) as DropboxAdapterOptions;
  }

  oneDriveOptions(destination: DestinationRegistryEntry): OneDriveAdapterOptions | null {
    if (!this.supports('onedrive')) return null;
    return this.tokenOptions('onedrive', destination) as OneDriveAdapterOptions;
  }

  boxOptions(destination: DestinationRegistryEntry): BoxAdapterOptions | null {
    if (!this.supports('box')) return null;
    const key = `storage_box_folder:${destination.id}`;
    return {
      ...this.tokenOptions('box', destination),
      folderState: {
        getFolderId: async () => getSetting(this.db, key),
        setFolderId: async (folderId) => { setSetting(this.db, key, folderId); },
        clearFolderId: async () => { setSetting(this.db, key, ''); },
      },
    } as BoxAdapterOptions;
  }

  private tokenOptions(
    kind: MobileOAuthDestinationKind,
    destination: DestinationRegistryEntry,
  ): {
    transport: HttpTransport;
    accessTokenProvider: AccessTokenProvider;
    credentialRef: string;
  } {
    return {
      transport: this.transport,
      accessTokenProvider: this.provider(kind, destination.id),
      credentialRef: destination.credentialRef ?? `securestore://meerkat/oauth/${kind}/${destination.id}`,
    };
  }

  private provider(kind: MobileOAuthDestinationKind, destinationId: string): AccessTokenProvider {
    return {
      getAccessToken: async (operation: AccessTokenOperation) => (
        (await this.source(kind, destinationId))?.getAccessToken(operation) ?? null
      ),
      invalidateAccessToken: async (token) => {
        await (await this.source(kind, destinationId))?.invalidateAccessToken?.(token);
      },
      revoke: async () => {
        await (await this.source(kind, destinationId))?.revoke();
      },
    };
  }

  private source(kind: MobileOAuthDestinationKind, destinationId: string): Promise<NativeSource | null> {
    const key = `${kind}:${destinationId}`;
    const existing = this.sources.get(key);
    if (existing) return existing;
    const options = {
      clientId: this.clientId(kind),
      redirectUri: `${clean(this.config.redirectBase).replace(/\/+$/u, '')}/${kind}`,
      destinationId,
    };
    const created = kind === 'google_drive'
      ? createGoogleDriveNativeTokenSource(options)
      : kind === 'dropbox'
        ? createDropboxNativeTokenSource(options)
        : kind === 'onedrive'
          ? createOneDriveNativeTokenSource(options)
          : createBoxNativeTokenSource(options);
    this.sources.set(key, created);
    return created;
  }

  private clientId(kind: MobileOAuthDestinationKind): string {
    if (kind === 'google_drive') return clean(this.config.googleClientId);
    if (kind === 'dropbox') return clean(this.config.dropboxClientId);
    if (kind === 'onedrive') return clean(this.config.oneDriveClientId);
    return clean(this.config.boxClientId);
  }
}
