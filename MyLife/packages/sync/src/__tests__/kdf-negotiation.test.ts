/**
 * MK-010 -- KDF v2 (RFC 5869 HKDF) with versioned negotiation. New sessions
 * agree on v2; a peer that only speaks v1 (or predates negotiation) falls back
 * inside the compatibility window, and the session still completes with
 * ENCRYPTED payloads either way.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { DeviceIdentity, PairedDevice, SyncSecurityPreference, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { deriveKey, deriveKeyV2, hexToBytes } from '../encryption/keys';
import {
  negotiateKdfVersion,
  resolvePayloadEncryptionKey,
  SUPPORTED_KDF_VERSIONS,
} from '../protocol/payload-security';
import { createSyncTables } from '../db/schema';
import { insertPairedDevice } from '../db/queries';
import { generateDeviceIdentity, extractDhPrivateKeyHex } from '../identity/device-identity';
import { derivePairingSharedSecret } from '../identity/pairing';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';

describe('KDF v2 derivation (MK-010)', () => {
  const secret = hexToBytes('ab'.repeat(32));

  it('is deterministic and 32 bytes', () => {
    const a = deriveKeyV2(secret, 'info-string');
    expect(a).toHaveLength(32);
    expect(deriveKeyV2(secret, 'info-string')).toEqual(a);
  });

  it('differs from v1 for the same inputs and separates by info', () => {
    expect(deriveKeyV2(secret, 'x')).not.toEqual(deriveKey(secret, 'x'));
    expect(deriveKeyV2(secret, 'x')).not.toEqual(deriveKeyV2(secret, 'y'));
  });

  it('resolvePayloadEncryptionKey derives different keys per kdf version, same per side', () => {
    const paired: PairedDevice = {
      deviceId: 'remote', displayName: 'r', dhPublicKey: 'dh',
      sharedSecretRef: `local:shared:${'ab'.repeat(32)}`,
      lastSeenAt: null, lastSyncAt: null, lastSyncModule: null,
      bytesSent: 0, bytesReceived: 0, isActive: true, pairedAt: '',
    } as unknown as PairedDevice;
    const base = {
      pairedDevices: [paired], localDeviceId: 'local', remoteDeviceId: 'remote',
      subjectType: 'direct' as const, subjectId: 'remote',
    };
    const v1 = resolvePayloadEncryptionKey({ ...base, kdfVersion: 1 })!;
    const v2 = resolvePayloadEncryptionKey({ ...base, kdfVersion: 2 })!;
    const v2Again = resolvePayloadEncryptionKey({ ...base, kdfVersion: 2 })!;
    expect(v1).not.toEqual(v2);
    expect(v2).toEqual(v2Again);
    // Default (no version) stays v1: the fallback window.
    expect(resolvePayloadEncryptionKey(base)!).toEqual(v1);
  });
});

describe('negotiateKdfVersion (MK-010)', () => {
  it('picks the highest mutual version', () => {
    expect(negotiateKdfVersion([2, 1], [2, 1])).toBe(2);
    expect(negotiateKdfVersion([2, 1], [1])).toBe(1);
    expect(negotiateKdfVersion([1], [2, 1])).toBe(1);
  });

  it('falls back to v1 for peers that predate negotiation', () => {
    expect(negotiateKdfVersion([2, 1], undefined)).toBe(1);
    expect(negotiateKdfVersion([2, 1], [])).toBe(1);
  });

  it('the default supported list leads with v2', () => {
    expect(SUPPORTED_KDF_VERSIONS[0]).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Cross-version encrypted sessions
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

function connectionPair(deviceA: string, deviceB: string): { connA: TransportConnection; connB: TransportConnection } {
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

async function runEncryptedSession(kdfA: readonly number[] | undefined, kdfB: readonly number[] | undefined) {
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
    data: { id: 'n1', title: 'encrypted note', updated_at: '2026-06-11T00:00:00.000Z' },
  });

  const security = (subjectId: string): SyncSecurityPreference => ({
    subjectType: 'direct', subjectId, encryptionMode: 'required',
    disappearingMessagesEnabled: false, disappearAfterSeconds: null,
    updatedAt: new Date().toISOString(),
  });

  const makeOptions = (
    db: InMemoryTestDatabase, identity: DeviceIdentity, peer: DeviceIdentity,
    doc: LwwDocumentManager, kdf: readonly number[] | undefined,
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
    supportedKdfVersions: kdf,
  });

  const { connA, connB } = connectionPair(idA.publicKey, idB.publicKey);
  const [initiator, responder] = await Promise.all([
    runInitiatorSession(connA, makeOptions(dbA, idA, idB, docA, kdfA)),
    runResponderSession(connB, makeOptions(dbB, idB, idA, new LwwDocumentManager(), kdfB)),
  ]);
  return { initiator, responder, dbB };
}

describe('cross-version encrypted sessions (MK-010 acceptance)', () => {
  it('two current peers negotiate kdf v2 and the encrypted note lands', async () => {
    const { initiator, responder } = await runEncryptedSession(undefined, undefined);
    expect(initiator.session.status).toBe('completed');
    expect(initiator.negotiation?.kdfVersion).toBe(2);
    expect(responder.negotiation?.kdfVersion).toBe(2);
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(1);
  });

  it('a v1-only peer falls back inside the compatibility window and still syncs', async () => {
    const { initiator, responder } = await runEncryptedSession(undefined, [1]);
    expect(initiator.session.status).toBe('completed');
    expect(initiator.negotiation?.kdfVersion).toBe(1);
    expect(responder.negotiation?.kdfVersion).toBe(1);
    expect(dbB!.adapter.query('SELECT * FROM nt_notes WHERE id = ?', ['n1'])).toHaveLength(1);
  });
});
