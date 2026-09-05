// BrowserSecretStore: a SYNCHRONOUS @mylife/sync SyncSecretStore backed by
// IndexedDB. It holds the device's Ed25519/X25519 private-key bundle and the
// per-peer X25519 shared secrets derived during pairing. These MUST survive a
// reload (MK-001 durability): a lost device key orphans the identity and breaks
// every paired session.
//
// SyncSecretStore is synchronous (getSecret/setSecret/deleteSecret). IndexedDB
// is async. We resolve it like the DB adapter: load the full secret image into
// memory once at boot, serve the sync interface from that image, and persist
// each write back to IndexedDB in the background. This mirrors
// apps/meerkat-web/src/lib/storage/browser-secret-store.ts (duplicated because
// meerkat-web exposes no package `exports`).

import type { SyncSecretStore } from '@mylife/sync/src/secrets/sync-secret-store';
import { STORE_SECRETS, idbGetAll, idbPut, idbDelete } from './idb';

export interface BrowserSecretStore extends SyncSecretStore {
  /** Force a pending-write flush to durable storage now. */
  flush(): Promise<void>;
  /** Release in-memory state (used on reset / between tests). */
  close(): void;
}

export async function createBrowserSecretStore(): Promise<BrowserSecretStore> {
  // Load the full secret image once. Keys are opaque refs; values are strings.
  const image = new Map<string, string>();
  const entries = await idbGetAll(STORE_SECRETS);
  for (const { key, value } of entries) {
    if (typeof value === 'string') image.set(key, value);
  }

  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;

  async function persistNow(): Promise<void> {
    if (inFlight) await inFlight;
    if (pending.size === 0) return;
    const refs = [...pending];
    pending.clear();
    inFlight = (async () => {
      for (const ref of refs) {
        const value = image.get(ref);
        if (value === undefined) continue;
        await idbPut(STORE_SECRETS, ref, value);
      }
    })()
      .catch(() => {
        // Re-arm so a later flush retries; never throw out of the bg path.
        for (const ref of refs) pending.add(ref);
      })
      .finally(() => {
        inFlight = null;
      });
    await inFlight;
    if (pending.size > 0) await persistNow();
  }

  function schedulePersist(ref: string): void {
    pending.add(ref);
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void persistNow();
    }, 0);
  }

  return {
    getSecret(ref: string): string | null {
      return image.get(ref) ?? null;
    },
    setSecret(ref: string, value: string): void {
      image.set(ref, value);
      schedulePersist(ref);
    },
    deleteSecret(ref: string): void {
      image.delete(ref);
      pending.delete(ref);
      // Mirror the delete to durable storage immediately (best effort).
      void idbDelete(STORE_SECRETS, ref).catch(() => {});
    },
    async flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await persistNow();
    },
    close(): void {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      image.clear();
    },
  };
}
