// Web storage data hook (Plan 41 WP-41B3). Assembles the destination registry +
// the pure @mylife/sync storage router over the browser database, and exposes a
// live diagnostics read model to the Storage & Backup surfaces. Byte-for-byte
// the same read model the mobile StorageProvider builds; only the platform db
// and adapter registry differ. Every rendered value is a folded mk_storage_* row.

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useMeerkat } from '../MeerkatProvider';
import {
  type DestinationRegistry,
} from './destination-registry';
import { createConfiguredWebStorageRegistry } from './configured-registry';
import { BrowserStorageJobPayloadStore } from './storage-job-payload-store';
import {
  createBrowserStorageCredentialBroker,
  migrateBrowserStorageCredentials,
  STORAGE_BROKER_ALLOW_INSECURE_LOOPBACK,
} from './credential-store';
import { HOSTED_API_URL } from '../hosted-access';

export interface WebStorageController {
  router: StorageDestinationRouter;
  registry: DestinationRegistry;
  payloadStore: BrowserStorageJobPayloadStore;
  diagnostics: StorageDiagnostics;
  refresh: () => void;
  revision: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

export function useWebStorage(): WebStorageController {
  const m = useMeerkat();
  const db = m.db;

  const registry = useMemo(
    () => createConfiguredWebStorageRegistry({
      db,
      identity: m.identity,
      secrets: m.storageSecretAccess,
    }),
    [db, m.identity, m.storageSecretAccess],
  );
  const payloadStore = useMemo(() => new BrowserStorageJobPayloadStore(), []);
  const credentialBroker = useMemo(() => createBrowserStorageCredentialBroker({
    baseUrl: HOSTED_API_URL,
    identity: m.identity,
    allowInsecureLoopback: STORAGE_BROKER_ALLOW_INSECURE_LOOPBACK,
  }), [m.identity]);
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
  const [diagnostics, setDiagnostics] = useState<StorageDiagnostics>(() => readDiagnostics());

  useEffect(() => {
    if (!HOSTED_API_URL) return;
    void migrateBrowserStorageCredentials(db, m.storageSecretAccess, credentialBroker)
      .then((count) => { if (count > 0) setDiagnostics(readDiagnostics()); })
      .catch(() => undefined);
  }, [credentialBroker, db, m.storageSecretAccess, readDiagnostics]);

  const refresh = useCallback(() => {
    setDiagnostics(readDiagnostics());
    setRevision((value) => value + 1);
  }, [readDiagnostics]);

  return useMemo(
    () => ({ router, registry, payloadStore, diagnostics, refresh, revision }),
    [router, registry, payloadStore, diagnostics, refresh, revision],
  );
}
