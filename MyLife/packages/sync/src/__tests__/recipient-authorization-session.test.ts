import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { DocumentManager } from '../crdt/document-manager';
import type { PairedDevice, TransportConnection } from '../types';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import { createSyncTables } from '../db/schema';
import { recordSasVerification, insertPairedDevice } from '../db/queries';
import { generateDeviceIdentity } from '../identity/device-identity';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { createCommunity, upsertCommunity, removeMemberRevision } from '../protocol/community';
import { applyReceivedDocumentChanges, runInitiatorSession, runResponderSession, type SyncSessionOptions } from '../protocol/sync-session';
import { configureSyncSecretStore, createInMemorySyncSecretStore } from '../secrets/sync-secret-store';
import { blobContentHash } from '../protocol/blob-transfer';
const SECRET = 'ab'.repeat(32);
const databases: InMemoryTestDatabase[] = [];
beforeEach(() => configureSyncSecretStore(createInMemorySyncSecretStore()));
afterEach(() => { for (const db of databases.splice(0)) db.close(); vi.restoreAllMocks(); });
const POLICY: ModuleSyncPolicy = { defaultScope: 'device_local', shareable: true, entityRules: [
  { tableName: 'nt_shared', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
  { tableName: 'nt_personal', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
] };
const POLICIES = new Map([['notes', POLICY]]);
const PREFIXES = new Map([['notes', 'nt_']]);
function connectionPair(deviceA: string, deviceB: string): { connA: TransportConnection; connB: TransportConnection } {
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
    if (buffer.length > 0) {
      const queued = buffer.splice(0, buffer.length);
      for (const d of queued) h(d);
    }
  }

  const connA: TransportConnection = {
    id: 'conn-a', remoteDeviceId: deviceB, transport: 'wan_relay',
    send: async (data) => { setTimeout(() => deliver(handlersForB, bufferForB, data), 0); },
    onData: (h) => attach(handlersForA, bufferForA, h),
    close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'conn-b', remoteDeviceId: deviceA, transport: 'wan_relay',
    send: async (data) => { setTimeout(() => deliver(handlersForA, bufferForA, data), 0); },
    onData: (h) => attach(handlersForB, bufferForB, h),
    close: async () => {},
  };
  return { connA, connB };
}


function fixture(own = false, verified = true) {
  const identities = [generateDeviceIdentity('Alice'), generateDeviceIdentity('Bob')];
  const nodes = identities.map((identity, index) => {
    const db = createInMemoryTestDatabase(); databases.push(db); createSyncTables(db.adapter);
    for (const table of ['nt_shared', 'nt_personal']) db.adapter.execute(`CREATE TABLE ${table} (id TEXT PRIMARY KEY, community_id TEXT, body TEXT, blob_hash TEXT, updated_at TEXT)`);
    const remote = identities[1 - index]!;
    if (verified) recordSasVerification(db.adapter, { peerDeviceId: remote.publicKey, sasIndices: '1,2,3,4,5' });
    const doc = new LwwDocumentManager();
    const tracker = new ChangeTracker({ db: db.adapter, deviceId: identity.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
    const captured: string[] = [];
    const diff = doc.diffSyncMessage.bind(doc);
    vi.spyOn(doc, 'diffSyncMessage').mockImplementation((module, bytes) => {
      captured.push(new TextDecoder().decode(bytes));
      return diff(module, bytes);
    });
    const options: SyncSessionOptions = {
      db: db.adapter, identity, pairedDevices: [{ deviceId: remote.publicKey, dhPublicKey: remote.dhPublicKey, sharedSecretRef: `local:shared:${SECRET}`, isActive: true } as PairedDevice],
      documentManager: doc as unknown as DocumentManager, changeTracker: tracker, enabledModules: ['notes'], modulePolicies: POLICIES,
      transport: 'wan_relay', isOwnDevice: () => own,
    };
    insertPairedDevice(db.adapter, { ...options.pairedDevices[0]!, displayName: 'peer', lastSeenAt: null, lastSyncAt: null, lastSyncModule: null, bytesSent: 0, bytesReceived: 0, pairedAt: new Date().toISOString() });
    return { db, identity, doc, tracker, options, captured };
  });
  const shared = createCommunity(identities[0]!, { name: 'Shared', channels: [], members: [{ deviceId: identities[1]!.publicKey, dhPublicKey: identities[1]!.dhPublicKey, role: 'member' }] });
  for (const node of nodes) upsertCommunity(node.db.adapter, shared, node.identity.publicKey);
  function add(index: number, id: string, communityId: string | null, table = 'nt_shared') {
    const node = nodes[index]!;
    const data = { id, community_id: communityId, body: `secret-${id}`, updated_at: new Date().toISOString() };
    node.doc.applyChange('notes', { table, rowId: id, operation: 'INSERT', data });
    node.tracker.recordChange(table, 'INSERT', id, data);
    return data;
  }
  async function run(index = 0) {
    const sender = nodes[index]!, receiver = nodes[1 - index]!;
    const pair = connectionPair(sender.identity.publicKey, receiver.identity.publicKey);
    const [a, b] = await Promise.all([runInitiatorSession(pair.connA, sender.options), runResponderSession(pair.connB, receiver.options)]);
    expect(a.session.status, a.session.error ?? '').toBe('completed');
    expect(b.session.status, b.session.error ?? '').toBe('completed');
  }
  return { nodes, shared, add, run };
}

describe('recipient authorization before serialization', () => {
  it('filters unrelated communities, personal rows, unattributed rows and tombstones in BOTH directions, retaining unsent changes', async () => {
    const f = fixture();
    for (const [index, node] of f.nodes.entries()) {
      const privateCommunity = createCommunity(node.identity, { name: 'Private', channels: [] });
      upsertCommunity(node.db.adapter, privateCommunity, node.identity.publicKey);
      f.add(index, `allowed-${index}`, f.shared.descriptor.communityId);
      f.add(index, `private-${index}`, privateCommunity.descriptor.communityId);
      f.add(index, `personal-${index}`, null, 'nt_personal');
      f.add(index, `unattributed-${index}`, null);
      node.doc.applyChange('notes', { table: 'nt_shared', rowId: `deleted-${index}`, operation: 'DELETE', data: null });
    }
    await f.run(0); await f.run(1);
    for (const [index, node] of f.nodes.entries()) {
      const wire = node.captured.join('');
      expect(wire).toContain(`allowed-${1 - index}`);
      expect(wire).not.toMatch(/secret-private|secret-personal|secret-unattributed|deleted-/);
      expect(node.tracker.getUnsyncedByModule('notes').map((c) => c.rowId)).toEqual(expect.arrayContaining([`private-${index}`, `personal-${index}`, `unattributed-${index}`]));
    }
  });

  it('transfers personal data and deletes only after explicit ownership and safety verification', async () => {
    const f = fixture(true);
    f.add(0, 'personal', null, 'nt_personal'); await f.run();
    expect(f.nodes[1]!.captured.join('')).toContain('secret-personal');
    f.nodes[0]!.doc.applyChange('notes', { table: 'nt_personal', rowId: 'personal', operation: 'DELETE', data: null });
    await f.run();
    expect(f.nodes[1]!.db.adapter.query('SELECT * FROM nt_personal')).toEqual([]);
  });

  it('does not confer access on an unverified paired friend or a claimed owner', async () => {
    for (const own of [false, true]) {
      const f = fixture(own, false);
      f.add(0, 'shared', f.shared.descriptor.communityId); f.add(0, 'personal', null, 'nt_personal');
      await f.run(); expect(f.nodes[1]!.captured).toEqual([]);
    }
  });

  it('rechecks signed current membership between batches and refuses unknown binary snapshots', async () => {
    const f = fixture();
    f.add(0, 'first', f.shared.descriptor.communityId); f.add(0, 'second', f.shared.descriptor.communityId);
    f.nodes[0]!.options.syncWindow = 1;
    const original = f.nodes[1]!.doc.diffSyncMessage.bind(f.nodes[1]!.doc);
    vi.spyOn(f.nodes[1]!.doc, 'diffSyncMessage').mockImplementation((module, bytes) => {
      const revised = removeMemberRevision(f.nodes[0]!.identity, f.shared, f.nodes[1]!.identity.publicKey);
      upsertCommunity(f.nodes[0]!.db.adapter, revised, f.nodes[0]!.identity.publicKey);
      return original(module, bytes);
    });
    await f.run();
    expect(f.nodes[1]!.captured).toHaveLength(1);
    vi.spyOn(f.nodes[0]!.doc, 'generateSyncMessage').mockReturnValue(new Uint8Array([255, 12]));
    await f.run(); expect(f.nodes[1]!.captured).toHaveLength(1);
  });

  it.each([false, true])('serves only sent references and rechecks removal after loading blob bytes (remove=%s)', async (remove) => {
    const f = fixture();
    const bytes = new TextEncoder().encode('authorized image');
    const hash = blobContentHash(bytes);
    const forbidden = blobContentHash(new TextEncoder().encode('unrelated private image'));
    f.add(0, 'image', f.shared.descriptor.communityId);
    f.nodes[0]!.doc.getDocument('notes').tables.nt_shared!.image!.blob_hash = hash;
    const read = vi.fn((requested: string) => {
      if (remove) upsertCommunity(f.nodes[0]!.db.adapter,
        removeMemberRevision(f.nodes[0]!.identity, f.shared, f.nodes[1]!.identity.publicKey), f.nodes[0]!.identity.publicKey);
      return requested === hash ? bytes : new TextEncoder().encode('unrelated private image');
    });
    const stored: string[] = [];
    f.nodes[0]!.options.blobProvider = { get: read, put: () => {} };
    f.nodes[1]!.options.blobProvider = { get: () => null, put: (h) => { stored.push(h); } };
    // A hostile recipient asks for another known hash after opening the valid batch.
    const original = f.nodes[1]!.doc.diffSyncMessage.bind(f.nodes[1]!.doc);
    vi.spyOn(f.nodes[1]!.doc, 'diffSyncMessage').mockImplementation((module, payload) => [
      ...original(module, payload),
      { table: 'nt_shared', rowId: 'forged-reference', operation: 'INSERT', data: {
        id: 'forged-reference', community_id: f.shared.descriptor.communityId, blob_hash: forbidden,
      } },
    ]);
    await f.run();
    expect(read).toHaveBeenCalledWith(hash);
    expect(read).not.toHaveBeenCalledWith(forbidden);
    expect(stored).toEqual(remove ? [] : [hash]);
  });

  it.each(['inactive', 'rekeyed'])('stops data after the local pairing becomes %s', async (change) => {
    const f = fixture();
    f.add(0, 'private-after-pairing-change', f.shared.descriptor.communityId);
    f.nodes[0]!.db.adapter.execute(change === 'inactive'
      ? 'UPDATE sync_paired_devices SET is_active = 0'
      : "UPDATE sync_paired_devices SET dh_public_key = 'changed-key'");
    await f.run();
    expect(f.nodes[1]!.captured).toEqual([]);
  });

  it('does not acknowledge an edit created while a prior snapshot is in flight', async () => {
    const f = fixture();
    f.add(0, 'one', f.shared.descriptor.communityId); f.add(0, 'two', f.shared.descriptor.communityId);
    f.nodes[0]!.options.syncWindow = 1;
    const original = f.nodes[1]!.doc.diffSyncMessage.bind(f.nodes[1]!.doc);
    let edited = false;
    vi.spyOn(f.nodes[1]!.doc, 'diffSyncMessage').mockImplementation((module, bytes) => {
      const changes = original(module, bytes);
      if (!edited) {
        edited = true;
        const id = changes[0]!.rowId === 'one' ? 'two' : 'one';
        const data = { id, community_id: f.shared.descriptor.communityId, body: 'new edit', updated_at: new Date().toISOString() };
        f.nodes[0]!.tracker.recordChange('nt_shared', 'UPDATE', id, data);
        f.nodes[0]!.doc.applyChange('notes', { table: 'nt_shared', rowId: id, operation: 'UPDATE', data });
      }
      return changes;
    });
    await f.run();
    expect(f.nodes[0]!.tracker.getUnsyncedByModule('notes').some((c) => c.operation === 'UPDATE')).toBe(true);
  });

  it('rejects inbound personal data and foreign-community laundering from a verified friend', () => {
    const f = fixture();
    const foreign = createCommunity(f.nodes[0]!.identity, { name: 'Foreign', channels: [] });
    upsertCommunity(f.nodes[0]!.db.adapter, foreign, f.nodes[0]!.identity.publicKey);
    const changes = [
      { table: 'nt_shared', rowId: 'foreign', operation: 'INSERT' as const, data: { community_id: foreign.descriptor.communityId } },
      { table: 'nt_personal', rowId: 'personal', operation: 'INSERT' as const, data: { body: 'private' } },
    ];
    expect(applyReceivedDocumentChanges(f.nodes[0]!.options, 'notes', changes, { remoteDeviceId: f.nodes[1]!.identity.publicKey, sessionId: 'attack' })).toBe(0);
  });
});
