/**
 * Plan 39 P12: OperatorConsoleService core. Everything is real: a real
 * CommunityNode over shared in-memory stores, real signed reports/posts, real
 * operator-signed tombstones/freezes/kills, and a real PersonaRegistryService
 * for suspend/unsuspend. Adversarial coverage: IDOR on report keys, actions the
 * node refuses are reported refused (NC-P4, never a fake effect), audit rows are
 * append-only with monotonic seq, counts are real store counts (NC-P6), and a
 * GDPR-deleted persona can never be unsuspended back to life.
 */

import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
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
  personaRequestBytes,
  PERSONA_GDPR_DELETE_DOMAIN,
  publicPostNodeKeypairFromSeed,
  sha512Hex,
  signMessage,
  type ContentManifest,
  type DeviceIdentity,
  type SignedPublicAbuseReport,
} from '@mylife/sync';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import {
  CommunityNode,
  InMemoryPublicationStore,
  InMemoryPublicPostStore,
  InMemoryReportStore,
  InMemoryPersonaRegistryStore,
  PersonaRegistryService,
} from '../index';
import {
  createPersonaAdminFromService,
  deriveReportKey,
  InMemoryOperatorConsoleStore,
  OperatorConsoleService,
} from '../operator-console';

const CHANNEL = 'general';
const NOW = '2026-07-06T00:00:00.000Z';
const nodeReceipt = publicPostNodeKeypairFromSeed('33'.repeat(32));
const operator = publicPostNodeKeypairFromSeed('55'.repeat(32));
const persona = publicPostNodeKeypairFromSeed('44'.repeat(32));

interface Env {
  node: CommunityNode;
  console: OperatorConsoleService;
  store: InMemoryOperatorConsoleStore;
  publicationId: string;
  communityId: string;
  reporter: DeviceIdentity;
}

async function registerPublication(node: CommunityNode, communityId: string): Promise<string> {
  const owner = generateDeviceIdentity('Publisher');
  const publicKey = new Uint8Array(nodeRandomBytes(32));
  const events = [createChannelMessage(owner, {
    communityId, channelId: CHANNEL, body: 'seed event', hlc: { wall: '2026-07-06T00:00:10.000Z', counter: 0 },
  })];
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
    postPolicy: 'open',
    postNodeKeyHex: nodeReceipt.publicKeyHex,
  });
  const verdict = await node.registerPublication({
    descriptor: signed,
    snapshots: [{ channelId: CHANNEL, epoch: 0, manifest, pieces }],
  });
  expect(verdict.ok).toBe(true);
  return signed.descriptor.publicationId;
}

async function makeEnv(options: {
  trustOperator?: boolean;
  personaAdmin?: boolean;
} = {}): Promise<Env & { registry?: PersonaRegistryService; registryStore?: InMemoryPersonaRegistryStore }> {
  const publications = new InMemoryPublicationStore();
  const reports = new InMemoryReportStore();
  const posts = new InMemoryPublicPostStore();
  const communityId = `community-${Math.random().toString(16).slice(2)}`;
  const node = new CommunityNode({
    publicationStore: publications,
    reportStore: reports,
    publicPostStore: posts,
    postReceipt: nodeReceipt,
    ...(options.trustOperator === false ? {} : { trustedKillAuthorityDeviceId: operator.publicKeyHex }),
  });
  const publicationId = await registerPublication(node, communityId);
  const store = new InMemoryOperatorConsoleStore();
  let registry: PersonaRegistryService | undefined;
  let registryStore: InMemoryPersonaRegistryStore | undefined;
  let personaAdmin;
  if (options.personaAdmin) {
    registryStore = new InMemoryPersonaRegistryStore();
    registry = new PersonaRegistryService({
      store: registryStore,
      sessionSecret: 'session-secret-for-tests-000000000000',
      humanityRequired: false,
    });
    personaAdmin = createPersonaAdminFromService(registry);
  }
  // A strictly ticking console clock: consecutive freeze records must carry
  // strictly increasing frozenAt (the core's monotonic replay guard).
  let clock = Date.parse(NOW);
  const console_ = new OperatorConsoleService({
    node,
    publications,
    reports,
    posts,
    store,
    operator,
    now: () => { clock += 1000; return clock; },
    ...(personaAdmin ? { personaAdmin } : {}),
  });
  return { node, console: console_, store, publicationId, communityId, reporter: generateDeviceIdentity('Reporter'), registry, registryStore };
}

async function submitPost(env: Env, body: string) {
  const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body });
  const verdict = await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex);
  expect(verdict.ok).toBe(true);
  return post;
}

function fileReport(env: Env, targetId: string, reason: Parameters<typeof createPublicAbuseReport>[1]['reason']): Promise<SignedPublicAbuseReport> {
  const signed = createPublicAbuseReport(env.reporter, {
    publicationId: env.publicationId,
    targetKind: 'post',
    targetId,
    reason,
  });
  return env.node.submitPublicReport(env.publicationId, signed).then((verdict) => {
    expect(verdict.ok).toBe(true);
    return signed;
  });
}

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
});

describe('report queue', () => {
  it('lists real reports with post context, priority lane first, real counts (NC-P6)', async () => {
    const env = await makeEnv();
    const post = await submitPost(env, 'CLICK HERE FOR FREE CRYPTO');
    await fileReport(env, post.postId, 'spam');
    await fileReport(env, post.postId, 'csam');
    await fileReport(env, 'unknown-post-id', 'harassment');

    const { reports, total } = await env.console.listReports({});
    expect(total).toBe(3);
    expect(reports[0]!.reason).toBe('csam');
    expect(reports[0]!.priority).toBe(true);
    expect(reports[0]!.post?.body).toBe('CLICK HERE FOR FREE CRYPTO');
    const orphan = reports.find((r) => r.targetId === 'unknown-post-id');
    expect(orphan?.post).toBeNull();

    const stats = await env.console.queueStats();
    expect(stats.open).toBe(3);
    expect(stats.openByReason.spam).toBe(1);
    expect(stats.openByReason.csam).toBe(1);
    expect(stats.openByReason.harassment).toBe(1);
    expect(stats.openPriority).toBe(1);
    expect(stats.actioned).toBe(0);
  });

  it('filters by reason and by triage status', async () => {
    const env = await makeEnv();
    const post = await submitPost(env, 'body');
    const spam = await fileReport(env, post.postId, 'spam');
    await fileReport(env, post.postId, 'violence');

    const spamOnly = await env.console.listReports({ reason: 'spam' });
    expect(spamOnly.total).toBe(1);
    expect(spamOnly.reports[0]!.reportKey).toBe(deriveReportKey(spam));

    const review = await env.console.reviewReport({ reportKey: deriveReportKey(spam), status: 'dismissed', note: 'not spam' });
    expect(review.ok).toBe(true);
    expect((await env.console.listReports({ status: 'open' })).total).toBe(1);
    expect((await env.console.listReports({ status: 'dismissed' })).total).toBe(1);
    const stats = await env.console.queueStats();
    expect(stats.open).toBe(1);
    expect(stats.dismissed).toBe(1);
  });

  it('IDOR guard: a fabricated reportKey can never create a triage decision', async () => {
    const env = await makeEnv();
    const fake = sha512Hex(new TextEncoder().encode('fabricated')).slice(0, 64);
    const result = await env.console.reviewReport({ reportKey: fake, status: 'dismissed' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown_report');
    // The refusal itself is audit-logged with the real outcome (no silent path).
    expect(result.audit.outcome).toBe('unknown_report');
    expect(await env.store.listTriage()).toEqual([]);
  });
});

describe('tombstone (remove post)', () => {
  it('removes the post immediately, flips its reports to actioned, audits ok', async () => {
    const env = await makeEnv();
    const post = await submitPost(env, 'remove me');
    await fileReport(env, post.postId, 'harassment');

    const result = await env.console.tombstonePost({ publicationId: env.publicationId, postId: post.postId, reason: 'harassment' });
    expect(result.ok).toBe(true);

    // AC-4: gone on the very next page fetch.
    const page = await env.node.getPublicationPage(env.publicationId, CHANNEL, null, 50);
    expect(page?.publicPosts.some((p) => p.post.postId === post.postId)).toBe(false);

    // A byte-identical resubmit can never resurrect it.
    const resubmit = await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex);
    expect(resubmit.ok).toBe(false);
    if (!resubmit.ok) expect(resubmit.reason).toBe('tombstoned');

    const stats = await env.console.queueStats();
    expect(stats.open).toBe(0);
    expect(stats.actioned).toBe(1);

    const { rows } = await env.console.listAudit(10);
    expect(rows[0]!.action).toBe('post_tombstoned');
    expect(rows[0]!.outcome).toBe('ok');
    expect(rows[0]!.actionSignature).toBeTruthy();
  });

  it('NC-P4: a tombstone the node refuses is reported refused, never as done', async () => {
    // Node does NOT trust the operator authority: the signed tombstone verifies
    // against no allowed signer and the core rejects it.
    const env = await makeEnv({ trustOperator: false });
    const post = await submitPost(env, 'stays up');
    const result = await env.console.tombstonePost({ publicationId: env.publicationId, postId: post.postId, reason: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_authorized');
    expect(result.audit.outcome).toBe('not_authorized');
    const page = await env.node.getPublicationPage(env.publicationId, CHANNEL, null, 50);
    expect(page?.publicPosts.some((p) => p.post.postId === post.postId)).toBe(true);
  });

  it('is idempotent: tombstoning an already-removed post still reports ok', async () => {
    const env = await makeEnv();
    const post = await submitPost(env, 'twice');
    expect((await env.console.tombstonePost({ publicationId: env.publicationId, postId: post.postId, reason: 'a' })).ok).toBe(true);
    expect((await env.console.tombstonePost({ publicationId: env.publicationId, postId: post.postId, reason: 'b' })).ok).toBe(true);
  });
});

describe('posting freeze (kill switch)', () => {
  it('freezes to effective view_only on the next submit and unfreezes again', async () => {
    const env = await makeEnv();
    expect((await env.console.setPostingFreeze({ publicationId: env.publicationId, frozen: true, reason: 'raid' })).ok).toBe(true);
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'frozen out' });
    const refused = await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe('posting_frozen');

    expect((await env.console.setPostingFreeze({ publicationId: env.publicationId, frozen: false, reason: 'over' })).ok).toBe(true);
    const accepted = await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex);
    expect(accepted.ok).toBe(true);
  });
});

describe('publication kill', () => {
  it('drops the publication from all public routes, durably, and audits it', async () => {
    const env = await makeEnv();
    await submitPost(env, 'soon gone');
    const result = await env.console.killPublication({ publicationId: env.publicationId, reason: 'illegal content' });
    expect(result.ok).toBe(true);
    expect(await env.node.getPublicationManifest(env.publicationId)).toBeNull();
    expect(await env.node.getPublicationPage(env.publicationId, CHANNEL, null, 50)).toBeNull();
    const { rows } = await env.console.listAudit(10);
    const kill = rows.find((r) => r.action === 'publication_killed');
    expect(kill?.outcome).toBe('ok');
    expect(kill?.target.communityId).toBe(env.communityId);
  });

  it('NC-P4: a kill the node does not honor is reported as not honored', async () => {
    const env = await makeEnv({ trustOperator: false });
    const result = await env.console.killPublication({ publicationId: env.publicationId, reason: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('kill_not_honored');
    expect(await env.node.getPublicationManifest(env.publicationId)).not.toBeNull();
  });

  it('refuses an unknown publication (no phantom kill rows marked ok)', async () => {
    const env = await makeEnv();
    const result = await env.console.killPublication({ publicationId: 'nope', reason: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown_publication');
  });
});

describe('persona suspend / unsuspend', () => {
  it('honestly refuses when no persona admin is wired', async () => {
    const env = await makeEnv();
    const result = await env.console.suspendPersona({ personaPubkey: persona.publicKeyHex, reason: 'spam wave' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('persona_admin_not_configured');
    expect(result.audit.outcome).toBe('persona_admin_not_configured');
  });

  it('suspends (revoking sessions + future issuance) and unsuspends via the registry', async () => {
    const env = await makeEnv({ personaAdmin: true });
    const registry = env.registry!;
    const registryStore = env.registryStore!;
    const alice = generatePublicPersona('alice');
    const claim = createPersonaClaim({ persona: alice, humanityBinding: sha512Hex(new TextEncoder().encode('t')) });
    expect((await registry.register({ claim })).ok).toBe(true);

    const suspended = await env.console.suspendPersona({ alias: 'alice', reason: 'spam wave' });
    expect(suspended.ok).toBe(true);
    expect(await registryStore.isRevoked(alice.personaPubkey)).toBe(true);
    // Sessions can no longer be issued while suspended.
    const challenge = await registry.sessionChallenge(alice.personaPubkey);
    expect(challenge.ok).toBe(false);

    const unsuspended = await env.console.unsuspendPersona({ personaPubkey: alice.personaPubkey, reason: 'appeal accepted' });
    expect(unsuspended.ok).toBe(true);
    expect(await registryStore.isRevoked(alice.personaPubkey)).toBe(false);
    expect((await registry.sessionChallenge(alice.personaPubkey)).ok).toBe(true);
  });

  it('never unsuspends a GDPR-deleted persona (fail-closed)', async () => {
    const env = await makeEnv({ personaAdmin: true });
    const registry = env.registry!;
    const bob = generatePublicPersona('bobby');
    const claim = createPersonaClaim({ persona: bob, humanityBinding: sha512Hex(new TextEncoder().encode('t')) });
    expect((await registry.register({ claim })).ok).toBe(true);
    // GDPR delete through the real signed path.
    const issuedAtMs = Date.now();
    const priv = extractPersonaPrivateKeyHex(bob.privateKeyRef, bob.personaPubkey);
    const signature = bytesToHex(signMessage(priv, personaRequestBytes(PERSONA_GDPR_DELETE_DOMAIN, bob.personaPubkey, issuedAtMs)));
    expect((await registry.deleteAccount({ personaPubkey: bob.personaPubkey, issuedAtMs, signatureHex: signature })).ok).toBe(true);

    const result = await env.console.unsuspendPersona({ personaPubkey: bob.personaPubkey, reason: 'no' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_registered');
  });
});

describe('audit log', () => {
  it('assigns strictly increasing seqs and never mutates earlier rows', async () => {
    const env = await makeEnv();
    const post = await submitPost(env, 'audited');
    await env.console.tombstonePost({ publicationId: env.publicationId, postId: post.postId, reason: 'one' });
    const firstPage = await env.console.listAudit(10);
    const firstRow = JSON.parse(JSON.stringify(firstPage.rows.at(-1)));

    await env.console.setPostingFreeze({ publicationId: env.publicationId, frozen: true, reason: 'two' });
    await env.console.setPostingFreeze({ publicationId: env.publicationId, frozen: false, reason: 'three' });
    const { rows, total } = await env.console.listAudit(10);
    expect(total).toBe(3);
    const seqs = rows.map((r) => r.seq);
    expect(seqs).toEqual([3, 2, 1]);
    // The earliest row is byte-identical to what was first written (append-only).
    expect(rows.at(-1)).toEqual(firstRow);
  });

  it('pages newest-first with a bounded limit and a before cursor', async () => {
    const env = await makeEnv();
    for (let i = 0; i < 5; i += 1) {
      await env.console.setPostingFreeze({ publicationId: env.publicationId, frozen: i % 2 === 0, reason: `r${i}` });
    }
    const page1 = await env.console.listAudit(2);
    expect(page1.rows.map((r) => r.seq)).toEqual([5, 4]);
    const page2 = await env.console.listAudit(2, page1.rows.at(-1)!.seq);
    expect(page2.rows.map((r) => r.seq)).toEqual([3, 2]);
    expect(page2.total).toBe(5);
  });
});
