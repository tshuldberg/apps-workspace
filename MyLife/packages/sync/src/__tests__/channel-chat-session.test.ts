import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { DatabaseAdapter } from '@mylife/db';
import type { DocumentManager } from '../crdt/document-manager';
import type { PairedDevice, TransportConnection, WorkspaceMemberRole } from '../types';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { createSyncTables } from '../db/schema';
import {
  addWorkspaceMember,
  createWorkspace,
  getInboundAudit,
} from '../db/queries';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  createChannelMessage,
  resolveChannelMessages,
  type ChannelMessageEvent,
} from '../protocol/channel-message';
import {
  openChannelMessageMailboxDelta,
  sealChannelMessageMailboxDelta,
} from '../protocol/channel-mailbox';
import {
  decodeMailboxEnvelope,
  deriveMailboxToken,
  encodeMailboxEnvelope,
} from '../protocol/mailbox';
import {
  createCommunity,
  upsertCommunity,
  type SignedCommunityDescriptor,
} from '../protocol/community';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';

const SECRET = 'ab'.repeat(32);
const COMMUNITY_MODULE_ID = 'community';
const PREFIXES = new Map([[COMMUNITY_MODULE_ID, 'cm_']]);
const COMMUNITY_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [
    {
      tableName: 'cm_messages',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    },
    {
      tableName: 'cm_read_state',
      defaultScope: 'personal_replica',
      maxScope: 'personal_replica',
      conflictStrategy: 'lww',
    },
  ],
};
const POLICIES = new Map([[COMMUNITY_MODULE_ID, COMMUNITY_POLICY]]);
const CHANNELS = [
  { id: 'general', name: 'general' },
  { id: 'announcements', name: 'announcements', postRoles: ['owner', 'admin'] as WorkspaceMemberRole[] },
];

const CREATE_CM_MESSAGES = `
CREATE TABLE cm_messages (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  author_device_id TEXT NOT NULL,
  body TEXT NOT NULL,
  hlc_wall TEXT NOT NULL,
  hlc_counter INTEGER NOT NULL,
  supersedes_id TEXT,
  supersedes_deleted INTEGER,
  signature TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;
const CREATE_CM_READ_STATE = `
CREATE TABLE cm_read_state (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  last_read_wall TEXT,
  last_read_counter INTEGER,
  updated_at TEXT NOT NULL
)`;

interface ChannelMessageRow {
  id: string;
  community_id: string;
  channel_id: string;
  author_device_id: string;
  body: string;
  hlc_wall: string;
  hlc_counter: number;
  supersedes_id: string | null;
  supersedes_deleted: number | null;
  signature: string;
  updated_at: string;
}

interface ChannelReadStateRow {
  id: string;
  community_id: string;
  channel_id: string;
  last_read_wall: string;
  last_read_counter: number;
  updated_at: string;
}

function paired(deviceId: string, dhPublicKey: string): PairedDevice {
  return {
    deviceId,
    displayName: 'peer',
    // Forward secrecy (D.6) needs the peer's real DH public key.
    dhPublicKey,
    sharedSecretRef: `local:shared:${SECRET}`,
    isActive: true,
  } as unknown as PairedDevice;
}

function connectionPair(deviceA: string, deviceB: string): { connA: TransportConnection; connB: TransportConnection } {
  const handlersForA: Array<(d: Uint8Array) => void> = [];
  const handlersForB: Array<(d: Uint8Array) => void> = [];
  const bufferForA: Uint8Array[] = [];
  const bufferForB: Uint8Array[] = [];

  function deliver(handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], data: Uint8Array): void {
    if (handlers.length === 0) {
      buffer.push(data);
      return;
    }
    for (const handler of [...handlers]) handler(data);
  }

  function attach(handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], handler: (d: Uint8Array) => void): void {
    handlers.push(handler);
    if (buffer.length > 0) {
      const queued = buffer.splice(0, buffer.length);
      for (const data of queued) handler(data);
    }
  }

  const connA: TransportConnection = {
    id: 'conn-a',
    remoteDeviceId: deviceB,
    transport: 'wan_relay',
    send: async (data) => { setTimeout(() => deliver(handlersForB, bufferForB, data), 0); },
    onData: (handler) => attach(handlersForA, bufferForA, handler),
    close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'conn-b',
    remoteDeviceId: deviceA,
    transport: 'wan_relay',
    send: async (data) => { setTimeout(() => deliver(handlersForA, bufferForA, data), 0); },
    onData: (handler) => attach(handlersForB, bufferForB, handler),
    close: async () => {},
  };
  return { connA, connB };
}

function messageRow(event: ChannelMessageEvent): ChannelMessageRow {
  return {
    id: event.id,
    community_id: event.communityId,
    channel_id: event.channelId,
    author_device_id: event.authorDeviceId,
    body: event.body,
    hlc_wall: event.hlc.wall,
    hlc_counter: event.hlc.counter,
    supersedes_id: event.supersedes?.id ?? null,
    supersedes_deleted: event.supersedes ? (event.supersedes.deleted ? 1 : 0) : null,
    signature: event.signature,
    updated_at: event.hlc.wall,
  };
}

function eventFromRow(row: ChannelMessageRow): ChannelMessageEvent {
  return {
    version: 1,
    id: row.id,
    communityId: row.community_id,
    channelId: row.channel_id,
    authorDeviceId: row.author_device_id,
    body: row.body,
    hlc: { wall: row.hlc_wall, counter: row.hlc_counter },
    supersedes: row.supersedes_id
      ? { id: row.supersedes_id, deleted: row.supersedes_deleted === 1 }
      : undefined,
    signature: row.signature,
  };
}

function installCommunity(db: DatabaseAdapter, signed: SignedCommunityDescriptor, localDeviceId: string): void {
  createSyncTables(db);
  db.execute(CREATE_CM_MESSAGES);
  db.execute(CREATE_CM_READ_STATE);
  createWorkspace(db, {
    id: signed.descriptor.communityId,
    displayName: signed.descriptor.name,
    workspaceType: 'community',
    createdByDeviceId: signed.descriptor.ownerDeviceId,
    createdAt: signed.descriptor.createdAt,
    rotatedAt: null,
    currentKeyVersion: 1,
    archivedAt: null,
  });
  for (const member of signed.descriptor.members) {
    addWorkspaceMember(db, {
      workspaceId: signed.descriptor.communityId,
      deviceId: member.deviceId,
      role: member.role,
      invitedByDeviceId: signed.descriptor.ownerDeviceId,
      invitedAt: signed.descriptor.createdAt,
      removedAt: null,
    });
  }
  upsertCommunity(db, signed, localDeviceId, signed.descriptor.createdAt);
}

function insertLocalReadState(
  db: DatabaseAdapter,
  doc: LwwDocumentManager,
  tracker: ChangeTracker,
  row: ChannelReadStateRow,
): void {
  db.execute(
    `INSERT INTO cm_read_state (
      id, community_id, channel_id, last_read_wall, last_read_counter, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.channel_id,
      row.last_read_wall,
      row.last_read_counter,
      row.updated_at,
    ],
  );
  tracker.recordChange('cm_read_state', 'INSERT', row.id, { ...row });
  doc.applyChange(COMMUNITY_MODULE_ID, {
    table: 'cm_read_state',
    rowId: row.id,
    operation: 'INSERT',
    data: { ...row },
  });
}

function insertLocalMessage(
  db: DatabaseAdapter,
  doc: LwwDocumentManager,
  tracker: ChangeTracker,
  event: ChannelMessageEvent,
): void {
  const row = messageRow(event);
  db.execute(
    `INSERT INTO cm_messages (
      id, community_id, channel_id, author_device_id, body,
      hlc_wall, hlc_counter, supersedes_id, supersedes_deleted,
      signature, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.channel_id,
      row.author_device_id,
      row.body,
      row.hlc_wall,
      row.hlc_counter,
      row.supersedes_id,
      row.supersedes_deleted,
      row.signature,
      row.updated_at,
    ],
  );
  tracker.recordChange('cm_messages', 'INSERT', event.id, { ...row });
  doc.applyChange(COMMUNITY_MODULE_ID, {
    table: 'cm_messages',
    rowId: event.id,
    operation: 'INSERT',
    data: { ...row },
  });
}

function insertReceivedMessage(db: DatabaseAdapter, event: ChannelMessageEvent): void {
  const row = messageRow(event);
  db.execute(
    `INSERT INTO cm_messages (
      id, community_id, channel_id, author_device_id, body,
      hlc_wall, hlc_counter, supersedes_id, supersedes_deleted,
      signature, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.channel_id,
      row.author_device_id,
      row.body,
      row.hlc_wall,
      row.hlc_counter,
      row.supersedes_id,
      row.supersedes_deleted,
      row.signature,
      row.updated_at,
    ],
  );
}

function listEvents(db: DatabaseAdapter, communityId: string, channelId: string): ChannelMessageEvent[] {
  return db.query<ChannelMessageRow>(
    `SELECT id, community_id, channel_id, author_device_id, body,
       hlc_wall, hlc_counter, supersedes_id, supersedes_deleted,
       signature, updated_at
     FROM cm_messages
     WHERE community_id = ? AND channel_id = ?
     ORDER BY hlc_wall, hlc_counter, author_device_id, id`,
    [communityId, channelId],
  ).map(eventFromRow);
}

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;

afterEach(() => {
  dbA?.close();
  dbA = null;
  dbB?.close();
  dbB = null;
});

describe('channel chat live session (MK-051)', () => {
  it('does not send personal read state over a shared community session', async () => {
    const idA = generateDeviceIdentity('Owner Device');
    const idB = generateDeviceIdentity('Member Device');
    const signed = createCommunity(idA, {
      name: 'Club',
      channels: CHANNELS,
      members: [{ deviceId: idB.publicKey, role: 'member', displayName: idB.displayName }],
      now: '2026-06-13T00:00:00.000Z',
    });
    const communityId = signed.descriptor.communityId;

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    installCommunity(dbA.adapter, signed, idA.publicKey);
    installCommunity(dbB.adapter, signed, idB.publicKey);

    const docA = new LwwDocumentManager();
    const docB = new LwwDocumentManager();
    const ctA = new ChangeTracker({
      db: dbA.adapter,
      deviceId: idA.publicKey,
      modulePrefixes: PREFIXES,
      modulePolicies: POLICIES,
    });
    const ctB = new ChangeTracker({
      db: dbB.adapter,
      deviceId: idB.publicKey,
      modulePrefixes: PREFIXES,
      modulePolicies: POLICIES,
    });
    insertLocalReadState(dbA.adapter, docA, ctA, {
      id: `${communityId}:general`,
      community_id: communityId,
      channel_id: 'general',
      last_read_wall: '2026-06-13T00:00:01.000Z',
      last_read_counter: 0,
      updated_at: '2026-06-13T00:00:02.000Z',
    });

    const { connA, connB } = connectionPair(idA.publicKey, idB.publicKey);
    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, {
        db: dbA.adapter,
        identity: idA,
        pairedDevices: [paired(idB.publicKey, idB.dhPublicKey)],
        documentManager: docA as unknown as DocumentManager,
        changeTracker: ctA,
        enabledModules: [COMMUNITY_MODULE_ID],
        modulePolicies: POLICIES,
        transport: 'wan_relay',
        workspaceId: communityId,
      }),
      runResponderSession(connB, {
        db: dbB.adapter,
        identity: idB,
        pairedDevices: [paired(idA.publicKey, idA.dhPublicKey)],
        documentManager: docB as unknown as DocumentManager,
        changeTracker: ctB,
        enabledModules: [COMMUNITY_MODULE_ID],
        modulePolicies: POLICIES,
        transport: 'wan_relay',
        workspaceId: communityId,
      }),
    ]);

    expect(initiator.session.status).toBe('completed');
    expect(responder.session.status).toBe('completed');
    expect(dbB.adapter.query('SELECT * FROM cm_read_state')).toHaveLength(0);
    expect(getInboundAudit(dbB.adapter, { outcome: 'rejected' })
      .filter((row) => row.tableName === 'cm_read_state')).toHaveLength(0);
    expect(ctA.getUnsyncedByModule(COMMUNITY_MODULE_ID)
      .some((change) => change.tableName === 'cm_read_state')).toBe(true);
  });

  it('parks offline channel messages in the v2 mailbox and drains them in order on reconnect', async () => {
    const idA = generateDeviceIdentity('Owner Device');
    const idB = generateDeviceIdentity('Member Device');
    const signed = createCommunity(idA, {
      name: 'Club',
      channels: CHANNELS,
      members: [{ deviceId: idB.publicKey, role: 'member', displayName: idB.displayName }],
      now: '2026-06-13T00:00:00.000Z',
    });
    const communityId = signed.descriptor.communityId;

    dbB = createInMemoryTestDatabase();
    installCommunity(dbB.adapter, signed, idB.publicKey);

    const first = createChannelMessage(idA, {
      communityId,
      channelId: 'general',
      body: 'offline one',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
    });
    const second = createChannelMessage(idA, {
      communityId,
      channelId: 'general',
      body: 'offline two',
      hlc: { wall: '2026-06-13T00:00:02.000Z', counter: 0 },
    });
    const third = createChannelMessage(idA, {
      communityId,
      channelId: 'general',
      body: 'offline three',
      hlc: { wall: '2026-06-13T00:00:03.000Z', counter: 0 },
    });

    const sealed = sealChannelMessageMailboxDelta({
      sender: idA,
      recipient: { deviceId: idB.publicKey, dhPublicKey: idB.dhPublicKey },
      pairSharedSecretHex: SECRET,
      communityId,
      channelId: 'general',
      events: [third, first, second],
      now: '2026-06-13T00:00:04.000Z',
    });

    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.token).toBe(deriveMailboxToken(SECRET, idB.publicKey, Date.parse('2026-06-13T00:00:04.000Z')));

    const wire = encodeMailboxEnvelope(sealed.envelope);
    const wireText = new TextDecoder().decode(wire);
    expect(wireText).not.toContain(idA.publicKey);
    expect(wireText).not.toContain(idB.publicKey);
    expect(wireText).not.toContain(communityId);
    expect(wireText).not.toContain('general');
    expect(wireText).not.toContain('offline one');

    const decoded = decodeMailboxEnvelope(wire);
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    const opened = openChannelMessageMailboxDelta(idB, decoded);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.senderDeviceId).toBe(idA.publicKey);
    expect(opened.createdAt).toBe('2026-06-13T00:00:04.000Z');
    expect(opened.events.map((event) => event.body)).toEqual(['offline one', 'offline two', 'offline three']);

    for (const event of opened.events) insertReceivedMessage(dbB.adapter, event);
    expect(listEvents(dbB.adapter, communityId, 'general').map((event) => event.body))
      .toEqual(['offline one', 'offline two', 'offline three']);
  });

  it('syncs signed channel messages and rejects role-denied posts at apply', async () => {
    const idA = generateDeviceIdentity('Owner Device');
    const idB = generateDeviceIdentity('Member Device');
    const signed = createCommunity(idA, {
      name: 'Club',
      channels: CHANNELS,
      members: [{ deviceId: idB.publicKey, role: 'member', displayName: idB.displayName }],
      now: '2026-06-13T00:00:00.000Z',
    });
    const communityId = signed.descriptor.communityId;

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    installCommunity(dbA.adapter, signed, idA.publicKey);
    installCommunity(dbB.adapter, signed, idB.publicKey);

    const docA = new LwwDocumentManager();
    const docB = new LwwDocumentManager();
    const ctA = new ChangeTracker({
      db: dbA.adapter,
      deviceId: idA.publicKey,
      modulePrefixes: PREFIXES,
      modulePolicies: POLICIES,
    });
    const ctB = new ChangeTracker({
      db: dbB.adapter,
      deviceId: idB.publicKey,
      modulePrefixes: PREFIXES,
      modulePolicies: POLICIES,
    });

    const draft = createChannelMessage(idA, {
      communityId,
      channelId: 'general',
      body: 'draft',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
    });
    const edited = createChannelMessage(idA, {
      communityId,
      channelId: 'general',
      body: 'final',
      hlc: { wall: '2026-06-13T00:00:02.000Z', counter: 0 },
      supersedes: { id: draft.id, deleted: false },
    });
    const second = createChannelMessage(idA, {
      communityId,
      channelId: 'general',
      body: 'second',
      hlc: { wall: '2026-06-13T00:00:03.000Z', counter: 0 },
    });
    insertLocalMessage(dbA.adapter, docA, ctA, second);
    insertLocalMessage(dbA.adapter, docA, ctA, draft);
    insertLocalMessage(dbA.adapter, docA, ctA, edited);

    const runAtoB = async () => {
      const { connA, connB } = connectionPair(idA.publicKey, idB.publicKey);
      const [initiator, responder] = await Promise.all([
        runInitiatorSession(connA, {
          db: dbA!.adapter,
          identity: idA,
          pairedDevices: [paired(idB.publicKey, idB.dhPublicKey)],
          documentManager: docA as unknown as DocumentManager,
          changeTracker: ctA,
          enabledModules: [COMMUNITY_MODULE_ID],
          modulePolicies: POLICIES,
          transport: 'wan_relay',
          workspaceId: communityId,
        }),
        runResponderSession(connB, {
          db: dbB!.adapter,
          identity: idB,
          pairedDevices: [paired(idA.publicKey, idA.dhPublicKey)],
          documentManager: docB as unknown as DocumentManager,
          changeTracker: ctB,
          enabledModules: [COMMUNITY_MODULE_ID],
          modulePolicies: POLICIES,
          transport: 'wan_relay',
          workspaceId: communityId,
        }),
      ]);
      expect(initiator.session.status).toBe('completed');
      expect(responder.session.status).toBe('completed');
    };

    await runAtoB();

    const bGeneral = listEvents(dbB.adapter, communityId, 'general');
    expect(bGeneral.map((event) => event.body)).toEqual(['draft', 'final', 'second']);
    expect(resolveChannelMessages(bGeneral).map((event) => event.body)).toEqual(['final', 'second']);
    expect(getInboundAudit(dbB.adapter, { outcome: 'rejected' })).toHaveLength(0);

    const deleted = createChannelMessage(idA, {
      communityId,
      channelId: 'general',
      body: '',
      hlc: { wall: '2026-06-13T00:00:04.000Z', counter: 0 },
      supersedes: { id: edited.id, deleted: true },
    });
    insertLocalMessage(dbA.adapter, docA, ctA, deleted);
    await runAtoB();
    expect(resolveChannelMessages(listEvents(dbB.adapter, communityId, 'general')).map((event) => event.body))
      .toEqual(['second']);

    const denied = createChannelMessage(idB, {
      communityId,
      channelId: 'announcements',
      body: 'members cannot post here',
      hlc: { wall: '2026-06-13T00:00:05.000Z', counter: 0 },
    });
    insertLocalMessage(dbB.adapter, docB, ctB, denied);

    const { connA, connB } = connectionPair(idB.publicKey, idA.publicKey);
    await Promise.all([
      runInitiatorSession(connA, {
        db: dbB.adapter,
        identity: idB,
        pairedDevices: [paired(idA.publicKey, idA.dhPublicKey)],
        documentManager: docB as unknown as DocumentManager,
        changeTracker: ctB,
        enabledModules: [COMMUNITY_MODULE_ID],
        modulePolicies: POLICIES,
        transport: 'wan_relay',
        workspaceId: communityId,
      }),
      runResponderSession(connB, {
        db: dbA.adapter,
        identity: idA,
        pairedDevices: [paired(idB.publicKey, idB.dhPublicKey)],
        documentManager: docA as unknown as DocumentManager,
        changeTracker: ctA,
        enabledModules: [COMMUNITY_MODULE_ID],
        modulePolicies: POLICIES,
        transport: 'wan_relay',
        workspaceId: communityId,
      }),
    ]);

    expect(dbA.adapter.query('SELECT * FROM cm_messages WHERE id = ?', [denied.id])).toHaveLength(0);
    const rejected = getInboundAudit(dbA.adapter, { outcome: 'rejected' });
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBe('channel_role_denied');
    expect(rejected[0]!.tableName).toBe('cm_messages');
    expect(rejected[0]!.rowId).toBe(denied.id);
  });
});
