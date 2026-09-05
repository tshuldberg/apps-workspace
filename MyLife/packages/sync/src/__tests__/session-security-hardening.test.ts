/**
 * Session security hardening acceptance (closes the 2026-06-12 audit's three
 * criticals at their seams):
 *
 *  1. Sessions DEFAULT to required encryption: with no securityPreference
 *     passed at all, the wire carries only sealed MK-044 envelopes -- no
 *     device public keys, no message types, no plaintext payload bytes.
 *  2. An initiator dialing an unpaired peer fails closed before a single
 *     byte crosses the pipe.
 *  3. A dropped SYNC_OFFER / SYNC_ACCEPT negotiation frame is a hard session
 *     failure, never a silent plaintext downgrade.
 *  4. A forged or over-broad SYNC_ACK can never mark undelivered changes as
 *     synced (receipts are intersected with what the batch actually carried).
 *  5. Frame-envelope unit behavior: tamper/wrong-key/wrong-version all drop.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { DeviceIdentity, PairedDevice, SyncMessage, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { createSyncTables } from '../db/schema';
import { insertPairedDevice } from '../db/queries';
import { generateDeviceIdentity, extractDhPrivateKeyHex } from '../identity/device-identity';
import { derivePairingSharedSecret } from '../identity/pairing';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';
import { responderHandshake } from '../protocol/handshake';
import {
  createSecureJsonMessage,
  createSessionPayloadSecurity,
  parseSecureJsonPayload,
  resolvePayloadEncryptionKey,
} from '../protocol/payload-security';
import { decodeMessage, encodeMessage } from '../protocol/message-codec';
import {
  deriveFrameEnvelopeKey,
  FRAME_ENVELOPE_VERSION,
  openFrame,
  sealFrame,
  wrapConnectionWithFrameEnvelope,
} from '../protocol/frame-envelope';
import { decodeTappedMessage, envelopeKeyFromSharedHex } from '../test/frame-tap';

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

type DropPredicate = (wire: Uint8Array, fromA: boolean) => boolean;

/** Wired in-memory pair with a full wire capture and an optional frame drop. */
function wiredPair(
  deviceA: string,
  deviceB: string,
  drop?: DropPredicate,
): { connA: TransportConnection; connB: TransportConnection; wire: Uint8Array[] } {
  const handlersForA: Array<(d: Uint8Array) => void> = [];
  const handlersForB: Array<(d: Uint8Array) => void> = [];
  const bufferForA: Uint8Array[] = [];
  const bufferForB: Uint8Array[] = [];
  const wire: Uint8Array[] = [];
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
    send: async (data) => {
      wire.push(data);
      if (drop?.(data, true)) return;
      setTimeout(() => deliver(handlersForB, bufferForB, data), 0);
    },
    onData: (h) => attach(handlersForA, bufferForA, h),
    close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'conn-b', remoteDeviceId: deviceA, transport: 'wan_relay',
    send: async (data) => {
      wire.push(data);
      if (drop?.(data, false)) return;
      setTimeout(() => deliver(handlersForA, bufferForA, data), 0);
    },
    onData: (h) => attach(handlersForB, bufferForB, h),
    close: async () => {},
  };
  return { connA, connB, wire };
}

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;
afterEach(() => {
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
});

function setupPair() {
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
  return { idA, idB, secret };
}

function makeOptions(
  db: InMemoryTestDatabase,
  identity: DeviceIdentity,
  peer: DeviceIdentity,
  secret: string,
  doc: LwwDocumentManager,
  tracker?: ChangeTracker,
) {
  return {
    db: db.adapter,
    identity,
    pairedDevices: [pairedRow(peer, secret)],
    documentManager: doc as unknown as DocumentManager,
    changeTracker: tracker ?? new ChangeTracker({ db: db.adapter, deviceId: identity.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES }),
    enabledModules: ['notes'],
    modulePolicies: POLICIES,
    transport: 'wan_relay' as const,
    // Deliberately NO securityPreference: the default must be 'required'.
  };
}

describe('default-required encryption + frame envelope (audit criticals 1 and 2)', () => {
  it('a session with NO security preference still encrypts everything: the wire shows no identities, types, or payload bytes', async () => {
    const { idA, idB, secret } = setupPair();
    const docA = new LwwDocumentManager();
    const note = { id: 'n1', title: 'private words', updated_at: '2026-06-12T00:00:00.000Z' };
    docA.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note });

    const { connA, connB, wire } = wiredPair(idA.publicKey, idB.publicKey);
    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, makeOptions(dbA!, idA, idB, secret, docA)),
      runResponderSession(connB, makeOptions(dbB!, idB, idA, secret, new LwwDocumentManager())),
    ]);

    // The session worked end to end.
    expect(initiator.session.status).toBe('completed');
    expect(responder.session.status).toBe('completed');
    expect(initiator.negotiation?.securityAgreement?.encryptionConfirmed).toBe(true);
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(1);

    // And the wire gave a passive observer NOTHING:
    expect(wire.length).toBeGreaterThan(0);
    for (const frame of wire) {
      // every frame is a sealed envelope, never a bare codec frame
      expect(frame[0]).toBe(FRAME_ENVELOPE_VERSION);
      expect(decodeMessage(frame)).toBeNull();
      const hex = Buffer.from(frame).toString('hex');
      const text = Buffer.from(frame).toString('latin1');
      expect(hex.includes(idA.publicKey)).toBe(false);
      expect(hex.includes(idB.publicKey)).toBe(false);
      expect(text.includes('syncData')).toBe(false);
      expect(text.includes('private words')).toBe(false);
    }
  });

  it('dialing an unpaired peer fails closed before any byte crosses', async () => {
    const { idA, idB } = setupPair();
    const { connA, wire } = wiredPair(idA.publicKey, idB.publicKey);

    const result = await runInitiatorSession(connA, {
      db: dbA!.adapter,
      identity: idA,
      pairedDevices: [], // nothing paired
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
      changeTracker: new ChangeTracker({ db: dbA!.adapter, deviceId: idA.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES }),
      enabledModules: ['notes'],
      modulePolicies: POLICIES,
      transport: 'wan_relay',
    });

    expect(result.session.status).toBe('failed');
    expect(result.session.error).toContain('Frame envelope key unavailable');
    expect(wire).toHaveLength(0);
  });
});

describe('negotiation fails closed (audit critical: plaintext downgrade)', () => {
  it('a dropped SYNC_OFFER fails BOTH sessions; zero data crosses', async () => {
    const { idA, idB, secret } = setupPair();
    const docA = new LwwDocumentManager();
    docA.applyChange('notes', {
      table: 'nt_notes', rowId: 'n1', operation: 'INSERT',
      data: { id: 'n1', title: 'must never leak', updated_at: '2026-06-12T00:00:00.000Z' },
    });

    const envelopeKey = envelopeKeyFromSharedHex(secret, idA.publicKey, idB.publicKey);
    const { connA, connB } = wiredPair(idA.publicKey, idB.publicKey, (frame, fromA) => {
      if (!fromA) return false;
      const msg = decodeTappedMessage(envelopeKey, frame);
      return msg?.type === 'SYNC_OFFER'; // the MITM eats exactly one frame
    });

    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, makeOptions(dbA!, idA, idB, secret, docA)),
      runResponderSession(connB, makeOptions(dbB!, idB, idA, secret, new LwwDocumentManager())),
    ]);

    expect(initiator.session.status).toBe('failed');
    expect(initiator.session.error).toBe('Security negotiation response missing');
    expect(responder.session.status).toBe('failed');
    expect(responder.session.error).toBe('Security negotiation offer missing');
    expect(dbB!.adapter.query('SELECT * FROM nt_notes')).toHaveLength(0);
  }, 30_000);

  it('a withheld SYNC_ACCEPT fails the initiator; nothing proceeds in plaintext', async () => {
    const { idA, idB, secret } = setupPair();
    const docA = new LwwDocumentManager();
    docA.applyChange('notes', {
      table: 'nt_notes', rowId: 'n1', operation: 'INSERT',
      data: { id: 'n1', title: 'must never leak', updated_at: '2026-06-12T00:00:00.000Z' },
    });

    const { connA, connB, wire } = wiredPair(idA.publicKey, idB.publicKey);

    // Scripted responder: completes the handshake, reads the SYNC_OFFER, and
    // never replies (a stalling or stripping peer/relay).
    const pairedA = [pairedRow(idA, secret)];
    const wrappedB = wrapConnectionWithFrameEnvelope(connB, { identity: idB, pairedDevices: pairedA });
    const responderScript = (async () => {
      const hs = await responderHandshake(wrappedB, idB, pairedA, []);
      expect(hs.success).toBe(true);
      wrappedB.onData(() => { /* swallow the offer, never answer */ });
    })();

    const initiator = await runInitiatorSession(connA, makeOptions(dbA!, idA, idB, secret, docA));
    await responderScript;

    expect(initiator.session.status).toBe('failed');
    expect(initiator.session.error).toBe('Security negotiation response missing');
    // No SYNC_DATA ever crossed the wire, sealed or otherwise.
    const envelopeKey = envelopeKeyFromSharedHex(secret, idA.publicKey, idB.publicKey);
    const types = wire.map((f) => decodeTappedMessage(envelopeKey, f)?.type).filter(Boolean);
    expect(types).not.toContain('SYNC_DATA');
  }, 30_000);
});

describe('receipt forgery (audit high: false markSynced)', () => {
  it('an over-broad SYNC_ACK yields zero receipts: forged ids never mark changes synced', async () => {
    const { idA, idB, secret } = setupPair();
    const note = { id: 'n1', title: 'deliver me', updated_at: '2026-06-12T00:00:00.000Z' };
    const docA = new LwwDocumentManager();
    docA.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note });
    const ctA = new ChangeTracker({ db: dbA!.adapter, deviceId: idA.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
    ctA.recordChange('nt_notes', 'INSERT', 'n1', note);
    expect(ctA.getUnsynced()).toHaveLength(1);

    const { connA, connB } = wiredPair(idA.publicKey, idB.publicKey);
    const pairedA = [pairedRow(idA, secret)];
    const wrappedB = wrapConnectionWithFrameEnvelope(connB, { identity: idB, pairedDevices: pairedA });

    // Scripted malicious responder: speaks the protocol honestly up to the
    // data channel, then acks change ids it never received.
    const responderScript = (async () => {
      const hs = await responderHandshake(wrappedB, idB, pairedA, []);
      expect(hs.success).toBe(true);

      // Attach the inbox only AFTER the handshake so its frames are not
      // swallowed into the queue.
      const inbox: SyncMessage[] = [];
      const waiters: Array<(m: SyncMessage) => void> = [];
      wrappedB.onData((data) => {
        const m = decodeMessage(data);
        if (!m) return;
        const w = waiters.shift();
        if (w) w(m); else inbox.push(m);
      });
      const nextMessage = (): Promise<SyncMessage> => {
        const queued = inbox.shift();
        if (queued) return Promise.resolve(queued);
        return new Promise((resolve) => waiters.push(resolve));
      };

      // Negotiation channel: same derivation the initiator uses (v1).
      const negoKey = resolvePayloadEncryptionKey({
        pairedDevices: pairedA,
        localDeviceId: idB.publicKey,
        remoteDeviceId: idA.publicKey,
        subjectType: 'direct',
        subjectId: idA.publicKey,
      })!;
      const negoSec = createSessionPayloadSecurity(negoKey, true);
      const offer = await nextMessage();
      expect(offer.type).toBe('SYNC_OFFER');

      const accept = createSecureJsonMessage('SYNC_ACCEPT', idB.publicKey, '', {
        kdfVersions: [2, 1],
        security: {
          subjectType: 'direct', subjectId: idA.publicKey, encryptionMode: 'required',
          canEncrypt: true, disappearingMessagesEnabled: false, disappearAfterSeconds: null,
        },
        // D.6: no noise leg, but a MUTUAL forward-secrecy opt-out (the initiator
        // also opts out below), so the data channel legitimately stays on the
        // static-derived v2 key. This exercises the ack-forgery path on the
        // sanctioned static channel, not a silent downgrade.
        fsOptOut: true,
      }, negoSec);
      await wrappedB.send(encodeMessage(accept));

      const dataKey = resolvePayloadEncryptionKey({
        pairedDevices: pairedA,
        localDeviceId: idB.publicKey,
        remoteDeviceId: idA.publicKey,
        subjectType: 'direct',
        subjectId: idA.publicKey,
        kdfVersion: 2,
      })!;
      const dataSec = createSessionPayloadSecurity(dataKey, true);
      const dataMsg = await nextMessage();
      expect(dataMsg.type).toBe('SYNC_DATA');
      const payload = parseSecureJsonPayload<{ moduleId: string; changeIds?: string[] }>(dataMsg, dataSec)!;
      expect(payload.moduleId).toBe('notes');

      // The forgery: ack ONLY ids this batch never carried.
      const forgedAck = createSecureJsonMessage('SYNC_ACK', idB.publicKey, '', {
        moduleId: 'notes',
        changeIds: ['forged-id-1', 'forged-id-2'],
      }, dataSec);
      await wrappedB.send(encodeMessage(forgedAck));
    })();

    const initiator = await runInitiatorSession(connA, {
      ...makeOptions(dbA!, idA, idB, secret, docA, ctA),
      // D.6: opt out of forward secrecy so the mutual opt-out with the scripted
      // responder keeps this test on the static-derived channel it inspects.
      supportsForwardSecrecy: false,
    });
    await responderScript;

    expect(initiator.session.status).toBe('completed');
    // The forged ack bought the attacker nothing: no receipts, change still
    // queued for a future honest delivery.
    expect(dbA!.adapter.query('SELECT * FROM sync_receipts')).toHaveLength(0);
    expect(ctA.getUnsynced()).toHaveLength(1);
  }, 30_000);
});

describe('frame envelope (MK-044 unit)', () => {
  const a = generateDeviceIdentity('A');
  const b = generateDeviceIdentity('B');
  const secret = derivePairingSharedSecret(extractDhPrivateKeyHex(a.privateKeyRef)!, b.dhPublicKey);
  const key = deriveFrameEnvelopeKey(Buffer.from(secret.slice(0, 64), 'hex'), a.publicKey, b.publicKey);

  it('round-trips a frame and is direction-symmetric', () => {
    const frame = new TextEncoder().encode('frame bytes');
    const keyOtherOrder = deriveFrameEnvelopeKey(Buffer.from(secret.slice(0, 64), 'hex'), b.publicKey, a.publicKey);
    expect(openFrame(key, sealFrame(key, frame))).toEqual(frame);
    expect(openFrame(keyOtherOrder, sealFrame(key, frame))).toEqual(frame);
  });

  it('drops tampered, wrong-key, truncated, and wrong-version envelopes', () => {
    const frame = new TextEncoder().encode('frame bytes');
    const sealed = sealFrame(key, frame);

    const tampered = sealed.slice();
    tampered[tampered.length - 1]! ^= 0x01;
    expect(openFrame(key, tampered)).toBeNull();

    const otherKey = deriveFrameEnvelopeKey(new Uint8Array(32).fill(7), a.publicKey, b.publicKey);
    expect(openFrame(otherKey, sealed)).toBeNull();

    expect(openFrame(key, sealed.slice(0, 10))).toBeNull();

    const wrongVersion = sealed.slice();
    wrongVersion[0] = 0x01;
    expect(openFrame(key, wrongVersion)).toBeNull();
  });

  it('wrapped sender with no resolvable peer throws instead of sending bare frames', () => {
    const bare: TransportConnection = {
      id: 'x', remoteDeviceId: '', transport: 'wan_relay',
      send: async () => { throw new Error('must not be reached'); },
      onData: () => {},
      close: async () => {},
    };
    const wrapped = wrapConnectionWithFrameEnvelope(bare, { identity: a, pairedDevices: [] });
    expect(() => wrapped.send(new Uint8Array([1, 2, 3]))).toThrow('Frame envelope key unavailable');
  });
});
