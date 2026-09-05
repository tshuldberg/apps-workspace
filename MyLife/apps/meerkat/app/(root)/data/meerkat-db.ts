// Shared Meerkat database boot (Task 3, background sync).
//
// The single source of truth for the meerkat.db open AND the MK-001 crypto boot
// order (PRNG + secret store configured BEFORE any identity/seal call). Both the
// foreground DatabaseProvider and the headless background path call this so the
// boot order can never drift between them. Without this, a headless background
// run could reach an identity/seal call before the secure store was wired and
// orphan the device keys.
//
// This module statically imports expo-* native modules, so it is NOT used from
// Node/Vitest. The headless background entry that needs it (runBackgroundSyncOnce
// with no args) lazy-loads it; the pure, testable core takes its db injected.

import {
  openDatabaseSync,
  type SQLiteDatabase,
  type SQLiteBindParams,
} from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { DatabaseAdapter } from '@mylife/db';
import {
  configureSyncPrng,
  configureSyncSecretStore,
  hasConfiguredSyncPrng,
  hasConfiguredSyncSecretStore,
} from '@mylife/sync';
import { ensureFullMeerkatSchema } from './schema-boot';
import { recoverInterruptedMobileRestoreBeforeOpen } from './local-restore-boot';
import { getPrivateStorageRoot, preparePrivateStorageBeforeOpen } from './private-storage';

export function createExpoAdapter(db: SQLiteDatabase): DatabaseAdapter {
  return {
    execute(sql: string, params?: unknown[]): void {
      db.runSync(sql, (params ?? []) as SQLiteBindParams);
    },
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      return db.getAllSync(sql, (params ?? []) as SQLiteBindParams) as T[];
    },
    transaction(fn: () => void): void {
      db.withTransactionSync(fn);
    },
  };
}

// MK-001 durability fix: device identity keys MUST persist in the OS keychain,
// not the in-memory Map that @mylife/sync defaults to. Mirrors the BestChef
// secret-store + PRNG wiring exactly.
export function ensureNativeSyncPrng(): void {
  if (hasConfiguredSyncPrng()) return;
  configureSyncPrng((byteCount) => Crypto.getRandomBytes(byteCount));
}

export function ensureNativeSyncSecretStore(): void {
  if (hasConfiguredSyncSecretStore()) return;

  const options: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    keychainService: 'com.mylife.meerkat.sync',
  };

  configureSyncSecretStore({
    getSecret(ref: string): string | null {
      return SecureStore.getItem(ref, options);
    },
    setSecret(ref: string, value: string): void {
      SecureStore.setItem(ref, value, options);
    },
    deleteSecret(ref: string): void {
      SecureStore.deleteItemAsync(ref, options).catch(() => {});
    },
  });
}

/**
 * Delete a device identity's private-key secret from the OS keychain (B.2).
 * Used by the "Delete my data" flow to remove the recovered/minted private keys
 * behind a `privateKeyRef` so nothing sensitive lingers after a wipe. Uses the
 * SAME keychain options the secret store is configured with. A deletion failure
 * rejects so the caller never wipes the only references and reports false success.
 */
export async function clearNativeIdentitySecret(ref: string): Promise<void> {
  const options: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    keychainService: 'com.mylife.meerkat.sync',
  };
  await SecureStore.deleteItemAsync(ref, options);
  const remaining = await SecureStore.getItemAsync(ref, options);
  if (remaining !== null) throw new Error(`SecureStore did not delete ${ref}.`);
}

/** Configure crypto plumbing in the MK-001 order, then open + bootstrap the db. */
let cachedDb: DatabaseAdapter | null = null;
let cachedNativeDb: SQLiteDatabase | null = null;
let maintenanceActive = false;
let maintenanceTail: Promise<void> = Promise.resolve();

function requireOpenNativeDatabase(): SQLiteDatabase {
  if (!cachedNativeDb) throw new Error('Meerkat database is closed for maintenance.');
  return cachedNativeDb;
}

function assertWritesAvailable(): void {
  if (maintenanceActive) throw new Error('Meerkat database writes are quiesced for maintenance.');
}

function createStableExpoAdapter(): DatabaseAdapter {
  return {
    execute(sql: string, params?: unknown[]): void {
      assertWritesAvailable();
      requireOpenNativeDatabase().runSync(sql, (params ?? []) as SQLiteBindParams);
    },
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      return requireOpenNativeDatabase().getAllSync(
        sql,
        (params ?? []) as SQLiteBindParams,
      ) as T[];
    },
    transaction(fn: () => void): void {
      assertWritesAvailable();
      requireOpenNativeDatabase().withTransactionSync(fn);
    },
  };
}

function openActiveDatabase(): SQLiteDatabase {
  const directory = preparePrivateStorageBeforeOpen();
  recoverInterruptedMobileRestoreBeforeOpen(undefined, getPrivateStorageRoot());
  const db = openDatabaseSync('meerkat.db', {}, directory);
  const directAdapter = createExpoAdapter(db);
  db.runSync('PRAGMA journal_mode=WAL;');
  db.runSync('PRAGMA foreign_keys=ON;');
  // Fresh-install fix (2026-08-28, TestFlight builds 13 + 14 crashed at first
  // launch): EVERY table family is created HERE, synchronously, before any
  // handle is handed out. Schema existence is an invariant of holding a db
  // handle. See schema-boot.ts for the full rationale and the rule for adding
  // a new family. Idempotent, so provider-effect ensure* calls stay harmless.
  ensureFullMeerkatSchema(directAdapter);
  cachedNativeDb = db;
  return db;
}

export interface MeerkatDatabaseMaintenanceHandle {
  readonly nativeDatabase: SQLiteDatabase;
  closeActiveDatabase(): void;
  reopenActiveDatabase(): DatabaseAdapter;
}

/** Serialize snapshot or activation work while normal provider writes are quiesced. */
export function withMeerkatDatabaseMaintenance<T>(
  operation: (handle: MeerkatDatabaseMaintenanceHandle) => Promise<T>,
): Promise<T> {
  const run = maintenanceTail.then(async () => {
    const nativeDatabase = cachedNativeDb ?? openActiveDatabase();
    maintenanceActive = true;
    const handle: MeerkatDatabaseMaintenanceHandle = {
      nativeDatabase,
      closeActiveDatabase(): void {
        if (!cachedNativeDb) return;
        cachedNativeDb.closeSync();
        cachedNativeDb = null;
      },
      reopenActiveDatabase(): DatabaseAdapter {
        if (!cachedNativeDb) openActiveDatabase();
        cachedDb ??= createStableExpoAdapter();
        return cachedDb;
      },
    };
    try {
      return await operation(handle);
    } finally {
      try {
        if (!cachedNativeDb) openActiveDatabase();
      } finally {
        maintenanceActive = false;
      }
    }
  });
  maintenanceTail = run.then(() => undefined, () => undefined);
  return run;
}

export function getMeerkatDatabase(): DatabaseAdapter {
  // Crypto plumbing MUST be configured before any identity/seal call.
  ensureNativeSyncPrng();
  ensureNativeSyncSecretStore();
  if (!cachedNativeDb) openActiveDatabase();
  cachedDb ??= createStableExpoAdapter();
  return cachedDb;
}

/** Drop the cached singleton (used on a database reset). */
export function resetMeerkatDatabaseCache(): void {
  cachedNativeDb?.closeSync();
  cachedDb = null;
  cachedNativeDb = null;
}
