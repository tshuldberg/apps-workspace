import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  parseCredentialDestinationConfig,
  parseS3Credentials,
  parseWebdavCredentials,
  type HttpTransport,
  type S3AdapterOptions,
  type WebdavAdapterOptions,
} from '@mylife/sync';
import type { DestinationRegistryEntry } from './destination-registry';

const REFERENCE_PREFIX = 'securestore://meerkat.storage.';
const KEY_PREFIX = 'meerkat.storage.';
const OAUTH_REFERENCE_PREFIX = 'securestore://meerkat/oauth/';
const OAUTH_KEY_PREFIX = 'meerkat.oauth.';
const KEY_PATTERN = /^[A-Za-z0-9._-]{1,240}$/u;
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'com.mylife.meerkat.storage',
};

export function createMobileStorageCredentialRef(destinationId: string): string {
  const safeId = destinationId.replace(/[^A-Za-z0-9._-]/gu, '_').slice(0, 100);
  if (safeId.length === 0) throw new Error('destination id is invalid');
  return `${REFERENCE_PREFIX}${safeId}.${Crypto.randomUUID()}`;
}

export async function writeMobileStorageSecret(ref: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(storageKey(ref), value, secureStoreOptions);
  const written = await SecureStore.getItemAsync(storageKey(ref), secureStoreOptions);
  if (written !== value) throw new Error('SecureStore did not persist the storage credential.');
}

export async function readMobileStorageSecret(ref: string): Promise<string | null> {
  return SecureStore.getItemAsync(storageKey(ref), secureStoreOptions);
}

export async function deleteMobileStorageSecret(ref: string): Promise<void> {
  const target = secureStoreTarget(ref);
  await SecureStore.deleteItemAsync(target.key, target.options);
  if (await SecureStore.getItemAsync(target.key, target.options) !== null) {
    throw new Error('SecureStore did not delete the storage credential.');
  }
}

export function createMobileHttpTransport(fetchImpl: typeof fetch = fetch): HttpTransport {
  return async (request) => {
    const body = request.body === undefined ? undefined : request.body.slice().buffer as ArrayBuffer;
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      ...(body === undefined ? {} : { body }),
      redirect: 'manual',
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => { headers[name] = value; });
    return {
      status: response.status,
      headers,
      body: new Uint8Array(await response.arrayBuffer()),
    };
  };
}

export function mobileWebdavOptions(
  destination: DestinationRegistryEntry,
): WebdavAdapterOptions | null {
  const config = parseCredentialDestinationConfig(destination.rootRef ?? null);
  const credentialRef = destination.credentialRef;
  if (config?.kind !== 'webdav' || !credentialRef) return null;
  return {
    baseUrl: config.baseUrl,
    transport: createMobileHttpTransport(),
    allowInsecureLocalNetwork: true,
    credentialProvider: {
      async get() {
        return parseWebdavCredentials(await readMobileStorageSecret(credentialRef));
      },
    },
  };
}

export function mobileS3Options(
  destination: DestinationRegistryEntry,
): S3AdapterOptions | null {
  const config = parseCredentialDestinationConfig(destination.rootRef ?? null);
  const credentialRef = destination.credentialRef;
  if (config?.kind !== 's3' || !credentialRef) return null;
  return {
    endpoint: config.endpoint,
    bucket: config.bucket,
    region: config.region,
    ...(config.prefix === undefined ? {} : { prefix: config.prefix }),
    transport: createMobileHttpTransport(),
    allowInsecureLocalNetwork: true,
    credentialProvider: {
      async get() {
        return parseS3Credentials(await readMobileStorageSecret(credentialRef));
      },
    },
  };
}

function storageKey(ref: string): string {
  if (!ref.startsWith(REFERENCE_PREFIX)) throw new Error('storage credential reference is invalid');
  const suffix = ref.slice(REFERENCE_PREFIX.length);
  const key = `${KEY_PREFIX}${suffix}`;
  if (!KEY_PATTERN.test(key)) throw new Error('storage credential reference is invalid');
  return key;
}

function secureStoreTarget(ref: string): {
  key: string;
  options: SecureStore.SecureStoreOptions;
} {
  if (!ref.startsWith(OAUTH_REFERENCE_PREFIX)) {
    return { key: storageKey(ref), options: secureStoreOptions };
  }
  const parts = ref.slice(OAUTH_REFERENCE_PREFIX.length).split('/');
  if (parts.length !== 2 || !['google', 'dropbox', 'onedrive', 'box'].includes(parts[0] ?? '')
    || !/^[A-Za-z0-9._:-]{1,120}$/u.test(parts[1] ?? '')) {
    throw new Error('OAuth credential reference is invalid');
  }
  return {
    key: `${OAUTH_KEY_PREFIX}${parts[0]}.${parts[1]}`,
    options: {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      keychainService: 'com.mylife.meerkat.oauth',
    },
  };
}
