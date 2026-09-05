/**
 * File request -> approve -> re-send -> verify-then-pin restore, end to end,
 * with NO peer online (Files & Sharing Phase 3).
 *
 * Reuses the store-and-forward MailboxRelayBackend from mailbox-drain.test.ts:
 * a park is a send by an absent sender; a join drains whatever is parked on the
 * token. So the whole exchange runs over the relay's TTL mailbox with neither
 * device "live" at the same moment:
 *
 *   1. requester seals a FILE_REQUEST to the owner's pair-token and parks it;
 *   2. owner drains via runMailboxDrainJob + applyMailboxEnvelope (file-request
 *      handler) -> records an incoming request;
 *   3. owner buildFileGrant from its in-memory blob map and parks the grant;
 *   4. requester drains -> applyFileGrant writes into the requester's in-memory
 *      blob store -> bytes are present and hash-verified end to end.
 *
 * Also asserts the dispatcher routes channel-message / file-request / file-grant
 * to the right handler and DROPS an unknown kind fail-closed (counted rejected,
 * nothing written).
 */

import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import { blobContentHash } from '../protocol/blob-transfer';
import { createChannelMessage } from '../protocol/channel-message';
import { encodeMailboxEnvelope, sealMailboxDelta, deriveMailboxToken } from '../protocol/mailbox';
import { sealChannelMessageMailboxDelta } from '../protocol/channel-mailbox';
import {
  applyFileGrant,
  buildFileGrant,
  fileRequestId,
  restoreFromGrantPayload,
  sealFileRequestMailbox,
  type FileGrantMailboxPayload,
  type FileRequestFields,
  type FileRequestMailboxPayload,
} from '../protocol/file-request-mailbox';
import { applyMailboxEnvelope, type MailboxEnvelopeHandlers } from '../protocol/mailbox-dispatch';
import { runMailboxDrainJob, type MailboxDrainPeer } from '../protocol/mailbox-drain';
import type { RelayBackend, RelaySession } from '../transport/relay-transport';

const PAIR_SECRET = 'ef'.repeat(32);
const MODULE_ID = 'community';

class MailboxRelayBackend implements RelayBackend {
  private readonly mailbox = new Map<string, Uint8Array[]>();
  destroyed = false;

  park(token: string, bytes: Uint8Array): void {
    const queue = this.mailbox.get(token) ?? [];
    queue.push(bytes);
    this.mailbox.set(token, queue);
  }

  parkedCount(token: string): number {
    return this.mailbox.get(token)?.length ?? 0;
  }

  async connect(_url: string, token: string): Promise<RelaySession> {
    if (this.destroyed) throw new Error('destroyed');
    const drained = this.mailbox.get(token) ?? [];
    this.mailbox.delete(token);
    return {
      async send(): Promise<void> {},
      onMessage: (handler) => { for (const b of drained) handler(new Uint8Array(b)); },
      close: async () => {},
    };
  }

  destroy(): void { this.destroyed = true; }
}

function instantWait(): Promise<void> {
  return Promise.resolve();
}

function activePeer(deviceId: string): MailboxDrainPeer {
  return { deviceId, pairSharedSecretHex: PAIR_SECRET, revoked: false, isActive: true };
}

describe('file request -> grant -> restore (store-and-forward, no peer online)', () => {
  it('restores the exact bytes the requester signed, end to end over the relay TTL mailbox', async () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');

    // The blob the owner holds and the requester removed. The requester still
    // holds the signed cm_messages event naming this blobHash.
    const fileBytes = new TextEncoder().encode('the original attachment '.repeat(2000));
    const blobHash = blobContentHash(fileBytes);
    const event = createChannelMessage(owner, {
      communityId: 'c1', channelId: 'general', body: 'here is the file',
      attachments: [{ id: 'att_1', blobHash, name: 'doc.txt', mimeType: 'text/plain', size: fileBytes.length }],
      hlc: { wall: '2026-06-14T00:00:01.000Z', counter: 0 },
    });
    const requesterSignedHash = event.attachments![0]!.blobHash;

    const base = {
      communityId: 'c1', channelId: 'general', messageId: event.id, attachmentId: 'att_1', blobHash,
    };
    const fields: FileRequestFields = { ...base, requestId: fileRequestId(base, requester.publicKey) };

    const backend = new MailboxRelayBackend();

    // --- Step 1: requester parks a FILE_REQUEST to the owner's pair-token ---
    const sealedRequest = sealFileRequestMailbox({
      sender: requester,
      recipient: { deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET,
      fields,
    });
    backend.park(sealedRequest.token, encodeMailboxEnvelope(sealedRequest.envelope));
    // It is addressed to the OWNER's mailbox (token derived from owner deviceId).
    expect(sealedRequest.token).toBe(deriveMailboxToken(PAIR_SECRET, owner.publicKey, Date.now()));

    // --- Step 2: owner drains and receives the request (no peer online) ---
    const ownerBlobs = new Map<string, Uint8Array>([[blobHash, fileBytes]]);
    const incomingRequests: FileRequestMailboxPayload[] = [];
    const ownerDrain = await runMailboxDrainJob({
      identity: owner,
      backend,
      relayUrl: 'ws://relay',
      peers: [activePeer(requester.publicKey)],
      waitForDrain: instantWait,
      handlers: {
        fileRequest: (senderDeviceId, payload) => {
          expect(senderDeviceId).toBe(requester.publicKey);
          incomingRequests.push(payload);
          return true; // a real incoming row was written
        },
      },
    });
    expect(ownerDrain.fileRequests).toBe(1);
    expect(ownerDrain.applied).toBe(0); // not a channel message
    expect(ownerDrain.rejected).toBe(0);
    expect(incomingRequests).toHaveLength(1);
    expect(incomingRequests[0]!.requestId).toBe(fields.requestId);

    // --- Step 3: owner approves -> buildFileGrant + park to the requester ---
    const grant = await buildFileGrant({
      owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET,
      request: incomingRequests[0]!,
      moduleId: MODULE_ID,
      getBlobBytes: (hash) => ownerBlobs.get(hash) ?? null,
      mimeType: 'text/plain',
    });
    expect(grant.payload.decision).toBe('approve');
    backend.park(grant.token, encodeMailboxEnvelope(grant.envelope));
    expect(grant.token).toBe(deriveMailboxToken(PAIR_SECRET, requester.publicKey, Date.now()));

    // --- Step 4: requester drains -> applyFileGrant verify-then-pin ---
    const requesterBlobs = new Map<string, Uint8Array>();
    let restoredHash: string | null = null;
    const requesterDrain = await runMailboxDrainJob({
      identity: requester,
      backend,
      relayUrl: 'ws://relay',
      peers: [activePeer(owner.publicKey)],
      waitForDrain: instantWait,
      handlers: {
        // The dispatcher already opened+verified the grant; the handler restores
        // from the opened payload (the same pattern the app SyncProvider uses).
        fileGrant: async (senderDeviceId, payload) => {
          expect(senderDeviceId).toBe(owner.publicKey);
          const result = await restoreFromGrantPayload({
            payload,
            expectedBlobHash: requesterSignedHash,
            putBlob: (hash, bytes) => { requesterBlobs.set(hash, bytes); },
            moduleId: MODULE_ID,
          });
          if (result.ok && result.restored) {
            restoredHash = result.blobHash;
            return true;
          }
          return false;
        },
      },
    });

    expect(requesterDrain.fileGrants).toBe(1);
    expect(requesterDrain.rejected).toBe(0);
    expect(restoredHash).toBe(blobHash);

    // The bytes are present and hash-verified end to end.
    const restored = requesterBlobs.get(blobHash);
    expect(restored).toBeDefined();
    expect(blobContentHash(restored!)).toBe(requesterSignedHash);
    expect(new TextDecoder().decode(restored!)).toBe(new TextDecoder().decode(fileBytes));
  });

  it('owner decline propagates honestly: requester records a decline, nothing restored', async () => {
    const requester = generateDeviceIdentity('Phone');
    const owner = generateDeviceIdentity('Desktop');
    const fileBytes = new TextEncoder().encode('the file the owner deleted too');
    const blobHash = blobContentHash(fileBytes);
    const base = { communityId: 'c1', channelId: 'general', messageId: 'm1', attachmentId: 'att_1', blobHash };
    const fields: FileRequestFields = { ...base, requestId: fileRequestId(base, requester.publicKey) };

    const backend = new MailboxRelayBackend();

    // Owner no longer holds the bytes -> buildFileGrant declines.
    const grant = await buildFileGrant({
      owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET,
      request: fields,
      moduleId: MODULE_ID,
      getBlobBytes: () => null,
    });
    expect(grant.payload.decision).toBe('decline');
    backend.park(grant.token, encodeMailboxEnvelope(grant.envelope));

    let declineReason: string | null = null;
    const drain = await runMailboxDrainJob({
      identity: requester,
      backend,
      relayUrl: 'ws://relay',
      peers: [activePeer(owner.publicKey)],
      waitForDrain: instantWait,
      handlers: {
        fileGrant: async (_sender, payload: FileGrantMailboxPayload) => {
          const result = await applyFileGrant({
            recipient: requester,
            envelope: grant.envelope,
            expectedBlobHash: blobHash,
            putBlob: () => { throw new Error('should not be called on decline'); },
            moduleId: MODULE_ID,
          });
          if (result.ok && !result.restored) {
            declineReason = result.reason;
            return true; // a real decline row was recorded
          }
          void payload;
          return false;
        },
      },
    });
    expect(drain.fileGrants).toBe(1);
    expect(declineReason).toBe('owner_no_longer_has_file');
  });
});

describe('applyMailboxEnvelope dispatcher (routing + unknown-kind fail-closed)', () => {
  const requester = generateDeviceIdentity('Phone');
  const owner = generateDeviceIdentity('Desktop');

  it('routes a channel-message envelope to the channel handler only', async () => {
    const event = createChannelMessage(owner, {
      communityId: 'c1', channelId: 'general', body: 'hi',
      hlc: { wall: '2026-06-14T00:00:01.000Z', counter: 0 },
    });
    const sealed = sealChannelMessageMailboxDelta({
      sender: owner,
      recipient: { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET,
      communityId: 'c1', channelId: 'general', events: [event],
    });
    if (!sealed.ok) throw new Error('seal failed');

    let channelApplied = 0;
    let fileReqSeen = false;
    let fileGrantSeen = false;
    const handlers: MailboxEnvelopeHandlers = {
      channelMessage: (events) => { channelApplied += events.length; return { inserted: events.length, skipped: 0, invalid: 0 }; },
      fileRequest: () => { fileReqSeen = true; return true; },
      fileGrant: () => { fileGrantSeen = true; return true; },
    };

    const outcome = await applyMailboxEnvelope(requester, encodeMailboxEnvelope(sealed.envelope), handlers);
    expect(outcome.kind).toBe('channel-message');
    if (outcome.kind === 'channel-message') expect(outcome.applied).toBe(1);
    expect(channelApplied).toBe(1);
    expect(fileReqSeen).toBe(false);
    expect(fileGrantSeen).toBe(false);
  });

  it('routes a file-request envelope to the file-request handler only', async () => {
    const base = { communityId: 'c1', channelId: 'general', messageId: 'm', attachmentId: 'a', blobHash: 'ab'.repeat(64) };
    const sealed = sealFileRequestMailbox({
      sender: requester,
      recipient: { deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET,
      fields: { ...base, requestId: fileRequestId(base, requester.publicKey) },
    });
    let channelSeen = false;
    const outcome = await applyMailboxEnvelope(owner, encodeMailboxEnvelope(sealed.envelope), {
      channelMessage: () => { channelSeen = true; return { inserted: 0, skipped: 0, invalid: 0 }; },
      fileRequest: () => true,
    });
    expect(outcome.kind).toBe('file-request');
    expect(channelSeen).toBe(false);
  });

  it('a handler that applies nothing is counted rejected (preserves the contract)', async () => {
    const base = { communityId: 'c1', channelId: 'general', messageId: 'm', attachmentId: 'a', blobHash: 'ab'.repeat(64) };
    const sealed = sealFileRequestMailbox({
      sender: requester,
      recipient: { deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey },
      pairSharedSecretHex: PAIR_SECRET,
      fields: { ...base, requestId: fileRequestId(base, requester.publicKey) },
    });
    const outcome = await applyMailboxEnvelope(owner, encodeMailboxEnvelope(sealed.envelope), {
      fileRequest: () => false, // duplicate / already-known: nothing written
    });
    expect(outcome.kind).toBe('rejected');
  });

  it('DROPS an unknown kind fail-closed: counted rejected, no handler invoked', async () => {
    // Seal a perfectly valid mailbox envelope whose inner payload kind is unknown.
    const envelope = sealMailboxDelta(
      owner,
      { deviceId: requester.publicKey, dhPublicKey: requester.dhPublicKey },
      { kind: 'meerkat.unknown-future-kind', version: 9, secret: 'data' },
    );
    let anyHandler = false;
    const outcome = await applyMailboxEnvelope(requester, encodeMailboxEnvelope(envelope), {
      channelMessage: () => { anyHandler = true; return { inserted: 1, skipped: 0, invalid: 0 }; },
      fileRequest: () => { anyHandler = true; return true; },
      fileGrant: () => { anyHandler = true; return true; },
    });
    expect(outcome.kind).toBe('rejected');
    expect(anyHandler).toBe(false);
  });

  it('DROPS a malformed envelope fail-closed', async () => {
    const outcome = await applyMailboxEnvelope(
      requester,
      new TextEncoder().encode('not an envelope'),
      { channelMessage: () => ({ inserted: 1, skipped: 0, invalid: 0 }) },
    );
    expect(outcome.kind).toBe('rejected');
  });
});
