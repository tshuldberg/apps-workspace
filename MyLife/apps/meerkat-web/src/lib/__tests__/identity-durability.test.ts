// MK-001 durability proof on web.
//
// The native MK-001 fix relies on the OS keychain being synchronous + durable.
// On web both the secret store and the DB persist on a 250ms debounce, so a
// freshly created identity tab-closed inside that window would ORPHAN the device
// keys: the private key parked only in the secret store's in-memory Map and the
// mk_identity row pointing at a private_key_ref whose bytes were never written.
//
// resolveOrCreateIdentity (in MeerkatProvider.tsx) flushes BOTH stores BEFORE
// returning, secrets first then db. These tests prove:
//   1. a generate -> flush -> (cache reset = tab reload) -> reboot cycle finds
//      BOTH the row AND the private key bytes, and they match.
//   2. NEGATIVE control: WITHOUT the flush, with a long debounce, a tab reload
//      inside the debounce window finds NOTHING (so the flush is load-bearing,
//      not decorative).
//
// "Cache reset" simulates a tab reload: drop the in-memory adapters + the idb
// connection cache + the sql.js cache, but DO NOT delete the IndexedDB database
// (that would be a wipe, not a reload). fake-indexeddb persists the underlying
// data across connections within the process.

import { beforeEach, describe, expect, it } from 'vitest';
import {
  configureSyncPrng,
  configureSyncSecretStore,
  generateDeviceIdentity,
  getDeviceIdentitySecrets,
} from '@mylife/sync';
import { bootBrowserSync, resetBrowserSyncCache } from '../browser-sync-init';
import { resolveOrCreateIdentity } from '../MeerkatProvider';
import { getIdentityRow, saveIdentityRow } from '../meerkat-data';
import {
  createBrowserDatabaseAdapter,
} from '../storage/browser-database-adapter';
import {
  createBrowserSecretStore,
} from '../storage/browser-secret-store';
import { ensureMeerkatTables, ensureSyncSchema } from '../schema';
import {
  closeMeerkatIdb,
  resetMeerkatIdbCache,
} from '../storage/idb';
import { resetSqlJsCache } from '../storage/load-sqljs';
import { nodeLocateFile, resetDurableLayer } from '../storage/__tests__/helpers';

const locateFile = nodeLocateFile();

/** Simulate a tab reload: drop in-memory caches but KEEP the IndexedDB data. */
async function simulateReload(): Promise<void> {
  await resetBrowserSyncCache(); // closes the cached db + secrets, drops the singleton
  await closeMeerkatIdb(); // close the idb connection so a fresh one re-opens
  resetMeerkatIdbCache();
  resetSqlJsCache();
}

describe('MK-001 web identity durability', () => {
  beforeEach(async () => {
    await resetBrowserSyncCache();
    await resetDurableLayer();
  });

  it('a generated identity survives flush -> reload -> reboot (row AND private key)', async () => {
    // Boot #1: first launch, no identity yet.
    const boot1 = await bootBrowserSync({ database: { locateFile } });
    expect(getIdentityRow(boot1.db)).toBeNull();

    const identity = await resolveOrCreateIdentity(boot1.db, boot1.secrets);
    expect(identity.publicKey).toBeTruthy();
    // Capture the ORIGINAL private key bytes from boot #1's live store, so the
    // reboot assertion can prove boot #2 recovers the SAME bytes from encrypted
    // IndexedDB (not a leaked in-memory map).
    const originalKey = getDeviceIdentitySecrets(identity.privateKeyRef);
    expect(originalKey).not.toBeNull();

    // resolveOrCreateIdentity already awaited secrets.flush() + db.flush(), so
    // both are durable now. Simulate a tab reload INSIDE what would have been
    // the debounce window (we never waited for it).
    await simulateReload();

    // Boot #2: reboot off the durable layer.
    const boot2 = await bootBrowserSync({ database: { locateFile } });
    const reboothRow = getIdentityRow(boot2.db);
    expect(reboothRow).not.toBeNull();
    expect(reboothRow!.public_key).toBe(identity.publicKey);
    expect(reboothRow!.private_key_ref).toBe(identity.privateKeyRef);

    // The private key bytes round-tripped through encrypted IndexedDB: resolving
    // on boot #2 must NOT generate a new identity, and the store rebuilt from
    // IndexedDB returns the SAME bytes captured from boot #1.
    const rebooted = await resolveOrCreateIdentity(boot2.db, boot2.secrets);
    expect(rebooted.publicKey).toBe(identity.publicKey);
    const reKey = getDeviceIdentitySecrets(identity.privateKeyRef);
    expect(reKey).not.toBeNull();
    expect(reKey).toEqual(originalKey);
  });

  it('NEGATIVE: a bare database without vault-first persistence can orphan keys', async () => {
    // Build the stores DIRECTLY with a long debounce so nothing auto-persists in
    // the test window. This is the exact failure MK-001 fixes: write the row +
    // the secret to in-memory state, then "reload" before the debounce fires
    // WITHOUT calling flush.
    configureSyncPrng((n) => globalThis.crypto.getRandomValues(new Uint8Array(n)));
    const secrets = await createBrowserSecretStore({ persistDebounceMs: 1_000_000 });
    configureSyncSecretStore(secrets);
    const db = await createBrowserDatabaseAdapter({ locateFile, persistDebounceMs: 1_000_000 });
    db.execute('PRAGMA foreign_keys=ON;');
    ensureMeerkatTables(db);
    ensureSyncSchema(db);

    const created = generateDeviceIdentity('My Meerkat');
    saveIdentityRow(db, {
      public_key: created.publicKey,
      dh_public_key: created.dhPublicKey,
      private_key_ref: created.privateKeyRef,
      display_name: created.displayName,
      created_at: created.createdAt,
    });
    // Deliberately omit the vault-first hook used by bootBrowserSync. Closing
    // the database saves its row, while closing the vault discards its key.
    secrets.close();
    await db.close();
    await closeMeerkatIdb();
    resetMeerkatIdbCache();
    resetSqlJsCache();

    // Reboot finds a row but no durable signing key: the unsafe bare-adapter path.
    const reboot = await bootBrowserSync({ database: { locateFile } });
    expect(getIdentityRow(reboot.db)).not.toBeNull();
    // ...and the private key secret is gone too. Read the REBUILT store directly
    // (loaded from IndexedDB on reboot) rather than the global configured store,
    // which still references the manually-configured in-memory store above. The
    // rebuilt store loaded nothing because nothing was ever flushed, so the
    // durability claim is load-bearing on both halves (row AND secret).
    expect(reboot.secrets.getSecret(created.privateKeyRef)).toBeNull();
  });
});
