export type SyncSecretKind = 'device-identity' | 'shared-secret';

export interface SyncSecretStore {
  getSecret(ref: string): string | null;
  setSecret(ref: string, value: string): void;
  deleteSecret?(ref: string): void;
}

export interface SyncDeviceSecretBundle {
  ed25519PrivateKeyHex: string;
  x25519PrivateKeyHex: string;
}

const DEVICE_REF_PREFIX = 'secure.sync.device.';
const SHARED_REF_PREFIX = 'secure.sync.shared.';

function createMemorySecretStore(): SyncSecretStore {
  const values = new Map<string, string>();
  return {
    getSecret(ref: string): string | null {
      return values.get(ref) ?? null;
    },
    setSecret(ref: string, value: string): void {
      values.set(ref, value);
    },
    deleteSecret(ref: string): void {
      values.delete(ref);
    },
  };
}

let activeSecretStore: SyncSecretStore = createMemorySecretStore();
let configuredSecretStore = false;

export function createInMemorySyncSecretStore(): SyncSecretStore {
  return createMemorySecretStore();
}

export function configureSyncSecretStore(store: SyncSecretStore): void {
  activeSecretStore = store;
  configuredSecretStore = true;
}

export function hasConfiguredSyncSecretStore(): boolean {
  return configuredSecretStore;
}

export function createDeviceIdentitySecretRef(publicKey: string): string {
  return `${DEVICE_REF_PREFIX}${publicKey}`;
}

export function createSharedSecretRef(localDeviceId: string, remoteDeviceId: string): string {
  const pairId = [localDeviceId, remoteDeviceId].sort().join('_');
  return `${SHARED_REF_PREFIX}${pairId}`;
}

export function isDeviceIdentitySecretRef(ref: string): boolean {
  return ref.startsWith(DEVICE_REF_PREFIX);
}

export function isSharedSecretRef(ref: string): boolean {
  return ref.startsWith(SHARED_REF_PREFIX);
}

function assertHexSecret(name: string, value: string, expectedLength: number): void {
  if (value.length !== expectedLength || !/^[0-9a-f]+$/i.test(value)) {
    throw new Error(`${name} must be ${expectedLength} hex characters`);
  }
}

function parseDeviceSecretBundle(value: string): SyncDeviceSecretBundle | null {
  try {
    const parsed = JSON.parse(value) as Partial<SyncDeviceSecretBundle>;
    if (
      typeof parsed.ed25519PrivateKeyHex !== 'string'
      || typeof parsed.x25519PrivateKeyHex !== 'string'
    ) {
      return null;
    }
    assertHexSecret('ed25519PrivateKeyHex', parsed.ed25519PrivateKeyHex, 128);
    assertHexSecret('x25519PrivateKeyHex', parsed.x25519PrivateKeyHex, 64);
    return {
      ed25519PrivateKeyHex: parsed.ed25519PrivateKeyHex.toLowerCase(),
      x25519PrivateKeyHex: parsed.x25519PrivateKeyHex.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function storeDeviceIdentitySecrets(
  publicKey: string,
  bundle: SyncDeviceSecretBundle,
): string {
  assertHexSecret('ed25519PrivateKeyHex', bundle.ed25519PrivateKeyHex, 128);
  assertHexSecret('x25519PrivateKeyHex', bundle.x25519PrivateKeyHex, 64);

  const ref = createDeviceIdentitySecretRef(publicKey);
  activeSecretStore.setSecret(ref, JSON.stringify({
    ed25519PrivateKeyHex: bundle.ed25519PrivateKeyHex.toLowerCase(),
    x25519PrivateKeyHex: bundle.x25519PrivateKeyHex.toLowerCase(),
  }));
  return ref;
}

export function getDeviceIdentitySecrets(ref: string): SyncDeviceSecretBundle | null {
  if (!isDeviceIdentitySecretRef(ref)) return null;
  const value = activeSecretStore.getSecret(ref);
  if (!value) return null;
  return parseDeviceSecretBundle(value);
}

/** Remove one opaque secret reference from the configured platform store. */
export function deleteSyncSecret(ref: string): void {
  activeSecretStore.deleteSecret?.(ref);
}

export function storeSharedSecret(
  localDeviceId: string,
  remoteDeviceId: string,
  sharedSecretHex: string,
): string {
  assertHexSecret('sharedSecretHex', sharedSecretHex, 64);
  const ref = createSharedSecretRef(localDeviceId, remoteDeviceId);
  activeSecretStore.setSecret(ref, sharedSecretHex.toLowerCase());
  return ref;
}

export function getSharedSecretHex(ref: string): string | null {
  if (!isSharedSecretRef(ref)) return null;
  const value = activeSecretStore.getSecret(ref);
  if (!value) return null;
  try {
    assertHexSecret('sharedSecretHex', value, 64);
    return value.toLowerCase();
  } catch {
    return null;
  }
}
