import { describe, expect, it } from 'vitest';
import {
  extractSigningPrivateKeyHex,
  generateDeviceIdentity,
  signMessage,
} from '../../identity/device-identity';
import {
  bytesToHex,
  generateNonce,
  hexToBytes,
} from '../../encryption/keys';
import { sha512Hex } from '../../node/hkdf';
import { deriveMailboxToken } from '../mailbox';
import {
  CALL_SIGNAL_DOMAIN,
  createCallSignal,
  decryptCallPayload,
  deriveCallSignalToken,
  encryptCallPayload,
  resolveCallGlare,
  verifyCallSignal,
  type CallSignal,
  type CallSignalKind,
  type CreateCallSignalInput,
  type VerifyCallSignalOptions,
} from '../call-signal';

const encoder = new TextEncoder();
const NOW_MS = Date.parse('2026-07-12T12:00:30.000Z');
const ISSUED_AT = '2026-07-12T12:00:00.000Z';
const EXPIRES_AT = '2026-07-12T12:01:00.000Z';
const NONCE = 'ab'.repeat(24);
const PAIR_SECRET_HEX = '11'.repeat(32);
const PAIR_SECRET = hexToBytes(PAIR_SECRET_HEX);

const alice = generateDeviceIdentity('Alice');
const bob = generateDeviceIdentity('Bob');
const carol = generateDeviceIdentity('Carol');

const KINDS: CallSignalKind[] = [
  'invite',
  'accept',
  'decline',
  'busy',
  'cancel',
  'end',
  'offer',
  'answer',
  'ice',
  'restart',
];

function makeSignal(overrides: Partial<CreateCallSignalInput> = {}): CallSignal {
  const result = createCallSignal({
    sender: alice,
    callId: 'call-001',
    kind: 'invite',
    toDeviceId: bob.publicKey,
    media: 'video',
    issuedAt: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    nonce: NONCE,
    ...overrides,
  });
  if (!result.ok) throw new Error(`Signal creation failed: ${result.reason}`);
  return result.signal;
}

function verify(
  signal: unknown,
  overrides: Partial<VerifyCallSignalOptions> = {},
) {
  return verifyCallSignal(signal, {
    senderPublicKey: alice.publicKey,
    expectedRecipientDeviceId: bob.publicKey,
    nowMs: NOW_MS,
    hasSeenNonce: () => false,
    ...overrides,
  });
}

function canonicalForDomain(signal: CallSignal, domain: string): Uint8Array {
  const payloadHash = signal.payloadCiphertext === undefined
    ? ''
    : sha512Hex(encoder.encode(signal.payloadCiphertext));
  return encoder.encode(JSON.stringify([
    domain,
    signal.version,
    signal.callId,
    signal.kind,
    signal.fromDeviceId,
    signal.toDeviceId,
    signal.media,
    payloadHash,
    signal.issuedAt,
    signal.expiresAt,
    signal.nonce,
  ]));
}

function signForDomain(signal: CallSignal, domain: string): CallSignal {
  return {
    ...signal,
    signature: bytesToHex(signMessage(
      extractSigningPrivateKeyHex(alice.privateKeyRef),
      canonicalForDomain(signal, domain),
    )),
  };
}

describe('direct call signal protocol', () => {
  it.each(KINDS)('creates and verifies a %s signal', (kind) => {
    const signal = makeSignal({ kind });
    expect(verify(signal)).toEqual({ ok: true, signal });
  });

  it('encrypts and decrypts real SDP and ICE shaped JSON', () => {
    const payload = {
      description: {
        type: 'offer',
        sdp: [
          'v=0',
          'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
          's=-',
          't=0 0',
          'm=audio 9 UDP/TLS/RTP/SAVPF 111',
        ].join('\r\n'),
      },
      candidates: [{
        candidate: 'candidate:0 1 UDP 2122252543 192.0.2.1 54400 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      }],
    };
    const payloadCiphertext = encryptCallPayload(PAIR_SECRET, 'call-sdp', payload);
    const signal = makeSignal({
      callId: 'call-sdp',
      kind: 'offer',
      payloadCiphertext,
    });

    expect(payloadCiphertext).toMatch(/^[0-9a-f]{48}\.[0-9a-f]+$/u);
    expect(payloadCiphertext).not.toContain(payload.description.sdp);
    expect(decryptCallPayload(PAIR_SECRET, 'call-sdp', payloadCiphertext)).toEqual(payload);
    expect(verify(signal)).toEqual({ ok: true, signal });
  });

  it('fails payload decryption closed for the wrong secret, call id, tamper, or encoding', () => {
    const ciphertext = encryptCallPayload(PAIR_SECRET, 'call-payload', { type: 'ice', value: 7 });
    const [nonce, body] = ciphertext.split('.') as [string, string];
    const flipped = body.endsWith('0') ? '1' : '0';
    const tampered = `${nonce}.${body.slice(0, -1)}${flipped}`;

    expect(decryptCallPayload(hexToBytes('22'.repeat(32)), 'call-payload', ciphertext)).toBeNull();
    expect(decryptCallPayload(PAIR_SECRET, 'other-call', ciphertext)).toBeNull();
    expect(decryptCallPayload(PAIR_SECRET, 'call-payload', tampered)).toBeNull();
    expect(decryptCallPayload(PAIR_SECRET, 'call-payload', 'not-base64.not-hex')).toBeNull();
  });

  it('returns typed create rejects without throwing on invalid input', () => {
    expect(() => createCallSignal(null as unknown as CreateCallSignalInput)).not.toThrow();
    expect(createCallSignal(null as unknown as CreateCallSignalInput)).toEqual({
      ok: false,
      reason: 'invalid_input',
    });
    expect(createCallSignal({
      sender: alice,
      callId: '',
      kind: 'invite',
      toDeviceId: bob.publicKey,
      media: 'voice',
    })).toEqual({ ok: false, reason: 'invalid_call_id' });
    expect(createCallSignal({
      sender: alice,
      callId: 'call',
      kind: 'invite',
      toDeviceId: bob.publicKey,
      media: 'voice',
      ttlMs: 120_001,
    })).toEqual({ ok: false, reason: 'invalid_ttl' });
  });

  it('rejects tampering of every variable signature-covered field', () => {
    const payloadCiphertext = encryptCallPayload(PAIR_SECRET, 'call-001', { type: 'offer' });
    const otherPayload = encryptCallPayload(PAIR_SECRET, 'call-001', { type: 'answer' });
    const signal = makeSignal({ kind: 'offer', payloadCiphertext });
    const cases: Array<{
      name: string;
      patch: Partial<CallSignal>;
      opts?: Partial<VerifyCallSignalOptions>;
    }> = [
      { name: 'callId', patch: { callId: 'call-002' } },
      { name: 'kind', patch: { kind: 'answer' } },
      { name: 'fromDeviceId', patch: { fromDeviceId: carol.publicKey } },
      {
        name: 'toDeviceId',
        patch: { toDeviceId: carol.publicKey },
        opts: { expectedRecipientDeviceId: carol.publicKey },
      },
      { name: 'media', patch: { media: 'voice' } },
      { name: 'payloadCiphertext', patch: { payloadCiphertext: otherPayload } },
      { name: 'issuedAt', patch: { issuedAt: '2026-07-12T12:00:01.000Z' } },
      { name: 'expiresAt', patch: { expiresAt: '2026-07-12T12:01:01.000Z' } },
      { name: 'nonce', patch: { nonce: 'cd'.repeat(24) } },
    ];

    for (const testCase of cases) {
      expect(verify({ ...signal, ...testCase.patch }, testCase.opts), testCase.name).toEqual({
        ok: false,
        reason: 'invalid_signature',
      });
    }
  });

  it('rejects a tampered protocol version before signature verification', () => {
    const signal = makeSignal();
    expect(verify({ ...signal, version: 2 })).toEqual({ ok: false, reason: 'invalid_version' });
  });

  it('rejects a valid signature made over the wrong domain', () => {
    const signal = makeSignal();
    const wrongDomainSignal = signForDomain(signal, 'meerkat-call-signal-other-v1');
    expect(CALL_SIGNAL_DOMAIN).toBe('meerkat-call-signal-v1');
    expect(verify(wrongDomainSignal)).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('rejects the wrong signer key', () => {
    const signal = makeSignal();
    expect(verify(signal, { senderPublicKey: carol.publicKey })).toEqual({
      ok: false,
      reason: 'invalid_signature',
    });
  });

  it('rejects a valid signature that claims another sender id', () => {
    const claimed = { ...makeSignal(), fromDeviceId: carol.publicKey };
    const resigned = signForDomain(claimed, CALL_SIGNAL_DOMAIN);
    expect(verify(resigned)).toEqual({ ok: false, reason: 'sender_mismatch' });
  });

  it('rejects a signal addressed to another recipient', () => {
    const signal = makeSignal();
    expect(verify(signal, { expectedRecipientDeviceId: carol.publicKey })).toEqual({
      ok: false,
      reason: 'wrong_recipient',
    });
  });

  it('rejects an expired signal at the exclusive expiry boundary', () => {
    const signal = makeSignal();
    expect(verify(signal, { nowMs: Date.parse(EXPIRES_AT) })).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('rejects issuedAt beyond the 30 second future-skew tolerance', () => {
    const signal = makeSignal({
      issuedAt: '2026-07-12T12:01:00.001Z',
      expiresAt: '2026-07-12T12:02:00.001Z',
    });
    expect(verify(signal)).toEqual({ ok: false, reason: 'issued_in_future' });
  });

  it('accepts issuedAt exactly at the 30 second future-skew boundary', () => {
    const signal = makeSignal({
      issuedAt: '2026-07-12T12:01:00.000Z',
      expiresAt: '2026-07-12T12:02:00.000Z',
    });
    expect(verify(signal)).toEqual({ ok: true, signal });
  });

  it('rejects non-positive TTL and TTL above the 120 second cap', () => {
    const signal = makeSignal();
    expect(verify({ ...signal, expiresAt: signal.issuedAt })).toEqual({
      ok: false,
      reason: 'invalid_ttl',
    });
    expect(verify({
      ...signal,
      expiresAt: new Date(Date.parse(signal.issuedAt) + 120_001).toISOString(),
    })).toEqual({ ok: false, reason: 'ttl_exceeded' });
  });

  it('rejects a replayed nonce after signature verification', () => {
    const signal = makeSignal();
    expect(verify(signal, { hasSeenNonce: (nonce) => nonce === signal.nonce })).toEqual({
      ok: false,
      reason: 'replayed_nonce',
    });
  });

  it('fails closed when the replay seam throws', () => {
    const signal = makeSignal();
    expect(verify(signal, { hasSeenNonce: () => { throw new Error('store unavailable'); } })).toEqual({
      ok: false,
      reason: 'replay_check_failed',
    });
  });

  it('rejects payloadCiphertext above 32 KiB', () => {
    const signal = makeSignal();
    expect(verify({ ...signal, payloadCiphertext: 'a'.repeat(32 * 1024 + 1) })).toEqual({
      ok: false,
      reason: 'payload_too_large',
    });
  });

  it('rejects total signal JSON above 64 KiB', () => {
    const signal = makeSignal();
    expect(verify({ ...signal, padding: 'x'.repeat(64 * 1024) })).toEqual({
      ok: false,
      reason: 'signal_too_large',
    });
  });

  it('rejects unknown extra fields through the strict allowlist', () => {
    const signal = makeSignal();
    expect(verify({ ...signal, displayName: 'Alice' })).toEqual({
      ok: false,
      reason: 'unknown_field',
    });
  });

  it('rejects malformed ciphertext, signature, and public-key hex', () => {
    const signal = makeSignal();
    expect(verify({ ...signal, payloadCiphertext: 'not-base64.not-hex' })).toEqual({
      ok: false,
      reason: 'invalid_payload_ciphertext',
    });
    expect(verify({ ...signal, signature: 'zz'.repeat(64) })).toEqual({
      ok: false,
      reason: 'invalid_signature',
    });
    expect(verify(signal, { senderPublicKey: 'zz'.repeat(32) })).toEqual({
      ok: false,
      reason: 'invalid_signature',
    });
  });

  it('rejects empty and overlong ids', () => {
    const signal = makeSignal();
    expect(verify({ ...signal, callId: '' })).toEqual({ ok: false, reason: 'invalid_call_id' });
    expect(verify({ ...signal, callId: 'x'.repeat(129) })).toEqual({
      ok: false,
      reason: 'invalid_call_id',
    });
    expect(verify({ ...signal, fromDeviceId: '' })).toEqual({
      ok: false,
      reason: 'invalid_device_id',
    });
    expect(verify({ ...signal, toDeviceId: 'a'.repeat(66) })).toEqual({
      ok: false,
      reason: 'invalid_device_id',
    });
  });

  it('rejects invalid kind, media, timestamps, and missing required fields', () => {
    const signal = makeSignal();
    expect(verify({ ...signal, kind: 'ring' })).toEqual({ ok: false, reason: 'invalid_kind' });
    expect(verify({ ...signal, media: 'screen' })).toEqual({ ok: false, reason: 'invalid_media' });
    expect(verify({ ...signal, issuedAt: 'not-a-date' })).toEqual({
      ok: false,
      reason: 'invalid_timestamp',
    });
    const missing = { ...signal } as Partial<CallSignal>;
    delete missing.callId;
    expect(verify(missing)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('is fuzz-safe for 50 junk values', () => {
    const junk = Array.from({ length: 50 }, (_, index): unknown => {
      const randomKey = `junk_${bytesToHex(generateNonce()).slice(0, 12)}_${index}`;
      switch (index % 5) {
        case 0: return null;
        case 1: return index;
        case 2: return [randomKey, index];
        case 3: return { [randomKey]: index };
        default: return index % 2 === 0 ? randomKey : true;
      }
    });

    for (const value of junk) {
      expect(() => verify(value)).not.toThrow();
      expect(verify(value).ok).toBe(false);
    }
  });
});

describe('call signal relay token', () => {
  it('is stable lowercase 64-hex', () => {
    const token = deriveCallSignalToken(PAIR_SECRET_HEX, 'call-token');
    expect(token).toMatch(/^[0-9a-f]{64}$/u);
    expect(deriveCallSignalToken(PAIR_SECRET_HEX, 'call-token')).toBe(token);
  });

  it('differs across call ids and pair secrets', () => {
    expect(deriveCallSignalToken(PAIR_SECRET_HEX, 'call-a')).not.toBe(
      deriveCallSignalToken(PAIR_SECRET_HEX, 'call-b'),
    );
    expect(deriveCallSignalToken(PAIR_SECRET_HEX, 'call-a')).not.toBe(
      deriveCallSignalToken('22'.repeat(32), 'call-a'),
    );
  });

  it('is domain-separated from the mailbox token for the same inputs', () => {
    expect(deriveCallSignalToken(PAIR_SECRET_HEX, 'call-token')).not.toBe(
      deriveMailboxToken(PAIR_SECRET_HEX, 'call-token', Date.now()),
    );
  });
});

describe('call glare resolution', () => {
  it('returns the same winning value in both argument orders', () => {
    const first = { callId: 'call-a', fromDeviceId: bob.publicKey };
    const second = { callId: 'call-b', fromDeviceId: alice.publicKey };
    expect(resolveCallGlare(first, second)).toEqual(first);
    expect(resolveCallGlare(second, first)).toEqual(first);
  });

  it('chooses the lexicographically smaller call id', () => {
    expect(resolveCallGlare(
      { callId: 'z-call', fromDeviceId: alice.publicKey },
      { callId: 'a-call', fromDeviceId: carol.publicKey },
    )).toEqual({ callId: 'a-call', fromDeviceId: carol.publicKey });
  });

  it('breaks equal call-id ties with the smaller device id', () => {
    const lowerDeviceId = alice.publicKey < bob.publicKey ? alice.publicKey : bob.publicKey;
    const first = { callId: 'same-call', fromDeviceId: alice.publicKey };
    const second = { callId: 'same-call', fromDeviceId: bob.publicKey };
    expect(resolveCallGlare(first, second)).toEqual({
      callId: 'same-call',
      fromDeviceId: lowerDeviceId,
    });
    expect(resolveCallGlare(second, first)).toEqual({
      callId: 'same-call',
      fromDeviceId: lowerDeviceId,
    });
  });
});
