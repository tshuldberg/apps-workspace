/**
 * D.6 red-team suite for guaranteed Noise forward secrecy.
 *
 * Four proofs:
 *   1. Per-message ratchet advances: a captured message key opens exactly its
 *      own message, never a prior or a later one, and both peers derive the
 *      same per-message key from the shared session key.
 *   2. No silent downgrade: a session where one side withholds the ephemeral
 *      leg (without a mutual opt-out) FAILS via failNegotiation instead of
 *      quietly running on the static-derived key.
 *   3. Transcript binding: swapping an ephemeral public key (or a handshake
 *      ciphertext) breaks the handshake, proving the chaining key / transcript
 *      hash bind the whole exchange.
 *   4. Two honest peers still complete and agree on identical keys.
 *
 * (1)/(3)/(4) drive the NoiseHandshake + MessageRatchet construction directly;
 * (2) drives the real runInitiatorSession / runResponderSession path.
 */

import { describe, it, expect, afterEach } from 'vitest';
import nacl from 'tweetnacl';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type {
  DeviceIdentity,
  PairedDevice,
  SyncSecurityPreference,
  TransportConnection,
} from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { NoiseHandshake } from '../encryption/noise-handshake';
import { generateNonce } from '../encryption/keys';
import {
  MessageRatchet,
  createSessionPayloadSecurity,
  withMessageRatchet,
  createSecureJsonMessage,
  parseSecureJsonPayload,
} from '../protocol/payload-security';
import { createSyncTables } from '../db/schema';
import { insertPairedDevice } from '../db/queries';
import { generateDeviceIdentity, extractDhPrivateKeyHex } from '../identity/device-identity';
import { derivePairingSharedSecret } from '../identity/pairing';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';

// ---------------------------------------------------------------------------
// (4) honest handshake + (3) transcript tamper
// ---------------------------------------------------------------------------

describe('NoiseHandshake transcript binding (D.6)', () => {
  const a = generateDeviceIdentity('A');
  const b = generateDeviceIdentity('B');

  it('two honest peers complete and agree on an identical session key', () => {
    const initiator = new NoiseHandshake(a, b.dhPublicKey);
    const responder = new NoiseHandshake(b);
    const hello = initiator.initiatorHello();
    const reply = responder.responderReply(hello);
    const key = initiator.initiatorFinalize(reply);

    expect(key).toEqual(reply.sessionKey);
    expect(key).toEqual(initiator.getSessionKey());
    expect(key.length).toBe(nacl.secretbox.keyLength);
  });

  it('a swapped initiator ephemeral pubkey breaks the responder handshake', () => {
    const initiator = new NoiseHandshake(a, b.dhPublicKey);
    const responder = new NoiseHandshake(b);
    const hello = initiator.initiatorHello();

    // The attacker substitutes a different (valid) ephemeral public key while
    // leaving the identity ciphertext intact: the DH no longer matches the key
    // that sealed the payload, so decryption fails closed.
    const foreign = nacl.box.keyPair();
    const tampered = { ...hello, ephemeralPublicKey: Buffer.from(foreign.publicKey).toString('hex') };
    expect(() => responder.responderReply(tampered)).toThrow();
  });

  it('a swapped responder ephemeral pubkey breaks initiatorFinalize', () => {
    const initiator = new NoiseHandshake(a, b.dhPublicKey);
    const responder = new NoiseHandshake(b);
    const hello = initiator.initiatorHello();
    const reply = responder.responderReply(hello);

    const foreign = nacl.box.keyPair();
    const tampered = { ...reply, ephemeralPublicKey: Buffer.from(foreign.publicKey).toString('hex') };
    expect(() => initiator.initiatorFinalize(tampered)).toThrow();
  });

  it('a tampered handshake ciphertext breaks the responder handshake', () => {
    const initiator = new NoiseHandshake(a, b.dhPublicKey);
    const responder = new NoiseHandshake(b);
    const hello = initiator.initiatorHello();

    const flipped = Uint8Array.from(hello.encryptedPayload);
    flipped[flipped.length - 1] ^= 0xff;
    expect(() => responder.responderReply({ ...hello, encryptedPayload: flipped })).toThrow();
  });

  it('a fresh handshake derives a different key each run', () => {
    const run = () => {
      const initiator = new NoiseHandshake(a, b.dhPublicKey);
      const responder = new NoiseHandshake(b);
      const reply = responder.responderReply(initiator.initiatorHello());
      return initiator.initiatorFinalize(reply);
    };
    expect(run()).not.toEqual(run());
  });
});

// ---------------------------------------------------------------------------
// (1) per-message ratchet
// ---------------------------------------------------------------------------

describe('MessageRatchet per-message forward secrecy (D.6)', () => {
  it('derives a distinct key per index; a captured key opens only its own message', () => {
    const sessionKey = nacl.randomBytes(32);
    const ratchet = new MessageRatchet(sessionKey);

    const k0 = ratchet.messageKey(0);
    const k1 = ratchet.messageKey(1);
    const k2 = ratchet.messageKey(2);
    expect(k0).not.toEqual(k1);
    expect(k1).not.toEqual(k2);
    expect(k0).not.toEqual(k2);

    // Seal message 1 under mk_1. Capturing mk_1 must not open message 0 or 2.
    const nonce = generateNonce();
    const sealed1 = nacl.secretbox(new TextEncoder().encode('message one'), nonce, k1);
    expect(nacl.secretbox.open(sealed1, nonce, k1)).not.toBeNull();
    expect(nacl.secretbox.open(sealed1, nonce, k0)).toBeNull();
    expect(nacl.secretbox.open(sealed1, nonce, k2)).toBeNull();
  });

  it('an attacker holding one message key cannot reconstruct the chain', () => {
    const sessionKey = nacl.randomBytes(32);
    const real = new MessageRatchet(sessionKey);
    const mk0 = real.messageKey(0);

    // The best an attacker can do with a leaked message key is seed a ratchet
    // with it. Because mk_i is a one-way image of the (unknown) chain key, that
    // reconstruction yields none of the real per-message keys.
    const forged = new MessageRatchet(mk0);
    expect(forged.messageKey(0)).not.toEqual(real.messageKey(0));
    expect(forged.messageKey(1)).not.toEqual(real.messageKey(1));
  });

  it('both peers derive identical per-message keys from the shared session key', () => {
    const sessionKey = nacl.randomBytes(32);
    const sender = new MessageRatchet(sessionKey);
    const receiver = new MessageRatchet(sessionKey);
    for (let i = 0; i < 5; i++) {
      expect(sender.messageKey(i)).toEqual(receiver.messageKey(i));
    }
    // Out-of-order receipt still resolves the right key.
    expect(receiver.messageKey(9)).toEqual(sender.messageKey(9));
  });

  it('a ratcheted envelope cannot be decrypted at the wrong index or without the ratchet', () => {
    const sessionKey = nacl.randomBytes(32);
    const senderSec = withMessageRatchet(createSessionPayloadSecurity(sessionKey, true));
    const receiverSec = withMessageRatchet(createSessionPayloadSecurity(sessionKey, true));

    // First data message on the channel: index 0.
    const msg = createSecureJsonMessage('SYNC_DATA', 'device', '', { secret: 'index-0 payload' }, senderSec);
    const parsed = parseSecureJsonPayload<{ secret: string }>(msg, receiverSec);
    expect(parsed?.secret).toBe('index-0 payload');

    // The static key (no ratchet) cannot open a ratcheted frame.
    const staticSec = createSessionPayloadSecurity(sessionKey, true);
    expect(parseSecureJsonPayload(msg, staticSec)).toBeNull();

    // Rewriting the envelope index makes the derived key wrong -> fail closed.
    const envelope = JSON.parse(new TextDecoder().decode(msg.payload)) as Record<string, unknown>;
    envelope.msgIndex = 1;
    const retargeted = { ...msg, payload: new TextEncoder().encode(JSON.stringify(envelope)) };
    expect(parseSecureJsonPayload(retargeted, withMessageRatchet(createSessionPayloadSecurity(sessionKey, true)))).toBeNull();
  });

  it('drops a hostile wire msgIndex (oversized, negative, non-integer) without hanging or throwing', () => {
    const sessionKey = nacl.randomBytes(32);
    const sender = withMessageRatchet(createSessionPayloadSecurity(sessionKey, true));
    const receiver = withMessageRatchet(createSessionPayloadSecurity(sessionKey, true));

    const retarget = (base: ReturnType<typeof createSecureJsonMessage>, msgIndex: number) => {
      const env = JSON.parse(new TextDecoder().decode(base.payload)) as Record<string, unknown>;
      env.msgIndex = msgIndex;
      return { ...base, payload: new TextEncoder().encode(JSON.stringify(env)) };
    };

    // An honest sequential stream still decrypts end to end.
    for (let i = 0; i < 3; i++) {
      const honest = createSecureJsonMessage('SYNC_DATA', 'device', '', { seq: i }, sender);
      expect(parseSecureJsonPayload<{ seq: number }>(honest, receiver)?.seq).toBe(i);
    }

    // A compromised paired peer forges the index. Each is rejected fast (no
    // unbounded chain walk / allocation) and returns null rather than throwing
    // out of the synchronous data handler. A giant index that hung would time
    // this test out; returning promptly is the proof.
    const template = createSecureJsonMessage('SYNC_DATA', 'device', '', { seq: 99 }, sender);
    for (const evil of [2 ** 31, 2 ** 53, -1, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => parseSecureJsonPayload(retarget(template, evil), receiver)).not.toThrow();
      expect(parseSecureJsonPayload(retarget(template, evil), receiver)).toBeNull();
    }

    // The honest channel keeps working after the rejected frames.
    const after = createSecureJsonMessage('SYNC_DATA', 'device', '', { seq: 3 }, sender);
    expect(parseSecureJsonPayload<{ seq: number }>(after, receiver)?.seq).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// (2) no silent downgrade -- session level
// ---------------------------------------------------------------------------

const NOTES_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'nt_notes', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['notes', NOTES_POLICY]]);
const PREFIXES = new Map([['notes', 'nt_']]);

function pairedRow(remote: DeviceIdentity, sharedSecretHex: string): PairedDevice {
  const now = new Date().toISOString();
  return {
    deviceId: remote.publicKey, displayName: remote.displayName, dhPublicKey: remote.dhPublicKey,
    sharedSecretRef: `local:shared:${sharedSecretHex}`,
    lastSeenAt: now, lastSyncAt: null, lastSyncModule: null,
    bytesSent: 0, bytesReceived: 0, isActive: true, pairedAt: now,
  };
}

function connectionPair(
  deviceA: string,
  deviceB: string,
): { connA: TransportConnection; connB: TransportConnection } {
  const handlersForA: Array<(d: Uint8Array) => void> = [];
  const handlersForB: Array<(d: Uint8Array) => void> = [];
  const bufferForA: Uint8Array[] = [];
  const bufferForB: Uint8Array[] = [];
  const deliver = (handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], data: Uint8Array) => {
    if (handlers.length === 0) { buffer.push(data); return; }
    for (const h of [...handlers]) h(data);
  };
  const attach = (handlers: Array<(d: Uint8Array) => void>, buffer: Uint8Array[], h: (d: Uint8Array) => void) => {
    handlers.push(h);
    if (buffer.length > 0) for (const d of buffer.splice(0, buffer.length)) h(d);
  };
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

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;
afterEach(() => {
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
});

async function runSession(initiatorFs: boolean, responderFs: boolean) {
  const idA = generateDeviceIdentity('A');
  const idB = generateDeviceIdentity('B');
  const secret = derivePairingSharedSecret(extractDhPrivateKeyHex(idA.privateKeyRef)!, idB.dhPublicKey);

  dbA = createInMemoryTestDatabase();
  dbB = createInMemoryTestDatabase();
  for (const db of [dbA, dbB]) {
    createSyncTables(db.adapter);
    db.adapter.execute('CREATE TABLE nt_notes (id TEXT PRIMARY KEY, title TEXT, updated_at TEXT)');
  }
  insertPairedDevice(dbA.adapter, pairedRow(idB, secret));
  insertPairedDevice(dbB.adapter, pairedRow(idA, secret));

  const docA = new LwwDocumentManager();
  docA.applyChange('notes', {
    table: 'nt_notes', rowId: 'n1', operation: 'INSERT',
    data: { id: 'n1', title: 'downgrade bait', updated_at: '2026-06-30T00:00:00.000Z' },
  });

  const security = (subjectId: string): SyncSecurityPreference => ({
    subjectType: 'direct', subjectId, encryptionMode: 'required',
    disappearingMessagesEnabled: false, disappearAfterSeconds: null,
    updatedAt: new Date().toISOString(),
  });

  const makeOptions = (
    db: InMemoryTestDatabase, identity: DeviceIdentity, peer: DeviceIdentity,
    doc: LwwDocumentManager, supportsForwardSecrecy: boolean,
  ) => ({
    db: db.adapter,
    identity,
    pairedDevices: [pairedRow(peer, secret)],
    documentManager: doc as unknown as DocumentManager,
    changeTracker: new ChangeTracker({ db: db.adapter, deviceId: identity.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES }),
    enabledModules: ['notes'],
    modulePolicies: POLICIES,
    transport: 'wan_relay' as const,
    securityPreference: security(peer.publicKey),
    supportsForwardSecrecy,
  });

  const { connA, connB } = connectionPair(idA.publicKey, idB.publicKey);
  const [initiator, responder] = await Promise.all([
    runInitiatorSession(connA, makeOptions(dbA, idA, idB, docA, initiatorFs)),
    runResponderSession(connB, makeOptions(dbB, idB, idA, new LwwDocumentManager(), responderFs)),
  ]);
  return { initiator, responder };
}

describe('no silent forward-secrecy downgrade (D.6 acceptance)', () => {
  it('a one-sided withheld leg fails the session; nothing crosses in plaintext', async () => {
    // The responder refuses forward secrecy but the initiator never opted out:
    // there is NO mutual opt-out, so the session must fail rather than fall back
    // to the static-derived key.
    const { initiator, responder } = await runSession(true, false);

    expect(initiator.session.status).toBe('failed');
    expect(responder.session.status).toBe('failed');
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(0);
  });

  it('two current peers complete under a real ephemeral key (forward secrecy on)', async () => {
    const { initiator, responder } = await runSession(true, true);

    expect(initiator.session.status).toBe('completed');
    expect(responder.session.status).toBe('completed');
    expect(initiator.negotiation?.forwardSecrecy).toBe(true);
    expect(responder.negotiation?.forwardSecrecy).toBe(true);
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(1);
  });

  it('a mutual explicit opt-out is the ONLY path to the static channel', async () => {
    const { initiator, responder } = await runSession(false, false);

    expect(initiator.session.status).toBe('completed');
    expect(responder.session.status).toBe('completed');
    expect(initiator.negotiation?.forwardSecrecy).toBeFalsy();
    expect(responder.negotiation?.forwardSecrecy).toBeFalsy();
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(1);
  });
});
