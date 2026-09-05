// Plan 19 FF3 regression e2e (web): an OWNER's normal foreground drain records a
// request-policy PUBLIC-join request into cm_public_join_requests, end to end
// over a REAL @mylife/meerkat-relay server.
//
// This is the exact gap the FF3 closing review flagged and that a unit test
// missed: a web owner opening a channel calls runForegroundDrain (ChannelView),
// NOT runJoinHandoffDrain (only the joiner onboarding path). Before the fix
// runForegroundDrain carried buildFileMailboxHandlers ONLY, so a parked public-
// join request was never recorded and the "Requests to join" panel stayed empty.
//
// It also pins the DELIVERY token: a joiner parks its request on
// derivePublicJoinToken(publicationId, grantId, ownerDeviceId) (the real
// queuePublicJoinRequest path), a DISTINCT mailbox from the invite
// deriveCommunityJoinToken. The owner must add that token to its drain
// extraTokens or the record handler never fires. The test builds the SAME
// handler set + extraTokens the provider's runForegroundDrain now builds, using
// the SAME public helpers (listOwnedPublications + getCurrentPublicationDescriptor
// + derivePublicJoinToken), and drives them over the live relay.
//
// HONESTY anchors: the joiner uses the REAL queuePublicJoinRequest seal/park (no
// hand-built token); the owner opens with its own key (the record handler owner-
// checks its OWN stored community); a drain WITHOUT the public-join extraToken
// records NOTHING (the token is load-bearing, not the handler alone).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomBytes as nodeRandomBytes } from 'node:crypto';
import WebSocket from 'ws';
import {
  WebSocketRelayBackend,
  createChannelMessage,
  createCommunity,
  createPublication,
  derivePublicJoinToken,
  encodeMailboxEnvelope,
  queuePublicJoinRequest,
  serializeHumanityToken,
  runMailboxDrainJob,
  verifyPublication,
  type MailboxEnvelopeHandlers,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import {
  buildWebNode,
  parkEnvelope,
  teardownNode,
  withRelay,
  type WebNode,
} from './support/web-node-harness';
import {
  getPublicJoinRequest,
  insertMessageRow,
  recordPublicJoinRequests,
  storeOwnedCommunity,
} from '../meerkat-data';
import {
  DEFAULT_PUBLISH_DEPS,
  getCurrentPublicationDescriptor,
  listOwnedPublications,
  publishChannelPublicly,
  type PublishDeps,
} from '../public-publish';

const CHANNEL = 'general';

/** A fetch stub that returns 200 for the one serving host the publish registers to. */
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

/**
 * Publish a REQUEST-policy, advertised publication on the owner node through the
 * real orchestrator, returning the owner-signed descriptor + its community id.
 * The signed descriptor is what a joiner would fetch from the directory/host.
 */
async function ownerPublishRequestPolicy(
  owner: WebNode,
): Promise<{ communityId: string; signed: SignedPublicationDescriptor }> {
  const communitySigned = createCommunity(owner.identity, {
    name: 'Club',
    channels: [{ id: CHANNEL, name: CHANNEL }],
    now: '2026-06-28T00:00:00.000Z',
  });
  storeOwnedCommunity(owner.db, owner.identity, communitySigned);
  const communityId = communitySigned.descriptor.communityId;

  insertMessageRow(
    owner.db,
    createChannelMessage(owner.identity, {
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
      db: owner.db, identity: owner.identity, communityId, channelId: CHANNEL,
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
 * The owner's real foreground-drain extraTokens, derived with the SAME public
 * helpers the provider's resolveJoinExtraTokens uses. The public-join token is
 * the one the joiner actually parks its request on.
 */
function ownerPublicJoinExtraTokens(owner: WebNode): { token: string; label: string }[] {
  const tokens: { token: string; label: string }[] = [];
  for (const pub of listOwnedPublications(owner.db, owner.identity.publicKey)) {
    if (pub.status !== 'active') continue;
    const signed = getCurrentPublicationDescriptor(owner.db, pub.publicationId);
    const grantId = signed?.descriptor.publicJoin?.grantId;
    if (!grantId) continue;
    tokens.push({
      token: derivePublicJoinToken(pub.publicationId, grantId, owner.identity.publicKey),
      label: `public-join:${pub.publicationId}`,
    });
  }
  return tokens;
}

/** Drain the owner's mailboxes over the live relay with ws injected (provider path). */
async function ownerDrain(
  url: string,
  owner: WebNode,
  extraTokens: { token: string; label: string }[],
): Promise<void> {
  const handlers: MailboxEnvelopeHandlers = {
    ...recordPublicJoinRequests({ db: owner.db, owner: owner.identity, redeem: async () => ({ ok: true }) }),
  };
  const backend = new WebSocketRelayBackend({
    webSocketImpl: WebSocket as unknown as new (u: string) => WebSocket,
  });
  try {
    await runMailboxDrainJob({
      identity: owner.identity,
      backend,
      relayUrl: url,
      peers: [],
      handlers,
      extraTokens,
    });
  } finally {
    backend.destroy();
  }
}

let owner: WebNode | null = null;
let joiner: WebNode | null = null;

afterEach(async () => {
  await teardownNode(owner);
  await teardownNode(joiner);
  owner = null;
  joiner = null;
});

describe('Plan 19 FF3: web owner foreground drain records a public-join request (parity with mobile)', () => {
  it('records the joiner request into cm_public_join_requests; the public-join extraToken is load-bearing', async () => {
    await withRelay(async (url) => {
      owner = await buildWebNode('Owner');
      joiner = await buildWebNode('Joiner');

      const { signed } = await ownerPublishRequestPolicy(owner);

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
      const q = queuePublicJoinRequest(joiner.identity, signed, humanityToken);
      expect(q.ok).toBe(true);
      if (!q.ok) return;
      const parked = await parkEnvelope(url, q.token, encodeMailboxEnvelope(q.envelope));
      expect(parked).toBe(true);

      // NEGATIVE: an owner drain WITHOUT the public-join token records nothing,
      // so the extraToken (not just the handler) is what carries delivery.
      await ownerDrain(url, owner, []);
      expect(getPublicJoinRequest(owner.db, q.payload.publicationId, joiner.identity.publicKey)).toBeNull();

      // POSITIVE: the owner's real foreground extraTokens include the public-join
      // token; draining now records the request.
      const extraTokens = ownerPublicJoinExtraTokens(owner);
      expect(extraTokens.some((t) => t.label === `public-join:${q.payload.publicationId}`)).toBe(true);
      await ownerDrain(url, owner, extraTokens);

      const row = getPublicJoinRequest(owner.db, q.payload.publicationId, joiner.identity.publicKey);
      expect(row).not.toBeNull();
      expect(row!.status).toBe('pending');
      expect(row!.community_id).toBe(q.payload.communityId);
      expect(row!.grant_id).toBe(q.payload.grantId);
    });
  });
});
