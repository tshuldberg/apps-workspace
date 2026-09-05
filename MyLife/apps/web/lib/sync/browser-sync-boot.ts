// Hub web sync boot: the browser analog of the native app's getDatabase +
// crypto boot. It mirrors the MK-001 crypto boot ORDER exactly (PRNG and secret
// store BEFORE the database and BEFORE any identity/seal call), because that
// order is a durability invariant: device keys could be orphaned in the
// in-memory default store @mylife/sync ships with if the real secret store is
// configured too late.
//
// All imports here are browser-safe @mylife/sync SUBPATHS (never the bare
// barrel, which re-exports blob/blob-store.ts -> node `fs`). createSyncTables
// comes from db/schema; identity + queries are pure.
//
// Boot order:
//   1. configure PRNG          (WebCrypto getRandomValues)
//   2. configure secret store  (BrowserSecretStore, BEFORE the db)
//   3. create the DatabaseAdapter (sql.js, persisted to IndexedDB)
//   4. createSyncTables        (sync_ tables)
//   5. resolve-or-create the device identity (persisted)
//   6. ensure a personal workspace exists with this device as owner

import {
  configureSyncPrng,
  hasConfiguredSyncPrng,
} from '@mylife/sync/src/encryption/prng';
import {
  configureSyncSecretStore,
  hasConfiguredSyncSecretStore,
} from '@mylife/sync/src/secrets/sync-secret-store';
import { createSyncTables } from '@mylife/sync/src/db/schema';
import { generateDeviceIdentity } from '@mylife/sync/src/identity/device-identity';
import {
  getDeviceIdentity,
  upsertDeviceIdentity,
  getWorkspaces,
  createWorkspace,
  addWorkspaceMember,
} from '@mylife/sync/src/db/queries';
import type { DeviceIdentity } from '@mylife/sync/src/types';
import {
  createBrowserDatabaseAdapter,
  type BrowserDatabaseAdapter,
  type BrowserDatabaseAdapterOptions,
} from './browser-database-adapter';
import {
  createBrowserSecretStore,
  type BrowserSecretStore,
} from './browser-secret-store';

const DEFAULT_DEVICE_NAME = 'This browser';
const PERSONAL_WORKSPACE_ID = 'ws-personal-self';

export interface HubSyncBoot {
  db: BrowserDatabaseAdapter;
  secrets: BrowserSecretStore;
  identity: DeviceIdentity;
}

export interface BootHubSyncOptions {
  /** Forwarded to the sql.js adapter (Node tests inject `locateFile`). */
  database?: BrowserDatabaseAdapterOptions;
  /** Override the default device display name. */
  deviceName?: string;
}

/** WebCrypto-backed PRNG, the web equivalent of ensureNativeSyncPrng. */
function ensureBrowserSyncPrng(): void {
  if (hasConfiguredSyncPrng()) return;
  configureSyncPrng((byteCount) =>
    globalThis.crypto.getRandomValues(new Uint8Array(byteCount)),
  );
}

/** Load the persisted identity, or generate + persist a real one on first run. */
function resolveOrCreateIdentity(
  db: BrowserDatabaseAdapter,
  deviceName: string,
): DeviceIdentity {
  const existing = getDeviceIdentity(db);
  if (existing) return existing;
  // generateDeviceIdentity writes the new private-key bundle into the
  // (already configured) secret store and returns an opaque ref.
  const created = generateDeviceIdentity(deviceName);
  upsertDeviceIdentity(db, created);
  return created;
}

/** Ensure a personal workspace owned by this device exists (auto on first launch). */
function ensurePersonalWorkspace(
  db: BrowserDatabaseAdapter,
  identity: DeviceIdentity,
): void {
  const workspaces = getWorkspaces(db);
  if (workspaces.some((w) => w.workspaceType === 'personal')) return;
  const now = new Date().toISOString();
  createWorkspace(db, {
    id: PERSONAL_WORKSPACE_ID,
    displayName: 'Personal',
    workspaceType: 'personal',
    createdByDeviceId: identity.publicKey,
    createdAt: now,
    rotatedAt: null,
    currentKeyVersion: 1,
    archivedAt: null,
  });
  addWorkspaceMember(db, {
    workspaceId: PERSONAL_WORKSPACE_ID,
    deviceId: identity.publicKey,
    role: 'owner',
    invitedByDeviceId: identity.publicKey,
    invitedAt: now,
    removedAt: null,
  });
}

let cached: HubSyncBoot | null = null;
let inFlight: Promise<HubSyncBoot> | null = null;

export async function bootHubSync(
  options: BootHubSyncOptions = {},
): Promise<HubSyncBoot> {
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    // 1. PRNG, BEFORE any identity/seal call.
    ensureBrowserSyncPrng();

    // 2. Secret store, BEFORE the database, BEFORE any identity/seal call.
    const secrets = await createBrowserSecretStore();
    if (!hasConfiguredSyncSecretStore()) {
      configureSyncSecretStore(secrets);
    }

    // 3. DatabaseAdapter (sql.js, persisted to IndexedDB).
    const db = await createBrowserDatabaseAdapter(options.database);

    // 4. sync_ tables.
    createSyncTables(db);

    // 5. Device identity (persisted; first run generates real X25519/Ed25519 keys).
    const identity = resolveOrCreateIdentity(db, options.deviceName ?? DEFAULT_DEVICE_NAME);

    // 6. Personal workspace (auto-created, owner = this device).
    ensurePersonalWorkspace(db, identity);

    // MK-001 durability: flush both stores before the engine/UI touch the keys.
    await secrets.flush();
    await db.flush();

    cached = { db, secrets, identity };
    return cached;
  })();
  return inFlight;
}

/** Synchronous accessor for code that runs after bootHubSync resolved. */
export function getBootedHubSync(): HubSyncBoot | null {
  return cached;
}

/** Drop the cached singleton (used on reset / between tests). */
export function resetHubSyncBoot(): void {
  if (cached) {
    cached.secrets.close();
    cached.db.close();
  }
  cached = null;
  inFlight = null;
}
