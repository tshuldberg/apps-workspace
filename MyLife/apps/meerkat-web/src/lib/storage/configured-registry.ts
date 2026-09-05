import type { DatabaseAdapter } from '@mylife/db';
import {
  createHostedAuthBearer,
  parseCredentialDestinationConfig,
  parseBrokerVaultCredentialRef,
  type DeviceIdentity,
} from '@mylife/sync';
import { HOSTED_API_URL, STORAGE_OPERATOR_PUBLIC_KEY } from '../hosted-access';
import { getSetting, setSetting } from '../meerkat-data';
import { createBoxWebSessionSource } from './box-session';
import type { BrowserStorageSecretAccess } from './credential-store';
import {
  createBrowserStorageCredentialBroker,
  STORAGE_BROKER_ALLOW_INSECURE_LOOPBACK,
  webS3Options,
  webWebdavOptions,
} from './credential-store';
import {
  createDestinationRegistry,
  type DestinationRegistry,
  type DestinationRegistryEntry,
} from './destination-registry';
import { createDropboxWebSessionSource } from './dropbox-session';
import {
  createBrowserHttpTransport,
  createGoogleDriveWebSessionSource,
} from './google-drive-session';
import { createOneDriveWebSessionSource } from './onedrive-session';

export interface ConfiguredWebStorageRegistryInput {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  secrets: BrowserStorageSecretAccess;
}

type BrokerKind = 'google_drive' | 'dropbox' | 'onedrive' | 'box';

export function createConfiguredWebStorageRegistry(
  input: ConfiguredWebStorageRegistryInput,
): DestinationRegistry {
  const brokerSource = (destination: DestinationRegistryEntry, kind: BrokerKind) => {
    const vaultId = parseBrokerVaultCredentialRef(destination.credentialRef ?? null);
    if (!vaultId || !HOSTED_API_URL) return null;
    const common = {
      brokerBaseUrl: HOSTED_API_URL,
      vaultId,
      destinationId: destination.id,
      getHostedAuthBearer: () => createHostedAuthBearer(input.identity),
    };
    if (kind === 'google_drive') return createGoogleDriveWebSessionSource(common);
    if (kind === 'dropbox') return createDropboxWebSessionSource(common);
    if (kind === 'onedrive') return createOneDriveWebSessionSource(common);
    return createBoxWebSessionSource(common);
  };
  const transport = createBrowserHttpTransport();
  const credentialBroker = createBrowserStorageCredentialBroker({
    baseUrl: HOSTED_API_URL,
    identity: input.identity,
    allowInsecureLoopback: STORAGE_BROKER_ALLOW_INSECURE_LOOPBACK,
  });
  return createDestinationRegistry({
    localDevice: { db: input.db },
    ...(HOSTED_API_URL ? {
      webdav: (destination: DestinationRegistryEntry) => webWebdavOptions(destination, credentialBroker),
      s3: (destination: DestinationRegistryEntry) => webS3Options(destination, credentialBroker),
      connectedServer: (destination: DestinationRegistryEntry) => {
        const config = parseCredentialDestinationConfig(destination.rootRef ?? null);
        const credentialRef = destination.credentialRef;
        if (config?.kind !== 'connected_server' || !credentialRef) return null;
        return {
          descriptorUrl: config.descriptorUrl,
          expectedOperatorKey: config.operatorPublicKey,
          transport,
          credentialRef,
          allowInsecureLocalNetwork: true,
          authorizationProvider: {
            async getRequestHeaders(operation: 'health' | 'quota' | 'read' | 'write' | 'list' | 'delete' | 'revoke') {
              const secret = await credentialBroker.get(
                credentialRef,
                destination.id,
                operation === 'revoke' ? 'delete' : operation,
              );
              return secret ? { Authorization: `Bearer ${secret}` } : null;
            },
            revoke: () => credentialBroker.revoke(credentialRef),
          },
        };
      },
    } : {}),
    ...(HOSTED_API_URL && STORAGE_OPERATOR_PUBLIC_KEY ? {
      hostedStorage: (destination: DestinationRegistryEntry) => ({
        descriptorUrl: `${HOSTED_API_URL.replace(/\/+$/u, '')}/api/storage/v1/descriptor`,
        expectedOperatorKey: STORAGE_OPERATOR_PUBLIC_KEY,
        transport,
        credentialRef: destination.credentialRef ?? 'hosted://device',
        authorizationProvider: {
          async getRequestHeaders() {
            return { Authorization: `Bearer ${createHostedAuthBearer(input.identity)}` };
          },
        },
      }),
    } : {}),
    ...(HOSTED_API_URL ? {
      googleDrive: (destination: DestinationRegistryEntry) => {
        const source = brokerSource(destination, 'google_drive');
        return source ? { transport, accessTokenProvider: source, credentialRef: source.credentialRef } : null;
      },
      dropbox: (destination: DestinationRegistryEntry) => {
        const source = brokerSource(destination, 'dropbox');
        return source ? { transport, accessTokenProvider: source, credentialRef: source.credentialRef } : null;
      },
      oneDrive: (destination: DestinationRegistryEntry) => {
        const source = brokerSource(destination, 'onedrive');
        return source ? { transport, accessTokenProvider: source, credentialRef: source.credentialRef } : null;
      },
      box: (destination: DestinationRegistryEntry) => {
        const source = brokerSource(destination, 'box');
        const key = `storage_box_folder:${destination.id}`;
        return source ? {
          transport,
          accessTokenProvider: source,
          credentialRef: source.credentialRef,
          folderState: {
            async getFolderId() { return getSetting(input.db, key); },
            async setFolderId(folderId: string) { setSetting(input.db, key, folderId); },
            async clearFolderId() { setSetting(input.db, key, ''); },
          },
        } : null;
      },
    } : {}),
  });
}
