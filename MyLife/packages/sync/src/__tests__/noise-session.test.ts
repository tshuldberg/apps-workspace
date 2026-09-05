/**
 * MK-011 -- forward secrecy: the dormant NoiseHandshake is now load-bearing.
 * The negotiation carries ephemeral X25519 legs inside the encrypted offer/
 * accept, and the data channel switches from the static-derived key to a
 * per-session key. Proofs:
 *   - two sessions between the same devices derive DIFFERENT keys, and
 *     ciphertext under session N's key cannot open under session N+1's key;
 *   - a captured SYNC_DATA frame from a Noise session cannot be decrypted
 *     with the static-derived key (the channel really moved);
 *   - a pre-Noise peer falls back to the static channel and still syncs.
 */

import { describe, it, expect, afterEach } from 'vitest';
import nacl from 'tweetnacl';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { DeviceIdentity, PairedDevice, SyncSecurityPreference, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { NoiseHandshake } from '../encryption/noise-handshake';
import { generateNonce } from '../encryption/keys';
import {
  createSessionPayloadSecurity,
  parseSecureJsonPayload,
  resolvePayloadEncryptionKey,
} from '../protocol/payload-security';
import { decodeMessage } from '../protocol/message-codec';
import { createSyncTables } from '../db/schema';
import { insertPairedDevice } from '../db/queries';
import { generateDeviceIdentity, extractDhPrivateKeyHex } from '../identity/device-identity';
import { derivePairingSharedSecret } from '../identity/pairing';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';
import { envelopeKeyFromSharedHex, openTappedFrame } from '../test/frame-tap';

describe('Noise session keys (MK-011 unit)', () => {
  it('two handshakes between the same devices derive different keys; cross-decrypt fails', () => {
    const a = generateDeviceIdentity('A');
    const b = generateDeviceIdentity('B');

    const run = () => {
      const initiator = new NoiseHandshake(a, b.dhPublicKey);
      const responder = new NoiseHandshake(b);
      const hello = initiator.initiatorHello();
      const reply = responder.responderReply(hello);
      const key = initiator.initiatorFinalize(reply);
      expect(key).toEqual(reply.sessionKey); // both sides agree
      return key;
    };

    const keyN = run();
    const keyN1 = run();
    expect(keyN).not.toEqual(keyN1);

    // Ciphertext captured under session N cannot open under session N+1.
    const nonce = generateNonce();
    const captured = nacl.secretbox(new TextEncoder().encode('session N secret'), nonce, keyN);
    expect(nacl.secretbox.open(captured, nonce, keyN1)).toBeNull();
    expect(nacl.secretbox.open(captured, nonce, keyN)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Live sessions
// ---------------------------------------------------------------------------

const NOTES_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'nt_notes', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['notes', NOTES_POLICY]]);
const PREFIXES = new Map([['notes', 'nt_']]);
const SYNC_DATA_TYPE_BYTE = 0x12;

function pairedRow(remote: DeviceIdentity, sharedSecretHex: string): PairedDevice {
  const now = new Date().toISOString();
  return {
    deviceId: remote.publicKey, displayName: remote.displayName, dhPublicKey: remote.dhPublicKey,
    sharedSecretRef: `local:shared:${sharedSecretHex}`,
    lastSeenAt: now, lastSyncAt: null, lastSyncModule: null,
    bytesSent: 0, bytesReceived: 0, isActive: true, pairedAt: now,
  };
}

/** Wired pair that also captures every frame delivered to B. */
function tappedConnectionPair(
  deviceA: string,
  deviceB: string,
  capturedToB: Uint8Array[],
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
    send: async (data) => {
      capturedToB.push(data);
      setTimeout(() => deliver(handlersForB, bufferForB, data), 0);
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

async function runNoiseSession(initiatorFs: boolean, responderFs: boolean) {
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
    data: { id: 'n1', title: 'forward secret note', updated_at: '2026-06-11T00:00:00.000Z' },
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

  const capturedToB: Uint8Array[] = [];
  const { connA, connB } = tappedConnectionPair(idA.publicKey, idB.publicKey, capturedToB);
  const [initiator, responder] = await Promise.all([
    runInitiatorSession(connA, makeOptions(dbA, idA, idB, docA, initiatorFs)),
    runResponderSession(connB, makeOptions(dbB, idB, idA, new LwwDocumentManager(), responderFs)),
  ]);

  const staticKey = resolvePayloadEncryptionKey({
    pairedDevices: [pairedRow(idA, secret)],
    localDeviceId: idB.publicKey,
    remoteDeviceId: idA.publicKey,
    subjectType: 'direct',
    subjectId: idA.publicKey,
    kdfVersion: 2,
  })!;
  // The wire now carries pairwise frame envelopes (MK-044): open them like
  // the peer would, then find the inner SYNC_DATA codec frame.
  const envelopeKey = envelopeKeyFromSharedHex(secret, idA.publicKey, idB.publicKey);
  const syncDataFrame = capturedToB
    .map((frame) => openTappedFrame(envelopeKey, frame))
    .find((inner): inner is Uint8Array => inner !== null && inner[4] === SYNC_DATA_TYPE_BYTE)!;

  return { initiator, responder, staticKey, syncDataFrame };
}

describe('Noise-secured sessions (MK-011 acceptance)', () => {
  it('the data channel leaves the static key: captured SYNC_DATA is unreadable with it', async () => {
    const { initiator, responder, staticKey, syncDataFrame } = await runNoiseSession(true, true);

    expect(initiator.session.status).toBe('completed');
    expect(initiator.negotiation?.forwardSecrecy).toBe(true);
    expect(responder.negotiation?.forwardSecrecy).toBe(true);
    // The note still landed (both ends derived the SAME ephemeral key).
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(1);

    // The captured frame does NOT open under the static-derived key.
    const msg = decodeMessage(syncDataFrame)!;
    const parsedWithStatic = parseSecureJsonPayload(msg, createSessionPayloadSecurity(staticKey, true));
    expect(parsedWithStatic).toBeNull();
  });

  it('a one-sided FS opt-out fails the session (no silent static downgrade)', async () => {
    // D.6: the responder opts out of forward secrecy but the initiator did not.
    // There is no mutual opt-out, so the session fails closed rather than
    // quietly running on the static-derived key.
    const { initiator, responder } = await runNoiseSession(true, false);

    expect(initiator.session.status).toBe('failed');
    expect(responder.session.status).toBe('failed');
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(0);
  });

  it('a mutual explicit opt-out is the only sanctioned static-channel path', async () => {
    const { initiator, responder, staticKey, syncDataFrame } = await runNoiseSession(false, false);

    expect(initiator.session.status).toBe('completed');
    expect(initiator.negotiation?.forwardSecrecy).toBeFalsy();
    expect(responder.negotiation?.forwardSecrecy).toBeFalsy();
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(1);

    // The mutual opt-out keeps the (unratcheted) static channel: the frame DOES
    // open under the static-derived key, proving the capture is sound.
    const msg = decodeMessage(syncDataFrame)!;
    const parsedWithStatic = parseSecureJsonPayload(msg, createSessionPayloadSecurity(staticKey, true));
    expect(parsedWithStatic).not.toBeNull();
  });
});
