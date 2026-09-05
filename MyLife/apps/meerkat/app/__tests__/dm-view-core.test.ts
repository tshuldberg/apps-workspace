// Plan 21 Phase 5: the pure DM view-model helpers (dm-view-core.ts). Node-only:
// mapping, honest delivery labels, list rows, receipts-to-emit, and the
// ensureDirectConversation composition against an in-memory db.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createDmMessage,
  dmConversationId,
  generateDeviceIdentity,
  type DeviceIdentity,
  type Hlc,
} from '@mylife/sync';
import {
  buildDmListRow,
  computeDmReceiptsToEmit,
  dmDeliveryLabel,
  dmListChipLabel,
  dmRetryAvailable,
  DM_NOT_SENT_NO_RELAY,
  DM_NOT_SENT_UNREACHABLE,
  ensureDirectConversation,
  mapDmEventToKit,
  shouldStartDmRetry,
  sortDmListRows,
  summarizeDmDelivery,
} from '../(root)/data/dm-view-core';
import {
  getDmConversation,
  listDmParticipants,
  setDmConversationArchived,
  type DmDeliveryRow,
  type DmDeliveryState,
} from '../(root)/data/dm-core';

function delivery(state: DmDeliveryState, at = '2026-07-03T10:00:00.000Z', peer = 'p'): DmDeliveryRow {
  return { message_id: 'm', peer_device_id: peer, state, state_at: at, receipt_sig: state === 'delivered' || state === 'read' ? 'sig' : null };
}

function hlc(wall: string, counter = 0): Hlc {
  return { wall, counter };
}

// The DM has no linked own devices in these fixtures. summarizeDmDelivery now
// REQUIRES an explicit ownDeviceIds set (no fail-open default), so pass this.
const NO_OWN: ReadonlySet<string> = new Set();

let identity: DeviceIdentity;
let peer: DeviceIdentity;

beforeEach(() => {
  identity = generateDeviceIdentity('Me');
  peer = generateDeviceIdentity('Peer');
});

describe('mapDmEventToKit', () => {
  it('maps a stored event to a sent kit message with mine/edited flags', () => {
    const mine = createDmMessage(identity, { conversationId: 'c', body: 'hi', hlc: hlc('2026-07-03T10:00:00.000Z') });
    const kit = mapDmEventToKit(mine, identity.publicKey);
    expect(kit).toMatchObject({ id: mine.id, body: 'hi', isMine: true, status: 'sent', edited: false, replyTo: null });

    const theirs = createDmMessage(peer, { conversationId: 'c', body: 'yo', hlc: hlc('2026-07-03T10:01:00.000Z') });
    expect(mapDmEventToKit(theirs, identity.publicKey).isMine).toBe(false);
  });
});

describe('summarizeDmDelivery', () => {
  it('no rows means still sending', () => {
    expect(summarizeDmDelivery([], 'direct', NO_OWN).state).toBe('sending');
  });
  it('queued-only rows read as not_sent', () => {
    expect(summarizeDmDelivery([delivery('queued')], 'direct', NO_OWN).state).toBe('not_sent');
  });
  it('parked reads as sent', () => {
    expect(summarizeDmDelivery([delivery('parked')], 'direct', NO_OWN).state).toBe('sent');
  });
  it('delivered/read carry the strongest state and a wall time', () => {
    const d = summarizeDmDelivery([delivery('delivered', '2026-07-03T10:05:00.000Z')], 'direct', NO_OWN);
    expect(d.state).toBe('delivered');
    expect(d.atWall).toBe('2026-07-03T10:05:00.000Z');
    const r = summarizeDmDelivery([delivery('read', '2026-07-03T10:06:00.000Z')], 'direct', NO_OWN);
    expect(r.state).toBe('read');
  });
  it('group counts fold monotonically (read implies delivered implies parked)', () => {
    const s = summarizeDmDelivery(
      [delivery('read', '10', 'a'), delivery('delivered', '10', 'b'), delivery('parked', '10', 'c'), delivery('queued', '10', 'd')],
      'group',
      NO_OWN,
    );
    expect(s).toMatchObject({ recipients: 4, parked: 3, delivered: 2, read: 1 });
  });
});

describe('summarizeDmDelivery own-device exclusion (Plan 21 Phase 10 item 5)', () => {
  it('excludes my own linked devices from group recipient/delivered/read counts', () => {
    const rows = [
      delivery('read', '10', 'own'), // my own mirror device read it
      delivery('delivered', '10', 'p1'),
      delivery('parked', '10', 'p2'),
    ];
    expect(summarizeDmDelivery(rows, 'group', NO_OWN)).toMatchObject({ recipients: 3, parked: 3, delivered: 2, read: 1 });
    expect(summarizeDmDelivery(rows, 'group', new Set(['own']))).toMatchObject({
      recipients: 2, parked: 2, delivered: 1, read: 0,
    });
  });

  it('a group "Read by" count never includes my own mirror device', () => {
    const rows = [delivery('read', '10', 'own'), delivery('parked', '10', 'p1')];
    const s = summarizeDmDelivery(rows, 'group', new Set(['own']));
    // Only the real other member counts: no "Read by 1" from my own device.
    expect(dmDeliveryLabel(s, 'group', { relayConfigured: true })).toBe('Sent to 1');
  });

  it('excludes an own-device delivery row in a 1:1 too (the D2->D1 receipt is real, not a no-op)', () => {
    // A linked own device (D2) acked my 1:1 message, creating a real own-device
    // delivery row. It must not fabricate a "Delivered" for the direct thread.
    const rows = [delivery('read', '10', 'ownD2')];
    expect(summarizeDmDelivery(rows, 'direct', NO_OWN).state).toBe('read');
    expect(summarizeDmDelivery(rows, 'direct', new Set(['ownD2'])).state).toBe('sending');
  });
});

describe('dmRetryAvailable (Plan 21 Phase 10 item 3)', () => {
  it('offers retry only for my own fully not-sent message', () => {
    const notSent = summarizeDmDelivery([delivery('queued')], 'direct', NO_OWN);
    expect(dmRetryAvailable(notSent, true)).toBe(true);
    expect(dmRetryAvailable(notSent, false)).toBe(false); // never on a peer message
  });

  it('never offers retry while sending, or once at least one park landed', () => {
    expect(dmRetryAvailable(summarizeDmDelivery([], 'direct', NO_OWN), true)).toBe(false); // sending, no rows yet
    expect(dmRetryAvailable(summarizeDmDelivery([delivery('parked')], 'direct', NO_OWN), true)).toBe(false); // sent
    expect(dmRetryAvailable(summarizeDmDelivery([delivery('delivered')], 'direct', NO_OWN), true)).toBe(false);
    expect(dmRetryAvailable(summarizeDmDelivery([delivery('read')], 'direct', NO_OWN), true)).toBe(false);
  });
});

describe('shouldStartDmRetry (Plan 21 Phase 10 Fix 2, re-entrancy guard)', () => {
  it('starts a retry only when none is in flight', () => {
    expect(shouldStartDmRetry(false)).toBe(true);
    expect(shouldStartDmRetry(true)).toBe(false); // a second tap while one is in flight is a no-op
  });
});

describe('dmDeliveryLabel', () => {
  it('direct labels are the honest copy', () => {
    expect(dmDeliveryLabel(summarizeDmDelivery([], 'direct', NO_OWN), 'direct', { relayConfigured: true })).toBe('Sending…');
    expect(dmDeliveryLabel(summarizeDmDelivery([delivery('parked')], 'direct', NO_OWN), 'direct', { relayConfigured: true })).toBe('Sent');
    expect(dmDeliveryLabel(summarizeDmDelivery([delivery('queued')], 'direct', NO_OWN), 'direct', { relayConfigured: false })).toBe(DM_NOT_SENT_NO_RELAY);
    expect(dmDeliveryLabel(summarizeDmDelivery([delivery('queued')], 'direct', NO_OWN), 'direct', { relayConfigured: true })).toBe(DM_NOT_SENT_UNREACHABLE);
    expect(dmDeliveryLabel(summarizeDmDelivery([delivery('delivered', '2026-07-03T14:32:00.000Z')], 'direct', NO_OWN), 'direct', { relayConfigured: true })).toMatch(/^Delivered /);
    expect(dmDeliveryLabel(summarizeDmDelivery([delivery('read', '2026-07-03T14:35:00.000Z')], 'direct', NO_OWN), 'direct', { relayConfigured: true })).toMatch(/^Read /);
  });
  it('group aggregate shows only real non-zero segments', () => {
    const s = summarizeDmDelivery(
      [delivery('read', '10', 'a'), delivery('delivered', '10', 'b'), delivery('delivered', '10', 'c'), delivery('parked', '10', 'd'), delivery('parked', '10', 'e')],
      'group',
      NO_OWN,
    );
    expect(dmDeliveryLabel(s, 'group', { relayConfigured: true })).toBe('Sent to 5 · Delivered to 3 · Read by 1');
    const none = summarizeDmDelivery([delivery('queued', '10', 'a')], 'group', NO_OWN);
    expect(dmDeliveryLabel(none, 'group', { relayConfigured: false })).toBe(DM_NOT_SENT_NO_RELAY);
  });
});

describe('dmListChipLabel', () => {
  it('short chip per state', () => {
    expect(dmListChipLabel(summarizeDmDelivery([delivery('parked')], 'direct', NO_OWN))).toBe('Sent');
    expect(dmListChipLabel(summarizeDmDelivery([delivery('read')], 'direct', NO_OWN))).toBe('Read');
    expect(dmListChipLabel(summarizeDmDelivery([delivery('queued')], 'direct', NO_OWN))).toBe('Not sent');
  });
});

describe('buildDmListRow / sortDmListRows', () => {
  it('direct row uses the peer name and only chips my own last message', () => {
    const theirLast = createDmMessage(peer, { conversationId: 'c', body: 'ping', hlc: hlc('2026-07-03T10:00:00.000Z') });
    const theirRow = buildDmListRow({
      conversationId: 'c', kind: 'direct', title: null, updatedAt: '2026-07-03T10:00:00.000Z',
      selfDeviceId: identity.publicKey, peerName: 'Ana', lastMessage: theirLast, lastDelivery: [],
      ownDeviceIds: NO_OWN, unreadCount: 2, memberCount: null, relayConfigured: true,
    });
    expect(theirRow.title).toBe('Ana');
    expect(theirRow.subtitle).toBe('ping');
    expect(theirRow.unreadCount).toBe(2);
    expect(theirRow.chip).toBeNull();

    const myLast = createDmMessage(identity, { conversationId: 'c', body: 'pong', hlc: hlc('2026-07-03T10:01:00.000Z') });
    const myRow = buildDmListRow({
      conversationId: 'c', kind: 'direct', title: null, updatedAt: '2026-07-03T10:01:00.000Z',
      selfDeviceId: identity.publicKey, peerName: 'Ana', lastMessage: myLast, lastDelivery: [delivery('parked')],
      ownDeviceIds: NO_OWN, unreadCount: 0, memberCount: null, relayConfigured: true,
    });
    expect(myRow.chip).toBe('Sent');
  });

  it('empty conversation reads "No messages yet"', () => {
    const row = buildDmListRow({
      conversationId: 'c', kind: 'group', title: 'Trip', updatedAt: '2026-07-03T09:00:00.000Z',
      selfDeviceId: identity.publicKey, peerName: '', lastMessage: null, lastDelivery: [],
      ownDeviceIds: NO_OWN, unreadCount: 0, memberCount: 3, relayConfigured: true,
    });
    expect(row.title).toBe('Trip');
    expect(row.subtitle).toBe('No messages yet');
    expect(row.isGroup).toBe(true);
  });

  it('sorts newest activity first', () => {
    const rows = sortDmListRows([
      { id: 'a', kind: 'direct', title: 'A', subtitle: '', unreadCount: 0, lastActivityWall: '2026-07-03T09:00:00.000Z', isGroup: false, memberCount: null, chip: null },
      { id: 'b', kind: 'direct', title: 'B', subtitle: '', unreadCount: 0, lastActivityWall: '2026-07-03T11:00:00.000Z', isGroup: false, memberCount: null, chip: null },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('computeDmReceiptsToEmit', () => {
  it('emits one read receipt per newly-seen peer message and advances the marker', () => {
    const m1 = createDmMessage(peer, { conversationId: 'c', body: 'a', hlc: hlc('2026-07-03T10:00:00.000Z') });
    const m2 = createDmMessage(peer, { conversationId: 'c', body: 'b', hlc: hlc('2026-07-03T10:01:00.000Z') });
    const mine = createDmMessage(identity, { conversationId: 'c', body: 'c', hlc: hlc('2026-07-03T10:02:00.000Z') });
    const result = computeDmReceiptsToEmit([m1, m2, mine], identity.publicKey, hlc(''), true);
    expect(result.toEmit).toEqual([
      { messageId: m1.id, state: 'read' },
      { messageId: m2.id, state: 'read' },
    ]);
    expect(result.nextLastRead).toEqual(hlc('2026-07-03T10:02:00.000Z'));
  });

  it('emits delivered (never read) when read receipts are disabled (NC-5)', () => {
    const m1 = createDmMessage(peer, { conversationId: 'c', body: 'a', hlc: hlc('2026-07-03T10:00:00.000Z') });
    const result = computeDmReceiptsToEmit([m1], identity.publicKey, hlc(''), false);
    expect(result.toEmit).toEqual([{ messageId: m1.id, state: 'delivered' }]);
  });

  it('re-focus with nothing new emits nothing', () => {
    const m1 = createDmMessage(peer, { conversationId: 'c', body: 'a', hlc: hlc('2026-07-03T10:00:00.000Z') });
    const result = computeDmReceiptsToEmit([m1], identity.publicKey, hlc('2026-07-03T10:00:00.000Z', 0), true);
    expect(result.toEmit).toEqual([]);
    expect(result.nextLastRead).toBeNull();
  });

  it('never emits a receipt for a message authored by my OWN linked device, but still advances the marker (Fix 1)', () => {
    const ownLaptop = generateDeviceIdentity('MyLaptop');
    const m1 = createDmMessage(ownLaptop, { conversationId: 'c', body: 'mirrored from my laptop', hlc: hlc('2026-07-03T10:00:00.000Z') });
    const m2 = createDmMessage(peer, { conversationId: 'c', body: 'from peer', hlc: hlc('2026-07-03T10:01:00.000Z') });
    const ownIds = new Set([ownLaptop.publicKey]);
    const result = computeDmReceiptsToEmit(
      [m1, m2],
      identity.publicKey,
      hlc(''),
      true,
      () => false, // isBlocked
      (deviceId) => ownIds.has(deviceId), // isOwnDevice
    );
    // Only the real peer message emits; my own device's mirrored message emits nothing.
    expect(result.toEmit).toEqual([{ messageId: m2.id, state: 'read' }]);
    // The read marker still advances past both (unread clears locally).
    expect(result.nextLastRead).toEqual(hlc('2026-07-03T10:01:00.000Z'));
  });

  it('never parks a receipt to a blocked author, but still advances the read marker', () => {
    const blocked = generateDeviceIdentity('Blocked');
    const m1 = createDmMessage(blocked, { conversationId: 'c', body: 'a', hlc: hlc('2026-07-03T10:00:00.000Z') });
    const m2 = createDmMessage(peer, { conversationId: 'c', body: 'b', hlc: hlc('2026-07-03T10:01:00.000Z') });
    const result = computeDmReceiptsToEmit(
      [m1, m2],
      identity.publicKey,
      hlc(''),
      true,
      (deviceId) => deviceId === blocked.publicKey,
    );
    // Only the non-blocked peer's message emits a receipt; the blocked author gets none.
    expect(result.toEmit).toEqual([{ messageId: m2.id, state: 'read' }]);
    // The read marker still advances past both (unread clears locally).
    expect(result.nextLastRead).toEqual(hlc('2026-07-03T10:01:00.000Z'));
  });
});

describe('ensureDirectConversation', () => {
  let db: InMemoryTestDatabase;
  beforeEach(() => { db = createInMemoryTestDatabase(); });
  afterEach(() => { db.close(); });

  it('creates the deterministic conversation id + self and peer participants', () => {
    const id = ensureDirectConversation(db.adapter, identity, { deviceId: peer.publicKey, dhPublicKey: peer.dhPublicKey });
    expect(id).toBe(dmConversationId(identity.publicKey, peer.publicKey));

    const conv = getDmConversation(db.adapter, id);
    expect(conv?.kind).toBe('direct');

    const participants = listDmParticipants(db.adapter, id);
    const self = participants.find((p) => p.device_id === identity.publicKey);
    const other = participants.find((p) => p.device_id === peer.publicKey);
    expect(self?.is_self).toBe(1);
    expect(other?.is_self).toBe(0);
    expect(other?.dh_public_key).toBe(peer.dhPublicKey);
  });

  it('is idempotent and reopens an archived conversation', () => {
    const id = ensureDirectConversation(db.adapter, identity, { deviceId: peer.publicKey, dhPublicKey: peer.dhPublicKey });
    setDmConversationArchived(db.adapter, id, true);
    ensureDirectConversation(db.adapter, identity, { deviceId: peer.publicKey, dhPublicKey: peer.dhPublicKey });
    expect(getDmConversation(db.adapter, id)?.archived).toBe(0);
    expect(listDmParticipants(db.adapter, id)).toHaveLength(2);
  });
});
