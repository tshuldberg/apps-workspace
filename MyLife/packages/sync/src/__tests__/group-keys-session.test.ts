/**
 * M3 group keys in a LIVE session (MK-022 + MK-023 acceptance).
 *
 * Two workspace members run a real session with workspaceId set. The data
 * channel must key under the shared GROUP epoch key (not the pairwise key),
 * and -- the removal acceptance -- frames captured off the wire post-removal
 * must be unreadable with the epoch secret the removed device still holds,
 * while a current member's epoch key opens them.
 */

import { it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { PairedDevice, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { createSyncTables } from '../db/schema';
import { generateDeviceIdentity } from '../identity/device-identity';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';
import { createWorkspace, addWorkspaceMember, getKeyWraps } from '../db/queries';
import {
  createGroupCommit,
  commitMemberRemoval,
  deriveEpochContentKey,
  storeReceivedKeyWrap,
  type GroupMemberKey,
} from '../protocol/group-keys';
import { parseSecureJsonPayload } from '../protocol/payload-security';
import { decodeTappedMessage, envelopeKeyFromSharedHex } from '../test/frame-tap';

const SECRET = 'cd'.repeat(32);
const WS = 'ws-live';

const HEALTH_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [{ tableName: 'hl_vitals', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['health', HEALTH_POLICY]]);
const PREFIXES = new Map([['health', 'hl_']]);

const memberKey = (m: ReturnType<typeof generateDeviceIdentity>): GroupMemberKey =>
  ({ deviceId: m.publicKey, dhPublicKey: m.dhPublicKey });

function paired(deviceId: string): PairedDevice {
  return {
    deviceId, displayName: 'peer', dhPublicKey: 'dh',
    sharedSecretRef: `local:shared:${SECRET}`, isActive: true,
  } as unknown as PairedDevice;
}

/** Wired pair that ALSO records every frame (the wire tap). */
function tappedConnectionPair(deviceA: string, deviceB: string) {
  const captured: Uint8Array[] = [];
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
    id: 'conn-a', remoteDeviceId: deviceB, transport: 'wan_relay',
    send: async (data) => { captured.push(data); setTimeout(() => deliver(handlersForB, bufferForB, data), 0); },
    onData: (h) => attach(handlersForA, bufferForA, h),
    close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'conn-b', remoteDeviceId: deviceA, transport: 'wan_relay',
    send: async (data) => { captured.push(data); setTimeout(() => deliver(handlersForA, bufferForA, data), 0); },
    onData: (h) => attach(handlersForB, bufferForB, h),
    close: async () => {},
  };
  return { connA, connB, captured };
}

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;
let dbLost: InMemoryTestDatabase | null = null;

afterEach(() => {
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
  dbLost?.close(); dbLost = null;
});

function setupWorkspaceDb(db: InMemoryTestDatabase, memberIds: string[]) {
  createSyncTables(db.adapter);
  db.adapter.execute('CREATE TABLE hl_vitals (id TEXT PRIMARY KEY, bpm TEXT, updated_at TEXT)');
  createWorkspace(db.adapter, {
    id: WS, displayName: 'Live', workspaceType: 'group', createdByDeviceId: memberIds[0]!,
    createdAt: '2026-06-11T00:00:00.000Z', rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
  });
  for (const id of memberIds) {
    addWorkspaceMember(db.adapter, {
      workspaceId: WS, deviceId: id, role: 'member', invitedByDeviceId: memberIds[0]!,
      invitedAt: '2026-06-11T00:00:00.000Z', removedAt: null,
    });
  }
}

it('post-removal workspace traffic is group-keyed: captured frames open with the new epoch key, never the removed member\'s old secret', async () => {
  const idA = generateDeviceIdentity('Admin');
  const idB = generateDeviceIdentity('Member B');
  const idLost = generateDeviceIdentity('Removed Device');

  dbA = createInMemoryTestDatabase();
  dbB = createInMemoryTestDatabase();
  setupWorkspaceDb(dbA, [idA.publicKey, idB.publicKey, idLost.publicKey]);
  setupWorkspaceDb(dbB, [idA.publicKey, idB.publicKey, idLost.publicKey]);

  // Epoch 1 included the soon-to-be-removed device; it HOLDS this secret.
  const epoch1 = createGroupCommit(dbA.adapter, {
    workspaceId: WS, committer: idA, members: [idA, idB, idLost].map(memberKey),
  });
  // The device is removed; epoch 2 is wrapped for A and B only.
  const epoch2 = commitMemberRemoval(dbA.adapter, {
    workspaceId: WS, committer: idA,
    members: [idA, idB, idLost].map(memberKey), removedDeviceId: idLost.publicKey,
  });
  expect(epoch2.epoch).toBe(2);
  // B receives its epoch-2 wrap (distribution); B's membership view drops the
  // removed device too.
  for (const wrap of getKeyWraps(dbA.adapter, WS, 2)) {
    if (wrap.wrappedForDeviceId === idB.publicKey) storeReceivedKeyWrap(dbB.adapter, wrap);
  }
  dbB.adapter.execute(
    'UPDATE sync_workspace_members SET removed_at = ? WHERE workspace_id = ? AND device_id = ?',
    ['2026-06-11T01:00:00.000Z', WS, idLost.publicKey],
  );

  // A authors post-removal workspace data.
  const docA = new LwwDocumentManager();
  docA.applyChange('health', { table: 'hl_vitals', rowId: 'v1', operation: 'INSERT', data: { id: 'v1', bpm: '62 resting, post-removal', updated_at: '2026-06-11T02:00:00.000Z' } });
  const docB = new LwwDocumentManager();

  const ctA = new ChangeTracker({ db: dbA.adapter, deviceId: idA.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
  const ctB = new ChangeTracker({ db: dbB.adapter, deviceId: idB.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });

  const { connA, connB, captured } = tappedConnectionPair(idA.publicKey, idB.publicKey);

  const [initiator, responder] = await Promise.all([
    runInitiatorSession(connA, {
      db: dbA.adapter, identity: idA, pairedDevices: [paired(idB.publicKey)],
      documentManager: docA as unknown as DocumentManager, changeTracker: ctA,
      enabledModules: ['health'], modulePolicies: POLICIES, transport: 'wan_relay',
      workspaceId: WS,
    }),
    runResponderSession(connB, {
      db: dbB.adapter, identity: idB, pairedDevices: [paired(idA.publicKey)],
      documentManager: docB as unknown as DocumentManager, changeTracker: ctB,
      enabledModules: ['health'], modulePolicies: POLICIES, transport: 'wan_relay',
      workspaceId: WS,
    }),
  ]);

  // The session ran under the group epoch key (MK-022).
  expect(initiator.session.status).toBe('completed');
  expect(responder.session.status).toBe('completed');
  expect(initiator.negotiation?.groupEpoch).toBe(2);

  // The data crossed: B holds the post-removal row.
  expect(dbB.adapter.query('SELECT * FROM hl_vitals WHERE id = ?', ['v1'])).toHaveLength(1);

  // --- The captured-frames acceptance (MK-023). ---
  // The wire carries pairwise frame envelopes (MK-044); this omniscient tap
  // opens them with the A-B pair key. The removed member holds neither this
  // pair's envelope key nor the new epoch key, so its real position is
  // strictly weaker than what the payload assertions below prove.
  const envelopeKey = envelopeKeyFromSharedHex(SECRET, idA.publicKey, idB.publicKey);
  const dataMessages = captured
    .map((frame) => decodeTappedMessage(envelopeKey, frame))
    .filter((m): m is NonNullable<typeof m> => m !== null && m.type === 'SYNC_DATA');
  expect(dataMessages.length).toBeGreaterThan(0);

  // The removed device's best material: the epoch-1 secret (and the stale
  // epoch-1 content key). Neither opens any captured SYNC_DATA frame.
  const oldKeyAsEpoch1 = deriveEpochContentKey(epoch1.secret, WS, 1);
  const oldKeyAsEpoch2 = deriveEpochContentKey(epoch1.secret, WS, 2); // even mislabeled
  for (const msg of dataMessages) {
    expect(parseSecureJsonPayload(msg, { enabled: true, key: oldKeyAsEpoch1 })).toBeNull();
    expect(parseSecureJsonPayload(msg, { enabled: true, key: oldKeyAsEpoch2 })).toBeNull();
  }

  // A current member's epoch-2 key DOES open them -- the traffic is group-keyed
  // (this is what retires the pairwise path for workspace traffic).
  const currentKey = deriveEpochContentKey(epoch2.secret, WS, 2);
  const opened = dataMessages
    .map((msg) => parseSecureJsonPayload<{ moduleId?: string }>(msg, { enabled: true, key: currentKey }))
    .filter((p) => p !== null);
  expect(opened.length).toBeGreaterThan(0);
  expect(opened.some((p) => p!.moduleId === 'health')).toBe(true);
}, 20_000);

it('a removed member holding the pairwise key + a stale epoch receives NO current data (epoch-downgrade refused)', async () => {
  const idA = generateDeviceIdentity('Admin');
  const idB = generateDeviceIdentity('Member B');
  const idLost = generateDeviceIdentity('Removed Device');

  dbA = createInMemoryTestDatabase();
  dbLost = createInMemoryTestDatabase();
  setupWorkspaceDb(dbA, [idA.publicKey, idB.publicKey, idLost.publicKey]);
  // The removed device still BELIEVES it is a full member (it never saw the
  // removal commit) and still holds the pairwise key with the admin.
  setupWorkspaceDb(dbLost, [idA.publicKey, idB.publicKey, idLost.publicKey]);

  // Epoch 1 included the removed device; epoch 2 removes it.
  const epoch1 = createGroupCommit(dbA.adapter, {
    workspaceId: WS, committer: idA, members: [idA, idB, idLost].map(memberKey),
  });
  void epoch1;
  commitMemberRemoval(dbA.adapter, {
    workspaceId: WS, committer: idA,
    members: [idA, idB, idLost].map(memberKey), removedDeviceId: idLost.publicKey,
  });
  // A's view: the device is removed.
  dbA.adapter.execute(
    'UPDATE sync_workspace_members SET removed_at = ? WHERE workspace_id = ? AND device_id = ?',
    ['2026-06-11T01:00:00.000Z', WS, idLost.publicKey],
  );
  // The removed device keeps ONLY its epoch-1 wrap (it never got epoch 2).
  for (const wrap of getKeyWraps(dbA.adapter, WS, 1)) {
    if (wrap.wrappedForDeviceId === idLost.publicKey) storeReceivedKeyWrap(dbLost.adapter, wrap);
  }

  // The admin authors current (post-removal) workspace data and INITIATES a
  // session straight to the removed device -- the exact downgrade attempt.
  const docA = new LwwDocumentManager();
  docA.applyChange('health', { table: 'hl_vitals', rowId: 'secret', operation: 'INSERT', data: { id: 'secret', bpm: 'post-removal secret', updated_at: '2026-06-11T02:00:00.000Z' } });
  const docLost = new LwwDocumentManager();

  const ctA = new ChangeTracker({ db: dbA.adapter, deviceId: idA.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
  const ctLost = new ChangeTracker({ db: dbLost.adapter, deviceId: idLost.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });

  const { connA, connB } = tappedConnectionPair(idA.publicKey, idLost.publicKey);

  const [initiator, responder] = await Promise.all([
    runInitiatorSession(connA, {
      db: dbA.adapter, identity: idA, pairedDevices: [paired(idLost.publicKey)],
      documentManager: docA as unknown as DocumentManager, changeTracker: ctA,
      enabledModules: ['health'], modulePolicies: POLICIES, transport: 'wan_relay',
      workspaceId: WS,
    }),
    runResponderSession(connB, {
      db: dbLost.adapter, identity: idLost, pairedDevices: [paired(idA.publicKey)],
      documentManager: docLost as unknown as DocumentManager, changeTracker: ctLost,
      enabledModules: ['health'], modulePolicies: POLICIES, transport: 'wan_relay',
      workspaceId: WS,
    }),
  ]);

  // Both sides failed; the epoch-keyed workspace refused the pairwise-key
  // fallback rather than serve current data under a key the removed device
  // still holds. (The removed device refuses first, so the admin then times
  // out waiting for a reply -- either way no session proceeds.)
  expect(initiator.session.status).toBe('failed');
  expect(responder.session.status).toBe('failed');
  expect(responder.session.error).toContain('group-epoch mismatch');
  // The removed device received NONE of the current workspace data.
  expect(dbLost.adapter.query('SELECT * FROM hl_vitals WHERE id = ?', ['secret'])).toHaveLength(0);
}, 20_000);
