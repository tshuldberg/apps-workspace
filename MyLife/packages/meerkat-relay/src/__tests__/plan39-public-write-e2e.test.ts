/**
 * Plan 39 A-B INTEGRATION e2e: the real public-write chain across three live services.
 *
 * This is the seam proof. Nothing is faked: a real HUMANITY service (token issue + atomic
 * redeem), the real PERSONA service (register + humanity-gated session issuance, Plan 39 P7),
 * and a real COMMUNITY NODE whose submit route consumes the REAL persona-session verifier
 * (`createPersonaSessionVerifier`, with `isRevoked` wired to the persona registry store).
 *
 * Full happy chain:
 *   humanity verify -> register persona -> session challenge -> issue session (spends a
 *   humanity token) -> mint a persona-bound app-unlock proof -> POST submit (session +
 *   humanity + app-unlock) -> fetch the public page and DUAL-VERIFY the post against the
 *   descriptor-pinned node key.
 *
 * Negative legs (the A-B contract):
 *   - GDPR delete revokes the live session -> the verifier reports 'revoked' and the submit
 *     is rejected (fail-closed).
 *   - a session whose persona != the post author -> 'persona_mismatch'.
 *   - session issuance with no humanity token -> 401 (P7 gate).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { issueMeerkatAppUnlockToken } from '@mylife/entitlements/server';
import {
  buildPublicSnapshot,
  bytesToHex,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createChannelMessage,
  createPersonaClaim,
  createPublication,
  createPublicPost,
  extractPersonaPrivateKeyHex,
  generateDeviceIdentity,
  generatePublicPersona,
  humanityServiceKeypairFromSeed,
  parseHumanityToken,
  personaRequestBytes,
  personaSessionChallengeBytes,
  publicPostNodeKeypairFromSeed,
  serializeHumanityToken,
  sha512Hex,
  signMessage,
  verifyPublicPost,
  PERSONA_GDPR_DELETE_DOMAIN,
  type AcceptedPublicPost,
  type ChannelMessageEvent,
  type ContentManifest,
  type HumanityRedeemOutcome,
  type PublicPersona,
} from '@mylife/sync';
import {
  CommunityNode,
  createHumanityRouteGuard,
  createPersonaSessionVerifier,
  FilePersonaRegistryStore,
  GdprDeletionCoordinator,
  HumanityService,
  InMemoryHumanityStore,
  PersonaRegistryService,
  startCommunityNodeHttp,
  startHumanityService,
  startPersonaService,
  StubHumanityVerifier,
  type HumanityServiceServer,
  type PersonaServiceServer,
  type SeederHttpServer,
} from '../index';
import { personaBindingHash } from '../community-node-http';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';

const CHANNEL = 'general';
const COMMUNITY = 'the-commons';
const NOW = '2026-07-06T00:00:00.000Z';
const APP_UNLOCK_SECRET = 'shared-app-unlock-secret-e2e';
const SESSION_SECRET = 'persona-session-secret-for-e2e-0000';
const encoder = new TextEncoder();

const nodeReceipt = publicPostNodeKeypairFromSeed('33'.repeat(32));

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}
async function getJson(url: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(url);
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

// The HTTP redeem client both the persona service (registration + issuance guard) and the
// community node (submit gate 2) use: POST the token to the real humanity service.
function httpRedeem(humanityUrl: string) {
  return async (bearer: string): Promise<HumanityRedeemOutcome> => {
    try {
      const res = await fetch(`${humanityUrl}/humanity/redeem`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: bearer }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
      if (res.ok && body?.ok === true) return { ok: true };
      const reason = body?.reason;
      if (reason === 'already_spent' || reason === 'invalid' || reason === 'expired') return { ok: false, reason };
      return { ok: false, reason: 'service_unreachable' };
    } catch {
      return { ok: false, reason: 'service_unreachable' };
    }
  };
}

interface Fixture {
  signed: Awaited<ReturnType<typeof createPublication>>;
  publicationId: string;
  manifest: ContentManifest;
  pieces: Uint8Array[];
}

async function buildFixture(): Promise<Fixture> {
  const owner = generateDeviceIdentity('CommonsOperator');
  const publicKey = new Uint8Array(randomBytes(32));
  const events: ChannelMessageEvent[] = [
    createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body: 'seed', hlc: { wall: '2026-07-06T00:00:10.000Z', counter: 0 } }),
  ];
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({ identity: owner, publicationId: 'pending', communityId: COMMUNITY, channelId: CHANNEL, events, publicKey, pieceStore: buildStore, now: NOW });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(manifest.infoHash, i) as Uint8Array);
  const signed = createPublication(owner, {
    kind: 'channel', communityId: COMMUNITY, channelId: CHANNEL, title: 'The Commons', description: 'public', category: 'technology',
    contentId: record.infoHash, publicKeyHex: bytesToHex(publicKey), now: NOW, postPolicy: 'open', postNodeKeyHex: nodeReceipt.publicKeyHex,
  });
  return { signed, publicationId: signed.descriptor.publicationId, manifest, pieces };
}

interface World {
  humanity: HumanityServiceServer;
  persona: PersonaServiceServer;
  node: SeederHttpServer;
  personaStore: FilePersonaRegistryStore;
  fx: Fixture;
  personaUrl: string;
  nodeUrl: string;
  humanityUrl: string;
}

let world: World | null = null;
let dir: string;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  dir = mkdtempSync(path.join(tmpdir(), 'plan39-e2e-'));
});
afterEach(async () => {
  if (world) {
    await world.node.close();
    await world.persona.close();
    await world.humanity.close();
    world = null;
  }
  rmSync(dir, { recursive: true, force: true });
});

async function boot(): Promise<World> {
  // 1) Real humanity service (stub verifier: production-safe=false, so productionMode stays off).
  const humanityService = new HumanityService({
    signingKeypair: humanityServiceKeypairFromSeed('77'.repeat(32)),
    verifiers: [new StubHumanityVerifier('turnstile')],
    store: new InMemoryHumanityStore(),
  });
  const humanity = await startHumanityService({ service: humanityService, host: '127.0.0.1' });
  const humanityUrl = humanity.url;
  const redeem = httpRedeem(humanityUrl);

  // 2) Real persona service: registration humanity-gated + session issuance humanity-gated (P7).
  const personaStore = new FilePersonaRegistryStore(dir);
  const personaService = new PersonaRegistryService({ store: personaStore, sessionSecret: SESSION_SECRET, redeemHumanity: redeem, humanityRequired: true });
  const communityNode = new CommunityNode({ postReceipt: nodeReceipt });
  const gdprCoordinator = new GdprDeletionCoordinator({
    registry: personaService,
    postArchive: communityNode,
    operator: nodeReceipt,
    personaBindingHash,
  });
  const persona = await startPersonaService({
    service: personaService,
    gdprCoordinator,
    host: '127.0.0.1',
    sessionHumanityRequired: true,
    sessionHumanityGuard: createHumanityRouteGuard({ policy: { required: true, servicePublicKeyHex: humanityService.publicKeyHex, redeem } }),
  });

  // 3) Real community node: submit route consumes the REAL persona-session verifier + real redeem.
  const node = await startCommunityNodeHttp({
    node: communityNode,
    host: '127.0.0.1',
    publicSubmit: {
      sessionVerifier: createPersonaSessionVerifier({ secret: SESSION_SECRET, isRevoked: (pk) => personaStore.isRevoked(pk) }),
      humanityVerifyToken: redeem,
      appUnlockSecret: APP_UNLOCK_SECRET,
    },
  });

  const fx = await buildFixture();
  const reg = await postJson(`${node.url}/public/${fx.publicationId}/register`, {
    descriptor: fx.signed,
    snapshots: [{ channelId: CHANNEL, epoch: 0, manifest: fx.manifest, pieces: fx.pieces.map((p) => Buffer.from(p).toString('base64')) }],
  });
  expect(reg.status).toBe(200);

  world = { humanity, persona, node, personaStore, fx, personaUrl: persona.url, nodeUrl: node.url, humanityUrl };
  return world;
}

/** Issue a batch of real humanity tokens (serialized bearer strings) from the live service. */
async function issueHumanityTokens(humanityUrl: string): Promise<string[]> {
  const ch = await postJson(`${humanityUrl}/humanity/challenge`, { kind: 'turnstile' });
  expect(ch.status).toBe(200);
  const iss = await postJson(`${humanityUrl}/humanity/issue`, { challengeId: ch.json.challengeId, attestation: { stubSecret: 'stub-ok' } });
  expect(iss.status).toBe(200);
  return (iss.json.tokens as unknown[]).map((t) => (typeof t === 'string' ? t : serializeHumanityToken(t as never)));
}

/** Register a fresh persona through the real service and return its keypair-ish handle. */
async function registerPersona(w: World, alias: string, humanityToken: string): Promise<PublicPersona> {
  const persona = generatePublicPersona(alias);
  const binding = sha512Hex(encoder.encode(parseHumanityToken(humanityToken)!.tokenId));
  const claim = createPersonaClaim({ persona, humanityBinding: binding });
  const res = await postJson(`${w.personaUrl}/persona/register`, { claim }, { 'x-mk-humanity': humanityToken });
  expect(res.status).toBe(200);
  return persona;
}

/** Drive the real challenge -> issue flow (spending a humanity token) and return the bearer. */
async function issueSession(w: World, persona: PublicPersona, humanityToken: string): Promise<{ status: number; token?: string }> {
  const ch = await postJson(`${w.personaUrl}/persona/session/challenge`, { personaPubkey: persona.personaPubkey });
  if (ch.status !== 200) return { status: ch.status };
  const priv = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
  const signature = bytesToHex(signMessage(priv, personaSessionChallengeBytes(ch.json.nonce as string, persona.personaPubkey)));
  const res = await postJson(`${w.personaUrl}/persona/session/issue`, {
    challengeId: ch.json.challengeId, personaPubkey: persona.personaPubkey, signature,
  }, { 'x-mk-humanity': humanityToken });
  return { status: res.status, token: res.json.token as string | undefined };
}

function postPersona(persona: PublicPersona) {
  return { publicKeyHex: persona.personaPubkey, privateKeyHex: extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey) };
}

async function mintAppUnlock(personaPubkey: string): Promise<string> {
  const issued = await issueMeerkatAppUnlockToken({ secret: APP_UNLOCK_SECRET, purchaseDate: NOW, bindingHash: personaBindingHash(personaPubkey) });
  return issued.token;
}

describe('Plan 39 A-B integration: real public write chain', () => {
  it('humanity -> register -> session (humanity-spent) -> submit -> dual-verified page', async () => {
    const w = await boot();
    const tokens = await issueHumanityTokens(w.humanityUrl);
    const persona = await registerPersona(w, 'duskrunner', tokens[0]!);

    // Session issuance spends a SECOND humanity token (Plan 39 P7).
    const session = await issueSession(w, persona, tokens[1]!);
    expect(session.status).toBe(200);
    expect(typeof session.token).toBe('string');

    // Author a persona-signed post + a persona-bound app-unlock proof.
    const post = createPublicPost(postPersona(persona), { publicationId: w.fx.publicationId, channelId: CHANNEL, body: 'first commons post', now: NOW });
    const appUnlock = await mintAppUnlock(persona.personaPubkey);

    // Submit through all three gates: session + humanity (a THIRD token) + app-unlock.
    const submit = await postJson(`${w.nodeUrl}/public/${w.fx.publicationId}/${CHANNEL}/submit`, { post }, {
      'x-mk-session': session.token!,
      'x-mk-humanity': tokens[2]!,
      'x-mk-app-unlock': appUnlock,
    });
    expect(submit.status).toBe(200);
    expect(submit.json.ok).toBe(true);

    // Fetch the page and DUAL-VERIFY the post against the descriptor-pinned node key.
    const page = await getJson(`${w.nodeUrl}/public/${w.fx.publicationId}/${CHANNEL}/page`);
    expect(page.status).toBe(200);
    const posts = page.json.publicPosts as AcceptedPublicPost[];
    expect(posts).toHaveLength(1);
    expect(posts[0]!.post.postId).toBe(post.postId);
    expect(posts[0]!.post.personaPubkey).toBe(persona.personaPubkey);
    expect(verifyPublicPost(posts[0]!, w.fx.signed.descriptor.postNodeKeyHex!, { publicationId: w.fx.publicationId, channelId: CHANNEL })).toBe('ok');
  });

  it('GDPR delete revokes the live session: the real verifier reports revoked and the submit is refused', async () => {
    const w = await boot();
    const tokens = await issueHumanityTokens(w.humanityUrl);
    const persona = await registerPersona(w, 'duskrunner', tokens[0]!);
    const session = await issueSession(w, persona, tokens[1]!);
    expect(session.status).toBe(200);

    // The session verifies BEFORE deletion.
    const verifier = createPersonaSessionVerifier({ secret: SESSION_SECRET, isRevoked: (pk) => w.personaStore.isRevoked(pk) });
    expect((await verifier(session.token!)).ok).toBe(true);

    // GDPR-delete the persona (persona-signed request) -> revokes sessions.
    const issuedAt = Date.now();
    const priv = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
    const delSig = bytesToHex(signMessage(priv, personaRequestBytes(PERSONA_GDPR_DELETE_DOMAIN, persona.personaPubkey, issuedAt)));
    const del = await postJson(`${w.personaUrl}/persona/delete`, { personaPubkey: persona.personaPubkey, issuedAt, signature: delSig });
    expect(del.status).toBe(200);

    // The SAME bearer now fails closed as revoked.
    const after = await verifier(session.token!);
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.reason).toBe('revoked');

    // And a submit with that bearer is refused by the node (session gate).
    const post = createPublicPost(postPersona(persona), { publicationId: w.fx.publicationId, channelId: CHANNEL, body: 'should not land', now: NOW });
    const submit = await postJson(`${w.nodeUrl}/public/${w.fx.publicationId}/${CHANNEL}/submit`, { post }, {
      'x-mk-session': session.token!, 'x-mk-humanity': tokens[2]!, 'x-mk-app-unlock': await mintAppUnlock(persona.personaPubkey),
    });
    expect(submit.status).toBe(401);
    expect(submit.json.reason).toBe('session_invalid'); // the route maps any not-ok verdict (incl. revoked) to session_invalid
    expect((await getJson(`${w.nodeUrl}/public/${w.fx.publicationId}/${CHANNEL}/page`)).json.publicPosts).toHaveLength(0);
  });

  it('a session persona that is not the post author is rejected persona_mismatch', async () => {
    const w = await boot();
    const tokens = await issueHumanityTokens(w.humanityUrl);
    const author = await registerPersona(w, 'author', tokens[0]!);
    const other = await registerPersona(w, 'other', tokens[1]!);
    const otherSession = await issueSession(w, other, tokens[2]!);
    expect(otherSession.status).toBe(200);

    // Post signed by `author`, but the session belongs to `other`; app-unlock bound to `other`.
    const post = createPublicPost(postPersona(author), { publicationId: w.fx.publicationId, channelId: CHANNEL, body: 'wrong author', now: NOW });
    const submit = await postJson(`${w.nodeUrl}/public/${w.fx.publicationId}/${CHANNEL}/submit`, { post }, {
      'x-mk-session': otherSession.token!, 'x-mk-humanity': tokens[3]!, 'x-mk-app-unlock': await mintAppUnlock(other.personaPubkey),
    });
    expect(submit.status).toBe(401);
    expect(submit.json.reason).toBe('persona_mismatch');
  });

  it('session issuance with no humanity token is refused (Plan 39 P7 gate)', async () => {
    const w = await boot();
    const tokens = await issueHumanityTokens(w.humanityUrl);
    const persona = await registerPersona(w, 'duskrunner', tokens[0]!);
    // Challenge, then issue with NO x-mk-humanity header.
    const ch = await postJson(`${w.personaUrl}/persona/session/challenge`, { personaPubkey: persona.personaPubkey });
    const priv = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
    const signature = bytesToHex(signMessage(priv, personaSessionChallengeBytes(ch.json.nonce as string, persona.personaPubkey)));
    const res = await postJson(`${w.personaUrl}/persona/session/issue`, { challengeId: ch.json.challengeId, personaPubkey: persona.personaPubkey, signature });
    expect(res.status).toBe(401);
  });
});
