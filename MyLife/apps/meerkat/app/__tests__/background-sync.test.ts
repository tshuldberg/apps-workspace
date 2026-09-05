/**
 * runBackgroundSyncCore (Task 3): the app-level headless entry, pure core.
 *
 * Seeds an in-memory db with identity + relay settings + a paired device, then
 * drives the core with injected deps (fake backend, fake clock). Asserts:
 *  - it drains a parked channel event into cm_messages and records a real run;
 *  - with no connection server URL configured it is a no-op that writes nothing;
 *  - the MK-001 boot order holds: crypto is configured BEFORE identity is read.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createChannelMessage,
  createInMemorySyncSecretStore,
  configureSyncSecretStore,
  encodeMailboxEnvelope,
  generateDeviceIdentity,
  insertPairedDevice,
  sealChannelMessageMailboxDelta,
  storeSharedSecret,
  type DeviceIdentity,
  type PairedDevice,
  type RelayBackend,
  type RelaySession,
} from '@mylife/sync';
import { ensureMeerkatTables, setSetting } from '../(root)/data/db';
import { ensureSyncSchema, RELAY_URL_SETTING_KEY } from '../(root)/data/sync-core';
import { mergeChannelMessageEvents, listChannelMessageEvents } from '../(root)/data/community-core';
import {
  getLastBackgroundRunAt,
  runBackgroundSyncCore,
} from '../(root)/data/background-sync';

const PAIR_SECRET = 'cd'.repeat(32);

/** Store-and-forward mailbox backend (mirrors the relay drain-on-join). */
class MailboxRelayBackend implements RelayBackend {
  private readonly mailbox = new Map<string, Uint8Array[]>();
  destroyed = false;
  connectCount = 0;

  park(token: string, bytes: Uint8Array): void {
    const queue = this.mailbox.get(token) ?? [];
    queue.push(bytes);
    this.mailbox.set(token, queue);
  }

  async connect(_url: string, token: string): Promise<RelaySession> {
    this.connectCount += 1;
    const drained = this.mailbox.get(token) ?? [];
    this.mailbox.delete(token);
    return {
      async send(): Promise<void> {},
      onMessage: (handler) => { for (const b of drained) handler(new Uint8Array(b)); },
      close: async () => {},
    };
  }

  destroy(): void { this.destroyed = true; }
}

function seedIdentity(db: InMemoryTestDatabase['adapter'], identity: DeviceIdentity): void {
  db.execute(
    `INSERT OR REPLACE INTO mk_identity (id, public_key, dh_public_key, private_key_ref, display_name, created_at)
     VALUES ('self', ?, ?, ?, ?, ?)`,
    [identity.publicKey, identity.dhPublicKey, identity.privateKeyRef, identity.displayName, identity.createdAt],
  );
}

function pairedFrom(
  db: InMemoryTestDatabase['adapter'],
  self: DeviceIdentity,
  peer: DeviceIdentity,
): PairedDevice {
  const ref = storeSharedSecret(self.publicKey, peer.publicKey, PAIR_SECRET);
  const device = {
    deviceId: peer.publicKey,
    displayName: peer.displayName,
    dhPublicKey: peer.dhPublicKey,
    sharedSecretRef: ref,
    isActive: true,
    pairedAt: '2026-06-14T00:00:00.000Z',
    bytesSent: 0,
    bytesReceived: 0,
    lastSeenAt: null,
    lastSyncAt: null,
    lastSyncModule: null,
  } as unknown as PairedDevice;
  insertPairedDevice(db, device);
  return device;
}

let testDb: InMemoryTestDatabase | null = null;

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe('runBackgroundSyncCore (app headless entry)', () => {
  it('drains a parked channel event into cm_messages and records a real run', async () => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    testDb = createInMemoryTestDatabase();
    const db = testDb.adapter;
    ensureMeerkatTables(db);
    ensureSyncSchema(db);

    const self = generateDeviceIdentity('Phone');
    const peer = generateDeviceIdentity('Desktop');
    seedIdentity(db, self);
    pairedFrom(db, self, peer);
    setSetting(db, RELAY_URL_SETTING_KEY, 'ws://relay');

    const communityId = 'cm_bg';
    const event = createChannelMessage(peer, {
      communityId, channelId: 'general', body: 'parked while phone slept',
      hlc: { wall: '2026-06-14T00:00:01.000Z', counter: 0 },
    });
    const sealed = sealChannelMessageMailboxDelta({
      sender: peer,
      recipient: { deviceId: self.publicKey, dhPublicKey: self.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET,
      communityId, channelId: 'general', events: [event],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const backend = new MailboxRelayBackend();
    backend.park(sealed.token, encodeMailboxEnvelope(sealed.envelope));

    let cryptoConfiguredAt = -1;
    let identityReadAt = -1;
    let step = 0;

    const result = await runBackgroundSyncCore({
      db,
      configureCrypto: () => { cryptoConfiguredAt = step++; },
      getIdentity: () => { identityReadAt = step++; return self; },
      backend,
      buildHandlers: () => ({ channelMessage: (events) => mergeChannelMessageEvents(db, events) }),
      now: () => '2026-06-14T08:00:00.000Z',
    });

    expect(result.ran).toBe(true);
    expect(result.applied).toBe(1);
    expect(result.drain?.attempted).toBe(1);

    const rows = listChannelMessageEvents(db, communityId, 'general');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body).toBe('parked while phone slept');

    // A real run timestamp was recorded (the only persisted claim, and it is real).
    expect(getLastBackgroundRunAt(db)).toBe('2026-06-14T08:00:00.000Z');

    // MK-001 boot order: crypto configured BEFORE identity read.
    expect(cryptoConfiguredAt).toBeGreaterThanOrEqual(0);
    expect(identityReadAt).toBeGreaterThan(cryptoConfiguredAt);
  });

  it('runs the composed auto-connect round AFTER the drain (P4 graduation seam)', async () => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    testDb = createInMemoryTestDatabase();
    const db = testDb.adapter;
    ensureMeerkatTables(db);
    ensureSyncSchema(db);

    const self = generateDeviceIdentity('Phone');
    seedIdentity(db, self);
    setSetting(db, RELAY_URL_SETTING_KEY, 'ws://relay');

    const order: string[] = [];
    const result = await runBackgroundSyncCore({
      db,
      configureCrypto: () => {},
      getIdentity: () => self,
      backend: new MailboxRelayBackend(),
      buildHandlers: () => ({ channelMessage: (events) => mergeChannelMessageEvents(db, events) }),
      // The composed round runs after the drain and its real outcome is attached.
      runComposedSessions: async () => {
        order.push('composed');
        return { attempted: 2, completed: 1, failed: 1, skipped: 0, dials: [], nextEarliestRetryAt: null };
      },
    });

    expect(result.ran).toBe(true);
    // The drain ran (order not tracked for it here) then the composed round; the
    // real session counts are surfaced, never fabricated.
    expect(order).toEqual(['composed']);
    expect(result.composedSessions).toEqual({
      attempted: 2, completed: 1, failed: 1, skipped: 0, dials: [], nextEarliestRetryAt: null,
    });
  });

  it('with no connection server URL configured: a no-op that writes nothing and records no run', async () => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    testDb = createInMemoryTestDatabase();
    const db = testDb.adapter;
    ensureMeerkatTables(db);
    ensureSyncSchema(db);

    const self = generateDeviceIdentity('Phone');
    const peer = generateDeviceIdentity('Desktop');
    seedIdentity(db, self);
    pairedFrom(db, self, peer);
    // No connection server URL set.

    const backend = new MailboxRelayBackend();
    const result = await runBackgroundSyncCore({
      db,
      configureCrypto: () => {},
      getIdentity: () => self,
      backend,
      buildHandlers: () => ({ channelMessage: (events) => mergeChannelMessageEvents(db, events) }),
    });

    expect(result.ran).toBe(false);
    expect(result.applied).toBe(0);
    expect(result.reason).toContain('connection server');
    expect(backend.connectCount).toBe(0);
    expect(getLastBackgroundRunAt(db)).toBeNull();
  });

  it('boot order holds even when there is no identity (crypto still configured first)', async () => {
    testDb = createInMemoryTestDatabase();
    const db = testDb.adapter;
    ensureMeerkatTables(db);
    ensureSyncSchema(db);

    let cryptoConfigured = false;
    let identityCheckedAfterCrypto = false;

    const result = await runBackgroundSyncCore({
      db,
      configureCrypto: () => { cryptoConfigured = true; },
      getIdentity: () => { identityCheckedAfterCrypto = cryptoConfigured; return null; },
      backend: new MailboxRelayBackend(),
      buildHandlers: () => ({ channelMessage: () => ({ inserted: 0, skipped: 0, invalid: 0 }) }),
    });

    expect(result.ran).toBe(false);
    expect(cryptoConfigured).toBe(true);
    expect(identityCheckedAfterCrypto).toBe(true);
  });
});
