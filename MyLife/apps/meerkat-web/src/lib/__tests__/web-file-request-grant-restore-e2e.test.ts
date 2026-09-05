// Files Slice 4 e2e: request -> approve -> re-send -> verify-then-pin restore,
// and the decline path, end to end over a REAL @mylife/meerkat-relay server.
//
// Modeled on packages/sync/src/__tests__/file-request-restore-e2e.test.ts but on
// the WEB harness: two independent web nodes (real sql.js DatabaseAdapter + real
// NativeSyncEngine) talk over a live relay. It drives the SAME app code path the
// MeerkatProvider uses: sealFileRequestMailbox to seal the request, buildFileGrant
// to re-verify + seal the grant, and runMailboxDrainJob + buildFileMailboxHandlers
// to apply both. Parks/drains go over the relay with Node `ws` injected (the
// provider builds a bare WebSocketRelayBackend that uses the browser global).
//
// HONESTY anchors asserted here:
//   - "on this device" is the LIVE has() check (never a cached flag);
//   - a requester's outgoing row goes 'requested' only after a real park, and
//     'restored' only after verify-then-pin AND a live presence confirmation;
//   - the restored bytes hash-verify against the requester's ORIGINAL signed
//     blob hash (blobContentHash === original);
//   - a decline ends 'declined' with NO bytes restored.

import { afterEach, describe, expect, it } from 'vitest';
import {
  blobContentHash,
  buildFileGrant,
  buildFileDecline,
  createChannelMessage,
  createCommunity,
  createCommunityInvite,
  encodeMailboxEnvelope,
  fileRequestId,
  getPairedDevice,
  joinCommunityFromLink,
  sealFileRequestMailbox,
  type ChannelMessageAttachment,
  type FileRequestFields,
  type SessionBlobProvider,
} from '@mylife/sync';
import {
  buildWebNode,
  drainMailboxes,
  pairNodes,
  parkEnvelope,
  resolvePairSecretHex,
  runRelaySession,
  teardownNode,
  withRelay,
  type WebNode,
} from './support/web-node-harness';
import {
  buildFileMailboxHandlers,
  channelMessageAttachmentRowsFromEvent,
  channelMessageRowFromEvent,
  getFileRequest,
  insertMessageAttachmentRows,
  insertMessageRow,
  isActiveCommunityMember,
  storeOwnedCommunity,
  upsertFileRequest,
  type FileRequestRow,
} from '../meerkat-data';

const CM_MESSAGE_ATTACHMENTS_TABLE = 'cm_message_attachments';

const COMMUNITY_MODULE_ID = 'community';

/**
 * A per-node in-memory blob store with the exact surface the file flow needs.
 * It enforces the SAME honesty-critical invariant BrowserBlobStore does: put()
 * verifies blobContentHash(bytes) === hash before storing, so a verify-then-pin
 * restore is genuinely proven (not a fake write). Per-node isolation matters
 * because fake-indexeddb is a single global store; this keeps A and B distinct.
 */
function inMemoryBlobStore(): SessionBlobProvider & {
  get(hash: string): Promise<Uint8Array | null>;
  put(hash: string, bytes: Uint8Array, meta: { moduleId: string; mimeType: string | null }): Promise<void>;
  putLocal(bytes: Uint8Array, meta: { moduleId: string; mimeType?: string | null }): Promise<{ hash: string; size: number }>;
  has(hash: string): Promise<boolean>;
  removeLocal(hash: string): Promise<{ freed: boolean }>;
} {
  const store = new Map<string, Uint8Array>();
  const self = {
    async get(hash: string): Promise<Uint8Array | null> {
      const v = store.get(hash);
      return v ? new Uint8Array(v) : null;
    },
    async put(hash: string, bytes: Uint8Array, _meta: { moduleId: string; mimeType: string | null }): Promise<void> {
      const actual = blobContentHash(bytes);
      if (actual !== hash) {
        throw new Error(`Blob hash mismatch: expected ${hash.slice(0, 12)}, got ${actual.slice(0, 12)}`);
      }
      store.set(hash, new Uint8Array(bytes));
    },
    async putLocal(bytes: Uint8Array, meta: { moduleId: string; mimeType?: string | null }): Promise<{ hash: string; size: number }> {
      const hash = blobContentHash(bytes);
      await self.put(hash, bytes, { moduleId: meta.moduleId, mimeType: meta.mimeType ?? null });
      return { hash, size: bytes.length };
    },
    async has(hash: string): Promise<boolean> {
      return store.has(hash);
    },
    async removeLocal(hash: string): Promise<{ freed: boolean }> {
      const existed = store.delete(hash);
      return { freed: existed };
    },
  };
  return self;
}

type BlobStore = ReturnType<typeof inMemoryBlobStore>;

let nodeA: WebNode | null = null;
let nodeB: WebNode | null = null;

afterEach(async () => {
  await teardownNode(nodeA);
  await teardownNode(nodeB);
  nodeA = null;
  nodeB = null;
});

/**
 * Set up a community owned by A with B as a member, author a message on A with
 * one attachment whose bytes are in A's blob store, and (optionally) run a relay
 * session so B receives the signed message + attachment rows.
 */
async function seedSharedFile(
  url: string,
  aStore: BlobStore,
  syncToB: boolean,
): Promise<{
  communityId: string;
  channelId: string;
  attachment: ChannelMessageAttachment;
  fileBytes: Uint8Array;
  blobHash: string;
  messageId: string;
}> {
  const signed = createCommunity(nodeA!.identity, {
    name: 'Files Club',
    channels: [{ id: 'general', name: 'general' }],
    members: [
      { deviceId: nodeB!.identity.publicKey, role: 'member', displayName: nodeB!.identity.displayName },
    ],
    now: '2026-06-15T00:00:00.000Z',
  });
  const communityId = signed.descriptor.communityId;
  storeOwnedCommunity(nodeA!.db, nodeA!.identity, signed);
  const { link } = createCommunityInvite(nodeA!.identity, signed);
  expect(joinCommunityFromLink(nodeB!.db, nodeB!.identity, link).ok).toBe(true);

  // Kept small so the single sealed FILE_GRANT envelope (which carries the whole
  // file's blocks) stays under the real relay's per-envelope cap (90 KB base64).
  const fileBytes = new TextEncoder().encode('the original attachment bytes\n'.repeat(120));
  const stored = await aStore.putLocal(fileBytes, { moduleId: COMMUNITY_MODULE_ID, mimeType: 'text/plain' });
  const blobHash = stored.hash;
  const attachment: ChannelMessageAttachment = {
    id: blobHash.slice(0, 16),
    blobHash,
    name: 'doc.txt',
    mimeType: 'text/plain',
    size: fileBytes.length,
  };
  const event = createChannelMessage(nodeA!.identity, {
    communityId,
    channelId: 'general',
    body: 'here is the file',
    attachments: [attachment],
    hlc: { wall: '2026-06-15T00:00:01.000Z', counter: 0 },
  });
  insertMessageRow(nodeA!.db, event);
  insertMessageAttachmentRows(nodeA!.db, event);
  nodeA!.engine.recordChange('cm_messages', 'INSERT', event.id, { ...channelMessageRowFromEvent(event) });
  for (const row of channelMessageAttachmentRowsFromEvent(event)) {
    nodeA!.engine.recordChange(CM_MESSAGE_ATTACHMENTS_TABLE, 'INSERT', row.id, { ...row });
  }

  if (syncToB) {
    const session = await runRelaySession(url, nodeA!, nodeB!);
    expect(session.status).toBe('completed');
  }

  return { communityId, channelId: 'general', attachment, fileBytes, blobHash, messageId: event.id };
}

describe('web file request -> grant -> restore over a real relay', () => {
  it('B requests a removed file, A approves, B restores the exact original bytes', async () => {
    await withRelay(async (url) => {
      const aStore = inMemoryBlobStore();
      const bStore = inMemoryBlobStore();
      nodeA = await buildWebNode('Web Owner', { blobProvider: aStore });
      nodeB = await buildWebNode('Web Member', { blobProvider: bStore });
      pairNodes(nodeA, nodeB);

      const { communityId, channelId, attachment, blobHash, messageId } = await seedSharedFile(url, aStore, true);

      // B received the signed message + the attachment reference row, and the
      // engine blob phase moved the bytes too (a real session blob transfer, with
      // a BrowserBlobStore-equivalent wired on both nodes). Live presence is true.
      expect(
        nodeB!.db.query('SELECT id FROM cm_message_attachments WHERE blob_hash = ?', [blobHash]).length,
      ).toBe(1);
      expect(await bStore.has(blobHash)).toBe(true);

      // B frees its local copy: the live has() check (the single source of truth
      // for "on this device") flips to false. This is the removed placeholder.
      await bStore.removeLocal(blobHash);
      expect(await bStore.has(blobHash)).toBe(false);

      // --- B requests again: seal + park a FILE_REQUEST to A (the author) ---
      const base = { communityId, channelId, messageId, attachmentId: attachment.id, blobHash };
      const fields: FileRequestFields = { ...base, requestId: fileRequestId(base, nodeB!.identity.publicKey) };
      const sharedSecretHex = pairSecret(nodeB!, nodeA!.identity.publicKey);
      const sealedReq = sealFileRequestMailbox({
        sender: nodeB!.identity,
        recipient: { deviceId: nodeA!.identity.publicKey, dhPublicKey: nodeA!.identity.dhPublicKey },
        pairSharedSecretHex: sharedSecretHex,
        fields,
      });
      const parked = await parkEnvelope(url, sealedReq.token, encodeMailboxEnvelope(sealedReq.envelope));
      expect(parked).toBe(true);
      // Honest pending row written ONLY after a real park (mirror the provider).
      upsertFileRequest(nodeB!.db, {
        id: fields.requestId,
        communityId,
        channelId,
        messageId,
        attachmentId: attachment.id,
        blobHash,
        direction: 'outgoing',
        counterpartyDeviceId: nodeA!.identity.publicKey,
        status: 'requested',
      });
      expect(getFileRequest(nodeB!.db, fields.requestId)?.status).toBe('requested');

      // --- A drains its mailbox with the app handlers: records the incoming request ---
      const aHandlers = buildFileMailboxHandlers({
        db: nodeA!.db,
        blobStore: aStore,
        isActiveMember: (cid, did) => isActiveCommunityMember(nodeA!.db, cid, did),
      });
      const aDrain = await drainMailboxes(url, nodeA!, aHandlers);
      expect(aDrain.fileRequests).toBe(1);
      const incoming = getFileRequest(nodeA!.db, fields.requestId);
      expect(incoming?.direction).toBe('incoming');
      expect(incoming?.status).toBe('requested');

      // --- A approves: buildFileGrant re-verifies bytes, park the grant to B ---
      const aSecret = pairSecret(nodeA!, nodeB!.identity.publicKey);
      const grant = await buildFileGrant({
        owner: nodeA!.identity,
        recipient: { deviceId: nodeB!.identity.publicKey, dhPublicKey: nodeB!.identity.dhPublicKey },
        pairSharedSecretHex: aSecret,
        request: fields,
        moduleId: COMMUNITY_MODULE_ID,
        getBlobBytes: (hash) => aStore.get(hash),
        mimeType: 'text/plain',
      });
      expect(grant.payload.decision).toBe('approve');
      expect(await parkEnvelope(url, grant.token, encodeMailboxEnvelope(grant.envelope))).toBe(true);

      // --- B drains: applyFileGrant verify-then-pin -> bytes restored, row 'restored' ---
      const bHandlers = buildFileMailboxHandlers({
        db: nodeB!.db,
        blobStore: bStore,
        isActiveMember: (cid, did) => isActiveCommunityMember(nodeB!.db, cid, did),
      });
      const bDrain = await drainMailboxes(url, nodeB!, bHandlers);
      expect(bDrain.fileGrants).toBe(1);

      // The bytes are present, and hash-verify against B's ORIGINAL signed hash.
      expect(await bStore.has(blobHash)).toBe(true);
      const restored = await bStore.get(blobHash);
      expect(restored).not.toBeNull();
      expect(blobContentHash(restored!)).toBe(blobHash);
      // The outgoing row flipped to 'restored' (verify-then-pin + live presence).
      expect(getFileRequest(nodeB!.db, fields.requestId)?.status).toBe('restored');
    });
  });

  it('A declines: B records a decline and nothing is restored', async () => {
    await withRelay(async (url) => {
      const aStore = inMemoryBlobStore();
      const bStore = inMemoryBlobStore();
      nodeA = await buildWebNode('Web Owner', { blobProvider: aStore });
      nodeB = await buildWebNode('Web Member', { blobProvider: bStore });
      pairNodes(nodeA, nodeB);

      const { communityId, channelId, attachment, blobHash, messageId } = await seedSharedFile(url, aStore, true);
      await bStore.removeLocal(blobHash);
      expect(await bStore.has(blobHash)).toBe(false);

      const base = { communityId, channelId, messageId, attachmentId: attachment.id, blobHash };
      const fields: FileRequestFields = { ...base, requestId: fileRequestId(base, nodeB!.identity.publicKey) };
      const sealedReq = sealFileRequestMailbox({
        sender: nodeB!.identity,
        recipient: { deviceId: nodeA!.identity.publicKey, dhPublicKey: nodeA!.identity.dhPublicKey },
        pairSharedSecretHex: pairSecret(nodeB!, nodeA!.identity.publicKey),
        fields,
      });
      expect(await parkEnvelope(url, sealedReq.token, encodeMailboxEnvelope(sealedReq.envelope))).toBe(true);
      upsertFileRequest(nodeB!.db, {
        id: fields.requestId,
        communityId,
        channelId,
        messageId,
        attachmentId: attachment.id,
        blobHash,
        direction: 'outgoing',
        counterpartyDeviceId: nodeA!.identity.publicKey,
        status: 'requested',
      });

      const aHandlers = buildFileMailboxHandlers({
        db: nodeA!.db,
        blobStore: aStore,
        isActiveMember: (cid, did) => isActiveCommunityMember(nodeA!.db, cid, did),
      });
      expect((await drainMailboxes(url, nodeA!, aHandlers)).fileRequests).toBe(1);

      // A explicitly declines (buildFileDecline), not an owner_no_longer_has_file.
      const decline = buildFileDecline({
        owner: nodeA!.identity,
        recipient: { deviceId: nodeB!.identity.publicKey, dhPublicKey: nodeB!.identity.dhPublicKey },
        pairSharedSecretHex: pairSecret(nodeA!, nodeB!.identity.publicKey),
        request: fields,
      });
      expect(decline.payload.decision).toBe('decline');
      expect(await parkEnvelope(url, decline.token, encodeMailboxEnvelope(decline.envelope))).toBe(true);

      const bHandlers = buildFileMailboxHandlers({
        db: nodeB!.db,
        blobStore: bStore,
        isActiveMember: (cid, did) => isActiveCommunityMember(nodeB!.db, cid, did),
      });
      const bDrain = await drainMailboxes(url, nodeB!, bHandlers);
      expect(bDrain.fileGrants).toBe(1);

      const row: FileRequestRow | null = getFileRequest(nodeB!.db, fields.requestId);
      expect(row?.status).toBe('declined');
      // No bytes were restored.
      expect(await bStore.has(blobHash)).toBe(false);
    });
  });
});

/** Recover a node's stored pair shared secret for a peer (from the paired row). */
function pairSecret(node: WebNode, peerDeviceId: string): string {
  const peer = getPairedDevice(node.db, peerDeviceId);
  const hex = resolvePairSecretHex(peer?.sharedSecretRef);
  if (!hex) throw new Error('no shared secret for peer');
  return hex;
}
