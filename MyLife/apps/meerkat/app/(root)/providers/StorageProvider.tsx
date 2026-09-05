// StorageProvider (Plan 41 WP-41B3). Assembles the destination registry + the
// pure @mylife/sync storage router over the Meerkat database, and exposes a live
// diagnostics read model to the Storage & Backup screens. Boot is lazy: the
// tables are ensured and the router is built on first mount of a storage screen,
// not at app launch, so the hub tab pays nothing for this subsystem.
//
// Every value the screens render comes from a real mk_storage_* row folded
// through buildStorageDiagnostics. Writes go through the router only; the
// provider never sets a UI state that a row does not back.

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import {
  buildStorageDiagnostics,
  createStorageRouter,
  ensureStorageTables,
  listStorageBackups,
  listStorageDestinations,
  listStorageHealth,
  listStorageJobs,
  listStorageObjects,
  listStoragePolicies,
  type StorageDestinationRouter,
  type StorageDiagnostics,
} from '@mylife/sync';
import { useMeerkatDatabase } from './DatabaseProvider';
import { useIdentity } from './IdentityProvider';
import type { DestinationRegistry } from '../data/storage-destinations/destination-registry';
import { ExpoStorageJobPayloadStore } from '../data/storage-destinations/storage-job-payload-store';
import {
  type MobileOAuthConnectResult,
  type MobileOAuthDestinationKind,
} from '../data/storage-destinations/native-oauth-registry';
import { createConfiguredMobileStorageRegistry } from '../data/storage-destinations/configured-registry';

export interface StorageContextValue {
  router: StorageDestinationRouter;
  registry: DestinationRegistry;
  payloadStore: ExpoStorageJobPayloadStore;
  connectOAuthDestination: (
    kind: MobileOAuthDestinationKind,
    destinationId: string,
  ) => Promise<MobileOAuthConnectResult>;
  /** The current folded read model. Recomputed after refresh(). */
  diagnostics: StorageDiagnostics;
  /** Re-read all rows and rebuild the diagnostics fold. Call after any write. */
  refresh: () => void;
  /** Increments on every refresh so screens can key effects off real changes. */
  revision: number;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function useStorage(): StorageContextValue {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used within StorageProvider');
  return ctx;
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  return Crypto.randomUUID();
}

export function StorageProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const configured = useMemo(() => createConfiguredMobileStorageRegistry({
    db,
    identity,
    platformOS: Platform.OS,
  }), [db, identity]);
  const { registry, nativeOAuth } = configured;

  // Ensure the storage tables exist exactly once for this db handle, then build
  // the registry + router. Both are stable for the life of the provider.
  const payloadStore = useMemo(() => new ExpoStorageJobPayloadStore(), []);
  const router = useMemo(() => {
    ensureStorageTables(db);
    return createStorageRouter({
      db,
      adapterResolver: (destination) => registry.resolveRouterDestination(destination),
      now: nowIso,
      random: randomId,
      payloadStore,
    });
  }, [db, registry, payloadStore]);

  const readDiagnostics = useCallback((): StorageDiagnostics => buildStorageDiagnostics({
    destinations: listStorageDestinations(db),
    policies: listStoragePolicies(db),
    objects: listStorageObjects(db),
    jobs: listStorageJobs(db),
    health: listStorageHealth(db),
    backups: listStorageBackups(db),
  }), [db]);

  const [revision, setRevision] = useState(0);
  const diagnosticsRef = useRef<StorageDiagnostics | null>(null);
  const [diagnostics, setDiagnostics] = useState<StorageDiagnostics>(() => {
    const initial = readDiagnostics();
    diagnosticsRef.current = initial;
    return initial;
  });

  const refresh = useCallback(() => {
    const next = readDiagnostics();
    diagnosticsRef.current = next;
    setDiagnostics(next);
    setRevision((value) => value + 1);
  }, [readDiagnostics]);
  const connectOAuthDestination = useCallback(
    (kind: MobileOAuthDestinationKind, destinationId: string) => nativeOAuth.connect(kind, destinationId),
    [nativeOAuth],
  );

  const value = useMemo<StorageContextValue>(
    () => ({
      router,
      registry,
      payloadStore,
      connectOAuthDestination,
      diagnostics,
      refresh,
      revision,
    }),
    [router, registry, payloadStore, connectOAuthDestination, diagnostics, refresh, revision],
  );

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}
