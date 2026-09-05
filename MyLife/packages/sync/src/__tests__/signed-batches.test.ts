/**
 * MK-013 -- Ed25519-signed change batches, hardened: every batch MUST carry a
 * valid author signature. Beneath the MK-044 frame envelope this is defense
 * in depth: even an attacker who somehow holds the pair's envelope key (but
 * not the author's signing key) cannot tamper with, forge, or strip the
 * signature from a batch without rejection + audit.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { DeviceIdentity, PairedDevice, SyncSecurityPreference, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { signBatch, verifyBatch } from '../protocol/batch-signature';
import { createSyncTables } from '../db/schema';
import { insertPairedDevice, getInboundAudit } from '../db/queries';
import { generateDeviceIdentity, extractDhPrivateKeyHex } from '../identity/device-identity';
import { derivePairingSharedSecret } from '../identity/pairing';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';
import { sealFrame } from '../protocol/frame-envelope';
import { decodeMessage, encodeMessage, createJsonMessage, parseJsonPayload } from '../protocol/message-codec';
import { envelopeKeyFromSharedHex, openTappedFrame } from '../test/frame-tap';

describe('batch signatures (MK-013 unit)', () => {
  const author = generateDeviceIdentity('Author');
  const data = new TextEncoder().encode('snapshot bytes');
  const ids = ['c1', 'c2'];

  it('signs and verifies a batch', () => {
    const sig = signBatch(author, 'notes', data, ids)!;
    expect(sig).toBeTruthy();
    expect(verifyBatch(author.publicKey, 'notes', data, ids, sig)).toBe(true);
  });

  it('rejects a forged author', () => {
    const impostor = generateDeviceIdentity('Impostor');
    const sig = signBatch(impostor, 'notes', data, ids)!;
    expect(verifyBatch(author.publicKey, 'notes', data, ids, sig)).toBe(false);
  });

  it('rejects tampering with any signed field', () => {
    const sig = signBatch(author, 'notes', data, ids)!;
    expect(verifyBatch(author.publicKey, 'meds', data, ids, sig)).toBe(false);
    expect(verifyBatch(author.publicKey, 'notes', new TextEncoder().encode('other'), ids, sig)).toBe(false);
    expect(verifyBatch(author.publicKey, 'notes', data, ['c1'], sig)).toBe(false);
    expect(verifyBatch(author.publicKey, 'notes', data, ids, 'ff'.repeat(64))).toBe(false);
    expect(verifyBatch(author.publicKey, 'notes', data, ids, 'not-hex')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Live sessions. The payload channel is explicitly 'off' on both sides so the
// SIGNATURE is the integrity layer under test; the MK-044 frame envelope
// still wraps the wire, so each attacker model states what keys it holds.
// ---------------------------------------------------------------------------

const NOTES_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'nt_notes', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['notes', NOTES_POLICY]]);
const PREFIXES = new Map([['notes', 'nt_']]);
const SYNC_DATA_TYPE_BYTE = 0x12;

type TamperMode = 'none' | 'wire' | 'inner' | 'strip-sig';

function pairedRow(remote: DeviceIdentity, sharedSecretHex: string): PairedDevice {
  const now = new Date().toISOString();
  return {
    deviceId: remote.publicKey, displayName: remote.displayName, dhPublicKey: remote.dhPublicKey,
    sharedSecretRef: `local:shared:${sharedSecretHex}`,
    lastSeenAt: now, lastSyncAt: null, lastSyncModule: null,
    bytesSent: 0, bytesReceived: 0, isActive: true, pairedAt: now,
  };
}

/**
 * Flip one digit inside the plaintext SYNC_DATA JSON's syncData array, keeping
 * valid JSON, so the tamper reaches the signature check rather than a parser.
 * Operates on INNER codec bytes (header is 4+1+64+32+8 = 109).
 */
function tamperSyncData(frame: Uint8Array): Uint8Array {
  const text = new TextDecoder().decode(frame.slice(109));
  const marker = '"syncData":[';
  const start = text.indexOf(marker);
  if (start === -1) return frame;
  for (let i = start + marker.length; i < text.length; i++) {
    const ch = text[i]!;
    if (ch >= '0' && ch <= '9') {
      const flipped = ch === '9' ? '8' : String(Number(ch) + 1);
      const mutated = text.slice(0, i) + flipped + text.slice(i + 1);
      const out = new Uint8Array(frame.length);
      out.set(frame.slice(0, 109), 0);
      out.set(new TextEncoder().encode(mutated), 109);
      return out;
    }
  }
  return frame;
}

/** Rebuild the inner SYNC_DATA frame with the sig field removed. */
function stripSig(frame: Uint8Array): Uint8Array {
  const msg = decodeMessage(frame);
  if (!msg) return frame;
  const payload = parseJsonPayload<Record<string, unknown>>(msg);
  if (!payload) return frame;
  delete payload.sig;
  return encodeMessage(createJsonMessage('SYNC_DATA', msg.deviceId, msg.nonce, payload));
}

function tamperingConnectionPair(
  deviceA: string,
  deviceB: string,
  mode: TamperMode,
  envelopeKey: Uint8Array,
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
  const mutate = (data: Uint8Array): Uint8Array => {
    if (mode === 'none') return data;
    const inner = openTappedFrame(envelopeKey, data);
    if (!inner || inner[4] !== SYNC_DATA_TYPE_BYTE) return data;
    if (mode === 'wire') {
      // Blind wire MITM: no keys, flips one ciphertext byte. The envelope's
      // authenticated decryption must drop the whole frame at the receiver.
      const out = data.slice();
      out[out.length - 1]! ^= 0x01;
      return out;
    }
    if (mode === 'inner') {
      // Envelope-key-holding attacker: opens, tampers the signed bytes,
      // re-seals validly. Only the batch signature can catch this.
      return sealFrame(envelopeKey, tamperSyncData(inner));
    }
    // strip-sig: same attacker removes the signature field entirely. The
    // hardened responder must reject the unsigned batch, not skip the check.
    return sealFrame(envelopeKey, stripSig(inner));
  };
  const connA: TransportConnection = {
    id: 'conn-a', remoteDeviceId: deviceB, transport: 'wan_relay',
    send: async (data) => {
      const wire = mutate(data);
      setTimeout(() => deliver(handlersForB, bufferForB, wire), 0);
    },
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

async function runOffChannelSession(mode: TamperMode) {
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
    data: { id: 'n1', title: 'signed batch', updated_at: '2026-06-11T00:00:00.000Z' },
  });

  // Payload channel explicitly OFF on both sides: the signature carries the
  // batch's integrity here (sessions now default to required encryption, so
  // plaintext payloads only ever exist by this explicit mutual opt-out).
  const offSecurity: SyncSecurityPreference = {
    subjectType: 'direct', subjectId: 'sig-test', encryptionMode: 'off',
    disappearingMessagesEnabled: false, disappearAfterSeconds: null,
    updatedAt: new Date().toISOString(),
  };
  const makeOptions = (db: InMemoryTestDatabase, identity: DeviceIdentity, peer: DeviceIdentity, doc: LwwDocumentManager) => ({
    db: db.adapter,
    identity,
    pairedDevices: [pairedRow(peer, secret)],
    documentManager: doc as unknown as DocumentManager,
    changeTracker: new ChangeTracker({ db: db.adapter, deviceId: identity.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES }),
    enabledModules: ['notes'],
    modulePolicies: POLICIES,
    transport: 'wan_relay' as const,
    securityPreference: offSecurity,
  });

  const envelopeKey = envelopeKeyFromSharedHex(secret, idA.publicKey, idB.publicKey);
  const { connA, connB } = tamperingConnectionPair(idA.publicKey, idB.publicKey, mode, envelopeKey);
  const [initiator] = await Promise.all([
    runInitiatorSession(connA, makeOptions(dbA, idA, idB, docA)),
    runResponderSession(connB, makeOptions(dbB, idB, idA, new LwwDocumentManager())),
  ]);
  return { initiator, idA };
}

describe('signed batches in live sessions (MK-013 acceptance, hardened)', () => {
  it('honest session: batch verifies and the author is surfaced in the activity trail', async () => {
    const { initiator, idA } = await runOffChannelSession('none');
    expect(initiator.session.status).toBe('completed');
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(1);

    const accepted = getInboundAudit(dbB!.adapter, { outcome: 'accepted' })
      .filter((row) => row.reason === 'batch_author_verified');
    expect(accepted).toHaveLength(1);
    expect(accepted[0]!.peerDeviceId).toBe(idA.publicKey);
  });

  it('a blind wire MITM flipping ciphertext: the envelope drops the frame, nothing applied', async () => {
    await runOffChannelSession('wire');

    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(0);
    // The frame never reached the codec, so no batch audit row exists at all.
    const audited = getInboundAudit(dbB!.adapter, { outcome: 'rejected' });
    expect(audited.filter((row) => row.operation === 'SYNC_DATA')).toHaveLength(0);
    // And the sender holds no receipt.
    expect(dbA!.adapter.query('SELECT * FROM sync_receipts')).toHaveLength(0);
  }, 20_000);

  it('an envelope-key holder tampering the signed bytes: rejected + audited, nothing applied', async () => {
    await runOffChannelSession('inner');

    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(0);
    const rejected = getInboundAudit(dbB!.adapter, { outcome: 'rejected' })
      .filter((row) => row.reason === 'bad_batch_signature');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.operation).toBe('SYNC_DATA');
    expect(dbA!.adapter.query('SELECT * FROM sync_receipts')).toHaveLength(0);
  }, 20_000);

  it('a stripped signature is rejected as missing, never silently accepted', async () => {
    await runOffChannelSession('strip-sig');

    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(0);
    const rejected = getInboundAudit(dbB!.adapter, { outcome: 'rejected' })
      .filter((row) => row.reason === 'missing_batch_signature');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.operation).toBe('SYNC_DATA');
    expect(dbA!.adapter.query('SELECT * FROM sync_receipts')).toHaveLength(0);
  }, 20_000);
});
