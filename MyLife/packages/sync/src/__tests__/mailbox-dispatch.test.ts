/**
 * DM message + receipt dispatcher routing (Plan 21 Phase 2).
 *
 * Mirrors the public-join dispatcher route proven in public-join-handoff.test.ts:
 * applyMailboxEnvelope opens+verifies the sealed envelope FIRST (signature over
 * the ciphertext, recipient match, decrypt), then routes by the VERIFIED inner
 * kind tag to the dmMessage / dmReceipt handler. A missing handler, an
 * unknown/forged kind, or an envelope opened with the wrong recipient all
 * reject fail-closed with the handler never invoked.
 */

import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  createDmMessage,
  dmConversationId,
  verifyDmMessage,
  type DmMessageEvent,
} from '../protocol/dm-message';
import { sealDmDirect } from '../protocol/dm-mailbox';
import { createDmReceipt, sealDmReceipt } from '../protocol/dm-receipt';
import { applyMailboxEnvelope } from '../protocol/mailbox-dispatch';
import { encodeMailboxEnvelope, sealMailboxDelta } from '../protocol/mailbox';

const SECRET = 'ab'.repeat(32);
const HLC0 = { wall: '2026-07-01T00:00:00.000Z', counter: 0 };

describe('DM dispatcher routing (Plan 21 Phase 2)', () => {
  it('routes DM_MESSAGE_MAILBOX_KIND to the dmMessage handler with the verified events', async () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const cid = dmConversationId(alice.publicKey, bob.publicKey);
    const event = createDmMessage(alice, { conversationId: cid, body: 'hi bob', hlc: HLC0 });

    const sealed = sealDmDirect({
      sender: alice,
      conversationId: cid,
      events: [event],
      recipients: [{ deviceId: bob.publicKey, dhPublicKey: bob.dhPublicKey, pairSecret: SECRET }],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    let received: { sender: string; conversationId: string; mode: string; events: DmMessageEvent[] } | null = null;
    const outcome = await applyMailboxEnvelope(bob, encodeMailboxEnvelope(sealed.sealed[0]!.envelope), {
      dmMessage: (sender, opened) => {
        received = { sender, conversationId: opened.conversationId, mode: opened.mode, events: opened.events };
        return true;
      },
    });

    expect(outcome.kind).toBe('dm-message');
    expect(received).not.toBeNull();
    expect(received!.sender).toBe(alice.publicKey);
    expect(received!.conversationId).toBe(cid);
    expect(received!.mode).toBe('direct');
    expect(received!.events).toHaveLength(1);
    expect(received!.events[0]!.id).toBe(event.id);
    expect(verifyDmMessage(received!.events[0]!)).toBe(true);
  });

  it('routes DM_RECEIPT_MAILBOX_KIND to the dmReceipt handler with the verified receipt', async () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const cid = dmConversationId(alice.publicKey, bob.publicKey);
    const receipt = createDmReceipt(bob, {
      conversationId: cid, messageId: 'm1', state: 'delivered', at: HLC0.wall,
    });
    const sealed = sealDmReceipt({
      sender: bob,
      recipient: { deviceId: alice.publicKey, dhPublicKey: alice.dhPublicKey },
      pairSharedSecretHex: SECRET,
      receipt,
    });

    let received: { sender: string; messageId: string; state: string } | null = null;
    const outcome = await applyMailboxEnvelope(alice, encodeMailboxEnvelope(sealed.envelope), {
      dmReceipt: (sender, opened) => {
        received = { sender, messageId: opened.receipt.messageId, state: opened.receipt.state };
        return true;
      },
    });

    expect(outcome.kind).toBe('dm-receipt');
    expect(received).not.toBeNull();
    expect(received!.sender).toBe(bob.publicKey);
    expect(received!.messageId).toBe('m1');
    expect(received!.state).toBe('delivered');
  });

  it('a missing dmMessage handler returns rejected (fail-closed)', async () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const cid = dmConversationId(alice.publicKey, bob.publicKey);
    const event = createDmMessage(alice, { conversationId: cid, body: 'hi', hlc: HLC0 });
    const sealed = sealDmDirect({
      sender: alice,
      conversationId: cid,
      events: [event],
      recipients: [{ deviceId: bob.publicKey, dhPublicKey: bob.dhPublicKey, pairSecret: SECRET }],
    });
    if (!sealed.ok) throw new Error('seal failed');

    const outcome = await applyMailboxEnvelope(bob, encodeMailboxEnvelope(sealed.sealed[0]!.envelope), {});
    expect(outcome.kind).toBe('rejected');
  });

  it('a missing dmReceipt handler returns rejected (fail-closed)', async () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const cid = dmConversationId(alice.publicKey, bob.publicKey);
    const receipt = createDmReceipt(bob, {
      conversationId: cid, messageId: 'm1', state: 'read', at: HLC0.wall,
    });
    const sealed = sealDmReceipt({
      sender: bob,
      recipient: { deviceId: alice.publicKey, dhPublicKey: alice.dhPublicKey },
      pairSharedSecretHex: SECRET,
      receipt,
    });

    const outcome = await applyMailboxEnvelope(alice, encodeMailboxEnvelope(sealed.envelope), {});
    expect(outcome.kind).toBe('rejected');
  });

  it('an unknown/forged kind is dropped fail-closed, no DM handler invoked', async () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const envelope = sealMailboxDelta(
      alice,
      { deviceId: bob.publicKey, dhPublicKey: bob.dhPublicKey },
      { kind: 'meerkat.unknown-future-kind', version: 9, secret: 'data' },
    );
    let anyHandler = false;
    const outcome = await applyMailboxEnvelope(bob, encodeMailboxEnvelope(envelope), {
      dmMessage: () => { anyHandler = true; return true; },
      dmReceipt: () => { anyHandler = true; return true; },
    });
    expect(outcome.kind).toBe('rejected');
    expect(anyHandler).toBe(false);
  });

  it('a DM-message envelope opened with the WRONG recipient is rejected fail-closed', async () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const stranger = generateDeviceIdentity('Stranger');
    const cid = dmConversationId(alice.publicKey, bob.publicKey);
    const event = createDmMessage(alice, { conversationId: cid, body: 'private', hlc: HLC0 });
    const sealed = sealDmDirect({
      sender: alice,
      conversationId: cid,
      events: [event],
      recipients: [{ deviceId: bob.publicKey, dhPublicKey: bob.dhPublicKey, pairSecret: SECRET }],
    });
    if (!sealed.ok) throw new Error('seal failed');

    let seen = false;
    // The envelope is sealed to BOB's DH key; opening it with a different
    // device's identity must fail decrypt before the kind is ever read.
    const outcome = await applyMailboxEnvelope(stranger, encodeMailboxEnvelope(sealed.sealed[0]!.envelope), {
      dmMessage: () => { seen = true; return true; },
    });
    expect(outcome.kind).toBe('rejected');
    expect(seen).toBe(false);
  });

  it('a DM-receipt envelope opened with the WRONG recipient is rejected fail-closed', async () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const stranger = generateDeviceIdentity('Stranger');
    const cid = dmConversationId(alice.publicKey, bob.publicKey);
    const receipt = createDmReceipt(bob, {
      conversationId: cid, messageId: 'm1', state: 'delivered', at: HLC0.wall,
    });
    const sealed = sealDmReceipt({
      sender: bob,
      recipient: { deviceId: alice.publicKey, dhPublicKey: alice.dhPublicKey },
      pairSharedSecretHex: SECRET,
      receipt,
    });

    let seen = false;
    const outcome = await applyMailboxEnvelope(stranger, encodeMailboxEnvelope(sealed.envelope), {
      dmReceipt: () => { seen = true; return true; },
    });
    expect(outcome.kind).toBe('rejected');
    expect(seen).toBe(false);
  });

  it('a handler that applies nothing is counted rejected (preserves the contract)', async () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const cid = dmConversationId(alice.publicKey, bob.publicKey);
    const event = createDmMessage(alice, { conversationId: cid, body: 'dup', hlc: HLC0 });
    const sealed = sealDmDirect({
      sender: alice,
      conversationId: cid,
      events: [event],
      recipients: [{ deviceId: bob.publicKey, dhPublicKey: bob.dhPublicKey, pairSecret: SECRET }],
    });
    if (!sealed.ok) throw new Error('seal failed');

    const outcome = await applyMailboxEnvelope(bob, encodeMailboxEnvelope(sealed.sealed[0]!.envelope), {
      dmMessage: () => false, // e.g. all-duplicate events, nothing new merged
    });
    expect(outcome.kind).toBe('rejected');
  });
});
