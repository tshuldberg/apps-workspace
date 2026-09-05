import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  createChannelMessage,
  verifyChannelMessage,
  nextHlc,
  type ChannelMessageEvent,
} from '../protocol/channel-message';
import {
  compareDmMessages,
  createDmMessage,
  dmConversationId,
  dmMessageId,
  resolveDmMessages,
  verifyDmMessage,
  type DmMessageEvent,
} from '../protocol/dm-message';
import * as dmModule from '../protocol/dm-message';

const author = generateDeviceIdentity('Author');

// A conversation id derived once for the sign/verify suites below.
const cid = dmConversationId(author.publicKey, generateDeviceIdentity('Peer').publicKey);

describe('dm message event (Plan 21 Phase 0-A)', () => {
  it('signs, verifies, and derives a stable content id', () => {
    const message = createDmMessage(author, {
      conversationId: cid,
      body: 'hey there',
      hlc: { wall: '2026-07-01T00:00:00.000Z', counter: 0 },
    });

    expect(message.version).toBe(1);
    expect(message.authorDeviceId).toBe(author.publicKey);
    expect(message.id).toBe(dmMessageId(message));
    expect(verifyDmMessage(message)).toBe(true);
  });

  it('rejects tampering of every signature-covered field', () => {
    const evil = generateDeviceIdentity('Evil');
    const original = createDmMessage(author, {
      conversationId: cid,
      body: 'draft',
      hlc: { wall: '2026-07-01T00:00:00.000Z', counter: 0 },
    });
    // A rich event that carries body, an attachment, hlc, supersedes, AND intent,
    // so we can flip each covered field one at a time.
    const rich = createDmMessage(author, {
      conversationId: cid,
      body: 'final',
      hlc: { wall: '2026-07-01T00:00:01.000Z', counter: 0 },
      intent: 'message',
      attachments: [{
        id: 'att-1',
        blobHash: 'a'.repeat(128),
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 42,
      }],
      supersedes: { id: original.id, deleted: false },
    });

    expect(verifyDmMessage(rich)).toBe(true);
    expect(rich.id).toBe(dmMessageId(rich));

    const tamperBody: DmMessageEvent = { ...rich, body: 'evil' };
    const tamperAuthor: DmMessageEvent = { ...rich, authorDeviceId: evil.publicKey };
    const tamperBlobHash: DmMessageEvent = {
      ...rich,
      attachments: rich.attachments?.map((a) => (
        a.id === 'att-1' ? { ...a, blobHash: 'b'.repeat(128) } : a
      )),
    };
    const tamperHlc: DmMessageEvent = {
      ...rich,
      hlc: { wall: '2026-07-01T09:99:99.000Z', counter: 7 },
    };
    const tamperSupersedes: DmMessageEvent = {
      ...rich,
      supersedes: { id: original.id, deleted: true },
    };
    const tamperIntent: DmMessageEvent = { ...rich, intent: 'react' };

    expect(verifyDmMessage(tamperBody)).toBe(false);
    expect(verifyDmMessage(tamperAuthor)).toBe(false);
    expect(verifyDmMessage(tamperBlobHash)).toBe(false);
    expect(verifyDmMessage(tamperHlc)).toBe(false);
    expect(verifyDmMessage(tamperSupersedes)).toBe(false);
    expect(verifyDmMessage(tamperIntent)).toBe(false);
  });
});

describe('dm conversation id', () => {
  // Derivation contract (byte-identical on mobile + web):
  //   lo, hi   = the two anchors sorted lexicographically (order-independent)
  //   canonical = JSON.stringify(['meerkat-dm-conversation-v1', lo, hi])
  //   id        = sha512Hex(utf8(canonical)).slice(0, 32)
  // A single-device participant's anchor IS its device public key.
  it('is order-independent for a pair of anchors', () => {
    const a = generateDeviceIdentity('A').publicKey;
    const b = generateDeviceIdentity('B').publicKey;
    expect(dmConversationId(a, b)).toBe(dmConversationId(b, a));
  });

  it('produces distinct ids for distinct pairs', () => {
    const a = generateDeviceIdentity('A').publicKey;
    const b = generateDeviceIdentity('B').publicKey;
    const c = generateDeviceIdentity('C').publicKey;
    expect(dmConversationId(a, b)).not.toBe(dmConversationId(a, c));
  });

  it('reduces cleanly for a single-device anchor (anchor === deviceKey)', () => {
    const self = generateDeviceIdentity('Solo').publicKey;
    const id = dmConversationId(self, self);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).toBe(dmConversationId(self, self));
  });

  it('matches a pinned fixed vector so mobile and web derive byte-identical ids', () => {
    const anchorA = 'a'.repeat(64);
    const anchorB = 'b'.repeat(64);
    expect(dmConversationId(anchorA, anchorB)).toBe('26ff7f2581e15a13827ee109df26aa8f');
    expect(dmConversationId(anchorB, anchorA)).toBe('26ff7f2581e15a13827ee109df26aa8f');
  });
});

describe('dm message ordering + resolution', () => {
  it('orders deterministically by wall, counter, author, then id (same-clock two-author tie)', () => {
    const authorB = generateDeviceIdentity('Author B');
    const later = createDmMessage(author, {
      conversationId: cid,
      body: 'later wall',
      hlc: { wall: '2026-07-01T00:00:01.000Z', counter: 0 },
    });
    const firstTie = createDmMessage(author, {
      conversationId: cid,
      body: 'same clock a',
      hlc: { wall: '2026-07-01T00:00:00.000Z', counter: 5 },
    });
    const secondTie = createDmMessage(authorB, {
      conversationId: cid,
      body: 'same clock b',
      hlc: { wall: '2026-07-01T00:00:00.000Z', counter: 5 },
    });

    const sorted = [later, secondTie, firstTie].sort(compareDmMessages);

    // The later wall must sort last.
    expect(sorted[2]).toBe(later);
    // The same-clock tie breaks by authorDeviceId (then id).
    const expectedFirst = firstTie.authorDeviceId < secondTie.authorDeviceId ? firstTie : secondTie;
    expect(sorted[0]).toBe(expectedFirst);
    // Total order is stable.
    expect(sorted.map((m) => m.id)).toEqual(
      [...sorted].sort(compareDmMessages).map((m) => m.id),
    );
  });

  it('resolves edit and delete supersede events without mutating the append log', () => {
    const original = createDmMessage(author, {
      conversationId: cid,
      body: 'draft',
      hlc: { wall: '2026-07-01T00:00:00.000Z', counter: 0 },
    });
    const edited = createDmMessage(author, {
      conversationId: cid,
      body: 'final',
      hlc: { wall: '2026-07-01T00:00:01.000Z', counter: 0 },
      supersedes: { id: original.id, deleted: false },
    });
    const deleted = createDmMessage(author, {
      conversationId: cid,
      body: '',
      hlc: { wall: '2026-07-01T00:00:02.000Z', counter: 0 },
      supersedes: { id: edited.id, deleted: true },
    });

    // Edit keeps the slot with the new body.
    expect(resolveDmMessages([edited, original]).map((m) => m.body)).toEqual(['final']);

    // Delete removes the slot, and the caller's append log is untouched.
    const log = [deleted, original, edited];
    const snapshot = [...log];
    expect(resolveDmMessages(log)).toEqual([]);
    expect(log).toEqual(snapshot);
  });
});

describe('resolveDmMessages author + intent bind (Plan 21 Phase 10 hardening)', () => {
  const at = (s: string): { wall: string; counter: number } => ({
    wall: `2026-07-01T00:00:${s}.000Z`,
    counter: 0,
  });

  it('ignores a cross-author forged tombstone (a participant cannot delete another peer message)', () => {
    const victim = generateDeviceIdentity('Victim');
    const attacker = generateDeviceIdentity('Attacker');
    const cid2 = dmConversationId(victim.publicKey, attacker.publicKey);
    const root = createDmMessage(victim, { conversationId: cid2, body: 'my message', hlc: at('00') });
    const forgedTombstone = createDmMessage(attacker, {
      conversationId: cid2,
      body: '',
      hlc: at('01'),
      supersedes: { id: root.id, deleted: true },
    });
    // The forged tombstone is individually valid (the attacker signed it), but it
    // names the victim's message id: a signed tombstone only proves who authored
    // the TOMBSTONE, not that they may censor the target.
    expect(verifyDmMessage(forgedTombstone)).toBe(true);
    expect(resolveDmMessages([root, forgedTombstone]).map((m) => m.id)).toEqual([root.id]);
  });

  it('ignores a cross-author forged edit (a participant cannot rewrite another peer message)', () => {
    const victim = generateDeviceIdentity('Victim');
    const attacker = generateDeviceIdentity('Attacker');
    const cid2 = dmConversationId(victim.publicKey, attacker.publicKey);
    const root = createDmMessage(victim, { conversationId: cid2, body: 'original', hlc: at('00') });
    const forgedEdit = createDmMessage(attacker, {
      conversationId: cid2,
      body: 'rewritten by attacker',
      hlc: at('01'),
      supersedes: { id: root.id, deleted: false },
    });
    const resolved = resolveDmMessages([root, forgedEdit]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.body).toBe('original');
  });

  it('still applies a legitimate own-message edit and delete', () => {
    const me = generateDeviceIdentity('Me');
    const them = generateDeviceIdentity('Them');
    const cid2 = dmConversationId(me.publicKey, them.publicKey);
    const root = createDmMessage(me, { conversationId: cid2, body: 'draft', hlc: at('00') });
    const myEdit = createDmMessage(me, {
      conversationId: cid2,
      body: 'final',
      hlc: at('01'),
      supersedes: { id: root.id, deleted: false },
    });
    expect(resolveDmMessages([root, myEdit]).map((m) => m.body)).toEqual(['final']);

    const myDelete = createDmMessage(me, {
      conversationId: cid2,
      body: '',
      hlc: at('02'),
      supersedes: { id: myEdit.id, deleted: true },
    });
    expect(resolveDmMessages([root, myEdit, myDelete])).toEqual([]);
  });

  it('ignores a supersede that crosses intents (a react tombstone cannot censor a message)', () => {
    const me = generateDeviceIdentity('Me');
    const them = generateDeviceIdentity('Them');
    const cid2 = dmConversationId(me.publicKey, them.publicKey);
    const message = createDmMessage(me, {
      conversationId: cid2,
      body: 'hello',
      hlc: at('00'),
      intent: 'message',
    });
    const reactTombstone = createDmMessage(me, {
      conversationId: cid2,
      body: '',
      hlc: at('01'),
      intent: 'react',
      supersedes: { id: message.id, deleted: true },
    });
    // Same author, but a react-intent supersede must not censor a message-intent root.
    expect(resolveDmMessages([message, reactTombstone]).map((m) => m.id)).toEqual([message.id]);
  });

  it('normalizes a missing intent to message so an honest v1-style edit still applies', () => {
    const me = generateDeviceIdentity('Me');
    const them = generateDeviceIdentity('Them');
    const cid2 = dmConversationId(me.publicKey, them.publicKey);
    const root = createDmMessage(me, { conversationId: cid2, body: 'a', hlc: at('00') }); // no intent
    const edit = createDmMessage(me, {
      conversationId: cid2,
      body: 'b',
      hlc: at('01'),
      intent: 'message', // explicit 'message' matches the root's normalized 'message'
      supersedes: { id: root.id, deleted: false },
    });
    expect(resolveDmMessages([root, edit]).map((m) => m.body)).toEqual(['b']);
  });

  it('leaves an honest history unchanged (regression fixture)', () => {
    const a = generateDeviceIdentity('A');
    const b = generateDeviceIdentity('B');
    const cid2 = dmConversationId(a.publicKey, b.publicKey);
    const m1 = createDmMessage(a, { conversationId: cid2, body: 'a1', hlc: at('00') });
    const m2 = createDmMessage(b, { conversationId: cid2, body: 'b1', hlc: at('01') });
    const m1edit = createDmMessage(a, {
      conversationId: cid2,
      body: 'a1-edited',
      hlc: at('02'),
      supersedes: { id: m1.id, deleted: false },
    });
    const m3 = createDmMessage(a, { conversationId: cid2, body: 'a2', hlc: at('03') });
    expect(resolveDmMessages([m1, m2, m1edit, m3]).map((m) => m.body)).toEqual([
      'a1-edited',
      'b1',
      'a2',
    ]);
  });
});

describe('cross-domain separation (TC-2, load-bearing)', () => {
  it('a channel message cannot pass as a dm, and a dm cannot pass as a channel message', () => {
    const hlc = { wall: '2026-07-01T00:00:00.000Z', counter: 0 };

    const channelEvent = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'community post',
      hlc,
    });
    const dmEvent = createDmMessage(author, {
      conversationId: cid,
      body: 'private note',
      hlc,
    });

    // Both are individually valid inside their own domain.
    expect(verifyChannelMessage(channelEvent)).toBe(true);
    expect(verifyDmMessage(dmEvent)).toBe(true);

    // 'meerkat-channel-message-v1/2' vs 'meerkat-dm-message-v1' domain separation
    // makes a DM-as-community-post (and vice versa) cryptographically impossible.
    expect(verifyDmMessage(channelEvent as unknown as DmMessageEvent)).toBe(false);
    expect(verifyChannelMessage(dmEvent as unknown as ChannelMessageEvent)).toBe(false);
  });
});

describe('hlc reuse', () => {
  it('reuses nextHlc from channel-message rather than re-declaring a DM clock', () => {
    // dm-message must not ship its own clock. If it re-exports nextHlc for
    // convenience, it must be the SAME function reference from channel-message.
    if ('nextHlc' in dmModule) {
      expect((dmModule as unknown as { nextHlc: unknown }).nextHlc).toBe(nextHlc);
    }

    const hlc = nextHlc(null, '2026-07-01T00:00:00.000Z');
    const message = createDmMessage(author, { conversationId: cid, body: 'hi', hlc });
    expect(message.hlc).toEqual({ wall: '2026-07-01T00:00:00.000Z', counter: 0 });
    expect(verifyDmMessage(message)).toBe(true);
  });
});
