/**
 * Plan 19 FF3 close-out (ENGINE half): the owner-side PUBLIC-JOIN dispatcher route
 * + the explicit APPROVE mechanism (member add + epoch-key handoff).
 *
 * The SECURITY-CRITICAL invariant proven here: a public grant is BROADCAST, so
 * merely RECEIVING / RECORDING a request confers ZERO read access. The epoch key is
 * minted + handed off ONLY by the explicit owner approvePublicJoinRequest, through
 * the SAME owner-gated wrap rail the invite path uses (commitMemberAdd -> wrap to the
 * joiner DH key -> park a JOIN_GRANT). A stale/rotated grantId, a non-owner caller,
 * and a tampered bundle are all rejected fail-closed (no member row, no parked grant).
 */

import { describe, it, expect } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { createWorkspace, addWorkspaceMember } from '../db/queries';
import {
  createCommunity,
  communityRole,
  getCommunity,
  upsertCommunity,
  type SignedCommunityDescriptor,
} from '../protocol/community';
import { createGroupCommit, getCurrentEpochKey } from '../protocol/group-keys';
import {
  createPublication,
  createPublicJoinGrant,
  revisePublication,
  unpublish,
  type CreatePublicationOptions,
} from '../protocol/publication';
import {
  queuePublicJoinRequest,
  openPublicJoinRequest,
  PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
  type PublicJoinRequestPayload,
} from '../protocol/public-join';
import { approvePublicJoinRequest } from '../protocol/public-join-handoff-core';
import { applyJoinGrant } from '../protocol/join-handoff-core';
import { applyMailboxEnvelope, type MailboxEnvelopeHandlers } from '../protocol/mailbox-dispatch';
import { serializeHumanityToken } from '../protocol/humanity-credential';

/** A SHAPE-valid wire humanity token (openPublicJoinRequest checks shape only). */
const WIRE_TOKEN = serializeHumanityToken({
  version: 1, tokenId: 'b'.repeat(64),
  issuedAt: '2026-07-06T00:00:00.000Z', expiresAt: '2026-10-06T00:00:00.000Z',
  signature: '00'.repeat(64),
});
import {
  sealMailboxDelta,
  encodeMailboxEnvelope,
  type MailboxEnvelope,
} from '../protocol/mailbox';
import { createSignedIdentityBundle } from '../protocol/identity-bundle';

const NOW = '2026-06-30T00:00:00.000Z';
const randomBytes = (n: number) => new Uint8Array(n).fill(0x7c);
const randomBytes2 = (n: number) => new Uint8Array(n).fill(0x5a);

type Identity = ReturnType<typeof generateDeviceIdentity>;

function freshDb(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  return db;
}

/** Found an OWNER-ONLY community with a REAL epoch 1 (mirrors the app's storeOwnedCommunity). */
function foundOwnerCommunity(db: InMemoryTestDatabase, owner: Identity, signed: SignedCommunityDescriptor): void {
  const communityId = signed.descriptor.communityId;
  upsertCommunity(db.adapter, signed, owner.publicKey, NOW);
  createWorkspace(db.adapter, {
    id: communityId,
    displayName: signed.descriptor.name,
    workspaceType: 'community',
    createdByDeviceId: signed.descriptor.ownerDeviceId,
    createdAt: NOW,
    rotatedAt: null,
    currentKeyVersion: 0,
    archivedAt: null,
  });
  for (const member of signed.descriptor.members) {
    addWorkspaceMember(db.adapter, {
      workspaceId: communityId,
      deviceId: member.deviceId,
      role: member.role,
      invitedByDeviceId: signed.descriptor.ownerDeviceId,
      invitedAt: NOW,
      removedAt: null,
    });
  }
  createGroupCommit(db.adapter, {
    workspaceId: communityId,
    committer: owner,
    members: [{ deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey }],
    now: NOW,
  });
}

/** A request-policy publication that advertises joins, bound to the real community. */
function requestPublication(
  owner: Identity,
  communityId: string,
  rb: (n: number) => Uint8Array = randomBytes,
) {
  const grant = createPublicJoinGrant(owner, rb);
  const opts: CreatePublicationOptions = {
    kind: 'community',
    communityId,
    channelId: null,
    postId: null,
    title: 'NYC Cyclists',
    description: 'd',
    category: 'local',
    contentId: 'cid',
    publicKeyHex: 'aabbcc',
    hostUrls: ['https://host.example'],
    joinPolicy: 'request',
    publicJoin: grant,
    now: NOW,
  };
  return { grant, publication: createPublication(owner, opts) };
}

function memberDeviceIds(db: InMemoryTestDatabase, communityId: string): string[] {
  return db.adapter
    .query<{ device_id: string }>(
      'SELECT device_id FROM sync_workspace_members WHERE workspace_id = ? AND removed_at IS NULL',
      [communityId],
    )
    .map((r) => r.device_id);
}

describe('public-join dispatcher route (Plan 19 FF3)', () => {
  it('routes PUBLIC_JOIN_REQUEST_MAILBOX_KIND to the publicJoinRequest handler with the verified payload', async () => {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const ownerDb = freshDb();
    const signed = createCommunity(owner, { name: 'Club', channels: [{ id: 'general', name: 'general' }], now: NOW });
    foundOwnerCommunity(ownerDb, owner, signed);
    const { grant, publication } = requestPublication(owner, signed.descriptor.communityId);

    const q = queuePublicJoinRequest(joiner, publication, WIRE_TOKEN, NOW);
    expect(q.ok).toBe(true);
    if (!q.ok) return;

    let recorded: { sender: string; payload: PublicJoinRequestPayload } | null = null;
    const outcome = await applyMailboxEnvelope(owner, encodeMailboxEnvelope(q.envelope), {
      publicJoinRequest: (sender, payload) => {
        recorded = { sender, payload };
        return true; // a real review-queue row was written
      },
    });
    expect(outcome.kind).toBe('public-join-request');
    expect(recorded).not.toBeNull();
    expect(recorded!.sender).toBe(joiner.publicKey);
    expect(recorded!.payload.grantId).toBe(grant.grantId);
    expect(recorded!.payload.bundle.bundle.deviceId).toBe(joiner.publicKey);
  });

  it('a missing publicJoinRequest handler returns rejected (fail-closed)', async () => {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const ownerDb = freshDb();
    const signed = createCommunity(owner, { name: 'Club', now: NOW });
    foundOwnerCommunity(ownerDb, owner, signed);
    const { publication } = requestPublication(owner, signed.descriptor.communityId);
    const q = queuePublicJoinRequest(joiner, publication, WIRE_TOKEN, NOW);
    if (!q.ok) throw new Error('queue failed');

    const outcome = await applyMailboxEnvelope(owner, encodeMailboxEnvelope(q.envelope), {});
    expect(outcome.kind).toBe('rejected');
  });

  it('a FORGED public-join envelope (bundle deviceId != sender) is dropped, handler never invoked', async () => {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const stranger = generateDeviceIdentity('Stranger');
    // Seal a well-formed public-join payload BUT carry the stranger's bundle (deviceId
    // != the envelope signer). openPublicJoinRequest binds bundle.deviceId === sender.
    const forged = sealMailboxDelta(
      joiner,
      { deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey },
      {
        kind: PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
        version: 1,
        publicationId: 'p',
        communityId: 'c',
        grantId: 'g',
        bundle: createSignedIdentityBundle(stranger),
      },
      NOW,
    );
    let seen = false;
    const outcome = await applyMailboxEnvelope(owner, encodeMailboxEnvelope(forged), {
      publicJoinRequest: () => {
        seen = true;
        return true;
      },
    });
    expect(outcome.kind).toBe('rejected');
    expect(seen).toBe(false);
  });
});

describe('approvePublicJoinRequest e2e (Plan 19 FF3): key ONLY on approve, never on record', () => {
  it('record confers no key; approve adds the member + parks a grant the joiner can apply to hold the epoch key', async () => {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const ownerDb = freshDb();
    const joinerDb = freshDb();

    const signed = createCommunity(owner, { name: 'Feed Club FF3', channels: [{ id: 'general', name: 'general' }], now: NOW });
    const communityId = signed.descriptor.communityId;
    foundOwnerCommunity(ownerDb, owner, signed);
    const { grant, publication } = requestPublication(owner, communityId);

    // --- Joiner queues a request; owner opens (owner-side decrypt+verify) ---
    const q = queuePublicJoinRequest(joiner, publication, WIRE_TOKEN, NOW);
    if (!q.ok) throw new Error('queue failed');
    const opened = openPublicJoinRequest(owner, q.envelope);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    // --- RECORD step: routing to the handler records the request but hands off NO key ---
    let recorded: { sender: string; payload: PublicJoinRequestPayload } | null = null;
    const recordOutcome = await applyMailboxEnvelope(owner, encodeMailboxEnvelope(q.envelope), {
      publicJoinRequest: (sender, payload) => {
        recorded = { sender, payload };
        return true;
      },
    });
    expect(recordOutcome.kind).toBe('public-join-request');
    // After RECORD: the owner's descriptor does NOT list the joiner, no member row
    // was added, and NOTHING was parked. Record != approve.
    expect(communityRole(getCommunity(ownerDb.adapter, communityId)!.descriptor, joiner.publicKey)).toBeNull();
    expect(memberDeviceIds(ownerDb, communityId)).toEqual([owner.publicKey]);
    // The joiner still has no community and no epoch key.
    expect(getCurrentEpochKey(joinerDb.adapter, communityId, joiner)).toBeNull();

    // --- APPROVE step: explicit owner decision mints + hands off the key ---
    const parked: { token: string; envelope: MailboxEnvelope }[] = [];
    const res = await approvePublicJoinRequest({
      db: ownerDb.adapter,
      owner,
      parkEnvelope: (token, envelope) => {
        parked.push({ token, envelope });
        return true;
      },
      senderDeviceId: recorded!.sender,
      payload: recorded!.payload,
      publication,
      now: () => NOW,
    });
    expect(res).toEqual({ ok: true, communityId });

    // The owner's descriptor now lists the joiner, a sync_workspace_members row exists,
    // and exactly one JOIN_GRANT was parked.
    expect(communityRole(getCommunity(ownerDb.adapter, communityId)!.descriptor, joiner.publicKey)).toBe('member');
    expect(memberDeviceIds(ownerDb, communityId).sort()).toEqual([owner.publicKey, joiner.publicKey].sort());
    expect(parked).toHaveLength(1);

    // --- Joiner applies the parked grant -> obtains the epoch key (real read access) ---
    const joinerHandlers: MailboxEnvelopeHandlers = applyJoinGrant({ db: joinerDb.adapter, self: joiner, now: () => NOW });
    const applyOutcome = await applyMailboxEnvelope(joiner, encodeMailboxEnvelope(parked[0]!.envelope), joinerHandlers);
    expect(applyOutcome.kind).toBe('join-grant');

    // The KEY appears ONLY now, after approve+apply -- never on mere record.
    expect(getCurrentEpochKey(joinerDb.adapter, communityId, joiner)).not.toBeNull();
    expect(communityRole(getCommunity(joinerDb.adapter, communityId)!.descriptor, joiner.publicKey)).toBe('member');
    // Approve minted a NEW epoch (2) wrapped for the joiner; back-wrap of epoch 1 is
    // covered by the invite-path tests. The grant is used above (assert it existed).
    expect(grant.grantId).toMatch(/^[0-9a-f]+$/);
    expect(getCurrentEpochKey(joinerDb.adapter, communityId, joiner)!.epoch).toBe(2);
  });
});

describe('approvePublicJoinRequest fail-closed gates (Plan 19 FF3)', () => {
  function setup() {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const ownerDb = freshDb();
    const signed = createCommunity(owner, { name: 'Gate Club', channels: [{ id: 'general', name: 'general' }], now: NOW });
    const communityId = signed.descriptor.communityId;
    foundOwnerCommunity(ownerDb, owner, signed);
    const { grant, publication } = requestPublication(owner, communityId);
    const q = queuePublicJoinRequest(joiner, publication, WIRE_TOKEN, NOW);
    if (!q.ok) throw new Error('queue failed');
    const opened = openPublicJoinRequest(owner, q.envelope);
    if (!opened.ok) throw new Error('open failed');
    return { owner, joiner, ownerDb, communityId, grant, publication, payload: opened.payload, sender: opened.senderDeviceId };
  }

  it('a STALE grantId (owner rotated the grant) is rejected: no member row, no parked grant', async () => {
    const { owner, joiner, ownerDb, communityId, payload } = setup();
    let parkedCount = 0;
    // Owner rotated the advertised grant: the CURRENT publication carries grant2 (a new
    // grantId), but the recorded request references the OLD grantId. Rejected fail-closed.
    const { publication: rotated } = requestPublication(owner, communityId, randomBytes2);
    // Point the stale request at the rotated publication's id so the publicationId gate
    // passes and the grantId gate is what rejects it.
    const staleRequest: PublicJoinRequestPayload = { ...payload, publicationId: rotated.descriptor.publicationId };

    const res = await approvePublicJoinRequest({
      db: ownerDb.adapter,
      owner,
      parkEnvelope: () => {
        parkedCount += 1;
        return true;
      },
      senderDeviceId: joiner.publicKey,
      payload: staleRequest,
      publication: rotated,
      now: () => NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('grant_stale');
    expect(parkedCount).toBe(0);
    expect(memberDeviceIds(ownerDb, communityId)).toEqual([owner.publicKey]);
    expect(communityRole(getCommunity(ownerDb.adapter, communityId)!.descriptor, joiner.publicKey)).toBeNull();
  });

  it('a NON-OWNER caller is rejected: no member row, no parked grant', async () => {
    const { owner, joiner, ownerDb, communityId, publication, payload } = setup();
    const stranger = generateDeviceIdentity('Stranger');
    let parkedCount = 0;
    const res = await approvePublicJoinRequest({
      db: ownerDb.adapter,
      owner: stranger, // NOT the community owner
      parkEnvelope: () => {
        parkedCount += 1;
        return true;
      },
      senderDeviceId: joiner.publicKey,
      payload,
      publication,
      now: () => NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('not_owner');
    expect(parkedCount).toBe(0);
    expect(memberDeviceIds(ownerDb, communityId)).toEqual([owner.publicKey]);
    expect(communityRole(getCommunity(ownerDb.adapter, communityId)!.descriptor, joiner.publicKey)).toBeNull();
  });

  it('a TAMPERED bundle (deviceId != sender) is rejected: no member row, no parked grant', async () => {
    const { owner, ownerDb, communityId, publication, payload } = setup();
    let parkedCount = 0;
    const res = await approvePublicJoinRequest({
      db: ownerDb.adapter,
      owner,
      parkEnvelope: () => {
        parkedCount += 1;
        return true;
      },
      senderDeviceId: 'a-different-device-id', // != payload.bundle.bundle.deviceId
      payload,
      publication,
      now: () => NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('bundle_invalid');
    expect(parkedCount).toBe(0);
    expect(communityRole(getCommunity(ownerDb.adapter, communityId)!.descriptor, 'a-different-device-id')).toBeNull();
  });
});

describe('approvePublicJoinRequest revision-agnostic owner-signature (Plan 19 FF3 fix)', () => {
  function setup() {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const ownerDb = freshDb();
    const signed = createCommunity(owner, { name: 'Rev Club', channels: [{ id: 'general', name: 'general' }], now: NOW });
    const communityId = signed.descriptor.communityId;
    foundOwnerCommunity(ownerDb, owner, signed);
    const { grant, publication } = requestPublication(owner, communityId);
    const q = queuePublicJoinRequest(joiner, publication, WIRE_TOKEN, NOW);
    if (!q.ok) throw new Error('queue failed');
    const opened = openPublicJoinRequest(owner, q.envelope);
    if (!opened.ok) throw new Error('open failed');
    return { owner, joiner, ownerDb, communityId, grant, publication, payload: opened.payload };
  }

  it('SUCCEEDS against a revision-2 descriptor (owner revised hosts, SAME grantId)', async () => {
    const { owner, joiner, ownerDb, communityId, publication, payload } = setup();
    // A benign owner revision (edit hosts) bumps the descriptor to revision 2 while
    // keeping the SAME publicationId (stable) and SAME grantId. verifyPublication would
    // reject this rev-2 descriptor 'invalid'; verifyPublicationOwnerSignature accepts it.
    const revised = revisePublication(owner, publication, { hostUrls: ['https://host2.example'] }, NOW);
    expect(revised.descriptor.revision).toBe(2);
    expect(revised.descriptor.publicJoin!.grantId).toBe(payload.grantId);

    const parked: MailboxEnvelope[] = [];
    const res = await approvePublicJoinRequest({
      db: ownerDb.adapter,
      owner,
      parkEnvelope: (_token, envelope) => {
        parked.push(envelope);
        return true;
      },
      senderDeviceId: joiner.publicKey,
      payload,
      publication: revised,
      now: () => NOW,
    });
    expect(res).toEqual({ ok: true, communityId });
    expect(parked).toHaveLength(1);
    expect(communityRole(getCommunity(ownerDb.adapter, communityId)!.descriptor, joiner.publicKey)).toBe('member');
    expect(memberDeviceIds(ownerDb, communityId).sort()).toEqual([owner.publicKey, joiner.publicKey].sort());
  });

  it('REJECTS a request bearing the OLD grantId after the owner ROTATED the grant (revocation works)', async () => {
    const { owner, joiner, ownerDb, communityId, publication, payload } = setup();
    // Rotate the advertised grant via a real revision: same publicationId, NEW grantId.
    const grant2 = createPublicJoinGrant(owner, randomBytes2);
    const rotated = revisePublication(owner, publication, { publicJoin: grant2 }, NOW);
    expect(rotated.descriptor.revision).toBe(2);
    expect(rotated.descriptor.publicJoin!.grantId).not.toBe(payload.grantId);

    let parkedCount = 0;
    const res = await approvePublicJoinRequest({
      db: ownerDb.adapter,
      owner,
      parkEnvelope: () => {
        parkedCount += 1;
        return true;
      },
      senderDeviceId: joiner.publicKey,
      payload, // still references the OLD grantId
      publication: rotated,
      now: () => NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('grant_stale');
    expect(parkedCount).toBe(0);
    expect(memberDeviceIds(ownerDb, communityId)).toEqual([owner.publicKey]);
    expect(communityRole(getCommunity(ownerDb.adapter, communityId)!.descriptor, joiner.publicKey)).toBeNull();
  });

  it('REJECTS an UNPUBLISHED current descriptor (status gate): no member row, no parked grant', async () => {
    const { owner, joiner, ownerDb, communityId, publication, payload } = setup();
    const pulled = unpublish(owner, publication, NOW);
    expect(pulled.descriptor.status).toBe('unpublished');

    let parkedCount = 0;
    const res = await approvePublicJoinRequest({
      db: ownerDb.adapter,
      owner,
      parkEnvelope: () => {
        parkedCount += 1;
        return true;
      },
      senderDeviceId: joiner.publicKey,
      payload,
      publication: pulled,
      now: () => NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('publication_invalid');
    expect(parkedCount).toBe(0);
    expect(memberDeviceIds(ownerDb, communityId)).toEqual([owner.publicKey]);
  });

  it('REJECTS a descriptor whose owner signature does not verify (tampered / non-owner signed)', async () => {
    const { owner, joiner, ownerDb, communityId, publication, payload } = setup();
    // Flip a signed field after signing: the owner signature no longer covers the bytes.
    const tampered = { ...publication, descriptor: { ...publication.descriptor, title: 'Hijacked' } };

    let parkedCount = 0;
    const res = await approvePublicJoinRequest({
      db: ownerDb.adapter,
      owner,
      parkEnvelope: () => {
        parkedCount += 1;
        return true;
      },
      senderDeviceId: joiner.publicKey,
      payload,
      publication: tampered,
      now: () => NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('publication_invalid');
    expect(parkedCount).toBe(0);
    expect(memberDeviceIds(ownerDb, communityId)).toEqual([owner.publicKey]);
  });
});
