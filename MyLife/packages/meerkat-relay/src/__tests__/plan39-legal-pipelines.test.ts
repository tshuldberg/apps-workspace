/**
 * Plan 39 P13 legal pipelines. Everything real: a real CommunityNode over shared stores, real
 * signed posts + attachments, a real OperatorConsoleService, real NCMEC + DMCA services.
 *
 * Coverage:
 *  - CSAM hash-scan at the submit boundary: text posts pass without a scan; media with a clean
 *    hash passes; a known-bad hash is refused 451 and files NCMEC evidence; NO scanner refuses
 *    media 503 (fail closed); a scanner OUTAGE refuses media 503; the node reports scanner state
 *    honestly.
 *  - NCMEC queue: enqueue is idempotent, an operator csam action enqueues, export marks exported.
 *  - DMCA intake: validation (missing attestation / empty items rejected), console lane takedown
 *    (tombstones claimed posts, surfaces unresolved), counter-notice + reject, all audited.
 */

import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildPublicSnapshot,
  bytesToHex,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createChannelMessage,
  createPublicAbuseReport,
  createPublication,
  createPublicPost,
  generateDeviceIdentity,
  publicPostNodeKeypairFromSeed,
  type ChannelMessageAttachment,
  type ContentManifest,
} from '@mylife/sync';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import {
  CommunityNode,
  InMemoryPublicationStore,
  InMemoryPublicPostStore,
  InMemoryReportStore,
  HashSetAbuseScanner,
  UnavailableAbuseScanner,
  NcmecReportQueue,
  InMemoryNcmecReportQueueStore,
  DmcaIntakeService,
  InMemoryDmcaIntakeStore,
} from '../index';
import {
  InMemoryOperatorConsoleStore,
  OperatorConsoleService,
  deriveReportKey,
} from '../operator-console';

const CHANNEL = 'general';
const NOW = '2026-07-06T00:00:00.000Z';
const nodeReceipt = publicPostNodeKeypairFromSeed('33'.repeat(32));
const operator = publicPostNodeKeypairFromSeed('55'.repeat(32));
const persona = publicPostNodeKeypairFromSeed('44'.repeat(32));

const KNOWN_BAD = 'ff'.repeat(32); // a hash in the known-bad set
const CLEAN_HASH = 'ab'.repeat(32);

function attachment(blobHash: string): ChannelMessageAttachment {
  return { id: `att-${blobHash.slice(0, 6)}`, blobHash, name: 'x.jpg', mimeType: 'image/jpeg', size: 1234 };
}

async function registerPublication(node: CommunityNode, communityId: string): Promise<string> {
  const owner = generateDeviceIdentity('Publisher');
  const publicKey = new Uint8Array(nodeRandomBytes(32));
  const events = [createChannelMessage(owner, {
    communityId, channelId: CHANNEL, body: 'seed', hlc: { wall: '2026-07-06T00:00:10.000Z', counter: 0 },
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
    kind: 'channel', communityId, channelId: CHANNEL, title: 'Open Channel', description: 'public',
    category: 'technology', contentId: record.infoHash, publicKeyHex: bytesToHex(publicKey), now: NOW,
    postPolicy: 'open', postNodeKeyHex: nodeReceipt.publicKeyHex,
  });
  const verdict = await node.registerPublication({ descriptor: signed, snapshots: [{ channelId: CHANNEL, epoch: 0, manifest, pieces }] });
  expect(verdict.ok).toBe(true);
  return signed.descriptor.publicationId;
}

interface Env {
  node: CommunityNode;
  console: OperatorConsoleService;
  publications: InMemoryPublicationStore;
  reports: InMemoryReportStore;
  posts: InMemoryPublicPostStore;
  ncmecQueue: NcmecReportQueue;
  dmca: DmcaIntakeService;
  publicationId: string;
}

async function makeEnv(options: { scanner?: 'hashset' | 'unavailable' | 'none' } = {}): Promise<Env> {
  const publications = new InMemoryPublicationStore();
  const reports = new InMemoryReportStore();
  const posts = new InMemoryPublicPostStore();
  const ncmecQueue = new NcmecReportQueue(new InMemoryNcmecReportQueueStore(), { now: () => Date.parse(NOW) });
  const dmca = new DmcaIntakeService(new InMemoryDmcaIntakeStore(), { now: () => Date.parse(NOW) });
  const scanner = options.scanner === 'hashset' ? new HashSetAbuseScanner([KNOWN_BAD])
    : options.scanner === 'unavailable' ? new UnavailableAbuseScanner()
      : undefined;
  const node = new CommunityNode({
    publicationStore: publications,
    reportStore: reports,
    publicPostStore: posts,
    postReceipt: nodeReceipt,
    trustedKillAuthorityDeviceId: operator.publicKeyHex,
    ...(scanner ? { abuseScanner: scanner } : {}),
    onAbuseHashMatch: async (m) => { await ncmecQueue.enqueueScanHit({ publicationId: m.publicationId, channelId: m.channelId, postId: m.postId, personaPubkey: m.personaPubkey, matchedBlobHashes: m.matchedBlobHashes }); },
  });
  const publicationId = await registerPublication(node, `community-${Math.random().toString(16).slice(2)}`);
  let clock = Date.parse(NOW);
  const console_ = new OperatorConsoleService({
    node, publications, reports, posts,
    store: new InMemoryOperatorConsoleStore(),
    operator,
    now: () => { clock += 1000; return clock; },
    ncmecQueue,
    dmcaIntake: dmca,
  });
  return { node, console: console_, publications, reports, posts, ncmecQueue, dmca, publicationId };
}

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
});

describe('CSAM hash-scan at the submit boundary', () => {
  it('text-only posts pass without a scanner (no attachment to scan)', async () => {
    const env = await makeEnv({ scanner: 'none' });
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'hello world' });
    const verdict = await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex);
    expect(verdict.ok).toBe(true);
  });

  it('media post is refused 503 scanner_unavailable when NO scanner is configured (fail closed)', async () => {
    const env = await makeEnv({ scanner: 'none' });
    expect(env.node.abuseScannerState()).toBe('not_configured');
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'pic', attachments: [attachment(CLEAN_HASH)] });
    const verdict = await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) { expect(verdict.status).toBe(503); expect(verdict.reason).toBe('scanner_unavailable'); }
  });

  it('media post with a CLEAN hash passes when a scanner is configured', async () => {
    const env = await makeEnv({ scanner: 'hashset' });
    expect(env.node.abuseScannerState()).toBe('configured');
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'pic', attachments: [attachment(CLEAN_HASH)] });
    const verdict = await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex);
    expect(verdict.ok).toBe(true);
  });

  it('media post with a KNOWN-BAD hash is refused 451 and files NCMEC evidence', async () => {
    const env = await makeEnv({ scanner: 'hashset' });
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'bad', attachments: [attachment(KNOWN_BAD)] });
    const verdict = await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) { expect(verdict.status).toBe(451); expect(verdict.reason).toBe('blob_rejected'); }
    // Never stored (never countersigned/appended).
    expect(await env.posts.listPosts(env.publicationId)).toEqual([]);
    // Evidence filed into the NCMEC queue.
    const counts = await env.ncmecQueue.counts();
    expect(counts.queued).toBe(1);
    const [rec] = await env.ncmecQueue.list();
    expect(rec!.source).toBe('submit_scan');
    expect(rec!.matchedBlobHashes).toEqual([KNOWN_BAD]);
    expect(rec!.postId).toBe(post.postId);
  });

  it('a scanner OUTAGE refuses media 503 (never a silent accept)', async () => {
    const env = await makeEnv({ scanner: 'unavailable' });
    expect(env.node.abuseScannerState()).toBe('configured'); // configured but will throw
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'pic', attachments: [attachment(CLEAN_HASH)] });
    const verdict = await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) { expect(verdict.status).toBe(503); expect(verdict.reason).toBe('scanner_unavailable'); }
  });
});

describe('NCMEC report queue', () => {
  it('enqueue is idempotent on the same evidence tuple', async () => {
    const q = new NcmecReportQueue(new InMemoryNcmecReportQueueStore());
    const a = await q.enqueueScanHit({ publicationId: 'p1', postId: 'post1', matchedBlobHashes: [KNOWN_BAD] });
    const b = await q.enqueueScanHit({ publicationId: 'p1', postId: 'post1', matchedBlobHashes: [KNOWN_BAD] });
    expect(a.id).toBe(b.id);
    expect((await q.counts()).total).toBe(1);
  });

  it('an operator reviewing a csam report enqueues an operator_report record', async () => {
    const env = await makeEnv({ scanner: 'hashset' });
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'text' });
    expect((await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex)).ok).toBe(true);
    const report = createPublicAbuseReport(generateDeviceIdentity('Reporter'), { publicationId: env.publicationId, targetKind: 'post', targetId: post.postId, reason: 'csam' });
    expect((await env.node.submitPublicReport(env.publicationId, report)).ok).toBe(true);
    const review = await env.console.reviewReport({ reportKey: deriveReportKey(report), status: 'reviewed' });
    expect(review.ok).toBe(true);
    const [rec] = await env.ncmecQueue.list();
    expect(rec!.source).toBe('operator_report');
    expect(rec!.reportKey).toBe(deriveReportKey(report));
  });

  it('DISMISSING a csam report does NOT enqueue NCMEC (respects the dismissal, no false filing)', async () => {
    const env = await makeEnv({ scanner: 'hashset' });
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'text' });
    expect((await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex)).ok).toBe(true);
    const report = createPublicAbuseReport(generateDeviceIdentity('Reporter'), { publicationId: env.publicationId, targetKind: 'post', targetId: post.postId, reason: 'csam' });
    expect((await env.node.submitPublicReport(env.publicationId, report)).ok).toBe(true);
    const dismiss = await env.console.reviewReport({ reportKey: deriveReportKey(report), status: 'dismissed' });
    expect(dismiss.ok).toBe(true);
    expect((await env.ncmecQueue.counts()).total).toBe(0); // dismissed -> never queued
  });

  it('export marks queued records exported and does not re-emit them', async () => {
    const q = new NcmecReportQueue(new InMemoryNcmecReportQueueStore());
    await q.enqueueScanHit({ publicationId: 'p1', postId: 'a', matchedBlobHashes: [KNOWN_BAD] });
    const first = await q.exportQueued();
    expect(first.records.length).toBe(1);
    expect((await q.counts()).exported).toBe(1);
    const second = await q.exportQueued();
    expect(second.records.length).toBe(0); // already exported
  });
});

describe('DMCA intake + console lane', () => {
  const validClaim = {
    workDescription: 'My photograph',
    claimedPostIds: [] as string[],
    claimedUrls: ['https://meerkat/p/xyz'],
    claimant: { name: 'Jane Doe', email: 'jane@example.com', address: '1 St, City' },
    goodFaithStatement: true as const,
    accuracyStatement: true as const,
    signature: 'Jane Doe',
  };

  it('rejects a claim missing the perjury attestation (fail closed)', async () => {
    const svc = new DmcaIntakeService(new InMemoryDmcaIntakeStore());
    const res = await svc.submitClaim({ ...validClaim, accuracyStatement: false });
    expect(res.ok).toBe(false);
  });

  it('rejects a claim with no claimed items', async () => {
    const svc = new DmcaIntakeService(new InMemoryDmcaIntakeStore());
    const res = await svc.submitClaim({ ...validClaim, claimedPostIds: [], claimedUrls: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('at_least_one_claimed_item');
  });

  it('takedown tombstones the claimed posts this node stores and surfaces unresolved items, audited', async () => {
    const env = await makeEnv({ scanner: 'hashset' });
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'infringing' });
    expect((await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex)).ok).toBe(true);

    const submitted = await env.dmca.submitClaim({ ...validClaim, claimedPostIds: [post.postId, 'unknown-post'], claimedUrls: ['https://x/y'] });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const result = await env.console.dmcaTakedown({ claimId: submitted.record.id, reason: 'valid dmca' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tombstonedPostIds).toEqual([post.postId]);
    // The unknown post id + the URL are surfaced, never silently dropped.
    expect(result.unresolved).toEqual(expect.arrayContaining(['unknown-post', 'https://x/y']));
    // The post is gone from the page.
    const page = await env.node.getPublicationPage(env.publicationId, CHANNEL, null, 50);
    expect(page?.publicPosts.some((p) => p.post.postId === post.postId)).toBe(false);
    // The claim keeps the tombstoned id + stays actionable (unresolved URL/unknown id remain).
    const claim = await env.dmca.getClaim(submitted.record.id);
    expect(claim?.status).toBe('received');
    expect(claim?.actionedPostIds).toEqual([post.postId]);
    expect(result.audit.action).toBe('dmca_takedown');
  });

  it('a takedown with UNRESOLVED items keeps the claim actionable (received) + tracks them durably', async () => {
    const env = await makeEnv({ scanner: 'hashset' });
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'one' });
    expect((await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex)).ok).toBe(true);
    const submitted = await env.dmca.submitClaim({ ...validClaim, claimedPostIds: [post.postId, 'unknown'], claimedUrls: ['https://x/y'] });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const result = await env.console.dmcaTakedown({ claimId: submitted.record.id, reason: 'partial' });
    expect(result.ok).toBe(true);
    const claim = await env.dmca.getClaim(submitted.record.id);
    // NOT closed: it still has unresolved items, so it stays received (lane keeps offering actions).
    expect(claim?.status).toBe('received');
    expect(claim?.actionedPostIds).toEqual([post.postId]);
    expect(claim?.unresolvedItems).toEqual(expect.arrayContaining(['unknown', 'https://x/y']));
  });

  it('a takedown that resolves EVERY item closes the claim (actioned)', async () => {
    const env = await makeEnv({ scanner: 'hashset' });
    const post = createPublicPost(persona, { publicationId: env.publicationId, channelId: CHANNEL, body: 'only' });
    expect((await env.node.submitPublicPost(env.publicationId, CHANNEL, post, persona.publicKeyHex)).ok).toBe(true);
    const submitted = await env.dmca.submitClaim({ ...validClaim, claimedPostIds: [post.postId], claimedUrls: [] });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const result = await env.console.dmcaTakedown({ claimId: submitted.record.id, reason: 'full' });
    expect(result.ok).toBe(true);
    expect((await env.dmca.getClaim(submitted.record.id))?.status).toBe('actioned');
  });

  it('records a counter-notice and a rejection, each audited', async () => {
    const env = await makeEnv();
    const submitted = await env.dmca.submitClaim(validClaim);
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const counter = await env.console.dmcaCounterNotice({ claimId: submitted.record.id, statement: 'I own it', signature: 'Poster' });
    expect(counter.ok).toBe(true);
    expect((await env.dmca.getClaim(submitted.record.id))?.status).toBe('counter_noticed');
    expect(counter.audit.action).toBe('dmca_counter_notice');

    const other = await env.dmca.submitClaim(validClaim);
    if (!other.ok) return;
    const reject = await env.console.dmcaRejectClaim({ claimId: other.record.id, reason: 'defective' });
    expect(reject.ok).toBe(true);
    expect((await env.dmca.getClaim(other.record.id))?.status).toBe('rejected');
  });

  it('takedown of an unknown claim is refused + audited (fail closed)', async () => {
    const env = await makeEnv();
    const result = await env.console.dmcaTakedown({ claimId: 'ab'.repeat(32), reason: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.reason).toBe('unknown_claim'); expect(result.audit.outcome).toBe('unknown_claim'); }
  });
});
