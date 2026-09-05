import {
  createHostedAuthBearer,
  parseCredentialDestinationConfig,
  parseS3Credentials,
  parseWebdavCredentials,
  type S3AdapterOptions,
  type WebdavAdapterOptions,
  type DeviceIdentity,
  type StorageCredentialOperation,
  ensureStorageTables,
  listStorageDestinations,
  updateStorageDestinationCredential,
} from '@mylife/sync';
import type { DatabaseAdapter } from '@mylife/db';
import type { DestinationRegistryEntry } from './destination-registry';
import { createBrowserHttpTransport } from './google-drive-session';

const REFERENCE_PREFIX = 'securestore://meerkat.storage.';
const BROKER_REFERENCE_PREFIX = 'broker://storage/';
export const STORAGE_BROKER_ALLOW_INSECURE_LOOPBACK = import.meta.env.DEV;

export interface BrowserStorageCredentialBroker {
  put(kind: 'webdav' | 's3' | 'connected_server', secret: string): Promise<string>;
  get(ref: string, destinationId: string, operation: StorageCredentialOperation): Promise<string | null>;
  revoke(ref: string): Promise<void>;
}

export function parseStorageCredentialBrokerRef(ref: string | null): string | null {
  if (!ref?.startsWith(BROKER_REFERENCE_PREFIX)) return null;
  const vaultId = ref.slice(BROKER_REFERENCE_PREFIX.length);
  return /^[A-Za-z0-9._:-]{1,200}$/u.test(vaultId) ? vaultId : null;
}

export function createBrowserStorageCredentialBroker(options: {
  baseUrl: string;
  identity: DeviceIdentity;
  fetchImpl?: typeof fetch;
  /** Optional immutable hosted origin pinned by deployment metadata. */
  expectedOrigin?: string;
  /** Development-only HTTP allowance. Never permits a non-loopback host. */
  allowInsecureLoopback?: boolean;
}): BrowserStorageCredentialBroker {
  const configured = options.baseUrl.trim();
  let base = '';
  if (configured) {
    let parsed: URL;
    try {
      parsed = new URL(configured);
    } catch {
      throw new TypeError('The storage credential broker URL is invalid.');
    }
    const loopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
    if (parsed.username || parsed.password || parsed.search || parsed.hash
      || (parsed.protocol !== 'https:' && !(options.allowInsecureLoopback === true && loopback))) {
      throw new TypeError('The storage credential broker URL is not a trusted HTTPS endpoint.');
    }
    if (options.expectedOrigin) {
      let expected: URL;
      try {
        expected = new URL(options.expectedOrigin);
      } catch {
        throw new TypeError('The pinned storage credential broker origin is invalid.');
      }
      if (parsed.origin !== expected.origin) {
        throw new TypeError('The storage credential broker origin does not match the pinned hosted origin.');
      }
    }
    base = parsed.toString().replace(/\/+$/u, '');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const request = async (path: string, body: Record<string, string>): Promise<Record<string, unknown>> => {
    if (!base) throw new Error('The storage credential broker is not configured in this build.');
    const response = await fetchImpl(`${base}/api/oauth/v1/storage-credential/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${createHostedAuthBearer(options.identity)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'omit',
    });
    if (!response.ok) throw new Error(`Storage credential broker request failed with ${response.status}.`);
    return await response.json() as Record<string, unknown>;
  };
  return {
    async put(kind, secret) {
      const result = await request('put', { kind, secret });
      if (typeof result.vaultId !== 'string' || parseStorageCredentialBrokerRef(
        `${BROKER_REFERENCE_PREFIX}${result.vaultId}`,
      ) === null) throw new Error('Storage credential broker returned an invalid vault reference.');
      return `${BROKER_REFERENCE_PREFIX}${result.vaultId}`;
    },
    async get(ref, destinationId, operation) {
      const vaultId = parseStorageCredentialBrokerRef(ref);
      if (vaultId === null) return null;
      const result = await request('session', { vaultId, destinationId, operation });
      return typeof result.credential === 'string' ? result.credential : null;
    },
    async revoke(ref) {
      const vaultId = parseStorageCredentialBrokerRef(ref);
      if (vaultId === null) return;
      await request('revoke', { vaultId });
    },
  };
}

/** One-way migration from the legacy same-origin vault to KMS-backed custody. */
export async function migrateBrowserStorageCredentials(
  db: DatabaseAdapter,
  access: BrowserStorageSecretAccess,
  broker: BrowserStorageCredentialBroker,
): Promise<number> {
  ensureStorageTables(db);
  let migrated = 0;
  const localRefsToDelete = new Set<string>();
  for (const destination of listStorageDestinations(db)) {
    if ((destination.kind !== 'webdav' && destination.kind !== 's3')
      || !destination.credential_ref?.startsWith(REFERENCE_PREFIX)) continue;
    const secret = access.get(destination.credential_ref);
    if (secret === null) continue;
    const priorRef = destination.credential_ref;
    const brokerRef = await broker.put(destination.kind, secret);
    try {
      updateStorageDestinationCredential(
        db,
        destination.id,
        brokerRef,
        destination.account_hint,
        destination.state,
        new Date().toISOString(),
      );
      const flushable = db as DatabaseAdapter & { flush?: () => Promise<void> };
      await flushable.flush?.();
    } catch (error) {
      updateStorageDestinationCredential(
        db,
        destination.id,
        priorRef,
        destination.account_hint,
        destination.state,
        destination.updated_at,
      );
      const flushable = db as DatabaseAdapter & { flush?: () => Promise<void> };
      await flushable.flush?.().catch(() => undefined);
      await broker.revoke(brokerRef).catch(() => undefined);
      throw error;
    }
    localRefsToDelete.add(priorRef);
    migrated += 1;
  }
  if (localRefsToDelete.size > 0) {
    for (const ref of localRefsToDelete) access.delete(ref);
    await access.flush();
    if ([...localRefsToDelete].some((ref) => access.get(ref) !== null)) {
      throw new Error('Browser vault did not delete a migrated storage credential.');
    }
  }
  return migrated;
}

export interface BrowserStorageSecretAccess {
  get(ref: string): string | null;
  set(ref: string, value: string): void;
  delete(ref: string): void;
  flush(): Promise<void>;
}

export function createBrowserStorageCredentialRef(destinationId: string): string {
  const safeId = destinationId.replace(/[^A-Za-z0-9._-]/gu, '_').slice(0, 100);
  if (safeId.length === 0) throw new Error('destination id is invalid');
  return `${REFERENCE_PREFIX}${safeId}.${globalThis.crypto.randomUUID()}`;
}

export async function writeBrowserStorageSecret(
  access: BrowserStorageSecretAccess,
  ref: string,
  value: string,
): Promise<void> {
  requireReference(ref);
  access.set(ref, value);
  await access.flush();
  if (access.get(ref) !== value) throw new Error('Browser vault did not persist the storage credential.');
}

export async function deleteBrowserStorageSecret(
  access: BrowserStorageSecretAccess,
  ref: string,
): Promise<void> {
  requireReference(ref);
  access.delete(ref);
  await access.flush();
  if (access.get(ref) !== null) throw new Error('Browser vault did not delete the storage credential.');
}

export async function deleteBrowserStorageCredentialRef(
  access: BrowserStorageSecretAccess,
  broker: BrowserStorageCredentialBroker,
  ref: string,
): Promise<void> {
  if (parseStorageCredentialBrokerRef(ref) !== null) {
    await broker.revoke(ref);
    return;
  }
  await deleteBrowserStorageSecret(access, ref);
}

export function webWebdavOptions(
  destination: DestinationRegistryEntry,
  broker: BrowserStorageCredentialBroker,
): WebdavAdapterOptions | null {
  const config = parseCredentialDestinationConfig(destination.rootRef ?? null);
  const credentialRef = destination.credentialRef;
  if (config?.kind !== 'webdav' || !credentialRef) return null;
  return {
    baseUrl: config.baseUrl,
    transport: createBrowserHttpTransport(),
    allowInsecureLocalNetwork: true,
    credentialProvider: {
      async get(operation = 'health') {
        return parseWebdavCredentials(await broker.get(credentialRef, destination.id, operation));
      },
    },
  };
}

export function webS3Options(
  destination: DestinationRegistryEntry,
  broker: BrowserStorageCredentialBroker,
): S3AdapterOptions | null {
  const config = parseCredentialDestinationConfig(destination.rootRef ?? null);
  const credentialRef = destination.credentialRef;
  if (config?.kind !== 's3' || !credentialRef) return null;
  return {
    endpoint: config.endpoint,
    bucket: config.bucket,
    region: config.region,
    ...(config.prefix === undefined ? {} : { prefix: config.prefix }),
    transport: createBrowserHttpTransport(),
    allowInsecureLocalNetwork: true,
    credentialProvider: {
      async get(operation = 'health') {
        return parseS3Credentials(await broker.get(credentialRef, destination.id, operation));
      },
    },
  };
}

function requireReference(ref: string): void {
  if (!ref.startsWith(REFERENCE_PREFIX) || ref.length > 500 || /[\0\r\n]/u.test(ref)) {
    throw new Error('storage credential reference is invalid');
  }
}
