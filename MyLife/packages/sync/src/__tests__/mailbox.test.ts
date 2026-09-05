/**
 * MK-033 -- mailbox mode envelopes (unit layer). Deltas are sealed to ONE
 * recipient, signed by the sender, and addressed by a pair-private token the
 * mailbox host cannot link to any identity.
 */

import { describe, it, expect } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  decodeMailboxEnvelope,
  deriveMailboxDrainTokens,
  deriveMailboxToken,
  encodeMailboxEnvelope,
  openMailboxDelta,
  sealMailboxDelta,
} from '../protocol/mailbox';

const SECRET = 'ab'.repeat(32);
const T = Date.parse('2026-08-25T12:00:00.000Z');
const DAY_MS = 86_400_000;

/** sealMailboxDelta addresses a recipient by {deviceId, dhPublicKey}. */
const to = (id: ReturnType<typeof generateDeviceIdentity>) =>
  ({ deviceId: id.publicKey, dhPublicKey: id.dhPublicKey });

describe('deriveMailboxToken (MK-033)', () => {
  it('is pair-private: deterministic for the pair, opaque to the host', () => {
    const recipient = generateDeviceIdentity('Phone');
    const a = deriveMailboxToken(SECRET, recipient.publicKey, T);
    const b = deriveMailboxToken(SECRET, recipient.publicKey, T);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    // The token never embeds the device id (no identity leak to the relay).
    expect(a).not.toContain(recipient.publicKey.slice(0, 16));
  });

  it('rotates daily (v2): the same pair derives a different token in the next UTC bucket', () => {
    const phone = generateDeviceIdentity('Phone');
    const today = deriveMailboxToken(SECRET, phone.publicKey, T);
    const tomorrow = deriveMailboxToken(SECRET, phone.publicKey, T + DAY_MS);
    expect(today).not.toBe(tomorrow);
    // Within one bucket the token is stable regardless of the wall-clock time.
    expect(deriveMailboxToken(SECRET, phone.publicKey, T + 3_600_000)).toBe(today);
  });

  it('drain window covers exactly the current and previous bucket', () => {
    const phone = generateDeviceIdentity('Phone');
    const window = deriveMailboxDrainTokens(SECRET, phone.publicKey, T);
    expect(window).toEqual([
      deriveMailboxToken(SECRET, phone.publicKey, T),
      deriveMailboxToken(SECRET, phone.publicKey, T - DAY_MS),
    ]);
    // An envelope parked YESTERDAY (sender clock in the previous bucket) is
    // addressed by a token today's drain window still contains.
    expect(window).toContain(deriveMailboxToken(SECRET, phone.publicKey, T - DAY_MS));
    // One parked the day BEFORE yesterday has aged past the 24h relay TTL and
    // is out of the window.
    expect(window).not.toContain(deriveMailboxToken(SECRET, phone.publicKey, T - 2 * DAY_MS));
  });

  it('differs per recipient and per pairing secret', () => {
    const phone = generateDeviceIdentity('Phone');
    const tablet = generateDeviceIdentity('Tablet');
    expect(deriveMailboxToken(SECRET, phone.publicKey, T))
      .not.toBe(deriveMailboxToken(SECRET, tablet.publicKey, T));
    expect(deriveMailboxToken(SECRET, phone.publicKey, T))
      .not.toBe(deriveMailboxToken('cd'.repeat(32), phone.publicKey, T));
  });
});

describe('sealMailboxDelta / openMailboxDelta (MK-033)', () => {
  it('round-trips a delta to the addressed recipient with sender authenticated', () => {
    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const envelope = sealMailboxDelta(desktop, to(phone), { table: 'nt_notes', rowId: 'n1', body: 'queued while you slept' });

    const wire = encodeMailboxEnvelope(envelope);
    const decoded = decodeMailboxEnvelope(wire)!;
    const opened = openMailboxDelta<{ body: string }>(phone, decoded);

    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.senderDeviceId).toBe(desktop.publicKey);
      expect(opened.payload.body).toBe('queued while you slept');
    }
  });

  it('the envelope carries NO identity metadata: the host sees only ciphertext', () => {
    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const envelope = sealMailboxDelta(desktop, to(phone), { secret: true });

    // v2: sender/recipient ids live inside the sealed box, never on the wire.
    expect('senderDeviceId' in envelope).toBe(false);
    expect('recipientDeviceId' in envelope).toBe(false);
    const wireText = new TextDecoder().decode(encodeMailboxEnvelope(envelope));
    expect(wireText.includes(desktop.publicKey)).toBe(false);
    expect(wireText.includes(phone.publicKey)).toBe(false);
  });

  it('the mailbox host (or anyone but the recipient) cannot open it', () => {
    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const snoop = generateDeviceIdentity('Relay Operator');
    const envelope = sealMailboxDelta(desktop, to(phone), { secret: true });
    // The snoop holds no DH key for the box, so decryption itself fails (it
    // cannot even reach the inner recipient field).
    const result = openMailboxDelta(snoop, envelope);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('decrypt_failed');
  });

  it('a forged sender is rejected: naming another device needs that device key', () => {
    const desktop = generateDeviceIdentity('Desktop');
    const evil = generateDeviceIdentity('Evil');
    const phone = generateDeviceIdentity('Phone');
    // Evil seals to the phone but tries to claim it is the desktop by signing
    // a desktop-named inner with its own key. Easiest faithful forge: take a
    // real evil-authored envelope and swap in desktop's signature attempt by
    // re-signing -- evil cannot, so the honest path is: evil seals as itself,
    // and the recipient correctly sees EVIL, never the desktop.
    const evilEnvelope = sealMailboxDelta(evil, to(phone), { v: 1 });
    const opened = openMailboxDelta<{ v: number }>(phone, evilEnvelope);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.senderDeviceId).toBe(evil.publicKey); // not desktop

    // And a signature swapped from a different envelope fails to verify.
    const honest = sealMailboxDelta(desktop, to(phone), { v: 1 });
    const tamperedSig = { ...honest, signature: evilEnvelope.signature };
    const result = openMailboxDelta(phone, tamperedSig);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_signature');
  });

  it('a tampered ciphertext is rejected', () => {
    const desktop = generateDeviceIdentity('Desktop');
    const phone = generateDeviceIdentity('Phone');
    const envelope = sealMailboxDelta(desktop, to(phone), { v: 1 });
    const tail = envelope.sealedHex.slice(-2) === '00' ? 'ff' : '00';
    const tampered = { ...envelope, sealedHex: envelope.sealedHex.slice(0, -2) + tail };
    // The authenticated secretbox catches the tamper at decryption, before
    // the inner sender can even be read.
    const result = openMailboxDelta(phone, tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('decrypt_failed');
  });

  it('decode rejects garbage frames', () => {
    expect(decodeMailboxEnvelope(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
