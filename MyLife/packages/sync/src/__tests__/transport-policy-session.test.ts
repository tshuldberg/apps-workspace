/**
 * Plan 27 P1: the ROW-LEVEL transport-policy gates (the guarantee).
 *
 * Meerkat sessions are device-scoped: ONE connection carries rows for EVERY
 * joined community, distinguished only by each row's community_id. Dial-time
 * gating is therefore not the security boundary; these tests prove the row
 * gates are, in BOTH directions, independently:
 *
 *  - pure evaluator: a change carrying a `local_only` community's policy fact
 *    is rejected on a WAN transport with `transport_not_permitted`, allowed on
 *    LAN/Nearby; BLE never carries data; a missing transport fails closed.
 *  - inbound apply (the smuggled-batch case): a WAN batch carrying a
 *    local_only community's row or key wrap is rejected AND audited, while an
 *    `any` community's row in the SAME batch applies; a DM-group key wrap
 *    (unknown community) still applies over WAN (no false positive).
 *  - full duplex session: over a wan_relay connection, ZERO of the local_only
 *    community's rows cross in either direction (outbound-filtered, so the
 *    relay never even sees their sizes) while the `any` community's rows flow;
 *    the SAME fixture over a lan connection moves everything. The change log
 *    only acks what was really sent.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { PairedDevice, SyncTransport, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { createSyncTables } from '../db/schema';
import { generateDeviceIdentity } from '../identity/device-identity';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import {
  applyReceivedDocumentChanges,
  runInitiatorSession,
  runResponderSession,
  type SyncSessionOptions,
} from '../protocol/sync-session';
import {
  evaluateInboundChange,
  type InboundChangeFacts,
  type InboundSessionAuth,
} from '../protocol/inbound-policy';
import {
  createCommunity,
  getCommunity,
  revisePolicy,
  upsertCommunity,
  type SignedCommunityDescriptor,
} from '../protocol/community';
import { applyGossipedDescriptors, collectDescriptorRecords } from '../protocol/descriptor-gossip';
import { createChannelMessage } from '../protocol/channel-message';
import { keyWrapToSyncedRow } from '../protocol/group-keys';
import { getInboundAudit, getKeyWraps } from '../db/queries';
import { configureSyncSecretStore } from '../secrets/sync-secret-store';
import { createInMemorySyncSecretStore } from '../secrets/sync-secret-store';

const NOW = '2026-07-02T00:00:00.000Z';
const SECRET = 'cd'.repeat(32);

beforeEach(() => configureSyncSecretStore(createInMemorySyncSecretStore()));

type Identity = ReturnType<typeof generateDeviceIdentity>;

// --- Meerkat-shaped module config (community rows + key wraps) --------------

const COMMUNITY_POLICY: ModuleSyncPolicy = {
  defaultScope: 'device_local',
  shareable: true,
  entityRules: [
    { tableName: 'cm_messages', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
  ],
};
const KEYS_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [
    { tableName: 'sync_workspace_keys', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
  ],
};
const POLICIES = new Map<string, ModuleSyncPolicy>([
  ['community', COMMUNITY_POLICY],
  ['communitykeys', KEYS_POLICY],
]);
const PREFIXES = new Map<string, string>([
  ['community', 'cm_'],
  ['communitykeys', 'sync_workspace_keys'],
]);
const ENABLED = ['community', 'communitykeys'];

const CM_MESSAGES_DDL = `CREATE TABLE IF NOT EXISTS cm_messages (
  id TEXT PRIMARY KEY, community_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  author_device_id TEXT NOT NULL, body TEXT NOT NULL,
  hlc_wall TEXT NOT NULL, hlc_counter INTEGER NOT NULL,
  signature TEXT NOT NULL, updated_at TEXT NOT NULL)`;

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  db.adapter.execute(CM_MESSAGES_DDL);
  return db;
}

function paired(deviceId: string, dhPublicKey = 'dh'): PairedDevice {
  return {
    deviceId,
    displayName: 'peer',
    // Forward secrecy (D.6) needs the peer's REAL DH public key.
    dhPublicKey,
    sharedSecretRef: `local:shared:${SECRET}`,
    isActive: true,
  } as unknown as PairedDevice;
}

/** A member of every fixture community, added so cm_messages authored by it verify. */
const asGeneralMember = (id: Identity) => ({ deviceId: id.publicKey, role: 'member' as const, dhPublicKey: id.dhPublicKey });
const GENERAL_CHANNEL = [{ id: 'general', name: 'general' }];

/**
 * A REAL signed channel message row (the inbound cm_messages validator, Item 8,
 * verifies every row's signature + author authorization, so a synthetic
 * unsigned row would be rejected before the transport gate is even observable).
 * Returns the message's real content id and its persisted-row shape.
 */
function signedMsg(author: Identity, communityId: string, counter = 0): { id: string; data: Record<string, unknown> } {
  const event = createChannelMessage(author, {
    communityId, channelId: 'general', body: 'hi', hlc: { wall: NOW, counter },
  });
  return {
    id: event.id,
    data: {
      id: event.id, community_id: communityId, channel_id: 'general',
      author_device_id: event.authorDeviceId, body: event.body,
      hlc_wall: event.hlc.wall, hlc_counter: event.hlc.counter,
      signature: event.signature, updated_at: event.hlc.wall,
    },
  };
}

function wrapRow(workspaceId: string, forDevice: string): Record<string, unknown> {
  return keyWrapToSyncedRow({
    workspaceId, keyVersion: 1, wrappedForDeviceId: forDevice,
    wrappedKeyBlob: new Uint8Array(80).fill(7), validFrom: NOW, validUntil: null,
  });
}

// ---------------------------------------------------------------------------
// Part A: the pure evaluator gate
// ---------------------------------------------------------------------------

describe('evaluateInboundChange transport gate (Plan 27 P1)', () => {
  const auth = (sessionTransport?: SyncTransport): InboundSessionAuth => ({
    peerRevoked: false,
    peerAuthorized: true,
    sessionScope: 'personal_replica',
    sasVerified: true,
    ...(sessionTransport ? { sessionTransport } : {}),
  });
  const facts = (overrides: Partial<InboundChangeFacts> = {}): InboundChangeFacts => ({
    operation: 'INSERT',
    claimedModuleId: 'community',
    resolvedModuleId: 'community',
    moduleEnabled: true,
    moduleScopeCap: 'shared_workspace',
    moduleIsSensitive: false,
    moduleRequiresSasForShare: false,
    incomingUpdatedAt: NOW,
    tombstoneDeletedAt: null,
    ...overrides,
  });

  it('rejects a local_only row on WAN transports, allows it on lan + nearby', () => {
    for (const transport of ['wan_relay', 'wan_webrtc'] as const) {
      expect(evaluateInboundChange(auth(transport), facts({ communityTransportPolicy: 'local_only' })))
        .toEqual({ allowed: false, reason: 'transport_not_permitted' });
    }
    for (const transport of ['lan', 'nearby'] as const) {
      expect(evaluateInboundChange(auth(transport), facts({ communityTransportPolicy: 'local_only' })).allowed)
        .toBe(true);
    }
  });

  it('allows any/local_preferred rows on WAN, and non-community rows regardless', () => {
    expect(evaluateInboundChange(auth('wan_relay'), facts({ communityTransportPolicy: 'any' })).allowed).toBe(true);
    expect(evaluateInboundChange(auth('wan_relay'), facts({ communityTransportPolicy: 'local_preferred' })).allowed).toBe(true);
    expect(evaluateInboundChange(auth('wan_relay'), facts()).allowed).toBe(true);
    expect(evaluateInboundChange(auth('wan_relay'), facts({ communityTransportPolicy: null })).allowed).toBe(true);
  });

  it('fails CLOSED when a policy fact is present but the transport is unknown', () => {
    expect(evaluateInboundChange(auth(undefined), facts({ communityTransportPolicy: 'any' })))
      .toEqual({ allowed: false, reason: 'transport_not_permitted' });
  });

  it('BLE never carries data under ANY policy (NC-2)', () => {
    for (const policy of ['local_only', 'local_preferred', 'any'] as const) {
      expect(evaluateInboundChange(auth('ble'), facts({ communityTransportPolicy: policy })))
        .toEqual({ allowed: false, reason: 'transport_not_permitted' });
    }
  });
});

// ---------------------------------------------------------------------------
// Part B: inbound apply -- the smuggled WAN batch
// ---------------------------------------------------------------------------

describe('applyReceivedDocumentChanges transport gate (the smuggled batch)', () => {
  let self: Identity;
  let peer: Identity;
  let db: InMemoryTestDatabase;
  let hard: SignedCommunityDescriptor;
  let open: SignedCommunityDescriptor;

  beforeEach(() => {
    self = generateDeviceIdentity('Self');
    peer = generateDeviceIdentity('Peer');
    db = freshDb();
    hard = createCommunity(self, { name: 'H', channels: GENERAL_CHANNEL, members: [asGeneralMember(peer)], transportPolicy: 'local_only', now: NOW });
    open = createCommunity(self, { name: 'O', channels: GENERAL_CHANNEL, members: [asGeneralMember(peer)], now: NOW });
    upsertCommunity(db.adapter, hard, self.publicKey, NOW);
    upsertCommunity(db.adapter, open, self.publicKey, NOW);
  });

  function options(transport: SyncTransport): SyncSessionOptions {
    return {
      db: db.adapter,
      identity: self,
      pairedDevices: [paired(peer.publicKey)],
      changeTracker: new ChangeTracker({
        db: db.adapter, deviceId: self.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES,
      }),
      enabledModules: ENABLED,
      modulePolicies: POLICIES,
      transport,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    } as unknown as SyncSessionOptions;
  }
  const ctx = () => ({ remoteDeviceId: peer.publicKey, sessionId: 'sess-tp' });

  it('rejects + audits the local_only row in a WAN batch while the any row applies', () => {
    const hMsg = signedMsg(peer, hard.descriptor.communityId);
    const oMsg = signedMsg(peer, open.descriptor.communityId);
    const changes = [
      { table: 'cm_messages', rowId: hMsg.id, operation: 'INSERT', data: hMsg.data },
      { table: 'cm_messages', rowId: oMsg.id, operation: 'INSERT', data: oMsg.data },
    ];
    const applied = applyReceivedDocumentChanges(options('wan_relay'), 'community', changes, ctx());

    expect(applied).toBe(1);
    const ids = db.adapter.query<{ id: string }>('SELECT id FROM cm_messages').map((r) => r.id);
    expect(ids).toEqual([oMsg.id]);
    const audit = getInboundAudit(db.adapter, { outcome: 'rejected' });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ reason: 'transport_not_permitted', rowId: hMsg.id });
  });

  it('applies the same local_only row over a LAN session', () => {
    const hMsg = signedMsg(peer, hard.descriptor.communityId);
    const changes = [
      { table: 'cm_messages', rowId: hMsg.id, operation: 'INSERT', data: hMsg.data },
    ];
    expect(applyReceivedDocumentChanges(options('lan'), 'community', changes, ctx())).toBe(1);
    expect(getInboundAudit(db.adapter, { outcome: 'rejected' })).toHaveLength(0);
  });

  it('gates the key-wrap branch by wrap.workspaceId, without breaking DM-group wraps', () => {
    const changes = [
      { table: 'sync_workspace_keys', rowId: 'w-hard', operation: 'INSERT', data: wrapRow(hard.descriptor.communityId, self.publicKey) },
      { table: 'sync_workspace_keys', rowId: 'w-dm', operation: 'INSERT', data: wrapRow('dm-group-1', self.publicKey) },
    ];
    const applied = applyReceivedDocumentChanges(options('wan_relay'), 'communitykeys', changes, ctx());

    // The DM-group wrap (no community descriptor -> no community policy) applies;
    // the local_only community's wrap is rejected + audited.
    expect(applied).toBe(1);
    expect(getKeyWraps(db.adapter, hard.descriptor.communityId, 1)).toHaveLength(0);
    expect(getKeyWraps(db.adapter, 'dm-group-1', 1)).toHaveLength(1);
    const audit = getInboundAudit(db.adapter, { outcome: 'rejected' });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ reason: 'transport_not_permitted', rowId: 'w-hard' });

    // Over LAN, the same community wrap applies.
    expect(applyReceivedDocumentChanges(options('lan'), 'communitykeys',
      [{ table: 'sync_workspace_keys', rowId: 'w-hard', operation: 'INSERT', data: wrapRow(hard.descriptor.communityId, self.publicKey) }],
      ctx())).toBe(1);
    expect(getKeyWraps(db.adapter, hard.descriptor.communityId, 1)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Part B2: descriptor gossip honors the policy (metadata is covered too)
// ---------------------------------------------------------------------------

describe('descriptor gossip transport restriction (Plan 27)', () => {
  it('collect excludes a local_only community on WAN, includes it on lan; apply is symmetric', () => {
    const owner = generateDeviceIdentity('Owner');
    const db = freshDb();
    const hardSigned = createCommunity(owner, { name: 'H', channels: [], transportPolicy: 'local_only', now: NOW });
    const openSigned = createCommunity(owner, { name: 'O', channels: [], now: NOW });
    upsertCommunity(db.adapter, hardSigned, owner.publicKey, NOW);
    upsertCommunity(db.adapter, openSigned, owner.publicKey, NOW);

    const wanIds = collectDescriptorRecords(db.adapter, 'wan_relay').map((r) => r.descriptor.communityId);
    expect(wanIds).toEqual([openSigned.descriptor.communityId]);
    const lanIds = collectDescriptorRecords(db.adapter, 'lan').map((r) => r.descriptor.communityId).sort();
    expect(lanIds).toEqual(
      [hardSigned.descriptor.communityId, openSigned.descriptor.communityId].sort(),
    );
    // No transport given (legacy caller): everything, unchanged behavior.
    expect(collectDescriptorRecords(db.adapter)).toHaveLength(2);

    // Apply side, symmetric fail-closed: a NEWER revision of the local_only
    // community arriving over WAN gossip is dropped; over lan it applies.
    const member = generateDeviceIdentity('Member');
    const memberDb = freshDb();
    upsertCommunity(memberDb.adapter, hardSigned, member.publicKey, NOW);
    const revised = revisePolicy(owner, hardSigned, 'local_only', '2026-07-02T01:00:00.000Z');
    expect(applyGossipedDescriptors(memberDb.adapter, [revised], member.publicKey, NOW, 'wan_relay')).toBe(0);
    expect(getCommunity(memberDb.adapter, hardSigned.descriptor.communityId)!.descriptor.revision)
      .toBe(hardSigned.descriptor.revision);
    expect(applyGossipedDescriptors(memberDb.adapter, [revised], member.publicKey, NOW, 'lan')).toBe(1);
    expect(getCommunity(memberDb.adapter, hardSigned.descriptor.communityId)!.descriptor.revision)
      .toBe(revised.descriptor.revision);
  });
});

// ---------------------------------------------------------------------------
// Part C: full duplex sessions (outbound filter is what the wire proves)
// ---------------------------------------------------------------------------

function tappedConnectionPair(deviceA: string, deviceB: string, transport: SyncTransport) {
  const handlersForA: Array<(d: Uint8Array) => void> = [];
  const handlersForB: Array<(d: Uint8Array) => void> = [];
  const bufferForA: Uint8Array[] = [];
  const bufferForB: Uint8Array[] = [];

  function deliver(handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], data: Uint8Array): void {
    if (handlers.length === 0) { buffer.push(data); return; }
    for (const h of [...handlers]) h(data);
  }
  function attach(handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], h: (d: Uint8Array) => void): void {
    handlers.push(h);
    if (buffer.length > 0) for (const d of buffer.splice(0, buffer.length)) h(d);
  }

  const connA: TransportConnection = {
    id: 'conn-a', remoteDeviceId: deviceB, transport,
    send: async (data) => { setTimeout(() => deliver(handlersForB, bufferForB, data), 0); },
    onData: (h) => attach(handlersForA, bufferForA, h),
    close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'conn-b', remoteDeviceId: deviceA, transport,
    send: async (data) => { setTimeout(() => deliver(handlersForA, bufferForA, data), 0); },
    onData: (h) => attach(handlersForB, bufferForB, h),
    close: async () => {},
  };
  return { connA, connB };
}

interface DuplexResult {
  dbA: InMemoryTestDatabase;
  dbB: InMemoryTestDatabase;
  hard: SignedCommunityDescriptor;
  open: SignedCommunityDescriptor;
  trackerA: ChangeTracker;
  /** The real content ids of the four signed messages (h/o per direction). */
  ids: { h1: string; o1: string; h2: string; o2: string };
}

/**
 * Two devices, one device-scoped session (workspaceId ABSENT -- the Meerkat
 * path). Each side holds a row for the local_only community H and a row for
 * the `any` community O; A additionally carries H's key wrap for B and a
 * DM-group wrap. Runs one full duplex session over `transport`.
 */
async function runDuplexSession(transport: SyncTransport): Promise<DuplexResult> {
  const idA = generateDeviceIdentity('A');
  const idB = generateDeviceIdentity('B');
  const dbA = freshDb();
  const dbB = freshDb();

  const hard = createCommunity(idA, { name: 'H', channels: GENERAL_CHANNEL, members: [asGeneralMember(idB)], transportPolicy: 'local_only', now: NOW });
  const open = createCommunity(idA, { name: 'O', channels: GENERAL_CHANNEL, members: [asGeneralMember(idB)], now: NOW });
  for (const db of [dbA, dbB]) {
    upsertCommunity(db.adapter, hard, idA.publicKey, NOW);
    upsertCommunity(db.adapter, open, idA.publicKey, NOW);
  }

  const docA = new LwwDocumentManager();
  const docB = new LwwDocumentManager();
  const trackerA = new ChangeTracker({ db: dbA.adapter, deviceId: idA.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
  const trackerB = new ChangeTracker({ db: dbB.adapter, deviceId: idB.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });

  // A -> B payload: one REAL signed message per community + H's key wrap + a DM-group wrap.
  const h1 = signedMsg(idA, hard.descriptor.communityId);
  const o1 = signedMsg(idA, open.descriptor.communityId);
  docA.applyChange('community', { table: 'cm_messages', rowId: h1.id, operation: 'INSERT', data: h1.data });
  docA.applyChange('community', { table: 'cm_messages', rowId: o1.id, operation: 'INSERT', data: o1.data });
  trackerA.recordChange('cm_messages', 'INSERT', h1.id, h1.data);
  trackerA.recordChange('cm_messages', 'INSERT', o1.id, o1.data);
  docA.applyChange('communitykeys', {
    table: 'sync_workspace_keys', rowId: 'w-hard', operation: 'INSERT',
    data: wrapRow(hard.descriptor.communityId, idB.publicKey),
  });
  docA.applyChange('communitykeys', {
    table: 'sync_workspace_keys', rowId: 'w-dm', operation: 'INSERT',
    data: wrapRow('dm-group-1', idB.publicKey),
  });

  // B -> A payload: the reverse direction.
  const h2 = signedMsg(idB, hard.descriptor.communityId);
  const o2 = signedMsg(idB, open.descriptor.communityId);
  docB.applyChange('community', { table: 'cm_messages', rowId: h2.id, operation: 'INSERT', data: h2.data });
  docB.applyChange('community', { table: 'cm_messages', rowId: o2.id, operation: 'INSERT', data: o2.data });
  trackerB.recordChange('cm_messages', 'INSERT', h2.id, h2.data);
  trackerB.recordChange('cm_messages', 'INSERT', o2.id, o2.data);

  const optionsFor = (
    db: InMemoryTestDatabase, identity: Identity, remote: Identity,
    doc: LwwDocumentManager, tracker: ChangeTracker,
  ): SyncSessionOptions => ({
    db: db.adapter,
    identity,
    pairedDevices: [paired(remote.publicKey, remote.dhPublicKey)],
    documentManager: doc as unknown as DocumentManager,
    changeTracker: tracker,
    enabledModules: ENABLED,
    modulePolicies: POLICIES,
    transport,
  } as unknown as SyncSessionOptions);

  // The data plane is initiator-push (the app's two-way sync is each side
  // taking a turn initiating), so run BOTH legs: A -> B, then B -> A.
  // Each session must genuinely complete: a failed session moving zero rows
  // would fake the "zero local_only rows" assertion below.
  {
    const { connA, connB } = tappedConnectionPair(idA.publicKey, idB.publicKey, transport);
    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, optionsFor(dbA, idA, idB, docA, trackerA)),
      runResponderSession(connB, optionsFor(dbB, idB, idA, docB, trackerB)),
    ]);
    expect(initiator.session.status, initiator.session.error ?? '').toBe('completed');
    expect(responder.session.status, responder.session.error ?? '').toBe('completed');
  }
  {
    const { connA, connB } = tappedConnectionPair(idB.publicKey, idA.publicKey, transport);
    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, optionsFor(dbB, idB, idA, docB, trackerB)),
      runResponderSession(connB, optionsFor(dbA, idA, idB, docA, trackerA)),
    ]);
    expect(initiator.session.status, initiator.session.error ?? '').toBe('completed');
    expect(responder.session.status, responder.session.error ?? '').toBe('completed');
  }

  return { dbA, dbB, hard, open, trackerA, ids: { h1: h1.id, o1: o1.id, h2: h2.id, o2: o2.id } };
}

describe('device-scoped duplex session (Plan 27 P1 guarantee)', () => {
  it('over wan_relay: ZERO local_only rows cross in either direction; any-community rows flow', async () => {
    const r = await runDuplexSession('wan_relay');

    const idsOnB = r.dbB.adapter.query<{ id: string }>('SELECT id FROM cm_messages').map((x) => x.id).sort();
    const idsOnA = r.dbA.adapter.query<{ id: string }>('SELECT id FROM cm_messages').map((x) => x.id).sort();
    // Only the `any`-community (open) messages cross over WAN; the local_only H
    // messages are outbound-filtered in both directions.
    expect(idsOnB).toEqual([r.ids.o1]);
    expect(idsOnA).toEqual([r.ids.o2]);

    // The wraps: H's wrap never crossed; the DM-group wrap did.
    expect(getKeyWraps(r.dbB.adapter, r.hard.descriptor.communityId, 1)).toHaveLength(0);
    expect(getKeyWraps(r.dbB.adapter, 'dm-group-1', 1)).toHaveLength(1);

    // OUTBOUND-filtered, not inbound-rejected: neither side audited a rejection,
    // because the rows never reached the wire (the relay saw nothing to reject).
    expect(getInboundAudit(r.dbA.adapter, { outcome: 'rejected' })).toHaveLength(0);
    expect(getInboundAudit(r.dbB.adapter, { outcome: 'rejected' })).toHaveLength(0);

    // The change log only acks what was really delivered: h1 stays unsynced
    // (waiting for a local session), o1 was acked.
    const unsynced = r.trackerA.getUnsyncedByModule('community').map((c) => c.rowId);
    expect(unsynced).toContain(r.ids.h1);
    expect(unsynced).not.toContain(r.ids.o1);
  }, 20_000);

  it('over lan: the SAME fixture moves both communities and the community wrap', async () => {
    const r = await runDuplexSession('lan');

    const idsOnB = r.dbB.adapter.query<{ id: string }>('SELECT id FROM cm_messages').map((x) => x.id).sort();
    const idsOnA = r.dbA.adapter.query<{ id: string }>('SELECT id FROM cm_messages').map((x) => x.id).sort();
    expect(idsOnB).toEqual([r.ids.h1, r.ids.o1].sort());
    expect(idsOnA).toEqual([r.ids.h2, r.ids.o2].sort());
    expect(getKeyWraps(r.dbB.adapter, r.hard.descriptor.communityId, 1)).toHaveLength(1);

    const unsynced = r.trackerA.getUnsyncedByModule('community').map((c) => c.rowId);
    expect(unsynced).not.toContain(r.ids.h1);
    expect(unsynced).not.toContain(r.ids.o1);
  }, 20_000);
});
