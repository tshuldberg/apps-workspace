/**
 * Plan 38 Phase 0 exit test -- library item two-node e2e.
 *
 * An item authored (sealed + signed) on device A crosses a REAL session to
 * device B: the signed cm_library_items row replicates, the sealed blocks ride
 * the existing BLOB_REQUEST/BLOB_DATA pipeline by sealedId, and B decrypts the
 * content with the DEK unwrapped from its own epoch-wrap history. No plaintext
 * ever crosses the wire or rests on disk.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { PairedDevice, TransportConnection } from '../types';
import type { DocumentManager } from '../crdt/document-manager';
import { createSyncTables } from '../db/schema';
import { createWorkspace, getKeyWraps } from '../db/queries';
import { generateDeviceIdentity } from '../identity/device-identity';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { runInitiatorSession, runResponderSession } from '../protocol/sync-session';
import { createGroupCommit, storeReceivedKeyWrap } from '../protocol/group-keys';
import {
  openLibraryObject,
  sealLibraryObject,
  unwrapLibraryObjectKeyForDevice,
} from '../protocol/library-objects';
import {
  sealedBlockBytesToPayload,
  sealedBlockPayloadToBytes,
  type SessionBlobProvider,
} from '../protocol/blob-transfer';
import type { SealedShare } from '../node/sealed-share';

const SECRET = 'ef'.repeat(32);
const WS = 'ws-library-e2e';

const COMMUNITY_POLICY: ModuleSyncPolicy = {
  defaultScope: 'device_local',
  shareable: true,
  entityRules: [{
    tableName: 'cm_library_items',
    defaultScope: 'shared_workspace',
    maxScope: 'shared_workspace',
    conflictStrategy: 'lww',
  }],
};
const POLICIES = new Map([['community', COMMUNITY_POLICY]]);
const PREFIXES = new Map([['community', 'cm_']]);

const ITEMS_DDL = `CREATE TABLE cm_library_items (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  content_cid TEXT NOT NULL,
  key_epoch INTEGER NOT NULL,
  wrapped_key TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  title TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  metadata_source TEXT NOT NULL,
  author_device_id TEXT NOT NULL,
  signature TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  tombstone INTEGER NOT NULL DEFAULT 0
)`;

function paired(deviceId: string, dhPublicKey: string): PairedDevice {
  return {
    deviceId, displayName: 'peer', dhPublicKey,
    sharedSecretRef: `local:shared:${SECRET}`, isActive: true,
  } as unknown as PairedDevice;
}

function memoryBlobStore() {
  const store = new Map<string, Uint8Array>();
  const provider: SessionBlobProvider = {
    get: (hash) => store.get(hash) ?? null,
    put: (hash, bytes) => { store.set(hash, bytes); },
  };
  return { store, provider };
}

function connectionPair(deviceA: string, deviceB: string) {
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
    send: async (d) => { setTimeout(() => deliver(handlersForB, bufferForB, d), 0); },
    onData: (f) => attach(handlersForA, bufferForA, f),
    close: async () => {},
  };
  const connB: TransportConnection = {
    id: 'b', remoteDeviceId: deviceA, transport: 'wan_relay',
    send: async (d) => { setTimeout(() => deliver(handlersForA, bufferForA, d), 0); },
    onData: (f) => attach(handlersForB, bufferForB, f),
    close: async () => {},
  };
  return { connA, connB };
}

let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;
afterEach(() => { dbA?.close(); dbA = null; dbB?.close(); dbB = null; });

describe('library item two-node e2e (Plan 38 Phase 0 exit)', () => {
  it('an item sealed + authored on A browses and DECRYPTS on B after a real session', async () => {
    const idA = generateDeviceIdentity('Author A');
    const idB = generateDeviceIdentity('Member B');
    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    for (const db of [dbA.adapter, dbB.adapter]) {
      createSyncTables(db);
      db.execute(ITEMS_DDL);
      createWorkspace(db, {
        id: WS, displayName: 'Shared Library', workspaceType: 'group', createdByDeviceId: idA.publicKey,
        createdAt: '2026-07-05T00:00:00.000Z', rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
      });
      for (const member of [idA.publicKey, idB.publicKey]) {
        db.execute(
          `INSERT OR IGNORE INTO sync_workspace_members (workspace_id, device_id, role, invited_by_device_id, invited_at, removed_at)
           VALUES (?, ?, 'member', ?, '2026-07-05T00:00:00.000Z', NULL)`,
          [WS, member, idA.publicKey],
        );
      }
    }

    // Epoch 1 minted on A, wraps for both members; B receives its wrap.
    const commit = createGroupCommit(dbA.adapter, {
      workspaceId: WS, committer: idA,
      members: [
        { deviceId: idA.publicKey, dhPublicKey: idA.dhPublicKey },
        { deviceId: idB.publicKey, dhPublicKey: idB.dhPublicKey },
      ],
    });
    for (const wrap of getKeyWraps(dbA.adapter, WS, 1)) {
      if (wrap.wrappedForDeviceId === idB.publicKey) storeReceivedKeyWrap(dbB.adapter, wrap);
    }

    // A seals a multi-block file as a library object under epoch 1.
    const content = new Uint8Array(40_000);
    for (let i = 0; i < content.length; i++) content[i] = (i * 13 + 5) % 251;
    const sealed = sealLibraryObject(content, {
      workspaceId: WS, epoch: commit.epoch, epochSecret: commit.secret,
      name: 'family-movie.mp4', identity: idA, createdAt: '2026-07-05T00:00:00.000Z',
      chunkSize: 16 * 1024,
    });
    expect(sealed.share.sealedChunks.length).toBeGreaterThan(1);

    // A's provider serves sealed blocks by sealedId (wire bytes hash to it).
    const aStore = memoryBlobStore();
    for (const chunk of sealed.share.sealedChunks) {
      aStore.store.set(chunk.sealedId, sealedBlockPayloadToBytes(chunk.payload)!);
    }
    const bStore = memoryBlobStore();

    // The signed row (Phase 3 signs the metadata; this e2e carries the fields).
    const manifestJson = JSON.stringify({
      manifest: sealed.share.manifest,
      manifestSignature: sealed.share.manifestSignature,
      sealedChunkIds: sealed.share.sealedChunks.map((c) => c.sealedId),
    });
    const docA = new LwwDocumentManager();
    docA.applyChange('community', {
      table: 'cm_library_items', rowId: 'item1', operation: 'INSERT',
      data: {
        id: 'item1', community_id: WS, channel_id: 'movies',
        content_cid: sealed.contentId, key_epoch: sealed.keyEpoch, wrapped_key: sealed.wrappedKey,
        manifest_json: manifestJson, title: 'Family Movie', metadata_json: '{}',
        metadata_source: 'local', author_device_id: idA.publicKey, signature: 'sig-phase3',
        updated_at: '2026-07-05T00:01:00.000Z', tombstone: 0,
      },
    });
    const docB = new LwwDocumentManager();
    const ctA = new ChangeTracker({ db: dbA.adapter, deviceId: idA.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
    const ctB = new ChangeTracker({ db: dbB.adapter, deviceId: idB.publicKey, modulePrefixes: PREFIXES, modulePolicies: POLICIES });
    const { connA, connB } = connectionPair(idA.publicKey, idB.publicKey);

    const [initiator, responder] = await Promise.all([
      runInitiatorSession(connA, {
        db: dbA.adapter, identity: idA, pairedDevices: [paired(idB.publicKey, idB.dhPublicKey)],
        documentManager: docA as unknown as DocumentManager, changeTracker: ctA,
        enabledModules: ['community'], modulePolicies: POLICIES, transport: 'wan_relay',
        blobProvider: aStore.provider,
      }),
      runResponderSession(connB, {
        db: dbB.adapter, identity: idB, pairedDevices: [paired(idA.publicKey, idA.dhPublicKey)],
        documentManager: docB as unknown as DocumentManager, changeTracker: ctB,
        enabledModules: ['community'], modulePolicies: POLICIES, transport: 'wan_relay',
        blobProvider: bStore.provider,
      }),
    ]);
    expect(initiator.session.status).toBe('completed');
    expect(responder.session.status).toBe('completed');

    // The signed row crossed.
    const rows = dbB.adapter.query<{ wrapped_key: string; key_epoch: number; manifest_json: string }>(
      'SELECT * FROM cm_library_items WHERE id = ?', ['item1'],
    );
    if (rows.length !== 1) {
      const audit = dbB.adapter.query('SELECT reason, table_name, outcome FROM sync_inbound_audit');
      throw new Error(`row did not apply; audit: ${JSON.stringify(audit)}`);
    }
    expect(rows).toHaveLength(1);

    // Every sealed block landed on B by sealedId (still ciphertext).
    for (const chunk of sealed.share.sealedChunks) {
      expect(bStore.store.get(chunk.sealedId)).toBeDefined();
    }

    // B reconstructs the sealed share from the row + received blocks...
    const parsed = JSON.parse(rows[0]!.manifest_json) as {
      manifest: SealedShare['manifest']; manifestSignature: string; sealedChunkIds: string[];
    };
    const shareOnB: SealedShare = {
      manifest: parsed.manifest,
      manifestSignature: parsed.manifestSignature,
      sealedChunks: parsed.sealedChunkIds.map((sealedId, index) => ({
        index, sealedId,
        payload: sealedBlockBytesToPayload(bStore.store.get(sealedId)!)!,
      })),
    };

    // ...unwraps the DEK from ITS OWN epoch-wrap history, and decrypts.
    const dek = unwrapLibraryObjectKeyForDevice(dbB.adapter, idB, WS, rows[0]!.key_epoch, rows[0]!.wrapped_key);
    expect(dek).not.toBeNull();
    const opened = openLibraryObject(
      shareOnB, rows[0]!.wrapped_key, commit.secret, WS, rows[0]!.key_epoch,
      { expectedAuthor: idA.publicKey },
    );
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.content).toEqual(content);

    // A device with NO wrap (never a member) cannot decrypt what B holds.
    const outsider = generateDeviceIdentity('Outsider');
    expect(unwrapLibraryObjectKeyForDevice(dbB.adapter, outsider, WS, 1, rows[0]!.wrapped_key)).toBeNull();
  }, 30_000);
});
