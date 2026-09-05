/**
 * MK-027 -- the blob pipeline live: BLOB_REQUEST/BLOB_DATA in a real session.
 *
 * The bellwether: a "photo" (real multi-block bytes) attached on device A via a
 * blob_hash column lands on device B verified and stored. Resume: blocks staged
 * by an interrupted transfer are NOT re-sent. Size caps from sync_blob_policy
 * are enforced on both ends.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { PairedDevice, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { createSyncTables } from '../db/schema';
import { generateDeviceIdentity } from '../identity/device-identity';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';
import { decodeTappedMessage, envelopeKeyFromSharedHex } from '../test/frame-tap';
import { getBlob, upsertBlobPolicy } from '../db/queries';
import {
  BLOB_TRANSFER_BLOCK_SIZE,
  assembleStagedBlob,
  blobContentHash,
  collectBlobRefs,
  getStagedBlockIndices,
  splitBlobForTransfer,
  stageBlobBlock,
  type SessionBlobProvider,
} from '../protocol/blob-transfer';

const SECRET = 'ef'.repeat(32);

const NOTES_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'nt_notes', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['notes', NOTES_POLICY]]);
const PREFIXES = new Map([['notes', 'nt_']]);

function paired(deviceId: string, dhPublicKey: string): PairedDevice {
  return {
    // Forward secrecy (D.6) needs the peer's real DH public key.
    deviceId, displayName: 'peer', dhPublicKey,
    sharedSecretRef: `local:shared:${SECRET}`, isActive: true,
  } as unknown as PairedDevice;
}

/** A deterministic multi-block "photo" (~3.2 blocks at 16 KiB). */
function makePhotoBytes(size = 52_000): Uint8Array {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 31 + 7) % 251;
  return bytes;
}

function memoryBlobStore() {
  const store = new Map<string, Uint8Array>();
  const puts: Array<{ hash: string; moduleId: string }> = [];
  const provider: SessionBlobProvider = {
    get: (hash) => store.get(hash) ?? null,
    put: (hash, bytes, meta) => {
      store.set(hash, bytes);
      puts.push({ hash, moduleId: meta.moduleId });
    },
  };
  return { store, puts, provider };
}

function tappedConnectionPair(deviceA: string, deviceB: string) {
  const captured: Uint8Array[] = [];
  const handlersForA: Array<(d: Uint8Array) => void> = [];
  const handlersForB: Array<(d: Uint8Array) => void> = [];
  const bufferForA: Uint8Array[] = [];
  const bufferForB: Uint8Array[] = [];
  const deliver = (h: Array<(d: Uint8Array) => void>, buf: Uint8Array[], d: Uint8Array) => {
    if (h.length === 0) { buf.push(d); return; }
    for (const f of [...h]) f(d);
  };
  const attach = (h: Array<(d: Uint8Array) => void>, buf: Uint8Array[], f: (d: Uint8Array) => void) => {
    h.push(f);
    if (buf.length) for (const d of buf.splice(0)) f(d);
  };
  const connA: TransportConnection = {
    id: 'a', remoteDeviceId: deviceB, transport: 'wan_relay',
    send: async (d) => { captured.push(d); setTimeout(() => deliver(handlersForB, bufferForB, d), 0); },
    onData: (f) => attach(handlersForA, bufferForA, f),
    close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'b', remoteDeviceId: deviceA, transport: 'wan_relay',
    send: async (d) => { captured.push(d); setTimeout(() => deliver(handlersForA, bufferForA, d), 0); },
    onData: (f) => attach(handlersForB, bufferForB, f),
    close: async () => {},
  };
  return { connA, connB, captured };
}

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;
afterEach(() => {
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
});

function setupDbs() {
  dbA = createInMemoryTestDatabase();
  dbB = createInMemoryTestDatabase();
  for (const db of [dbA.adapter, dbB.adapter]) {
    createSyncTables(db);
    db.execute('CREATE TABLE nt_notes (id TEXT PRIMARY KEY, title TEXT, blob_hash TEXT, updated_at TEXT)');
  }
}

function makeSessionPair(
  idA: ReturnType<typeof generateDeviceIdentity>,
  idB: ReturnType<typeof generateDeviceIdentity>,
  photoHash: string,
) {
  const docA = new LwwDocumentManager();
  docA.applyChange('notes', {
    table: 'nt_notes', rowId: 'n1', operation: 'INSERT',
    data: { id: 'n1', title: 'note with a photo', blob_hash: photoHash, updated_at: '2026-06-11T00:00:00.000Z' },
  });
  const docB = new LwwDocumentManager();
  const ctA = new ChangeTracker({ db: dbA!.adapter, deviceId: idA.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
  const ctB = new ChangeTracker({ db: dbB!.adapter, deviceId: idB.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
  return { docA, docB, ctA, ctB };
}

describe('blob-transfer unit layer (MK-027)', () => {
  it('split -> stage -> assemble round-trips and verifies', () => {
    dbA = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    const bytes = makePhotoBytes();
    const hash = blobContentHash(bytes);
    const blocks = splitBlobForTransfer(bytes, hash, 'notes', 'image/jpeg');
    expect(blocks.length).toBe(Math.ceil(bytes.length / BLOB_TRANSFER_BLOCK_SIZE));

    for (const block of blocks) stageBlobBlock(dbA.adapter, block);
    expect(getStagedBlockIndices(dbA.adapter, hash)).toEqual(blocks.map((b) => b.index));
    const assembled = assembleStagedBlob(dbA.adapter, hash)!;
    expect(assembled).toEqual(bytes);
    expect(blobContentHash(assembled)).toBe(hash);
  });

  it('assemble returns null while blocks are missing', () => {
    dbA = createInMemoryTestDatabase();
    createSyncTables(dbA.adapter);
    const bytes = makePhotoBytes();
    const hash = blobContentHash(bytes);
    const blocks = splitBlobForTransfer(bytes, hash, 'notes', null);
    stageBlobBlock(dbA.adapter, blocks[0]!);
    expect(assembleStagedBlob(dbA.adapter, hash)).toBeNull();
  });

  it('collectBlobRefs finds blob_hash columns and ignores everything else', () => {
    const hash = blobContentHash(makePhotoBytes(64));
    const refs = collectBlobRefs([
      { data: { id: 'a', blob_hash: hash } },
      { data: { id: 'b', blob_hash: hash } }, // duplicate -> once
      { data: { id: 'c', blob_hash: 'not-a-hash' } },
      { data: { id: 'd' } },
      { data: null },
    ]);
    expect(refs).toEqual([hash]);
  });
});

describe('blob pipeline in a live session (MK-027 acceptance)', () => {
  it('a photo attached on A lands on B: verified bytes, stored row, counted', async () => {
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');
    setupDbs();

    const photo = makePhotoBytes();
    const photoHash = blobContentHash(photo);
    const aStore = memoryBlobStore();
    const bStore = memoryBlobStore();
    aStore.store.set(photoHash, photo);

    const { docA, docB, ctA, ctB } = makeSessionPair(idA, idB, photoHash);
    const { connA, connB } = tappedConnectionPair(idA.publicKey, idB.publicKey);

    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, {
        db: dbA!.adapter, identity: idA, pairedDevices: [paired(idB.publicKey, idB.dhPublicKey)],
        documentManager: docA as unknown as DocumentManager, changeTracker: ctA,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
        blobProvider: aStore.provider,
      }),
      runResponderSession(connB, {
        db: dbB!.adapter, identity: idB, pairedDevices: [paired(idA.publicKey, idA.dhPublicKey)],
        documentManager: docB as unknown as DocumentManager, changeTracker: ctB,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
        blobProvider: bStore.provider,
      }),
    ]);

    expect(initiator.session.status).toBe('completed');
    expect(responder.session.status).toBe('completed');

    // The note row crossed (with its blob_hash reference)...
    const rows = dbB!.adapter.query<{ blob_hash: string }>('SELECT * FROM nt_notes WHERE id = ?', ['n1']);
    expect(rows[0]!.blob_hash).toBe(photoHash);

    // ...and the photo bytes landed, verified, in B's blob store ("renders on B").
    expect(bStore.store.get(photoHash)).toEqual(photo);
    expect(bStore.puts).toEqual([{ hash: photoHash, moduleId: 'notes' }]);

    // The blob is indexed in B's database and the session counted it.
    expect(getBlob(dbB!.adapter, photoHash)?.size).toBe(photo.length);
    expect(initiator.session.blobsSent).toBe(1);
    expect(responder.session.blobsReceived).toBe(1);

    // Staging is clean after a completed transfer.
    expect(getStagedBlockIndices(dbB!.adapter, photoHash)).toEqual([]);
  }, 30_000);

  it('resumes an interrupted transfer: already-staged blocks are not re-sent', async () => {
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');
    setupDbs();

    const photo = makePhotoBytes();
    const photoHash = blobContentHash(photo);
    const blocks = splitBlobForTransfer(photo, photoHash, 'notes', null);
    expect(blocks.length).toBeGreaterThanOrEqual(3);

    // A prior session was interrupted after two blocks: B staged them durably.
    stageBlobBlock(dbB!.adapter, blocks[0]!);
    stageBlobBlock(dbB!.adapter, blocks[1]!);

    const aStore = memoryBlobStore();
    const bStore = memoryBlobStore();
    aStore.store.set(photoHash, photo);

    const { docA, docB, ctA, ctB } = makeSessionPair(idA, idB, photoHash);
    const { connA, connB, captured } = tappedConnectionPair(idA.publicKey, idB.publicKey);

    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, {
        db: dbA!.adapter, identity: idA, pairedDevices: [paired(idB.publicKey, idB.dhPublicKey)],
        documentManager: docA as unknown as DocumentManager, changeTracker: ctA,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
        blobProvider: aStore.provider,
      }),
      runResponderSession(connB, {
        db: dbB!.adapter, identity: idB, pairedDevices: [paired(idA.publicKey, idA.dhPublicKey)],
        documentManager: docB as unknown as DocumentManager, changeTracker: ctB,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
        blobProvider: bStore.provider,
      }),
    ]);

    expect(initiator.session.status).toBe('completed');
    expect(responder.session.status).toBe('completed');
    // The full photo assembled from staged + freshly sent blocks.
    expect(bStore.store.get(photoHash)).toEqual(photo);

    // Only the MISSING blocks crossed the wire (tap opens the MK-044
    // envelope like the peer would, then counts inner BLOB_DATA frames).
    const envelopeKey = envelopeKeyFromSharedHex(SECRET, idA.publicKey, idB.publicKey);
    const blobDataFrames = captured
      .map((frame) => decodeTappedMessage(envelopeKey, frame))
      .filter((m): m is NonNullable<typeof m> => m !== null && m.type === 'BLOB_DATA');
    expect(blobDataFrames.length).toBe(blocks.length - 2);
  }, 30_000);

  it('enforces the receiver size cap from sync_blob_policy: over-cap blob refused, nothing stored', async () => {
    const idA = generateDeviceIdentity('Device A');
    const idB = generateDeviceIdentity('Device B');
    setupDbs();

    const photo = makePhotoBytes();
    const photoHash = blobContentHash(photo);
    const aStore = memoryBlobStore();
    const bStore = memoryBlobStore();
    aStore.store.set(photoHash, photo);

    // B's policy caps notes blobs far below the photo size.
    upsertBlobPolicy(dbB!.adapter, {
      moduleId: 'notes', policy: 'always', maxBlobSizeBytes: 1_000,
      updatedAt: new Date().toISOString(),
    });

    const { docA, docB, ctA, ctB } = makeSessionPair(idA, idB, photoHash);
    const { connA, connB } = tappedConnectionPair(idA.publicKey, idB.publicKey);

    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, {
        db: dbA!.adapter, identity: idA, pairedDevices: [paired(idB.publicKey, idB.dhPublicKey)],
        documentManager: docA as unknown as DocumentManager, changeTracker: ctA,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
        blobProvider: aStore.provider,
      }),
      runResponderSession(connB, {
        db: dbB!.adapter, identity: idB, pairedDevices: [paired(idA.publicKey, idA.dhPublicKey)],
        documentManager: docB as unknown as DocumentManager, changeTracker: ctB,
        enabledModules: ['notes'], modulePolicies: POLICIES, transport: 'wan_relay',
        blobProvider: bStore.provider,
      }),
    ]);

    // The session itself still completes (the note row synced)...
    expect(initiator.session.status).toBe('completed');
    expect(responder.session.status).toBe('completed');
    // ...but the over-cap blob was refused: no bytes, no row, no staging.
    expect(bStore.store.has(photoHash)).toBe(false);
    expect(bStore.puts).toHaveLength(0);
    expect(getBlob(dbB!.adapter, photoHash)).toBeNull();
    expect(getStagedBlockIndices(dbB!.adapter, photoHash)).toEqual([]);
    expect(responder.session.blobsReceived).toBe(0);
  }, 30_000);
});
