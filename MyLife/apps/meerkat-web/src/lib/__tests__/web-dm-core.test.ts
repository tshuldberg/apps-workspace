// Plan 21 Phase 9 (WEB twin of apps/meerkat/app/__tests__/dm-core.test.ts):
// the device-local DM store (dm-core.ts) on the browser DatabaseAdapter seam.
//
// dm_ tables are LOCAL-ONLY by deliberate omission from MEERKAT_SYNC_PREFIXES /
// MEERKAT_SYNC_POLICIES (meerkat-data.ts). DM confidentiality comes from the
// mailbox seal in flight + the platform secure store at rest, not from session
// replication. The last describe block proves that omission holds by running a
// dm_ table name through the real ChangeTracker module resolver (NC-1a): it
// resolves to NO module, so applyReceivedDocumentChanges (proven against the
// shared engine in the mobile twin) rejects any inbound dm_ row fail-closed.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  ChangeTracker,
  createDmMessage,
  generateDeviceIdentity,
  type DeviceIdentity,
  type DmMessageEvent,
  type Hlc,
} from '@mylife/sync';
import {
  MEERKAT_SYNC_PREFIXES,
  MEERKAT_SYNC_POLICIES,
} from '../meerkat-data';
import {
  ensureDmTables,
  getDmConversation,
  getDmDelivery,
  getDmReadState,
  getDmUnreadCount,
  listDmConversations,
  listDmMessages,
  listDmOwnDevices,
  listDmParticipants,
  listDmReports,
  mergeDmEvents,
  recordDmReport,
  resolveOwnDeviceMirrorTargets,
  setDmConversationArchived,
  setDmConversationFeedOptIn,
  setDmConversationMuted,
  setDmDelivery,
  setDmParticipantRemoved,
  setDmReadReceiptsEnabled,
  setDmReadState,
  upsertDmConversation,
  upsertDmOwnDevice,
  upsertDmParticipant,
  type DmConversationRow,
  type DmParticipantRow,
} from '../dm-core';

let db: InMemoryTestDatabase;

beforeEach(() => {
  db = createInMemoryTestDatabase();
});

afterEach(() => {
  db.close();
});

function hlc(wall: string, counter = 0): Hlc {
  return { wall, counter };
}

function conversationRow(id: string, now = '2026-06-30T00:00:00.000Z'): DmConversationRow {
  return {
    id,
    kind: 'direct',
    title: null,
    group_workspace_id: null,
    admin_device_id: null,
    current_epoch: 0,
    descriptor_json: null,
    feed_opt_in: 0,
    archived: 0,
    muted: 0,
    created_at: now,
    updated_at: now,
  };
}

function participantRow(
  conversationId: string,
  identity: DeviceIdentity,
  overrides: Partial<DmParticipantRow> = {},
): DmParticipantRow {
  return {
    conversation_id: conversationId,
    device_id: identity.publicKey,
    identity_anchor: identity.publicKey,
    is_self: 0,
    role: 'member',
    dh_public_key: identity.dhPublicKey,
    joined_at: '2026-06-30T00:00:00.000Z',
    removed_at: null,
    ...overrides,
  };
}

function makeEvent(
  author: DeviceIdentity,
  conversationId: string,
  body: string,
  wall: string,
  counter = 0,
  extra: Partial<Parameters<typeof createDmMessage>[1]> = {},
): DmMessageEvent {
  return createDmMessage(author, {
    conversationId,
    body,
    hlc: hlc(wall, counter),
    ...extra,
  });
}

describe('ensureDmTables (web)', () => {
  it('is idempotent and creates the local-only dm_ schema', () => {
    ensureDmTables(db.adapter);
    ensureDmTables(db.adapter); // second run must not throw

    const tables = db.adapter
      .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((r) => r.name);
    expect(tables).toContain('dm_conversations');
    expect(tables).toContain('dm_participants');
    expect(tables).toContain('dm_own_devices');
    expect(tables).toContain('dm_messages');
    expect(tables).toContain('dm_message_attachments');
    expect(tables).toContain('dm_delivery');
    expect(tables).toContain('dm_read_state');
    expect(tables).toContain('dm_reports');

    const ownDeviceCols = db.adapter
      .query<{ name: string }>('PRAGMA table_info(dm_own_devices)')
      .map((c) => c.name);
    expect(ownDeviceCols).toEqual(
      expect.arrayContaining(['device_id', 'identity_anchor', 'dh_public_key', 'linked_at']),
    );

    const participantCols = db.adapter
      .query<{ name: string }>('PRAGMA table_info(dm_participants)')
      .map((c) => c.name);
    expect(participantCols).toEqual(
      expect.arrayContaining(['conversation_id', 'device_id', 'identity_anchor', 'is_self', 'role']),
    );
  });
});

describe('conversation CRUD (web)', () => {
  beforeEach(() => ensureDmTables(db.adapter));

  it('round-trips a conversation and lists it newest-updated-first, excluding archived by default', () => {
    expect(getDmConversation(db.adapter, 'c1')).toBeNull();

    upsertDmConversation(db.adapter, conversationRow('c1', '2026-06-30T00:00:00.000Z'));
    upsertDmConversation(db.adapter, conversationRow('c2', '2026-06-30T01:00:00.000Z'));

    expect(getDmConversation(db.adapter, 'c1')?.id).toBe('c1');
    expect(listDmConversations(db.adapter).map((c) => c.id)).toEqual(['c2', 'c1']);

    setDmConversationArchived(db.adapter, 'c1', true);
    expect(listDmConversations(db.adapter).map((c) => c.id)).toEqual(['c2']);
    expect(listDmConversations(db.adapter, { includeArchived: true }).map((c) => c.id).sort())
      .toEqual(['c1', 'c2']);

    setDmConversationMuted(db.adapter, 'c2', true);
    expect(getDmConversation(db.adapter, 'c2')?.muted).toBe(1);

    setDmConversationFeedOptIn(db.adapter, 'c2', true);
    expect(getDmConversation(db.adapter, 'c2')?.feed_opt_in).toBe(1);
  });
});

describe('participants + own devices (web)', () => {
  beforeEach(() => ensureDmTables(db.adapter));

  it('lists only active participants by default, and reflects removal', () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    upsertDmConversation(db.adapter, conversationRow('c1'));
    upsertDmParticipant(db.adapter, participantRow('c1', alice, { is_self: 1 }));
    upsertDmParticipant(db.adapter, participantRow('c1', bob));

    expect(listDmParticipants(db.adapter, 'c1').map((p) => p.device_id).sort())
      .toEqual([alice.publicKey, bob.publicKey].sort());

    setDmParticipantRemoved(db.adapter, 'c1', bob.publicKey, '2026-06-30T02:00:00.000Z');
    expect(listDmParticipants(db.adapter, 'c1').map((p) => p.device_id)).toEqual([alice.publicKey]);
  });

  it('own-device fan-out target list excludes self and includes other own devices', () => {
    const primary = generateDeviceIdentity('Primary Phone');
    const laptop = generateDeviceIdentity('Laptop');
    const tablet = generateDeviceIdentity('Tablet');

    upsertDmOwnDevice(db.adapter, {
      device_id: primary.publicKey, identity_anchor: primary.publicKey,
      dh_public_key: primary.dhPublicKey, linked_at: '2026-06-30T00:00:00.000Z',
    });
    upsertDmOwnDevice(db.adapter, {
      device_id: laptop.publicKey, identity_anchor: primary.publicKey,
      dh_public_key: laptop.dhPublicKey, linked_at: '2026-06-30T00:01:00.000Z',
    });
    upsertDmOwnDevice(db.adapter, {
      device_id: tablet.publicKey, identity_anchor: primary.publicKey,
      dh_public_key: tablet.dhPublicKey, linked_at: '2026-06-30T00:02:00.000Z',
    });

    expect(listDmOwnDevices(db.adapter)).toHaveLength(3);

    const targets = resolveOwnDeviceMirrorTargets(db.adapter, primary.publicKey);
    expect(targets.map((t) => t.device_id).sort()).toEqual([laptop.publicKey, tablet.publicKey].sort());
    expect(targets.some((t) => t.device_id === primary.publicKey)).toBe(false);
  });
});

describe('mergeDmEvents (web)', () => {
  beforeEach(() => ensureDmTables(db.adapter));

  it('is idempotent on event id: merging the same event twice yields one row', () => {
    const alice = generateDeviceIdentity('Alice');
    const event = makeEvent(alice, 'c1', 'hello', '2026-06-30T00:00:00.000Z');

    const first = mergeDmEvents(db.adapter, 'c1', [event]);
    expect(first).toEqual({ inserted: 1, skipped: 0, invalid: 0 });

    const second = mergeDmEvents(db.adapter, 'c1', [event]);
    expect(second).toEqual({ inserted: 0, skipped: 1, invalid: 0 });

    expect(listDmMessages(db.adapter, 'c1')).toHaveLength(1);
  });

  it('drops a bad-signature event (fail-closed) and does not store it', () => {
    const alice = generateDeviceIdentity('Alice');
    const event = makeEvent(alice, 'c1', 'hello', '2026-06-30T00:00:00.000Z');
    const tampered: DmMessageEvent = { ...event, body: 'tampered body' };

    const result = mergeDmEvents(db.adapter, 'c1', [tampered]);
    expect(result).toEqual({ inserted: 0, skipped: 0, invalid: 1 });
    expect(listDmMessages(db.adapter, 'c1')).toHaveLength(0);
  });

  it('touches the conversation updated_at when new events land', () => {
    const alice = generateDeviceIdentity('Alice');
    upsertDmConversation(db.adapter, conversationRow('c1', '2026-06-30T00:00:00.000Z'));
    const event = makeEvent(alice, 'c1', 'hello', '2026-06-30T05:00:00.000Z');

    mergeDmEvents(db.adapter, 'c1', [event]);
    expect(getDmConversation(db.adapter, 'c1')?.updated_at).toBe('2026-06-30T05:00:00.000Z');
  });

  it('merges attachment metadata alongside a message', () => {
    const alice = generateDeviceIdentity('Alice');
    const event = makeEvent(alice, 'c1', 'a photo', '2026-06-30T00:00:00.000Z', 0, {
      attachments: [{ id: 'att1', blobHash: 'hash1', name: 'pic.jpg', mimeType: 'image/jpeg', size: 1024 }],
    });

    mergeDmEvents(db.adapter, 'c1', [event]);
    const rows = db.adapter.query<{ id: string; attachment_id: string }>(
      'SELECT id, attachment_id FROM dm_message_attachments WHERE message_id = ?',
      [event.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.attachment_id).toBe('att1');
  });
});

describe('supersedes resolution (web)', () => {
  beforeEach(() => ensureDmTables(db.adapter));

  it('an edit event replaces the displayed body in the same slot', () => {
    const alice = generateDeviceIdentity('Alice');
    const original = makeEvent(alice, 'c1', 'original body', '2026-06-30T00:00:00.000Z', 0);
    const edit = makeEvent(alice, 'c1', 'edited body', '2026-06-30T00:01:00.000Z', 0, {
      supersedes: { id: original.id, deleted: false },
    });

    mergeDmEvents(db.adapter, 'c1', [original, edit]);
    const visible = listDmMessages(db.adapter, 'c1');
    expect(visible).toHaveLength(1);
    expect(visible[0]!.body).toBe('edited body');
    expect(visible[0]!.id).toBe(edit.id);
  });

  it('a delete event removes the message from the visible list', () => {
    const alice = generateDeviceIdentity('Alice');
    const original = makeEvent(alice, 'c1', 'original body', '2026-06-30T00:00:00.000Z', 0);
    const del = makeEvent(alice, 'c1', '', '2026-06-30T00:01:00.000Z', 0, {
      supersedes: { id: original.id, deleted: true },
    });

    mergeDmEvents(db.adapter, 'c1', [original, del]);
    expect(listDmMessages(db.adapter, 'c1')).toHaveLength(0);
  });
});

describe('dm_delivery transitions (web)', () => {
  beforeEach(() => ensureDmTables(db.adapter));

  it('advances forward through queued -> delivered -> read', () => {
    setDmDelivery(db.adapter, 'm1', 'peer1', 'queued', '2026-06-30T00:00:00.000Z');
    setDmDelivery(db.adapter, 'm1', 'peer1', 'delivered', '2026-06-30T00:01:00.000Z');
    setDmDelivery(db.adapter, 'm1', 'peer1', 'read', '2026-06-30T00:02:00.000Z');

    const rows = getDmDelivery(db.adapter, 'm1');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe('read');
  });

  it('does not regress a read state back to delivered on a stale transition', () => {
    setDmDelivery(db.adapter, 'm1', 'peer1', 'read', '2026-06-30T00:02:00.000Z');
    setDmDelivery(db.adapter, 'm1', 'peer1', 'delivered', '2026-06-30T00:01:00.000Z');

    const rows = getDmDelivery(db.adapter, 'm1');
    expect(rows[0]!.state).toBe('read');
  });

  it('tracks delivery independently per peer device', () => {
    setDmDelivery(db.adapter, 'm1', 'peer1', 'read', '2026-06-30T00:02:00.000Z');
    setDmDelivery(db.adapter, 'm1', 'peer2', 'queued', '2026-06-30T00:00:00.000Z');

    const rows = getDmDelivery(db.adapter, 'm1');
    expect(rows).toHaveLength(2);
    const byPeer = Object.fromEntries(rows.map((r) => [r.peer_device_id, r.state]));
    expect(byPeer.peer1).toBe('read');
    expect(byPeer.peer2).toBe('queued');
  });
});

describe('unread math (web)', () => {
  beforeEach(() => ensureDmTables(db.adapter));

  it('counts peer messages after last-read, excludes own messages, and respects the HLC boundary', () => {
    const self = generateDeviceIdentity('Self');
    const peer = generateDeviceIdentity('Peer');

    const m1 = makeEvent(peer, 'c1', 'from peer, before read', '2026-06-30T00:00:00.000Z', 0);
    const m2 = makeEvent(self, 'c1', 'from self, after read', '2026-06-30T00:02:00.000Z', 0);
    const m3 = makeEvent(peer, 'c1', 'from peer, exactly at boundary', '2026-06-30T00:01:00.000Z', 5);
    const m4 = makeEvent(peer, 'c1', 'from peer, after read', '2026-06-30T00:03:00.000Z', 0);
    mergeDmEvents(db.adapter, 'c1', [m1, m2, m3, m4]);

    expect(getDmUnreadCount(db.adapter, 'c1', self.publicKey)).toBe(3);

    setDmReadState(db.adapter, 'c1', '2026-06-30T00:01:00.000Z', 5);

    expect(getDmUnreadCount(db.adapter, 'c1', self.publicKey)).toBe(1);
  });

  it('read receipts enabled defaults true and toggles', () => {
    expect(getDmReadState(db.adapter, 'c1').read_receipts_enabled).toBe(1);
    setDmReadReceiptsEnabled(db.adapter, 'c1', false);
    expect(getDmReadState(db.adapter, 'c1').read_receipts_enabled).toBe(0);
    setDmReadState(db.adapter, 'c1', '2026-06-30T00:00:00.000Z', 1);
    setDmReadReceiptsEnabled(db.adapter, 'c1', true);
    const state = getDmReadState(db.adapter, 'c1');
    expect(state.last_read_hlc_wall).toBe('2026-06-30T00:00:00.000Z');
    expect(state.read_receipts_enabled).toBe(1);
  });
});

describe('reports (web)', () => {
  beforeEach(() => ensureDmTables(db.adapter));

  it('records and lists reports for a conversation', () => {
    recordDmReport(db.adapter, {
      id: 'r1', conversation_id: 'c1', message_id: 'm1',
      reported_device_id: 'peer1', reason: 'spam', created_at: '2026-06-30T00:00:00.000Z',
    });
    recordDmReport(db.adapter, {
      id: 'r2', conversation_id: 'c1', message_id: null,
      reported_device_id: 'peer1', reason: null, created_at: '2026-06-30T00:01:00.000Z',
    });
    expect(listDmReports(db.adapter, 'c1')).toHaveLength(2);
    recordDmReport(db.adapter, {
      id: 'r1', conversation_id: 'c1', message_id: 'm1',
      reported_device_id: 'peer1', reason: 'spam', created_at: '2026-06-30T00:00:00.000Z',
    });
    expect(listDmReports(db.adapter, 'c1')).toHaveLength(2);
  });
});

describe('LOCAL-ONLY invariant (web): dm_ never replicates', () => {
  it('dm_ tables resolve to NO sync module, so an inbound dm_ row is rejected fail-closed (NC-1a)', () => {
    ensureDmTables(db.adapter);

    const local = generateDeviceIdentity('Local Device');

    const changeTracker = new ChangeTracker({
      db: db.adapter,
      deviceId: local.publicKey,
      modulePrefixes: MEERKAT_SYNC_PREFIXES,
      modulePolicies: MEERKAT_SYNC_POLICIES,
    });

    // The real web MEERKAT_SYNC_PREFIXES map has no 'dm' entry (unlike mp_/cm_/
    // sync_workspace_keys), so every dm_ table resolves to null: applyReceived
    // DocumentChanges (proven against the shared engine in the mobile twin)
    // rejects it with scope device_local and never writes it.
    for (const table of [
      'dm_conversations', 'dm_participants', 'dm_own_devices', 'dm_messages',
      'dm_message_attachments', 'dm_delivery', 'dm_read_state', 'dm_reports',
    ]) {
      expect(changeTracker.resolveModule(table)).toBeNull();
    }

    // Defense in depth: no policy in the map claims a dm_ table either.
    for (const [, policy] of MEERKAT_SYNC_POLICIES) {
      for (const rule of policy.entityRules) {
        expect(rule.tableName.startsWith('dm_')).toBe(false);
      }
    }
  });
});
