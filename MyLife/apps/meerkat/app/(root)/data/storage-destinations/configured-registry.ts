import Constants from 'expo-constants';
import {
  createHostedAuthBearer,
  parseCredentialDestinationConfig,
  type DeviceIdentity,
} from '@mylife/sync';
import type { DatabaseAdapter } from '@mylife/db';
import {
  createMobileHttpTransport,
  mobileS3Options,
  mobileWebdavOptions,
  readMobileStorageSecret,
} from './credential-store';
import { createDestinationRegistry, type DestinationRegistry } from './destination-registry';
import {
  MobileNativeOAuthRegistry,
  type MobileOAuthConfiguration,
} from './native-oauth-registry';

interface MobileStorageServiceConfiguration {
  hostedApiUrl: string;
  operatorPublicKey: string;
  oauth: MobileOAuthConfiguration;
}

export interface ConfiguredMobileStorageRegistry {
  registry: DestinationRegistry;
  nativeOAuth: MobileNativeOAuthRegistry;
}

function readConfiguration(): MobileStorageServiceConfiguration {
  const extra = Constants.expoConfig?.extra as {
    hostedApiUrl?: unknown;
    storageOperatorPublicKey?: unknown;
    storageOAuth?: Partial<Record<keyof MobileOAuthConfiguration, unknown>>;
  } | undefined;
  const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
  return {
    hostedApiUrl: text(extra?.hostedApiUrl),
    operatorPublicKey: text(extra?.storageOperatorPublicKey),
    oauth: {
      googleClientId: text(extra?.storageOAuth?.googleClientId),
      dropboxClientId: text(extra?.storageOAuth?.dropboxClientId),
      oneDriveClientId: text(extra?.storageOAuth?.oneDriveClientId),
      boxClientId: text(extra?.storageOAuth?.boxClientId),
      redirectBase: text(extra?.storageOAuth?.redirectBase),
    },
  };
}

/** One configured adapter graph shared by foreground UI and background scheduling. */
export function createConfiguredMobileStorageRegistry(input: {
  db: DatabaseAdapter;
  identity: DeviceIdentity | null;
  platformOS?: string;
}): ConfiguredMobileStorageRegistry {
  const config = readConfiguration();
  const nativeOAuth = new MobileNativeOAuthRegistry(config.oauth, input.db);
  const transport = createMobileHttpTransport();
  const identity = input.identity;
  const registry = createDestinationRegistry({
    ...(input.platformOS === undefined ? {} : { platformOS: input.platformOS }),
    localDevice: { db: input.db },
    ...(nativeOAuth.supports('google_drive')
      ? { googleDrive: (destination) => nativeOAuth.googleDriveOptions(destination) } : {}),
    ...(nativeOAuth.supports('dropbox')
      ? { dropbox: (destination) => nativeOAuth.dropboxOptions(destination) } : {}),
    ...(nativeOAuth.supports('onedrive')
      ? { oneDrive: (destination) => nativeOAuth.oneDriveOptions(destination) } : {}),
    ...(nativeOAuth.supports('box')
      ? { box: (destination) => nativeOAuth.boxOptions(destination) } : {}),
    webdav: mobileWebdavOptions,
    s3: mobileS3Options,
    ...(identity !== null && config.hostedApiUrl && config.operatorPublicKey ? {
      hostedStorage: (destination) => ({
        descriptorUrl: `${config.hostedApiUrl.replace(/\/+$/u, '')}/api/storage/v1/descriptor`,
        expectedOperatorKey: config.operatorPublicKey,
        transport,
        credentialRef: destination.credentialRef ?? 'hosted://device',
        authorizationProvider: {
          async getRequestHeaders() {
            return { Authorization: `Bearer ${createHostedAuthBearer(identity)}` };
          },
        },
      }),
    } : {}),
    connectedServer: (destination) => {
      const destinationConfig = parseCredentialDestinationConfig(destination.rootRef ?? null);
      const credentialRef = destination.credentialRef;
      if (destinationConfig?.kind !== 'connected_server' || !credentialRef) return null;
      return {
        descriptorUrl: destinationConfig.descriptorUrl,
        expectedOperatorKey: destinationConfig.operatorPublicKey,
        transport,
        credentialRef,
        allowInsecureLocalNetwork: true,
        authorizationProvider: {
          async getRequestHeaders() {
            const secret = await readMobileStorageSecret(credentialRef);
            return secret ? { Authorization: `Bearer ${secret}` } : null;
          },
          revoke: async () => undefined,
        },
      };
    },
  });
  return { registry, nativeOAuth };
}
