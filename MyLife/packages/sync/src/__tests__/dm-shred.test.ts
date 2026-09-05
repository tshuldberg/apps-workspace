/**
 * DM disappearing-message shred (Plan 21 Phase 8): author-signed delete-for-everyone.
 *
 * - sign/verify + a NON-author signature is rejected (the load-bearing guarantee);
 * - cross-domain isolation (a DM message / receipt signature cannot masquerade);
 * - mailbox round-trip + fail-closed opens (wrong recipient, non-author sender,
 *   tampered shred);
 * - the dispatcher routes DM_SHRED to the dmShred handler and the drain counts it.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyMailboxEnvelope,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createDmMessage,
  createDmReceipt,
  createDmShred,
  encodeMailboxEnvelope,
  generateDeviceIdentity,
  openDmShredMailbox,
  sealDmShred,
  verifyDmShred,
  type DmShredEvent,
  type MailboxEnvelopeHandlers,
} from '../index';

const NOW = '2026-07-02T00:00:00.000Z';

beforeEach(() => configureSyncSecretStore(createInMemorySyncSecretStore()));

describe('createDmShred / verifyDmShred', () => {
  it('an author-signed shred verifies', () => {
    const author = generateDeviceIdentity('A');
    const shred = createDmShred(author, { conversationId: 'c1', messageIds: ['m1', 'm2'], at: NOW });
    expect(shred.authorDeviceId).toBe(author.publicKey);
    expect(verifyDmShred(shred)).toBe(true);
  });

  it('rejects a non-author signature (impostor claims the author)', () => {
    const author = generateDeviceIdentity('A');
    const impostor = generateDeviceIdentity('X');
    const forged: DmShredEvent = {
      ...createDmShred(impostor, { conversationId: 'c1', messageIds: ['m1'], at: NOW }),
      authorDeviceId: author.publicKey,
    };
    expect(verifyDmShred(forged)).toBe(false);
  });

  it('rejects tampered message ids and empty id lists', () => {
    const author = generateDeviceIdentity('A');
    const shred = createDmShred(author, { conversationId: 'c1', messageIds: ['m1'], at: NOW });
    expect(verifyDmShred({ ...shred, messageIds: ['m1', 'm-injected'] })).toBe(false);
    expect(verifyDmShred({ ...shred, messageIds: [] })).toBe(false);
  });

  it('a DM message / receipt signature cannot cross-verify as a shred (distinct domain)', () => {
    const author = generateDeviceIdentity('A');
    const dm = createDmMessage(author, { conversationId: 'c1', body: 'hi', hlc: { wall: NOW, counter: 0 } });
    const receipt = createDmReceipt(author, { conversationId: 'c1', messageId: 'm1', state: 'read', at: NOW });
    const base = createDmShred(author, { conversationId: 'c1', messageIds: ['m1'], at: NOW });
    expect(verifyDmShred({ ...base, signature: dm.signature })).toBe(false);
    expect(verifyDmShred({ ...base, signature: receipt.signature })).toBe(false);
  });
});

describe('sealDmShred / openDmShredMailbox', () => {
  it('round-trips to the addressed recipient', () => {
    const author = generateDeviceIdentity('A');
    const peer = generateDeviceIdentity('B');
    const secret = 'ab'.repeat(32);
    const shred = createDmShred(author, { conversationId: 'c1', messageIds: ['m1'], at: NOW });
    const sealed = sealDmShred({
      sender: author, recipient: { deviceId: peer.publicKey, dhPublicKey: peer.dhPublicKey },
      pairSharedSecretHex: secret, shred, now: NOW,
    });
    const opened = openDmShredMailbox(peer, sealed.envelope);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.senderDeviceId).toBe(author.publicKey);
    expect(opened.shred.messageIds).toEqual(['m1']);
  });

  it('rejects the wrong recipient', () => {
    const author = generateDeviceIdentity('A');
    const peer = generateDeviceIdentity('B');
    const stranger = generateDeviceIdentity('S');
    const shred = createDmShred(author, { conversationId: 'c1', messageIds: ['m1'], at: NOW });
    const sealed = sealDmShred({
      sender: author, recipient: { deviceId: peer.publicKey, dhPublicKey: peer.dhPublicKey },
      pairSharedSecretHex: 'ab'.repeat(32), shred, now: NOW,
    });
    expect(openDmShredMailbox(stranger, sealed.envelope).ok).toBe(false);
  });

  it('rejects a shred whose envelope signer is NOT the shred author (wrong_sender)', () => {
    const author = generateDeviceIdentity('A');
    const relayer = generateDeviceIdentity('R');
    const peer = generateDeviceIdentity('B');
    // author-signed shred, but relayer seals the envelope.
    const shred = createDmShred(author, { conversationId: 'c1', messageIds: ['m1'], at: NOW });
    const sealed = sealDmShred({
      sender: relayer, recipient: { deviceId: peer.publicKey, dhPublicKey: peer.dhPublicKey },
      pairSharedSecretHex: 'ab'.repeat(32), shred, now: NOW,
    });
    const opened = openDmShredMailbox(peer, sealed.envelope);
    expect(opened.ok).toBe(false);
    if (!opened.ok) expect(opened.reason).toBe('wrong_sender');
  });
});

describe('dispatcher + drain routing', () => {
  it('routes DM_SHRED to the dmShred handler and counts dm-shred', async () => {
    const author = generateDeviceIdentity('A');
    const peer = generateDeviceIdentity('B');
    const shred = createDmShred(author, { conversationId: 'c1', messageIds: ['m1'], at: NOW });
    const sealed = sealDmShred({
      sender: author, recipient: { deviceId: peer.publicKey, dhPublicKey: peer.dhPublicKey },
      pairSharedSecretHex: 'ab'.repeat(32), shred, now: NOW,
    });

    let seen: DmShredEvent | null = null;
    const handlers: MailboxEnvelopeHandlers = {
      dmShred: (_sender, s) => { seen = s; return true; },
    };
    const outcome = await applyMailboxEnvelope(peer, encodeMailboxEnvelope(sealed.envelope), handlers);
    expect(outcome).toEqual({ kind: 'dm-shred' });
    expect(seen).not.toBeNull();

    // A handler that applies nothing is counted rejected.
    const noop: MailboxEnvelopeHandlers = { dmShred: () => false };
    const rejected = await applyMailboxEnvelope(peer, encodeMailboxEnvelope(sealed.envelope), noop);
    expect(rejected).toEqual({ kind: 'rejected' });
  });
});
