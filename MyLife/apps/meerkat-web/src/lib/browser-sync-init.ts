// Browser sync boot: the web analog of getMeerkatDatabase in
// apps/meerkat/app/(root)/data/meerkat-db.ts. It mirrors the MK-001 crypto boot
// ORDER exactly, because that order is a durability invariant: the PRNG and the
// secret store must be configured BEFORE the database and BEFORE any identity or
// seal call, or device keys could be orphaned in the in-memory default store
// that @mylife/sync ships with.
//
// Boot order (mirrors getMeerkatDatabase):
//   1. configure PRNG          (WebCrypto getRandomValues)
//   2. configure secret store  (BrowserSecretStore, BEFORE the db)
//   3. create the DatabaseAdapter (sql.js, persisted)
//   4. ensure schema           (mk_ + sync_ + cm_ + blob policy)
//   5. create the node store    (BrowserNodeStore over OPFS/IndexedDB blocks)
//   6. return the wired { db, nodeStore, secrets } a future UI consumes
//
// Phase 1A returns the wired pieces; it does NOT instantiate the sync engine
// (that is Phase 1B UI work).

import {
  configureSyncPrng,
  configureSyncSecretStore,
  hasConfiguredSyncPrng,
} from '@mylife/sync';
import {
  createBrowserDatabaseAdapter,
  type BrowserDatabaseAdapter,
  type BrowserDatabaseAdapterOptions,
} from './storage/browser-database-adapter';
import {
  createBrowserSecretStore,
  type BrowserSecretStore,
} from './storage/browser-secret-store';
import {
  BrowserNodeStore,
  createBlockBackend,
} from './storage/browser-node-store';
import { ensureMeerkatTables, ensureSyncSchema } from './schema';
import { ensurePersonIdentityTables } from './person-identity-core';
import { ensureDmTables } from './dm-core';

export interface BrowserSyncBoot {
  db: BrowserDatabaseAdapter;
  nodeStore: BrowserNodeStore;
  secrets: BrowserSecretStore;
}

export interface BootBrowserSyncOptions {
  /** Forwarded to the sql.js adapter (Node tests inject `locateFile`). */
  database?: BrowserDatabaseAdapterOptions;
}

/** WebCrypto-backed PRNG, the web equivalent of ensureNativeSyncPrng. */
function ensureBrowserSyncPrng(): void {
  if (hasConfiguredSyncPrng()) return;
  configureSyncPrng((byteCount) =>
    globalThis.crypto.getRandomValues(new Uint8Array(byteCount)),
  );
}

let cached: BrowserSyncBoot | null = null;
/**
 * Single-flight boot promise. Caching only the RESOLVED value let two
 * concurrent callers (React StrictMode's double-mounted boot effect) each run a
 * full boot, racing two secret-store inits against one vault. Concurrent
 * callers now share one in-flight boot; a rejected boot clears the cache so a
 * later attempt can retry.
 */
let cachedPromise: Promise<BrowserSyncBoot> | null = null;

export function bootBrowserSync(
  options: BootBrowserSyncOptions = {},
): Promise<BrowserSyncBoot> {
  if (cachedPromise) return cachedPromise;
  const pending = bootBrowserSyncUncached(options);
  cachedPromise = pending;
  void pending.catch(() => {
    if (cachedPromise === pending) cachedPromise = null;
  });
  return pending;
}

async function bootBrowserSyncUncached(
  options: BootBrowserSyncOptions,
): Promise<BrowserSyncBoot> {
  // 1. PRNG, BEFORE any identity/seal call.
  ensureBrowserSyncPrng();

  // Own the complete node lifetime before touching the vault or loading SQLite.
  let secrets!: BrowserSecretStore;
  const db = await createBrowserDatabaseAdapter({
    ...options.database,
    beforeOpen: async () => {
      secrets = await createBrowserSecretStore();
      configureSyncSecretStore(secrets);
      await options.database?.beforeOpen?.();
    },
    beforeRetry: async () => {
      await secrets.retryPersistence();
      await options.database?.beforeRetry?.();
    },
    beforePersist: async () => {
      await secrets.flush();
      await options.database?.beforePersist?.();
    },
  });
  db.execute('PRAGMA foreign_keys=ON;');

  // 4. Schema: mk_ identity/settings/pinned, then sync_ + mp_pad + cm_ + blob,
  //    then the device-local dm_ tables (Plan 21 Phase 9) so the Messages surface
  //    can read them on first paint before any DM is sent (dm_ never replicates).
  ensureMeerkatTables(db);
  ensureSyncSchema(db);
  ensureDmTables(db);
  // Plan 52: device-local person-identity ceremony state (mk_ prefix: the
  // pending-proposal and announce-outbox tables never replicate).
  ensurePersonIdentityTables(db);

  // 5. Node store over OPFS (browser) or IndexedDB (fallback / Node).
  const nodeStore = new BrowserNodeStore(db, createBlockBackend());

  cached = { db, nodeStore, secrets };
  return cached;
}

/** Drop the cached singleton (used on a node reset / between tests). */
export async function resetBrowserSyncCache(options?: { retainOwnership?: boolean }): Promise<void> {
  if (cached) {
    await cached.db.close(options);
    cached.secrets.close();
  }
  cached = null;
  cachedPromise = null;
}
