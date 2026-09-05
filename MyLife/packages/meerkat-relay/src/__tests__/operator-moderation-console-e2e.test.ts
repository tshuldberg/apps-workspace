/**
 * Plan 39 P12 acceptance (AC-4), full stack and everything REAL:
 *  - a real persona registry (durable FilePersonaRegistryStore) + the REAL
 *    persona-session verifier (createPersonaSessionVerifier honoring the
 *    registry store's isRevoked) wired into the gated submit route;
 *  - the persona service HTTP surface with the operator admin routes, driven by
 *    the console's HTTP persona-admin client (the split-deploy path);
 *  - a real community node HTTP server (register/submit/report/page) over
 *    durable file stores;
 *  - the operator console HTTP surface with the durable FileOperatorConsoleStore.
 *
 * Proven end to end: report -> queue; tombstone -> gone on the NEXT public page
 * fetch; suspend -> a LIVE unexpired session's submit is rejected and issuance
 * is refused; unsuspend -> posting works again; freeze -> submit 403; kill ->
 * every public route 404s; GDPR-deleted personas cannot be unsuspended; and the
 * on-disk audit log only ever grows (append-only, prefix-stable).
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issueMeerkatAppUnlockToken } from '@mylife/entitlements/server';
import {
  buildPublicSnapshot,
  bytesToHex,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createChannelMessage,
  createPersonaClaim,
  createPublicAbuseReport,
  createPublication,
  createPublicPost,
  extractPersonaPrivateKeyHex,
  generateDeviceIdentity,
  generatePublicPersona,
  humanityServiceKeypairFromSeed,
  issueHumanityTokenBatch,
  personaRequestBytes,
  personaSessionChallengeBytes,
  PERSONA_GDPR_DELETE_DOMAIN,
  publicPostNodeKeypairFromSeed,
  serializeHumanityToken,
  sha512Hex,
  signMessage,
  type ContentManifest,
  type PublicPersona,
} from '@mylife/sync';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import {
  CommunityNode,
  createPersonaAdminHttpClient,
  createPersonaSessionVerifier,
  deriveReportKey,
  FileOperatorConsoleStore,
  FilePersonaRegistryStore,
  FilePublicationStore,
  FilePublicPostStore,
  FileReportStore,
  OperatorConsoleService,
  PersonaRegistryService,
  startCommunityNodeHttp,
  startOperatorConsoleHttp,
  startPersonaService,
} from '../index';
import { personaBindingHash } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';
import type { OperatorConsoleServer } from '../operator-console-http';
import type { PersonaServiceServer } from '../persona-service-http';

const CHANNEL = 'general';
const NOW = '2026-07-06T00:00:00.000Z';
const SESSION_SECRET = 'e2e-session-secret-000000000000000000';
const CONSOLE_SECRET = 'e2e-operator-console-secret';
const PERSONA_ADMIN_SECRET = 'e2e-persona-admin-secret';
const APP_UNLOCK_SECRET = 'e2e-app-unlock-secret';

const nodeReceipt = publicPostNodeKeypairFromSeed('33'.repeat(32));
const operator = publicPostNodeKeypairFromSeed('55'.repeat(32));
const humanityKp = humanityServiceKeypairFromSeed('ab'.repeat(32));

interface RawResponse { status: number; text: string; json: () => unknown }
function rawRequest(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: { Connection: 'close', ...(init.headers ?? {}) } }, (res) => {
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

const encoder = new TextEncoder();

/** Fake single-use humanity redeem: real tokens, real double-spend behavior. */
function spendingRedeem() {
  const spent = new Set<string>();
  return async (token: string): Promise<{ ok: boolean; reason?: string }> => {
    if (spent.has(token)) return { ok: false, reason: 'already_spent' };
    spent.add(token);
    return { ok: true };
  };
}

let tmpDir: string;
let registryStore: FilePersonaRegistryStore;
let registry: PersonaRegistryService;
let personaServer: PersonaServiceServer;
let node: CommunityNode;
let nodeServer: SeederHttpServer;
let consoleServer: OperatorConsoleServer;
let consoleStore: FileOperatorConsoleStore;
let auditFile: string;
let publicationId: string;
let alice: PublicPersona;
let aliceKeys: { publicKeyHex: string; privateKeyHex: string };

async function issueSessionFor(persona: PublicPersona): Promise<string> {
  const challenge = await registry.sessionChallenge(persona.personaPubkey);
  expect(challenge.ok).toBe(true);
  if (!challenge.ok) throw new Error('challenge refused');
  const priv = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
  const signatureHex = bytesToHex(signMessage(priv, personaSessionChallengeBytes(challenge.nonce, persona.personaPubkey)));
  const issued = await registry.issueSession({ challengeId: challenge.challengeId, personaPubkey: persona.personaPubkey, signatureHex });
  expect(issued.ok).toBe(true);
  if (!issued.ok) throw new Error('session refused');
  return issued.token;
}

function freshHumanityHeader(): string {
  const [token] = issueHumanityTokenBatch({
    servicePrivateKeyHex: humanityKp.privateKeyHex,
    count: 1,
    randomBytes: (n) => new Uint8Array(nodeRandomBytes(n)),
  });
  return serializeHumanityToken(token!);
}

async function submitOverHttp(body: string, sessionToken: string): Promise<RawResponse & { post: ReturnType<typeof createPublicPost> }> {
  const post = createPublicPost(aliceKeys, { publicationId, channelId: CHANNEL, body });
  const unlock = await issueMeerkatAppUnlockToken({
    secret: APP_UNLOCK_SECRET,
    purchaseDate: NOW,
    bindingHash: personaBindingHash(aliceKeys.publicKeyHex),
  });
  const res = await rawRequest(`${nodeServer.url}/public/${publicationId}/${CHANNEL}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mk-session': sessionToken,
      'x-mk-humanity': freshHumanityHeader(),
      'x-mk-app-unlock': unlock.token,
    },
    body: JSON.stringify({ post }),
  });
  return Object.assign(res, { post });
}

async function fetchPagePostIds(): Promise<string[]> {
  const res = await rawRequest(`${nodeServer.url}/public/${publicationId}/${CHANNEL}/page`);
  if (res.status !== 200) return [];
  const payload = res.json() as { publicPosts: Array<{ post: { postId: string } }> };
  return payload.publicPosts.map((p) => p.post.postId);
}

function consoleApi(pathname: string, body?: unknown): Promise<RawResponse> {
  return rawRequest(`${consoleServer.url}${pathname}`, {
    ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}),
    headers: {
      Authorization: `Bearer ${CONSOLE_SECRET}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

beforeAll(async () => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-operator-e2e-'));

  // Persona registry + service (durable store; humanity-gated registration).
  registryStore = new FilePersonaRegistryStore(path.join(tmpDir, 'personas'));
  registry = new PersonaRegistryService({
    store: registryStore,
    sessionSecret: SESSION_SECRET,
    redeemHumanity: spendingRedeem(),
  });
  personaServer = await startPersonaService({ service: registry, port: 0, adminSecret: PERSONA_ADMIN_SECRET });

  // Register alice through the REAL humanity-bound claim path.
  alice = generatePublicPersona('alice');
  aliceKeys = {
    publicKeyHex: alice.personaPubkey,
    privateKeyHex: extractPersonaPrivateKeyHex(alice.privateKeyRef, alice.personaPubkey),
  };
  const [aliceToken] = issueHumanityTokenBatch({
    servicePrivateKeyHex: humanityKp.privateKeyHex,
    count: 1,
    randomBytes: (n) => new Uint8Array(nodeRandomBytes(n)),
  });
  const claim = createPersonaClaim({
    persona: alice,
    humanityBinding: sha512Hex(encoder.encode(aliceToken!.tokenId)),
  });
  const registered = await registry.register({ claim, humanityToken: serializeHumanityToken(aliceToken!) });
  expect(registered.ok).toBe(true);

  // Community node over durable stores, trusting the operator authority, with
  // the REAL persona-session verifier (registry-store revocations honored).
  const publications = new FilePublicationStore(path.join(tmpDir, 'publications'));
  const reports = new FileReportStore(path.join(tmpDir, 'reports'));
  const posts = new FilePublicPostStore(path.join(tmpDir, 'public-posts'));
  node = new CommunityNode({
    publicationStore: publications,
    reportStore: reports,
    publicPostStore: posts,
    postReceipt: nodeReceipt,
    trustedKillAuthorityDeviceId: operator.publicKeyHex,
  });
  const sessionVerifier = createPersonaSessionVerifier({
    secret: SESSION_SECRET,
    isRevoked: (personaPubkey) => registryStore.isRevoked(personaPubkey),
  });
  nodeServer = await startCommunityNodeHttp({
    node,
    port: 0,
    publicSubmit: {
      sessionVerifier,
      humanityVerifyToken: spendingRedeem(),
      appUnlockSecret: APP_UNLOCK_SECRET,
    },
  });

  // Register an open publication.
  const owner = generateDeviceIdentity('Publisher');
  const publicKey = new Uint8Array(nodeRandomBytes(32));
  const events = [createChannelMessage(owner, {
    communityId: 'e2e-community', channelId: CHANNEL, body: 'seed', hlc: { wall: '2026-07-06T00:00:10.000Z', counter: 0 },
  })];
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({
    identity: owner, publicationId: 'pending', communityId: 'e2e-community', channelId: CHANNEL,
    events, publicKey, pieceStore: buildStore, now: NOW,
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: string[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) {
    pieces.push(Buffer.from(buildStore.get(manifest.infoHash, i) as Uint8Array).toString('base64'));
  }
  const signed = createPublication(owner, {
    kind: 'channel', communityId: 'e2e-community', channelId: CHANNEL, title: 'The Commons e2e',
    description: 'public', category: 'technology', contentId: record.infoHash,
    publicKeyHex: bytesToHex(publicKey), now: NOW,
    postPolicy: 'open', postNodeKeyHex: nodeReceipt.publicKeyHex,
  });
  publicationId = signed.descriptor.publicationId;
  const registerRes = await rawRequest(`${nodeServer.url}/public/${publicationId}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descriptor: signed, snapshots: [{ channelId: CHANNEL, epoch: 0, manifest, pieces }] }),
  });
  expect(registerRes.status).toBe(200);

  // Operator console over the durable console store, with the HTTP persona-admin
  // client pointed at the persona service (the split-deploy path).
  const consoleDir = path.join(tmpDir, 'operator-console');
  consoleStore = new FileOperatorConsoleStore(consoleDir);
  auditFile = path.join(consoleDir, 'audit.log');
  const consoleService = new OperatorConsoleService({
    node,
    publications,
    reports,
    posts,
    store: consoleStore,
    operator,
    personaAdmin: createPersonaAdminHttpClient({ baseUrl: personaServer.url, adminSecret: PERSONA_ADMIN_SECRET }),
  });
  consoleServer = await startOperatorConsoleHttp({ console: consoleService, consoleSecret: CONSOLE_SECRET, port: 0 });
}, 30_000);

afterAll(async () => {
  await consoleServer?.close();
  await nodeServer?.close();
  await personaServer?.close();
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('operator moderation console e2e (AC-4)', () => {
  it('runs the full report -> remove -> suspend -> unsuspend -> freeze -> kill flow', async () => {
    // 1. Alice posts through the fully gated submit route.
    const session = await issueSessionFor(alice);
    const first = await submitOverHttp('CLICK HERE FOR FREE CRYPTO', session);
    expect(first.status).toBe(200);
    expect((await fetchPagePostIds())).toContain(first.post.postId);

    // 2. A viewer reports the post; the console queue shows it with context.
    const reporter = generateDeviceIdentity('Reporter');
    const report = createPublicAbuseReport(reporter, {
      publicationId, targetKind: 'post', targetId: first.post.postId, reason: 'spam',
    });
    const reportRes = await rawRequest(`${nodeServer.url}/public/${publicationId}/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report),
    });
    expect(reportRes.status).toBe(200);

    const queue = await consoleApi('/api/reports?status=open');
    expect(queue.status).toBe(200);
    const queueBody = queue.json() as { total: number; reports: Array<{ reportKey: string; reason: string; post: { body: string; personaPubkey: string } | null }> };
    expect(queueBody.total).toBe(1);
    expect(queueBody.reports[0]!.reason).toBe('spam');
    expect(queueBody.reports[0]!.post?.body).toBe('CLICK HERE FOR FREE CRYPTO');
    expect(queueBody.reports[0]!.reportKey).toBe(deriveReportKey(report));

    // 3. Remove the post: effect visible on the very next public page fetch.
    const auditBytesBefore = await fs.readFile(auditFile, 'utf8').catch(() => '');
    const removed = await consoleApi('/api/actions/tombstone', {
      publicationId, postId: first.post.postId, reason: 'spam wave',
    });
    expect(removed.status).toBe(200);
    expect((await fetchPagePostIds())).not.toContain(first.post.postId);
    // The report flipped to actioned; open queue is empty (real counts).
    const statsAfterRemove = (await consoleApi('/api/status')).json() as { queue: { open: number; actioned: number } };
    expect(statsAfterRemove.queue.open).toBe(0);
    expect(statsAfterRemove.queue.actioned).toBe(1);
    // Audit file grew append-only: the old bytes are a strict prefix.
    const auditBytesAfter = await fs.readFile(auditFile, 'utf8');
    expect(auditBytesAfter.startsWith(auditBytesBefore)).toBe(true);
    expect(auditBytesAfter.length).toBeGreaterThan(auditBytesBefore.length);

    // 4. Suspend alice through the console -> persona service admin route. The
    //    LIVE, unexpired session token is refused on the next submit.
    const suspended = await consoleApi('/api/actions/suspend', { alias: 'alice', reason: 'spam wave' });
    expect(suspended.status).toBe(200);
    const blocked = await submitOverHttp('still here?', session);
    expect(blocked.status).toBe(401);
    expect((blocked.json() as { reason: string }).reason).toBe('session_invalid');
    // New session issuance is refused too.
    expect((await registry.sessionChallenge(alice.personaPubkey)).ok).toBe(false);
    // Console status lookup reflects the real registry state.
    const status = (await consoleApi('/api/personas/status', { alias: 'alice' })).json() as { status: { suspended: boolean } };
    expect(status.status.suspended).toBe(true);

    // 5. Unsuspend: posting works again with a fresh session.
    const unsuspended = await consoleApi('/api/actions/unsuspend', { alias: 'alice', reason: 'appeal accepted' });
    expect(unsuspended.status).toBe(200);
    const session2 = await issueSessionFor(alice);
    const second = await submitOverHttp('back and behaving', session2);
    expect(second.status).toBe(200);

    // 6. Freeze: the one-action kill switch flips submits to 403 immediately.
    expect((await consoleApi('/api/actions/freeze', { publicationId, frozen: true, reason: 'cooling off' })).status).toBe(200);
    const frozen = await submitOverHttp('into the freeze', session2);
    expect(frozen.status).toBe(403);
    expect((frozen.json() as { reason: string }).reason).toBe('posting_frozen');
    expect((await consoleApi('/api/actions/freeze', { publicationId, frozen: false, reason: 'thaw' })).status).toBe(200);

    // 7. Kill: every public route 404s after the operator kill.
    expect((await consoleApi('/api/actions/kill', { publicationId, reason: 'terminal takedown' })).status).toBe(200);
    expect((await rawRequest(`${nodeServer.url}/public/${publicationId}/manifest`)).status).toBe(404);
    expect((await rawRequest(`${nodeServer.url}/public/${publicationId}/${CHANNEL}/page`)).status).toBe(404);
    const afterKill = await submitOverHttp('posting into the void', session2);
    expect(afterKill.status).toBe(404);

    // 8. The audit log recorded every action with real outcomes, newest first.
    const audit = (await consoleApi('/api/audit?limit=50')).json() as { rows: Array<{ action: string; outcome: string }>; total: number };
    const actions = audit.rows.map((r) => r.action);
    for (const expected of ['post_tombstoned', 'persona_suspended', 'persona_unsuspended', 'posting_freeze_set', 'publication_killed']) {
      expect(actions).toContain(expected);
    }
    expect(audit.rows.every((r) => r.outcome === 'ok')).toBe(true);
  }, 30_000);

  it('never unsuspends a GDPR-deleted persona through the console (fail-closed)', async () => {
    const bob = generatePublicPersona('bobby');
    const [bobToken] = issueHumanityTokenBatch({
      servicePrivateKeyHex: humanityKp.privateKeyHex,
      count: 1,
      randomBytes: (n) => new Uint8Array(nodeRandomBytes(n)),
    });
    const claim = createPersonaClaim({ persona: bob, humanityBinding: sha512Hex(encoder.encode(bobToken!.tokenId)) });
    expect((await registry.register({ claim, humanityToken: serializeHumanityToken(bobToken!) })).ok).toBe(true);

    const issuedAtMs = Date.now();
    const priv = extractPersonaPrivateKeyHex(bob.privateKeyRef, bob.personaPubkey);
    const signature = bytesToHex(signMessage(priv, personaRequestBytes(PERSONA_GDPR_DELETE_DOMAIN, bob.personaPubkey, issuedAtMs)));
    expect((await registry.deleteAccount({ personaPubkey: bob.personaPubkey, issuedAtMs, signatureHex: signature })).ok).toBe(true);

    const res = await consoleApi('/api/actions/unsuspend', { personaPubkey: bob.personaPubkey, reason: 'no' });
    expect(res.status).toBe(400);
    expect((res.json() as { reason: string }).reason).toBe('not_registered');
  });

  it('rejects console calls without the operator secret even mid-session', async () => {
    const res = await rawRequest(`${consoleServer.url}/api/status`);
    expect(res.status).toBe(401);
  });

  it('persona admin routes refuse a wrong admin secret (the console secret is not enough)', async () => {
    const res = await rawRequest(`${personaServer.url}/persona/admin/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CONSOLE_SECRET}` },
      body: JSON.stringify({ alias: 'alice' }),
    });
    expect(res.status).toBe(401);
  });
});
