import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasConfiguredSyncPrng,
  hasConfiguredSyncSecretStore,
} from '@mylife/sync';
import { bootBrowserSync, resetBrowserSyncCache } from '../../browser-sync-init';
import { nodeLocateFile, resetDurableLayer } from './helpers';

const locateFile = nodeLocateFile();

describe('bootBrowserSync (boot order mirrors meerkat-db.ts)', () => {
  beforeEach(async () => {
    await resetBrowserSyncCache();
    await resetDurableLayer();
  });

  it('configures PRNG + secret store and ensures the full schema', async () => {
    const { db, nodeStore, secrets } = await bootBrowserSync({ database: { locateFile } });

    // Crypto plumbing is wired (PRNG + secret store) before the db was usable.
    expect(hasConfiguredSyncPrng()).toBe(true);
    expect(hasConfiguredSyncSecretStore()).toBe(true);
    expect(secrets).toBeDefined();

    const tables = db
      .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
      .map((r) => r.name);

    // mk_ device-local tables.
    for (const t of ['mk_identity', 'mk_settings', 'mk_pinned']) {
      expect(tables).toContain(t);
    }
    // mp_pad synced bellwether.
    expect(tables).toContain('mp_pad');
    // cm_ community tables.
    for (const t of ['cm_messages', 'cm_message_attachments', 'cm_read_state']) {
      expect(tables).toContain(t);
    }
    // sync_ engine tables (at least one sync_-prefixed table exists).
    expect(tables.some((t) => t.startsWith('sync_'))).toBe(true);

    // The returned node store is usable.
    const stats = await nodeStore.stats();
    expect(stats).toEqual({ blockCount: 0, manifestCount: 0, totalBytes: 0 });

    // resetBrowserSyncCache (next beforeEach) closes db + secrets.
  });

  it('returns the cached singleton on a second call', async () => {
    const first = await bootBrowserSync({ database: { locateFile } });
    const second = await bootBrowserSync({ database: { locateFile } });
    expect(second).toBe(first);
  });
});
