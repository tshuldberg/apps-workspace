/**
 * Plan 39 P6 acceptance: POST /public/{pub}/{channel}/submit, the GATED public
 * write. Everything is real (owner-signed publication, real node:http server,
 * real dual-signature receipts); the session verifier is a FAKE injected through
 * the documented seam (Track A wires the real persona-session verifier at merge)
 * and the humanity redeem is a fake single-use client with exact branch control.
 *
 * NC-P3 matrix: every gate individually missing/invalid -> reject; all three
 * present -> accept. NC-P1 guard: private + public READ routes never consult the
 * submit gates. Plus: persona binding, postPolicy fail-closed, freeze kill
 * switch, tombstone removal + resurrection block, replay dedup, durable
 * per-persona flood caps, node-key pinning, and AM9 token-preservation ordering.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { issueMeerkatAppUnlockToken, issueMeerkatHostedEntitlement } from '@mylife/entitlements/server';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import {
  buildPublicSnapshot,
  bytesToHex,
  createChannelMessage,
  createCommunity,
  createPublication,
  createPublicPost,
  createPublicPostTombstone,
  createPublicPostingFreeze,
  extractSigningPrivateKeyHex,
  generateDeviceIdentity,
  publicPostNodeKeypairFromSeed,
  signFeedAuth,
  verifyPublicPost,
  type AcceptedPublicPost,
  type ChannelMessageEvent,
  type ContentManifest,
  type DeviceIdentity,
  type PublicationPostPolicy,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { CommunityNode } from '../index';
import {
  personaBindingHash,
  startCommunityNodeHttp,
  type CommunityNodePublicSubmitOptions,
  type StartCommunityNodeHttpOptions,
} from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';

const CHANNEL = 'general';
const COMMUNITY = 'submit-community';
const NOW = '2026-07-06T00:00:00.000Z';
const APP_UNLOCK_SECRET = 'shared-app-unlock-secret';

const nodeReceipt = publicPostNodeKeypairFromSeed('33'.repeat(32));

interface RawResponse { status: number; text: string; json: () => unknown }

function rawRequest(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers ?? {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode ?? 500, text, json: () => JSON.parse(text) });
      });
    });
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

interface Fixture {
  owner: DeviceIdentity;
  ownerKeys: { publicKeyHex: string; privateKeyHex: string };
  signed: SignedPublicationDescriptor;
  publicationId: string;
  manifest: ContentManifest;
  pieces: Uint8Array[];
}

function seedEvent(author: DeviceIdentity, communityId: string, body: string, wall: string): ChannelMessageEvent {
  return createChannelMessage(author, { communityId, channelId: CHANNEL, body, hlc: { wall, counter: 0 } });
}

async function buildFixture(options: {
  postPolicy?: PublicationPostPolicy | null;
  pinNodeKey?: boolean;
  communityId?: string;
  owner?: DeviceIdentity;
} = {}): Promise<Fixture> {
  const owner = options.owner ?? generateDeviceIdentity('Publisher');
  const communityId = options.communityId ?? COMMUNITY;
  const publicKey = new Uint8Array(randomBytes(32));
  const events = [seedEvent(owner, communityId, 'seed event', '2026-07-06T00:00:10.000Z')];
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({
    identity: owner, publicationId: 'pending', communityId, channelId: CHANNEL,
    events, publicKey, pieceStore: buildStore, now: NOW,
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(manifest.infoHash, i) as Uint8Array);
  const signed = createPublication(owner, {
    kind: 'channel', communityId, channelId: CHANNEL, title: 'Open Channel',
    description: 'public', category: 'technology', contentId: record.infoHash,
    publicKeyHex: bytesToHex(publicKey), now: NOW,
    ...(options.postPolicy !== undefined && options.postPolicy !== null ? { postPolicy: options.postPolicy } : {}),
    ...(options.pinNodeKey === false ? {} : { postNodeKeyHex: nodeReceipt.publicKeyHex }),
  });
  return {
    owner,
    ownerKeys: { publicKeyHex: owner.publicKey, privateKeyHex: extractSigningPrivateKeyHex(owner.privateKeyRef) },
    signed,
    publicationId: signed.descriptor.publicationId,
    manifest,
    pieces,
  };
}

async function register(server: SeederHttpServer, fx: Fixture): Promise<void> {
  const res = await rawRequest(`${server.url}/public/${fx.publicationId}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      descriptor: fx.signed,
      snapshots: [{ channelId: CHANNEL, epoch: 0, manifest: fx.manifest, pieces: fx.pieces.map((p) => Buffer.from(p).toString('base64')) }],
    }),
  });
  expect(res.status).toBe(200);
}

/** A fake single-use humanity redeem client with an inspectable spent set. */
function fakeHumanity(...accepted: string[]): { verifyToken: (t: string) => Promise<{ ok: boolean; reason?: string }>; spent: Set<string> } {
  const valid = new Set(accepted);
  const spent = new Set<string>();
  return {
    spent,
    verifyToken: async (token: string) => {
      if (!valid.has(token)) return { ok: false, reason: 'invalid' };
      if (spent.has(token)) return { ok: false, reason: 'already_spent' };
      spent.add(token);
      return { ok: true };
    },
  };
}

/** The FAKE session verifier for the Track A seam: token -> persona binding. */
function fakeSessions(map: Record<string, string>): CommunityNodePublicSubmitOptions['sessionVerifier'] {
  return async (token: string) => {
    const personaPubkey = map[token];
    return personaPubkey ? { ok: true, personaPubkey } : { ok: false, reason: 'unknown_session' };
  };
}

const persona = (() => {
  const kp = publicPostNodeKeypairFromSeed('44'.repeat(32));
  return kp; // an Ed25519 keypair; used here as the public persona keypair
})();

async function mintAppUnlock(secret = APP_UNLOCK_SECRET, boundTo: string = persona.publicKeyHex): Promise<string> {
  const issued = await issueMeerkatAppUnlockToken({
    secret,
    purchaseDate: NOW,
    bindingHash: personaBindingHash(boundTo),
  });
  return issued.token;
}

interface Env { server: SeederHttpServer; node: CommunityNode; fx: Fixture; humanity: ReturnType<typeof fakeHumanity> }

let server: SeederHttpServer | null = null;
afterEach(async () => { if (server) await server.close(); server = null; });

async function boot(options: {
  postPolicy?: PublicationPostPolicy | null;
  pinNodeKey?: boolean;
  communityId?: string;
  owner?: DeviceIdentity;
  submit?: Partial<CommunityNodePublicSubmitOptions> | null;
  nodeOverrides?: ConstructorParameters<typeof CommunityNode>[0];
  httpOverrides?: Partial<StartCommunityNodeHttpOptions>;
  humanityTokens?: string[];
} = {}): Promise<Env> {
  const fx = await buildFixture({
    postPolicy: options.postPolicy === undefined ? 'open' : options.postPolicy,
    pinNodeKey: options.pinNodeKey,
    communityId: options.communityId,
    owner: options.owner,
  });
  const node = new CommunityNode({ postReceipt: nodeReceipt, ...(options.nodeOverrides ?? {}) });
  const humanity = fakeHumanity(...(options.humanityTokens ?? ['human-1', 'human-2', 'human-3', 'human-4']));
  const submit: CommunityNodePublicSubmitOptions | undefined = options.submit === null ? undefined : {
    sessionVerifier: fakeSessions({ 'session-good': persona.publicKeyHex }),
    humanityVerifyToken: humanity.verifyToken,
    appUnlockSecret: APP_UNLOCK_SECRET,
    ...(options.submit ?? {}),
  };
  server = await startCommunityNodeHttp({ node, port: 0, publicSubmit: submit, ...(options.httpOverrides ?? {}) });
  await register(server, fx);
  return { server, node, fx, humanity };
}

function makePost(fx: Fixture, body: string, parentPostId: string | null = null) {
  return createPublicPost(persona, { publicationId: fx.publicationId, channelId: CHANNEL, body, parentPostId, now: NOW });
}

async function submitPost(env: Env, post: ReturnType<typeof makePost>, headers: Record<string, string | undefined>): Promise<RawResponse> {
  const clean: Record<string, string> = { 'Content-Type': 'application/json' };
  for (const [k, v] of Object.entries(headers)) if (v !== undefined) clean[k] = v;
  return rawRequest(`${env.server.url}/public/${env.fx.publicationId}/${CHANNEL}/submit`, {
    method: 'POST', headers: clean, body: JSON.stringify({ post }),
  });
}

async function fullHeaders(humanityToken: string): Promise<Record<string, string>> {
  return {
    'x-mk-session': 'session-good',
    'x-mk-humanity': humanityToken,
    'x-mk-app-unlock': await mintAppUnlock(),
  };
}

async function fetchPage(env: Env): Promise<{ events: ChannelMessageEvent[]; publicPosts: AcceptedPublicPost[]; nextCursor: string | null; hasMore: boolean }> {
  const res = await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/${CHANNEL}/page`);
  expect(res.status).toBe(200);
  return res.json() as { events: ChannelMessageEvent[]; publicPosts: AcceptedPublicPost[]; nextCursor: string | null; hasMore: boolean };
}

describe('Plan 39 P6: gated public submit route (NC-P3)', () => {
  it('accepts with ALL THREE gates present and serves a dual-verifiable post on the page route', async () => {
    const env = await boot();
    const post = makePost(env.fx, 'first gated post');
    const res = await submitPost(env, post, await fullHeaders('human-1'));
    expect(res.status).toBe(200);
    const body = res.json() as { ok: boolean; accepted: AcceptedPublicPost; deduplicated: boolean };
    expect(body.ok).toBe(true);
    expect(body.deduplicated).toBe(false);
    // The composer-facing acceptance is a REAL receipt (NC-3): a second client
    // dual-verifies it against the DESCRIPTOR-pinned node key.
    expect(verifyPublicPost(body.accepted, env.fx.signed.descriptor.postNodeKeyHex!)).toBe('ok');

    const page = await fetchPage(env);
    expect(page.publicPosts).toHaveLength(1);
    expect(page.publicPosts[0]!.post.postId).toBe(post.postId);
    expect(verifyPublicPost(page.publicPosts[0]!, env.fx.signed.descriptor.postNodeKeyHex!, {
      publicationId: env.fx.publicationId, channelId: CHANNEL,
    })).toBe('ok');
    // The pre-existing snapshot events still ride the same page.
    expect(page.events.length).toBeGreaterThan(0);
  });

  it('gated replies: a reply submits through the SAME full gate chain', async () => {
    const env = await boot();
    const parent = makePost(env.fx, 'parent');
    expect((await submitPost(env, parent, await fullHeaders('human-1'))).status).toBe(200);
    const reply = makePost(env.fx, 'reply', parent.postId);
    // A reply with a missing gate is rejected like any post...
    const noUnlock = await submitPost(env, reply, { 'x-mk-session': 'session-good', 'x-mk-humanity': 'human-2' });
    expect(noUnlock.status).toBe(401);
    // ...and passes with the full chain.
    const ok = await submitPost(env, reply, await fullHeaders('human-3'));
    expect(ok.status).toBe(200);
    const page = await fetchPage(env);
    expect(page.publicPosts.map((p) => p.post.postId)).toContain(reply.postId);
  });

  describe('NC-P3 negative matrix: each gate individually missing/invalid -> reject', () => {
    it('missing session header -> 401 session_required; nothing served', async () => {
      const env = await boot();
      const res = await submitPost(env, makePost(env.fx, 'x'), {
        'x-mk-humanity': 'human-1', 'x-mk-app-unlock': await mintAppUnlock(),
      });
      expect(res.status).toBe(401);
      expect((res.json() as { reason: string }).reason).toBe('session_required');
      expect((await fetchPage(env)).publicPosts).toHaveLength(0);
    });

    it('invalid session token -> 401 session_invalid (fake verifier reject path)', async () => {
      const env = await boot();
      const res = await submitPost(env, makePost(env.fx, 'x'), {
        'x-mk-session': 'session-BAD', 'x-mk-humanity': 'human-1', 'x-mk-app-unlock': await mintAppUnlock(),
      });
      expect(res.status).toBe(401);
      expect((res.json() as { reason: string }).reason).toBe('session_invalid');
    });

    it('NO sessionVerifier configured -> EVERY submit rejected 500 session_not_configured (fail-closed seam)', async () => {
      const env = await boot({ submit: { sessionVerifier: undefined } });
      const res = await submitPost(env, makePost(env.fx, 'x'), await fullHeaders('human-1'));
      expect(res.status).toBe(500);
      expect((res.json() as { reason: string }).reason).toBe('session_not_configured');
      // And the humanity token was NOT consumed by the refused request.
      expect(env.humanity.spent.size).toBe(0);
    });

    it('a throwing session verifier fails closed -> 503 session_unreachable', async () => {
      const env = await boot({ submit: { sessionVerifier: async () => { throw new Error('down'); } } });
      const res = await submitPost(env, makePost(env.fx, 'x'), await fullHeaders('human-1'));
      expect(res.status).toBe(503);
      expect((res.json() as { reason: string }).reason).toBe('session_unreachable');
    });

    it('missing humanity token -> 401 humanity_required', async () => {
      const env = await boot();
      const res = await submitPost(env, makePost(env.fx, 'x'), {
        'x-mk-session': 'session-good', 'x-mk-app-unlock': await mintAppUnlock(),
      });
      expect(res.status).toBe(401);
      expect((res.json() as { reason: string }).reason).toBe('humanity_required');
    });

    it('invalid humanity token -> 401; REPLAYED (already spent) token -> 409', async () => {
      const env = await boot();
      const bad = await submitPost(env, makePost(env.fx, 'x'), {
        'x-mk-session': 'session-good', 'x-mk-humanity': 'forged', 'x-mk-app-unlock': await mintAppUnlock(),
      });
      expect(bad.status).toBe(401);
      expect((await submitPost(env, makePost(env.fx, 'a'), await fullHeaders('human-1'))).status).toBe(200);
      const replay = await submitPost(env, makePost(env.fx, 'b'), await fullHeaders('human-1'));
      expect(replay.status).toBe(409);
    });

    it('no humanity redeem client configured -> 500 humanity_not_configured (submit is UNCONDITIONALLY gated)', async () => {
      const env = await boot({ submit: { humanityVerifyToken: undefined } });
      const res = await submitPost(env, makePost(env.fx, 'x'), await fullHeaders('human-1'));
      expect(res.status).toBe(500);
      expect((res.json() as { reason: string }).reason).toBe('humanity_not_configured');
    });

    it('missing app-unlock proof -> 401 app_unlock_required', async () => {
      const env = await boot();
      const res = await submitPost(env, makePost(env.fx, 'x'), {
        'x-mk-session': 'session-good', 'x-mk-humanity': 'human-1',
      });
      expect(res.status).toBe(401);
      expect((res.json() as { reason: string }).reason).toBe('app_unlock_required');
      // Gate order: the humanity token WAS spent before the entitlement check
      // (mandated order session -> humanity -> entitlement).
      expect(env.humanity.spent.has('human-1')).toBe(true);
    });

    it('forged/wrong-secret and expired app-unlock proofs -> 401 app_unlock_invalid', async () => {
      const env = await boot();
      const forged = await issueMeerkatAppUnlockToken({ secret: 'WRONG-secret', purchaseDate: NOW });
      const res1 = await submitPost(env, makePost(env.fx, 'x'), {
        'x-mk-session': 'session-good', 'x-mk-humanity': 'human-1', 'x-mk-app-unlock': forged.token,
      });
      expect(res1.status).toBe(401);
      expect((res1.json() as { reason: string }).reason).toBe('app_unlock_invalid');
      const expired = await issueMeerkatAppUnlockToken({ secret: APP_UNLOCK_SECRET, purchaseDate: NOW, nowMs: Date.now() - 48 * 60 * 60 * 1000 });
      const res2 = await submitPost(env, makePost(env.fx, 'x'), {
        'x-mk-session': 'session-good', 'x-mk-humanity': 'human-2', 'x-mk-app-unlock': expired.token,
      });
      expect(res2.status).toBe(401);
    });

    it('a proof minted for ANOTHER persona is rejected (non-transferable purchase gate)', async () => {
      const env = await boot();
      const otherPersona = publicPostNodeKeypairFromSeed('aa'.repeat(32));
      const transferred = await mintAppUnlock(APP_UNLOCK_SECRET, otherPersona.publicKeyHex);
      const res = await submitPost(env, makePost(env.fx, 'x'), {
        'x-mk-session': 'session-good', 'x-mk-humanity': 'human-1', 'x-mk-app-unlock': transferred,
      });
      expect(res.status).toBe(401);
      expect((res.json() as { reason: string }).reason).toBe('app_unlock_invalid');
    });

    it('an UNBOUND proof is rejected at the submit gate', async () => {
      const env = await boot();
      const unbound = await issueMeerkatAppUnlockToken({ secret: APP_UNLOCK_SECRET, purchaseDate: NOW });
      const res = await submitPost(env, makePost(env.fx, 'x'), {
        'x-mk-session': 'session-good', 'x-mk-humanity': 'human-1', 'x-mk-app-unlock': unbound.token,
      });
      expect(res.status).toBe(401);
    });

    it('a HOSTED-SUBSCRIPTION entitlement token cannot spoof the app-unlock gate (NC-P5)', async () => {
      const env = await boot();
      const hosted = await issueMeerkatHostedEntitlement({ secret: APP_UNLOCK_SECRET, expiresAt: new Date(Date.now() + 60_000).toISOString() });
      const res = await submitPost(env, makePost(env.fx, 'x'), {
        'x-mk-session': 'session-good', 'x-mk-humanity': 'human-1', 'x-mk-app-unlock': hosted.token,
      });
      expect(res.status).toBe(401);
      expect((res.json() as { reason: string }).reason).toBe('app_unlock_invalid');
    });

    it('no app-unlock secret configured -> 500 app_unlock_not_configured', async () => {
      const env = await boot({ submit: { appUnlockSecret: undefined } });
      const res = await submitPost(env, makePost(env.fx, 'x'), await fullHeaders('human-1'));
      expect(res.status).toBe(500);
      expect((res.json() as { reason: string }).reason).toBe('app_unlock_not_configured');
    });

    it('NO publicSubmit config at all -> rejected with a machine-readable code, never accepted', async () => {
      const env = await boot({ submit: null });
      const res = await submitPost(env, makePost(env.fx, 'x'), await fullHeaders('human-1'));
      expect(res.status).toBe(500);
      expect((res.json() as { reason: string }).reason).toBe('session_not_configured');
    });
  });

  it('binds the SESSION persona to the post author: a mismatch is rejected', async () => {
    const otherPersona = publicPostNodeKeypairFromSeed('55'.repeat(32));
    const env = await boot({ submit: { sessionVerifier: fakeSessions({ 'session-good': otherPersona.publicKeyHex }) } });
    // Valid session for persona B (with a proof correctly bound to B); the post
    // is signed by persona A -> the CORE rejects with persona_mismatch.
    const res = await submitPost(env, makePost(env.fx, 'x'), {
      'x-mk-session': 'session-good',
      'x-mk-humanity': 'human-1',
      'x-mk-app-unlock': await mintAppUnlock(APP_UNLOCK_SECRET, otherPersona.publicKeyHex),
    });
    expect(res.status).toBe(401);
    expect((res.json() as { reason: string }).reason).toBe('persona_mismatch');
  });

  it('a forged author signature is rejected 400 bad_post WITHOUT spending a humanity token', async () => {
    const env = await boot();
    const post = { ...makePost(env.fx, 'x'), body: 'tampered after signing' };
    const res = await submitPost(env, post, await fullHeaders('human-1'));
    expect(res.status).toBe(400);
    expect((res.json() as { reason: string }).reason).toBe('bad_post');
    // AM9 full form: the forged post never reached the single-use redeem.
    expect(env.humanity.spent.size).toBe(0);
  });

  it('AM9 ordering: a malformed body never consumes gates or a humanity token', async () => {
    const env = await boot();
    const res = await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/${CHANNEL}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await fullHeaders('human-1')) },
      body: JSON.stringify({ nope: true }),
    });
    expect(res.status).toBe(400);
    expect(env.humanity.spent.size).toBe(0);
    // The same token still works on a valid submit afterwards.
    expect((await submitPost(env, makePost(env.fx, 'x'), await fullHeaders('human-1'))).status).toBe(200);
  });

  describe('postPolicy enforcement (gate 4, fail-closed)', () => {
    it('a policy-less (view_only) publication rejects every submit', async () => {
      const env = await boot({ postPolicy: null });
      const res = await submitPost(env, makePost(env.fx, 'x'), await fullHeaders('human-1'));
      expect(res.status).toBe(403);
      expect((res.json() as { reason: string }).reason).toBe('posting_disabled');
    });

    it('an explicit view_only publication rejects every submit', async () => {
      const env = await boot({ postPolicy: 'view_only' });
      const res = await submitPost(env, makePost(env.fx, 'x'), await fullHeaders('human-1'));
      expect(res.status).toBe(403);
    });

    it('approval mode with no node-held roster fails CLOSED (membership_unknown)', async () => {
      const env = await boot({ postPolicy: 'approval' });
      const res = await submitPost(env, makePost(env.fx, 'x'), await fullHeaders('human-1'));
      expect(res.status).toBe(403);
      expect((res.json() as { reason: string }).reason).toBe('membership_unknown');
    });

    it('approval mode: an owner-ROSTERED persona posts; an unrostered persona is not_member', async () => {
      const communityOwner = generateDeviceIdentity('CommunityOwner');
      // The owner approves the PERSONA by adding its public key to the roster.
      const communitySigned = createCommunity(communityOwner, {
        name: 'Approval Community',
        members: [{ deviceId: persona.publicKeyHex, role: 'member', displayName: 'ApprovedPersona' }],
        now: NOW,
      });
      const communityId = communitySigned.descriptor.communityId;
      const stranger = publicPostNodeKeypairFromSeed('bb'.repeat(32));
      const env = await boot({
        postPolicy: 'approval',
        communityId,
        owner: communityOwner,
        submit: {
          sessionVerifier: fakeSessions({
            'session-good': persona.publicKeyHex,
            'session-stranger': stranger.publicKeyHex,
          }),
        },
      });
      // Publish the owner-signed community descriptor to the node (the roster source).
      const challenge = (await env.node.issueChallenge(communityId))!;
      const ts = new Date().toISOString();
      const publishVerdict = await env.node.publish(communityId, { descriptor: communitySigned, snapshots: [] }, {
        deviceId: communityOwner.publicKey,
        nonce: challenge.nonce,
        ts,
        signature: signFeedAuth(communityOwner, { communityId, nonce: challenge.nonce, ts }),
      });
      expect(publishVerdict.ok).toBe(true);

      // Rostered persona: full gate chain -> accepted.
      const ok = await submitPost(env, makePost(env.fx, 'approved post'), await fullHeaders('human-1'));
      expect(ok.status).toBe(200);

      // Verified stranger persona (valid session + humanity + ITS OWN unlock): not a member.
      const strangerPost = createPublicPost(stranger, {
        publicationId: env.fx.publicationId, channelId: CHANNEL, body: 'stranger post', now: NOW,
      });
      const rejected = await submitPost(env, strangerPost, {
        'x-mk-session': 'session-stranger',
        'x-mk-humanity': 'human-2',
        'x-mk-app-unlock': await mintAppUnlock(APP_UNLOCK_SECRET, stranger.publicKeyHex),
      });
      expect(rejected.status).toBe(403);
      expect((rejected.json() as { reason: string }).reason).toBe('not_member');
    });

    it('a publication with NO pinned node key is refused (never a receipt readers reject)', async () => {
      const env = await boot({ pinNodeKey: false });
      const res = await submitPost(env, makePost(env.fx, 'x'), await fullHeaders('human-1'));
      expect(res.status).toBe(409);
      expect((res.json() as { reason: string }).reason).toBe('node_key_not_pinned');
    });
  });

  describe('kill switch: one owner/operator action flips posting to view_only', () => {
    it('owner freeze takes effect on the NEXT submit; a NEWER unfreeze restores; a STALE unfreeze is rejected', async () => {
      const env = await boot();
      expect((await submitPost(env, makePost(env.fx, 'before freeze'), await fullHeaders('human-1'))).status).toBe(200);

      const freeze = createPublicPostingFreeze(env.fx.ownerKeys, { publicationId: env.fx.publicationId, frozen: true, now: '2026-07-06T01:00:00.000Z' });
      const fr = await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/posting-freeze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ freeze }),
      });
      expect(fr.status).toBe(200);

      const frozenSubmit = await submitPost(env, makePost(env.fx, 'during freeze'), await fullHeaders('human-2'));
      expect(frozenSubmit.status).toBe(403);
      expect((frozenSubmit.json() as { reason: string }).reason).toBe('posting_frozen');

      // A replayed OLDER unfreeze cannot undo the freeze (monotonic).
      const stale = createPublicPostingFreeze(env.fx.ownerKeys, { publicationId: env.fx.publicationId, frozen: false, now: '2026-07-06T00:30:00.000Z' });
      const staleRes = await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/posting-freeze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ freeze: stale }),
      });
      expect(staleRes.status).toBe(409);

      const unfreeze = createPublicPostingFreeze(env.fx.ownerKeys, { publicationId: env.fx.publicationId, frozen: false, now: '2026-07-06T02:00:00.000Z' });
      const unfrozenRes = await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/posting-freeze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ freeze: unfreeze }),
      });
      expect(unfrozenRes.status).toBe(200);
      expect((await submitPost(env, makePost(env.fx, 'after unfreeze'), await fullHeaders('human-3'))).status).toBe(200);
    });

    it('a stranger-signed freeze is rejected 401', async () => {
      const env = await boot();
      const stranger = publicPostNodeKeypairFromSeed('66'.repeat(32));
      const freeze = createPublicPostingFreeze(stranger, { publicationId: env.fx.publicationId, frozen: true, now: NOW });
      const res = await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/posting-freeze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ freeze }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('tombstones: removal, page drop, resurrection block', () => {
    it('an owner tombstone drops the post from pages and blocks resubmission forever', async () => {
      const env = await boot();
      const post = makePost(env.fx, 'to be removed');
      expect((await submitPost(env, post, await fullHeaders('human-1'))).status).toBe(200);
      expect((await fetchPage(env)).publicPosts).toHaveLength(1);

      const tombstone = createPublicPostTombstone(env.fx.ownerKeys, { publicationId: env.fx.publicationId, postId: post.postId, now: NOW });
      const tr = await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/post-tombstone`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tombstone }),
      });
      expect(tr.status).toBe(200);
      expect((await fetchPage(env)).publicPosts).toHaveLength(0);

      // Resurrection attempt: the identical post resubmitted with fresh gates.
      const res = await submitPost(env, post, await fullHeaders('human-2'));
      expect(res.status).toBe(409);
      expect((res.json() as { reason: string }).reason).toBe('tombstoned');
    });

    it('the author persona may tombstone their OWN post; a stranger may not', async () => {
      const env = await boot();
      const post = makePost(env.fx, 'author-removable');
      expect((await submitPost(env, post, await fullHeaders('human-1'))).status).toBe(200);

      const stranger = publicPostNodeKeypairFromSeed('77'.repeat(32));
      const forged = createPublicPostTombstone(stranger, { publicationId: env.fx.publicationId, postId: post.postId, now: NOW });
      const forgedRes = await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/post-tombstone`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tombstone: forged }),
      });
      expect(forgedRes.status).toBe(401);
      expect((await fetchPage(env)).publicPosts).toHaveLength(1);

      const own = createPublicPostTombstone(persona, { publicationId: env.fx.publicationId, postId: post.postId, now: NOW });
      const ownRes = await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/post-tombstone`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tombstone: own }),
      });
      expect(ownRes.status).toBe(200);
      expect((await fetchPage(env)).publicPosts).toHaveLength(0);
    });
  });

  it('replay dedup: a byte-identical resubmit is idempotent (same receipt, one stored post)', async () => {
    const env = await boot();
    const post = makePost(env.fx, 'dedup me');
    const first = await submitPost(env, post, await fullHeaders('human-1'));
    expect(first.status).toBe(200);
    const firstAccepted = (first.json() as { accepted: AcceptedPublicPost }).accepted;

    const second = await submitPost(env, post, await fullHeaders('human-2'));
    expect(second.status).toBe(200);
    const body = second.json() as { accepted: AcceptedPublicPost; deduplicated: boolean };
    expect(body.deduplicated).toBe(true);
    expect(body.accepted.receipt.signature).toBe(firstAccepted.receipt.signature);
    expect((await fetchPage(env)).publicPosts).toHaveLength(1);
  });

  it('receipt HLC always lands AFTER the snapshot events (a stale node clock cannot hide a post behind the cursor)', async () => {
    // Node clock BEFORE the snapshot seed event (00:00:10): without the snapshot
    // max-HLC floor, the receipt would sort behind a reader cursor at the seed
    // event and the accepted post would be filtered out forever.
    const env = await boot({ nodeOverrides: { postReceipt: nodeReceipt, now: () => Date.parse('2026-07-06T00:00:05.000Z') } });
    const post = makePost(env.fx, 'must be visible');
    const res = await submitPost(env, post, await fullHeaders('human-1'));
    expect(res.status).toBe(200);
    const cursorAtSeed = encodeURIComponent('2026-07-06T00:00:10.000Z.0');
    const page = await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/${CHANNEL}/page?after=${cursorAtSeed}`);
    expect(page.status).toBe(200);
    const payload = page.json() as { events: ChannelMessageEvent[]; publicPosts: AcceptedPublicPost[] };
    expect(payload.publicPosts.map((p) => p.post.postId)).toContain(post.postId);
  });

  it('RACE: concurrent identical submits (two valid single-use tokens) store exactly ONE post', async () => {
    const env = await boot();
    const post = makePost(env.fx, 'raced post');
    const [a, b] = await Promise.all([
      submitPost(env, post, await fullHeaders('human-1')),
      submitPost(env, post, await fullHeaders('human-2')),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const dedupFlags = [a, b].map((r) => (r.json() as { deduplicated: boolean }).deduplicated).sort();
    expect(dedupFlags).toEqual([false, true]);
    // Same receipt on both, one stored post on the page.
    const sigA = (a.json() as { accepted: AcceptedPublicPost }).accepted.receipt.signature;
    const sigB = (b.json() as { accepted: AcceptedPublicPost }).accepted.receipt.signature;
    expect(sigA).toBe(sigB);
    expect((await fetchPage(env)).publicPosts).toHaveLength(1);
  });

  it('durable per-persona flood cap: over the window ceiling -> 429', async () => {
    const env = await boot({ nodeOverrides: { postReceipt: nodeReceipt, publicPostLimits: { postsPerPersonaPerWindow: 2 } } });
    expect((await submitPost(env, makePost(env.fx, 'p1'), await fullHeaders('human-1'))).status).toBe(200);
    expect((await submitPost(env, makePost(env.fx, 'p2'), await fullHeaders('human-2'))).status).toBe(200);
    const third = await submitPost(env, makePost(env.fx, 'p3'), await fullHeaders('human-3'));
    expect(third.status).toBe(429);
    expect((third.json() as { reason: string }).reason).toBe('rate_limited');
  });

  it('per-IP rejection before the humanity gate reports the token unconsumed', async () => {
    const env = await boot({
      humanityTokens: ['human-1'],
      httpOverrides: { publicReadLimits: { requestsPerWindow: 1, windowMs: 60_000 } },
    });
    // Registration used the one request allowed in this window. Submit is rejected
    // by the shared per-IP rail before the single-use humanity service is called.
    const limited = await submitPost(env, makePost(env.fx, 'try later'), await fullHeaders('human-1'));
    expect(limited.status).toBe(429);
    expect(limited.json()).toEqual({ reason: 'rate_limited', humanityTokenConsumed: false });
    expect(env.humanity.spent.has('human-1')).toBe(false);
  });

  it('NC-P1 guard: private mesh routes + public reads never consult the submit gates', async () => {
    const env = await boot();
    // Public READ with zero gate headers still serves.
    expect((await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/manifest`)).status).toBe(200);
    expect((await rawRequest(`${env.server.url}/public/${env.fx.publicationId}/${CHANNEL}/page`)).status).toBe(200);
    // A PRIVATE community route (challenge issuance, the entry point of the
    // private feed auth path) answers with no session/humanity/app-unlock headers.
    const challenge = await rawRequest(`${env.server.url}/community/private-community/challenge`);
    expect(challenge.status).toBe(200);
    expect(JSON.parse(challenge.text)).toHaveProperty('nonce');
  });
});
