/**
 * Plan 39 P14 red-team. A DEDICATED adversarial suite over the public-tier primitives. Every
 * test is an attack that MUST fail closed. Real crypto, real stores, real HTTP where the gate
 * lives in the route. Categories: forged persona/receipt/dual-signature + domain confusion,
 * session fixation/replay + read-gate bypass, humanity double-spend race, entitlement spoof,
 * flood/rate-cap bypass, alias squat/homoglyph race, console auth replay/interleave.
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildPublicSnapshot,
  bytesToHex,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createChannelMessage,
  createPersonaClaim,
  createPublication,
  createPublicPost,
  createPublicPostTombstone,
  extractPersonaPrivateKeyHex,
  generateDeviceIdentity,
  generatePublicPersona,
  personaRequestBytes,
  personaSessionChallengeBytes,
  publicPostNodeKeypairFromSeed,
  serializeHumanityToken,
  sha512Hex,
  signMessage,
  verifyPublicPostAuthor,
  PERSONA_GDPR_DELETE_DOMAIN,
  type ContentManifest,
  type PublicPersona,
} from '@mylife/sync';
import { issueHumanityTokenBatch, humanityServiceKeypairFromSeed } from '@mylife/sync';
import { issueMeerkatAppUnlockToken, verifyMeerkatAppUnlockToken } from '@mylife/entitlements/server';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import {
  CommunityNode,
  InMemoryPublicationStore,
  InMemoryPublicPostStore,
  InMemoryReportStore,
  InMemoryPersonaRegistryStore,
  PersonaRegistryService,
  FilePersonaRegistryStore,
  HumanityService,
  InMemoryHumanityStore,
  signPersonaSessionToken,
  createPersonaSessionVerifier,
  verifyPersonaSessionChallengeSignature,
  startCommunityNodeHttp,
} from '../index';
import { personaBindingHash } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';

const CHANNEL = 'general';
const NOW = '2026-07-06T00:00:00.000Z';
const NOW_MS = Date.parse(NOW);
const SESSION_SECRET = 'red-team-session-secret-0000000000';
const nodeReceipt = publicPostNodeKeypairFromSeed('33'.repeat(32));
const persona = publicPostNodeKeypairFromSeed('44'.repeat(32));
const attackerKp = publicPostNodeKeypairFromSeed('66'.repeat(32));

interface RawResponse { status: number; json: () => unknown }
function rawRequest(url: string, headers: Record<string, string> = {}, init: { method?: string; body?: string } = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const r = http.request(url, { method: init.method ?? 'GET', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode ?? 500, json: () => (text ? JSON.parse(text) : null) });
      });
    });
    r.on('error', reject);
    if (init.body) r.write(init.body);
    r.end();
  });
}

async function registerPublication(node: CommunityNode, communityId: string, postPolicy: 'open' | 'view_only' = 'open'): Promise<string> {
  const owner = generateDeviceIdentity('Publisher');
  const publicKey = new Uint8Array(nodeRandomBytes(32));
  const events = [createChannelMessage(owner, { communityId, channelId: CHANNEL, body: 'seed', hlc: { wall: '2026-07-06T00:00:10.000Z', counter: 0 } })];
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({ identity: owner, publicationId: 'pending', communityId, channelId: CHANNEL, events, publicKey, pieceStore: buildStore, now: NOW });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(manifest.infoHash, i) as Uint8Array);
  const signed = createPublication(owner, {
    kind: 'channel', communityId, channelId: CHANNEL, title: 'Open', description: 'public', category: 'technology',
    contentId: record.infoHash, publicKeyHex: bytesToHex(publicKey), now: NOW, postPolicy, postNodeKeyHex: nodeReceipt.publicKeyHex,
  });
  expect((await node.registerPublication({ descriptor: signed, snapshots: [{ channelId: CHANNEL, epoch: 0, manifest, pieces }] })).ok).toBe(true);
  return signed.descriptor.publicationId;
}

function makeNode(): CommunityNode {
  return new CommunityNode({
    publicationStore: new InMemoryPublicationStore(),
    reportStore: new InMemoryReportStore(),
    publicPostStore: new InMemoryPublicPostStore(),
    postReceipt: nodeReceipt,
    now: () => NOW_MS,
  });
}

const tmpDirs: string[] = [];
async function tmpDir(): Promise<string> { const d = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-rt-')); tmpDirs.push(d); return d; }
const servers: SeederHttpServer[] = [];

beforeEach(() => { configureSyncSecretStore(createInMemorySyncSecretStore()); });
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
  await Promise.all(tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

// ---------------------------------------------------------------------------
describe('forged persona / receipt / dual-signature + domain confusion', () => {
  it('a post signed by the WRONG key is rejected (author signature verify)', async () => {
    const node = makeNode();
    const pubId = await registerPublication(node, 'c1');
    // Build a valid post by the attacker, then claim it is persona's by swapping the pubkey field.
    const good = createPublicPost(attackerKp, { publicationId: pubId, channelId: CHANNEL, body: 'x', now: NOW });
    const forged = { ...good, personaPubkey: persona.publicKeyHex }; // signature is attacker's, pubkey claims persona
    expect(verifyPublicPostAuthor(forged)).toBe(false);
    const verdict = await node.submitPublicPost(pubId, CHANNEL, forged, persona.publicKeyHex);
    expect(verdict.ok).toBe(false);
  });

  it('a TRANSPLANTED signature (post A signature on post B content) is rejected', async () => {
    const node = makeNode();
    const pubId = await registerPublication(node, 'c2');
    const a = createPublicPost(persona, { publicationId: pubId, channelId: CHANNEL, body: 'A', now: NOW });
    const b = createPublicPost(persona, { publicationId: pubId, channelId: CHANNEL, body: 'B', now: NOW });
    const frankenstein = { ...b, signature: a.signature }; // A's sig over B's bytes
    expect(verifyPublicPostAuthor(frankenstein)).toBe(false); // A's sig does not verify over B's bytes
    expect((await node.submitPublicPost(pubId, CHANNEL, frankenstein, persona.publicKeyHex)).ok).toBe(false);
  });

  it('a submit whose SESSION persona != the post author is rejected (no posting-as-someone-else)', async () => {
    const node = makeNode();
    const pubId = await registerPublication(node, 'c3');
    const post = createPublicPost(persona, { publicationId: pubId, channelId: CHANNEL, body: 'x', now: NOW });
    // Session says attacker, post says persona -> persona_mismatch.
    const verdict = await node.submitPublicPost(pubId, CHANNEL, post, attackerKp.publicKeyHex);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('persona_mismatch');
  });

  it('DOMAIN CONFUSION: a persona GDPR-delete signature cannot be replayed as a session challenge (different domains)', () => {
    const p = generatePublicPersona('victim');
    const priv = extractPersonaPrivateKeyHex(p.privateKeyRef, p.personaPubkey);
    // Sign the GDPR-delete request bytes...
    const gdprSig = bytesToHex(signMessage(priv, personaRequestBytes(PERSONA_GDPR_DELETE_DOMAIN, p.personaPubkey, NOW_MS)));
    // ...then try to pass it off as a session-challenge signature over a nonce. The challenge
    // verifier signs DIFFERENT bytes (challenge domain + nonce), so the transplant fails.
    expect(verifyPersonaSessionChallengeSignature('some-nonce', p.personaPubkey, gdprSig)).toBe(false);
    // Control: the domain-correct signature verifies.
    const challengeSig = bytesToHex(signMessage(priv, personaSessionChallengeBytes('some-nonce', p.personaPubkey)));
    expect(verifyPersonaSessionChallengeSignature('some-nonce', p.personaPubkey, challengeSig)).toBe(true);
  });

  it('an operator tombstone signed by a STRANGER key cannot censor a post', async () => {
    const node = makeNode();
    const pubId = await registerPublication(node, 'c4');
    const post = createPublicPost(persona, { publicationId: pubId, channelId: CHANNEL, body: 'keep', now: NOW });
    expect((await node.submitPublicPost(pubId, CHANNEL, post, persona.publicKeyHex)).ok).toBe(true);
    // A stranger (not owner, not node key, not the author) signs a tombstone -> rejected.
    const stranger = publicPostNodeKeypairFromSeed('77'.repeat(32));
    const t = createPublicPostTombstone(stranger, { publicationId: pubId, postId: post.postId, now: NOW });
    const verdict = await node.recordPublicPostTombstone(pubId, t);
    expect(verdict.ok).toBe(false);
    // The post is still served on the page (the stranger tombstone had no effect).
    const page = await node.getPublicationPage(pubId, CHANNEL, null, 50);
    expect(page?.publicPosts.some((p) => p.post.postId === post.postId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('session fixation / replay + read-gate bypass (P9)', () => {
  const verifier = createPersonaSessionVerifier({ secret: SESSION_SECRET, now: () => NOW_MS });

  it('an EXPIRED bearer is rejected', async () => {
    const token = signPersonaSessionToken(SESSION_SECRET, { personaPubkey: persona.publicKeyHex, issuedAtMs: NOW_MS - 10_000, expiresAtMs: NOW_MS - 1 });
    expect((await verifier(token)).ok).toBe(false);
  });

  it('a bearer minted with a DIFFERENT secret is rejected', async () => {
    const token = signPersonaSessionToken('some-other-secret-00000000000000', { personaPubkey: persona.publicKeyHex, issuedAtMs: NOW_MS, expiresAtMs: NOW_MS + 60_000 });
    expect((await verifier(token)).ok).toBe(false);
  });

  it('a TAMPERED mac is rejected', async () => {
    const token = signPersonaSessionToken(SESSION_SECRET, { personaPubkey: persona.publicKeyHex, issuedAtMs: NOW_MS, expiresAtMs: NOW_MS + 60_000 });
    const parts = token.split('.');
    parts[3] = parts[3]!.slice(0, -2) + (parts[3]!.endsWith('AA') ? 'BB' : 'AA');
    expect((await verifier(parts.join('.'))).ok).toBe(false);
  });

  it('a REVOKED persona bearer is rejected (GDPR delete / suspend)', async () => {
    const revoked = new Set([persona.publicKeyHex]);
    const v = createPersonaSessionVerifier({ secret: SESSION_SECRET, now: () => NOW_MS, isRevoked: (pk) => revoked.has(pk) });
    const token = signPersonaSessionToken(SESSION_SECRET, { personaPubkey: persona.publicKeyHex, issuedAtMs: NOW_MS, expiresAtMs: NOW_MS + 60_000 });
    expect((await v(token)).ok).toBe(false);
  });

  it('a revocation-store ERROR fails CLOSED (treated as revoked)', async () => {
    const v = createPersonaSessionVerifier({ secret: SESSION_SECRET, now: () => NOW_MS, isRevoked: () => { throw new Error('store down'); } });
    const token = signPersonaSessionToken(SESSION_SECRET, { personaPubkey: persona.publicKeyHex, issuedAtMs: NOW_MS, expiresAtMs: NOW_MS + 60_000 });
    const verdict = await v(token);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('revoked');
  });

  it('READ-GATE bypass attempts on a gated publication all fail closed; a valid session passes', async () => {
    const node = makeNode();
    const pubId = await registerPublication(node, 'c-read');
    const server = await startCommunityNodeHttp({ node, port: 0, publicRead: { isGated: (id) => id === pubId, sessionVerifier: verifier } });
    servers.push(server);
    const base = `${server.url}/public/${pubId}`;
    // No token -> 401.
    expect((await rawRequest(`${base}/manifest`)).status).toBe(401);
    // Garbage token -> 401.
    expect((await rawRequest(`${base}/manifest`, { 'x-mk-session': 'garbage' })).status).toBe(401);
    // Expired token -> 401.
    const expired = signPersonaSessionToken(SESSION_SECRET, { personaPubkey: persona.publicKeyHex, issuedAtMs: NOW_MS - 10_000, expiresAtMs: NOW_MS - 1 });
    expect((await rawRequest(`${base}/manifest`, { 'x-mk-session': expired })).status).toBe(401);
    // Wrong-secret token -> 401.
    const wrongSecret = signPersonaSessionToken('nope-secret-000000000000000000000', { personaPubkey: persona.publicKeyHex, issuedAtMs: NOW_MS, expiresAtMs: NOW_MS + 60_000 });
    expect((await rawRequest(`${base}/manifest`, { 'x-mk-session': wrongSecret })).status).toBe(401);
    // A VALID token passes.
    const good = signPersonaSessionToken(SESSION_SECRET, { personaPubkey: persona.publicKeyHex, issuedAtMs: NOW_MS, expiresAtMs: NOW_MS + 60_000 });
    expect((await rawRequest(`${base}/manifest`, { 'x-mk-session': good })).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
describe('humanity token double-spend RACE', () => {
  it('concurrent redeems of the SAME token: exactly one wins (atomic spend)', async () => {
    const kp = humanityServiceKeypairFromSeed('cd'.repeat(32));
    const service = new HumanityService({ signingKeypair: kp, store: new InMemoryHumanityStore(), verifiers: [], now: () => NOW_MS });
    const [token] = issueHumanityTokenBatch({ servicePrivateKeyHex: kp.privateKeyHex, count: 1, randomBytes: (n) => new Uint8Array(nodeRandomBytes(n)) });
    const wire = serializeHumanityToken(token);
    // Fire many concurrent redeems of the one token.
    const results = await Promise.all(Array.from({ length: 20 }, () => service.redeem(wire)));
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => !r.ok && r.reason === 'already_spent').length).toBe(19);
  });
});

// ---------------------------------------------------------------------------
describe('entitlement spoof', () => {
  const SECRET = 'app-unlock-secret-000';
  const bindingA = personaBindingHash(persona.publicKeyHex);
  const bindingB = personaBindingHash(attackerKp.publicKeyHex);

  it('an UNBOUND proof is rejected by a binding-required gate', async () => {
    const unbound = await issueMeerkatAppUnlockToken({ secret: SECRET, purchaseDate: NOW, nowMs: NOW_MS });
    const verdict = await verifyMeerkatAppUnlockToken(unbound.token, SECRET, { expectedBindingHash: bindingA, nowMs: NOW_MS });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('unbound');
  });

  it('a proof bound to persona A is rejected for persona B (cross-persona reuse)', async () => {
    const bound = await issueMeerkatAppUnlockToken({ secret: SECRET, purchaseDate: NOW, bindingHash: bindingA, nowMs: NOW_MS });
    const verdict = await verifyMeerkatAppUnlockToken(bound.token, SECRET, { expectedBindingHash: bindingB, nowMs: NOW_MS });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('wrong_binding');
  });

  it('a proof minted with the WRONG secret is rejected', async () => {
    const forged = await issueMeerkatAppUnlockToken({ secret: 'attacker-secret', purchaseDate: NOW, bindingHash: bindingA, nowMs: NOW_MS });
    const verdict = await verifyMeerkatAppUnlockToken(forged.token, SECRET, { expectedBindingHash: bindingA, nowMs: NOW_MS });
    expect(verdict.ok).toBe(false);
  });

  it('a TAMPERED proof body is rejected', async () => {
    const bound = await issueMeerkatAppUnlockToken({ secret: SECRET, purchaseDate: NOW, bindingHash: bindingA, nowMs: NOW_MS });
    const tampered = bound.token.slice(0, -3) + (bound.token.endsWith('aaa') ? 'bbb' : 'aaa');
    const verdict = await verifyMeerkatAppUnlockToken(tampered, SECRET, { expectedBindingHash: bindingA, nowMs: NOW_MS });
    expect(verdict.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('flood / rate-cap bypass', () => {
  it('parallel submits over the per-persona cap: no more than the cap are accepted (durable)', async () => {
    const node = new CommunityNode({
      publicationStore: new InMemoryPublicationStore(),
      reportStore: new InMemoryReportStore(),
      publicPostStore: new InMemoryPublicPostStore(),
      postReceipt: nodeReceipt,
      now: () => NOW_MS,
      publicPostLimits: { postsPerPersonaPerWindow: 3, windowMs: 60_000, maxPostsPerPublication: 100 },
    });
    const pubId = await registerPublication(node, 'c-flood');
    // Fire 10 DISTINCT posts concurrently; the durable per-persona window caps accepted at 3.
    const posts = Array.from({ length: 10 }, (_, i) => createPublicPost(persona, { publicationId: pubId, channelId: CHANNEL, body: `p${i}`, now: `2026-07-06T00:01:${String(i).padStart(2, '0')}.000Z` }));
    const verdicts = await Promise.all(posts.map((p) => node.submitPublicPost(pubId, CHANNEL, p, persona.publicKeyHex)));
    expect(verdicts.filter((v) => v.ok).length).toBe(3);
    expect(verdicts.filter((v) => !v.ok && v.reason === 'rate_limited').length).toBe(7);
  });

  it('a body over the submit size cap is rejected 413 at the HTTP boundary', async () => {
    const node = makeNode();
    const pubId = await registerPublication(node, 'c-size');
    const server = await startCommunityNodeHttp({ node, port: 0, bodyLimits: { submit: 256 } });
    servers.push(server);
    const huge = JSON.stringify({ post: { body: 'x'.repeat(5000) } });
    const res = await rawRequest(`${server.url}/public/${pubId}/${CHANNEL}/submit`, { 'Content-Type': 'application/json' }, { method: 'POST', body: huge });
    expect(res.status).toBe(413);
  });
});

// ---------------------------------------------------------------------------
describe('alias squat / homoglyph / re-registration block', () => {
  function account(alias: string): { claim: ReturnType<typeof createPersonaClaim>; persona: PublicPersona } {
    const p = generatePublicPersona(alias);
    return { claim: createPersonaClaim({ persona: p, humanityBinding: sha512Hex(new TextEncoder().encode('t')) }), persona: p };
  }

  it('CONCURRENT registration of the same alias over a DURABLE file store: exactly one wins (atomic O_EXCL)', async () => {
    const dir = await tmpDir();
    // Two independent services over the SAME durable dir race to claim 'dawn'.
    const mk = () => new PersonaRegistryService({ store: new FilePersonaRegistryStore(dir), sessionSecret: SESSION_SECRET, humanityRequired: false, now: () => NOW_MS });
    const a = account('dawn');
    const b = account('dawn');
    const [ra, rb] = await Promise.all([mk().register({ claim: a.claim }), mk().register({ claim: b.claim })]);
    expect([ra.ok, rb.ok].filter(Boolean).length).toBe(1);
  });

  it('case-fold collision: Alias vs alias -> the second is refused', async () => {
    const svc = new PersonaRegistryService({ store: new InMemoryPersonaRegistryStore(), sessionSecret: SESSION_SECRET, humanityRequired: false, now: () => NOW_MS });
    const p1 = generatePublicPersona('RiverSong');
    const p2 = generatePublicPersona('riversong');
    expect((await svc.register({ claim: createPersonaClaim({ persona: p1, humanityBinding: sha512Hex(new TextEncoder().encode('a')) }) })).ok).toBe(true);
    const second = await svc.register({ claim: createPersonaClaim({ persona: p2, humanityBinding: sha512Hex(new TextEncoder().encode('b')) }) });
    expect(second.ok).toBe(false);
  });

  it('a reserved alias is refused', async () => {
    const svc = new PersonaRegistryService({ store: new InMemoryPersonaRegistryStore(), sessionSecret: SESSION_SECRET, humanityRequired: false, now: () => NOW_MS });
    const p = generatePublicPersona('admin');
    expect((await svc.register({ claim: createPersonaClaim({ persona: p, humanityBinding: sha512Hex(new TextEncoder().encode('x')) }) })).ok).toBe(false);
  });

  it('a released alias cannot be re-registered inside the 30-day cooldown (AC-5)', async () => {
    let clock = NOW_MS;
    const svc = new PersonaRegistryService({ store: new InMemoryPersonaRegistryStore(), sessionSecret: SESSION_SECRET, humanityRequired: false, now: () => clock });
    const p = generatePublicPersona('nova');
    expect((await svc.register({ claim: createPersonaClaim({ persona: p, humanityBinding: sha512Hex(new TextEncoder().encode('n')) }) })).ok).toBe(true);
    const priv = extractPersonaPrivateKeyHex(p.privateKeyRef, p.personaPubkey);
    const sig = bytesToHex(signMessage(priv, personaRequestBytes(PERSONA_GDPR_DELETE_DOMAIN, p.personaPubkey, clock)));
    expect((await svc.deleteAccount({ personaPubkey: p.personaPubkey, issuedAtMs: clock, signatureHex: sig })).ok).toBe(true);
    // A different persona tries to grab the freed alias one day later -> blocked.
    clock += 24 * 60 * 60 * 1000;
    const squatter = generatePublicPersona('nova');
    const attempt = await svc.register({ claim: createPersonaClaim({ persona: squatter, humanityBinding: sha512Hex(new TextEncoder().encode('s')) }) });
    expect(attempt.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('console auth interleave: a GDPR-deleted persona can never be unsuspended back to life', () => {
  it('delete (revoke) then unsuspend does not clear the revocation', async () => {
    const store = new InMemoryPersonaRegistryStore();
    let clock = NOW_MS;
    const svc = new PersonaRegistryService({ store, sessionSecret: SESSION_SECRET, humanityRequired: false, now: () => clock });
    const p = generatePublicPersona('ghost');
    expect((await svc.register({ claim: createPersonaClaim({ persona: p, humanityBinding: sha512Hex(new TextEncoder().encode('g')) }) })).ok).toBe(true);
    const priv = extractPersonaPrivateKeyHex(p.privateKeyRef, p.personaPubkey);
    const sig = bytesToHex(signMessage(priv, personaRequestBytes(PERSONA_GDPR_DELETE_DOMAIN, p.personaPubkey, clock)));
    expect((await svc.deleteAccount({ personaPubkey: p.personaPubkey, issuedAtMs: clock, signatureHex: sig })).ok).toBe(true);
    expect(await store.isRevoked(p.personaPubkey)).toBe(true);
    // An operator unsuspend must NOT resurrect a deleted persona's sessions.
    await svc.unsuspendPersona(p.personaPubkey);
    expect(await store.isRevoked(p.personaPubkey)).toBe(true);
  });
});
