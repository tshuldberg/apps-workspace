/**
 * Plan 19 FF3 regression e2e (mobile): an OWNER's drain records a request-policy
 * PUBLIC-join request into cm_public_join_requests. Mirror of the web e2e
 * (apps/meerkat-web/.../web-public-join-owner-drain-e2e.test.ts), driven through
 * runBackgroundSyncCore (the SAME headless core the app runs) over the in-process
 * store-and-forward MailboxRelayBackend the other mobile drain tests use.
 *
 * It pins the DELIVERY token: a joiner parks its request on
 * derivePublicJoinToken(publicationId, grantId, ownerDeviceId) (the real
 * queuePublicJoinRequest path), a DISTINCT mailbox from the invite
 * deriveCommunityJoinToken. The owner must add that token to its drain
 * extraTokens (SyncProvider.resolveJoinExtraTokens + background-sync
 * buildExtraTokens) or the record handler never fires. The extra tokens here are
 * derived with the SAME public helpers the app uses (listOwnedPublications +
 * getCurrentPublicationDescriptor + derivePublicJoinToken).
 *
 * HONESTY anchors: the joiner uses the REAL queuePublicJoinRequest seal/park (no
 * hand-built token); the owner opens with its own key (the record handler owner-
 * checks its OWN stored community); a drain WITHOUT the public-join extra token
 * records NOTHING (the token is load-bearing, not the handler alone).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  configureSyncSecretStore,
  createChannelMessage,
  createCommunity,
  createInMemorySyncSecretStore,
  createPublication,
  derivePublicJoinToken,
  encodeMailboxEnvelope,
  generateDeviceIdentity,
  queuePublicJoinRequest,
  serializeHumanityToken,
  verifyPublication,
  type DeviceIdentity,
  type MailboxEnvelopeHandlers,
  type RelayBackend,
  type RelaySession,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { ensureMeerkatTables, setSetting } from '../(root)/data/db';
import { ensureSyncSchema, RELAY_URL_SETTING_KEY } from '../(root)/data/sync-core';
import {
  ensureCommunityTables,
  getPublicJoinRequest,
  insertMessageRow,
  recordPublicJoinRequests,
  storeOwnedCommunity,
} from '../(root)/data/community-core';
import {
  DEFAULT_PUBLISH_DEPS,
  getCurrentPublicationDescriptor,
  listOwnedPublications,
  publishChannelPublicly,
  type PublishDeps,
} from '../(root)/data/public-publish';
import { runBackgroundSyncCore } from '../(root)/data/background-sync';

const CHANNEL = 'general';

type Adapter = InMemoryTestDatabase['adapter'];

/** Store-and-forward mailbox backend (mirrors the relay drain-on-join). */
class MailboxRelayBackend implements RelayBackend {
  private readonly mailbox = new Map<string, Uint8Array[]>();
  destroyed = false;
  connectCount = 0;

  park(token: string, bytes: Uint8Array): void {
    const queue = this.mailbox.get(token) ?? [];
    queue.push(bytes);
    this.mailbox.set(token, queue);
  }

  async connect(_url: string, token: string): Promise<RelaySession> {
    this.connectCount += 1;
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

function seedIdentity(db: Adapter, identity: DeviceIdentity): void {
  db.execute(
    `INSERT OR REPLACE INTO mk_identity (id, public_key, dh_public_key, private_key_ref, display_name, created_at)
     VALUES ('self', ?, ?, ?, ?, ?)`,
    [identity.publicKey, identity.dhPublicKey, identity.privateKeyRef, identity.displayName, identity.createdAt],
  );
}

function fetchStub(statusByHost: Record<string, number>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const href = typeof url === 'string' ? url : url.toString();
    const host = Object.keys(statusByHost).find((h) => href.startsWith(h.replace(/\/+$/, '')));
    const status = host ? statusByHost[host]! : 404;
    const body = status === 200 ? { ok: true } : { reason: 'rejected' };
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

function deterministicDeps(over: Partial<PublishDeps>): PublishDeps {
  return {
    ...DEFAULT_PUBLISH_DEPS,
    randomBytes: (n: number) => new Uint8Array(nodeRandomBytes(n)),
    now: () => '2026-06-28T00:00:00.000Z',
    announcePublication: vi.fn(async () => {}),
    announceHeldContent: vi.fn(async () => {}),
    ...over,
  };
}

/** Publish a REQUEST-policy, advertised publication through the real orchestrator. */
async function ownerPublishRequestPolicy(
  db: Adapter,
  owner: DeviceIdentity,
): Promise<{ communityId: string; signed: SignedPublicationDescriptor }> {
  const communitySigned = createCommunity(owner, {
    name: 'Club',
    channels: [{ id: CHANNEL, name: CHANNEL }],
    now: '2026-06-28T00:00:00.000Z',
  });
  storeOwnedCommunity(db, owner, communitySigned);
  const communityId = communitySigned.descriptor.communityId;

  insertMessageRow(
    db,
    createChannelMessage(owner, {
      communityId,
      channelId: CHANNEL,
      body: 'hello',
      hlc: { wall: '2026-06-28T00:00:01.000Z', counter: 0 },
    }),
  );

  let signed: SignedPublicationDescriptor | null = null;
  const result = await publishChannelPublicly(
    deterministicDeps({
      fetchFn: fetchStub({ 'https://h1.example': 200 }),
      createPublication: (identity, opts) => {
        const s = createPublication(identity, opts);
        signed = s;
        return s;
      },
    }),
    {
      db, identity: owner, communityId, channelId: CHANNEL,
      title: 'Public', description: 'd', category: 'technology',
      hostUrls: ['https://h1.example'], directoryUrl: '', joinPolicy: 'request', advertiseJoins: true,
    },
  );
  expect(result.state).toBe('success');
  expect(signed).not.toBeNull();
  expect(verifyPublication(signed!)).toBe('ok');
  return { communityId, signed: signed! };
}

/**
 * The owner's real drain extraTokens, derived with the SAME public helpers the
 * app's resolveJoinExtraTokens / buildExtraTokens use. The public-join token is
 * the one the joiner actually parks its request on.
 */
function ownerPublicJoinExtraTokens(db: Adapter, owner: DeviceIdentity): { token: string; label: string }[] {
  const tokens: { token: string; label: string }[] = [];
  for (const pub of listOwnedPublications(db, owner.publicKey)) {
    if (pub.status !== 'active') continue;
    const signed = getCurrentPublicationDescriptor(db, pub.publicationId);
    const grantId = signed?.descriptor.publicJoin?.grantId;
    if (!grantId) continue;
    tokens.push({
      token: derivePublicJoinToken(pub.publicationId, grantId, owner.publicKey),
      label: `public-join:${pub.publicationId}`,
    });
  }
  return tokens;
}

let testDb: InMemoryTestDatabase | null = null;

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe('Plan 19 FF3: mobile owner drain records a public-join request (parity with web fix 947642f6)', () => {
  it('records the joiner request into cm_public_join_requests; the public-join extraToken is load-bearing', async () => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    testDb = createInMemoryTestDatabase();
    const db = testDb.adapter;
    ensureMeerkatTables(db);
    ensureSyncSchema(db);
    ensureCommunityTables(db);
    setSetting(db, RELAY_URL_SETTING_KEY, 'ws://relay');

    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    seedIdentity(db, owner);

    const { signed } = await ownerPublishRequestPolicy(db, owner);

    // The joiner uses the REAL queue path: seal + derive the public-join token.
    // AM1: the request MUST carry a SHAPE-valid humanity token or openPublicJoinRequest
    // fails closed (parseHumanityToken != null). The token's cryptographic validity +
    // single-spend are checked by the humanity SERVICE, not this open, so a shape-valid
    // (unsigned) token is the right fixture here.
    const humanityToken = serializeHumanityToken({
      version: 1,
      tokenId: 'a'.repeat(64),
      issuedAt: '2026-06-28T00:00:00.000Z',
      expiresAt: '2027-06-28T00:00:00.000Z',
      signature: 'b'.repeat(128),
    });
    const q = queuePublicJoinRequest(joiner, signed, humanityToken);
    expect(q.ok).toBe(true);
    if (!q.ok) return;

    const backend = new MailboxRelayBackend();
    backend.park(q.token, encodeMailboxEnvelope(q.envelope));

    const buildHandlers = (identity: DeviceIdentity): MailboxEnvelopeHandlers => ({
      ...recordPublicJoinRequests({ db, owner: identity, redeem: async () => ({ ok: true }) }),
    });

    // NEGATIVE: an owner drain WITHOUT the public-join token records nothing, so
    // the extraToken (not just the handler) is what carries delivery.
    const negative = await runBackgroundSyncCore({
      db,
      configureCrypto: () => {},
      getIdentity: () => owner,
      backend,
      buildHandlers,
      buildExtraTokens: () => [],
      now: () => '2026-06-28T08:00:00.000Z',
    });
    expect(negative.ran).toBe(true);
    expect(negative.publicJoinRequests).toBe(0);
    expect(getPublicJoinRequest(db, q.payload.publicationId, joiner.publicKey)).toBeNull();

    // POSITIVE: the owner's real extraTokens include the public-join token;
    // draining now records the request (the envelope is still parked: the
    // negative drain never connected to q.token).
    const extraTokens = ownerPublicJoinExtraTokens(db, owner);
    expect(extraTokens.some((t) => t.label === `public-join:${q.payload.publicationId}`)).toBe(true);
    const positive = await runBackgroundSyncCore({
      db,
      configureCrypto: () => {},
      getIdentity: () => owner,
      backend,
      buildHandlers,
      buildExtraTokens: () => extraTokens,
      now: () => '2026-06-28T09:00:00.000Z',
    });
    expect(positive.ran).toBe(true);
    expect(positive.publicJoinRequests).toBe(1);

    const row = getPublicJoinRequest(db, q.payload.publicationId, joiner.publicKey);
    expect(row).not.toBeNull();
    expect(row!.status).toBe('pending');
    expect(row!.community_id).toBe(q.payload.communityId);
    expect(row!.grant_id).toBe(q.payload.grantId);
  });
});
