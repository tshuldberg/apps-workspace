/**
 * DM delivery/read receipts (Plan 21 Phase 1), unit layer.
 *
 * A receipt is a recipient-signed statement over its OWN domain
 * ('meerkat-dm-receipt-v1'), sealed BACK to the original sender's pair-private
 * mailbox. These tests assert:
 *   - a signed delivered/read receipt round-trips and verifies;
 *   - a forged receipt (tampered field, or claiming another device) is rejected;
 *   - the pure seal/open does NOT fabricate delivery -- a withheld receipt yields
 *     NO state (NC-7), and a dm-MESSAGE mailbox carries no receipt state at all;
 *   - fail-closed on wrong recipient / tamper / wrong kind;
 *   - the wire leaks no identities, conversation id, message id, or kind tag.
 */

import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createDmMessage, dmConversationId } from '../protocol/dm-message';
import { openDmMailbox, sealDmDirect } from '../protocol/dm-mailbox';
import {
  DM_RECEIPT_MAILBOX_KIND,
  createDmReceipt,
  openDmReceiptMailbox,
  sealDmReceipt,
  verifyDmReceipt,
  type DmReceiptEvent,
} from '../protocol/dm-receipt';

const SECRET = 'ab'.repeat(32);
const HLC0 = { wall: '2026-07-01T00:00:00.000Z', counter: 0 };

// The original message sender (receipts flow back to THIS device).
const sender = generateDeviceIdentity('Sender');
// The recipient device that signs delivered/read receipts.
const recipient = generateDeviceIdentity('Recipient');
const cid = dmConversationId(sender.publicKey, recipient.publicKey);

function receiptRecipient(device: ReturnType<typeof generateDeviceIdentity>) {
  return { deviceId: device.publicKey, dhPublicKey: device.dhPublicKey };
}

describe('createDmReceipt + verifyDmReceipt', () => {
  it('signs and verifies delivered and read receipts bound to the signing device', () => {
    for (const state of ['delivered', 'read'] as const) {
      const receipt = createDmReceipt(recipient, {
        conversationId: cid,
        messageId: 'msg_1',
        state,
        at: HLC0.wall,
      });
      expect(receipt.recipientDeviceId).toBe(recipient.publicKey);
      expect(receipt.state).toBe(state);
      expect(verifyDmReceipt(receipt)).toBe(true);
    }
  });

  it('rejects a forged receipt (tampered state or messageId)', () => {
    const receipt = createDmReceipt(recipient, {
      conversationId: cid,
      messageId: 'msg_1',
      state: 'delivered',
      at: HLC0.wall,
    });
    const tamperState: DmReceiptEvent = { ...receipt, state: 'read' };
    const tamperMessage: DmReceiptEvent = { ...receipt, messageId: 'msg_2' };
    const tamperConversation: DmReceiptEvent = { ...receipt, conversationId: 'other' };
    const tamperAt: DmReceiptEvent = { ...receipt, at: '2099-01-01T00:00:00.000Z' };
    expect(verifyDmReceipt(tamperState)).toBe(false);
    expect(verifyDmReceipt(tamperMessage)).toBe(false);
    expect(verifyDmReceipt(tamperConversation)).toBe(false);
    expect(verifyDmReceipt(tamperAt)).toBe(false);
  });

  it('rejects a receipt that claims a device it did not sign for', () => {
    const victim = generateDeviceIdentity('Victim');
    // Attacker signs a receipt, then rewrites recipientDeviceId to the victim.
    const attackerReceipt = createDmReceipt(recipient, {
      conversationId: cid,
      messageId: 'msg_1',
      state: 'read',
      at: HLC0.wall,
    });
    const impersonated: DmReceiptEvent = { ...attackerReceipt, recipientDeviceId: victim.publicKey };
    expect(verifyDmReceipt(impersonated)).toBe(false);
  });

  it('rejects an unknown state', () => {
    const receipt = createDmReceipt(recipient, {
      conversationId: cid,
      messageId: 'msg_1',
      state: 'delivered',
      at: HLC0.wall,
    });
    const weird = { ...receipt, state: 'seen' } as unknown as DmReceiptEvent;
    expect(verifyDmReceipt(weird)).toBe(false);
  });
});

describe('sealDmReceipt + openDmReceiptMailbox (round-trip back to sender)', () => {
  it('seals a verified receipt to the original sender pair-private mailbox', () => {
    const receipt = createDmReceipt(recipient, {
      conversationId: cid,
      messageId: 'msg_1',
      state: 'read',
      at: HLC0.wall,
    });
    const sealed = sealDmReceipt({
      sender: recipient, // the device parking the receipt (it signed it)
      recipient: receiptRecipient(sender), // back to the original message author
      pairSharedSecretHex: SECRET,
      receipt,
    });
    expect(sealed.token).toMatch(/^[0-9a-f]{64}$/);

    const opened = openDmReceiptMailbox(sender, sealed.envelope);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.senderDeviceId).toBe(recipient.publicKey);
    expect(opened.receipt.state).toBe('read');
    expect(opened.receipt.messageId).toBe('msg_1');
    expect(verifyDmReceipt(opened.receipt)).toBe(true);
  });

  it('the relay sees no identities, conversation id, message id, or kind tag', () => {
    const receipt = createDmReceipt(recipient, {
      conversationId: cid,
      messageId: 'msg_secret',
      state: 'delivered',
      at: HLC0.wall,
    });
    const sealed = sealDmReceipt({
      sender: recipient,
      recipient: receiptRecipient(sender),
      pairSharedSecretHex: SECRET,
      receipt,
    });
    const wire = JSON.stringify(sealed.envelope);
    expect(wire.includes(recipient.publicKey)).toBe(false);
    expect(wire.includes(sender.publicKey)).toBe(false);
    expect(wire.includes(cid)).toBe(false);
    expect(wire.includes('msg_secret')).toBe(false);
    expect(wire.includes(DM_RECEIPT_MAILBOX_KIND)).toBe(false);
  });

  it('fail-closed: wrong recipient -> decrypt_failed', () => {
    const snoop = generateDeviceIdentity('Relay Operator');
    const receipt = createDmReceipt(recipient, {
      conversationId: cid,
      messageId: 'msg_1',
      state: 'delivered',
      at: HLC0.wall,
    });
    const sealed = sealDmReceipt({
      sender: recipient,
      recipient: receiptRecipient(sender),
      pairSharedSecretHex: SECRET,
      receipt,
    });
    const result = openDmReceiptMailbox(snoop, sealed.envelope);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('decrypt_failed');
  });

  it('fail-closed: a forged receipt inside a valid envelope -> invalid_receipt', () => {
    const receipt = createDmReceipt(recipient, {
      conversationId: cid,
      messageId: 'msg_1',
      state: 'delivered',
      at: HLC0.wall,
    });
    // Envelope is genuinely sealed+signed by the recipient device, but the
    // receipt payload has been tampered post-signing (state flipped).
    const forged: DmReceiptEvent = { ...receipt, state: 'read' };
    const sealed = sealDmReceipt({
      sender: recipient,
      recipient: receiptRecipient(sender),
      pairSharedSecretHex: SECRET,
      receipt: forged,
    });
    const result = openDmReceiptMailbox(sender, sealed.envelope);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_receipt');
  });
});

describe('NC-7: the pure path never fabricates delivery', () => {
  it('a dm-MESSAGE mailbox opened as a receipt -> invalid_payload (no default state)', () => {
    const msg = createDmMessage(sender, { conversationId: cid, body: 'hi', hlc: HLC0 });
    const sealed = sealDmDirect({
      sender,
      conversationId: cid,
      events: [msg],
      recipients: [{ deviceId: recipient.publicKey, dhPublicKey: recipient.dhPublicKey, pairSecret: SECRET }],
    });
    if (!sealed.ok) throw new Error('seal should succeed');
    const asReceipt = openDmReceiptMailbox(recipient, sealed.sealed[0]!.envelope);
    expect(asReceipt.ok).toBe(false);
    if (!asReceipt.ok) expect(asReceipt.reason).toBe('invalid_payload');
  });

  it('a delivered DM message carries NO receipt/state field on the opened payload', () => {
    const msg = createDmMessage(sender, { conversationId: cid, body: 'hi', hlc: HLC0 });
    const sealed = sealDmDirect({
      sender,
      conversationId: cid,
      events: [msg],
      recipients: [{ deviceId: recipient.publicKey, dhPublicKey: recipient.dhPublicKey, pairSecret: SECRET }],
    });
    if (!sealed.ok) throw new Error('seal should succeed');
    const opened = openDmMailbox(recipient, sealed.sealed[0]!.envelope);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    // A withheld receipt means the sender has NO delivered/read state to read:
    // the message payload itself never carries one.
    expect('state' in (opened.payload as unknown as Record<string, unknown>)).toBe(false);
    expect('receipt' in (opened.payload as unknown as Record<string, unknown>)).toBe(false);
  });
});
