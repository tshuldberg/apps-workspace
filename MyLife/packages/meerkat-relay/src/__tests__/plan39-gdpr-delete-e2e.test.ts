/**
 * Plan 39 P13 / AC-5: GDPR delete END-TO-END. Everything real -- a real PersonaRegistryService,
 * a real CommunityNode with the persona's posts, a REAL FileMeerkatBillingStore holding the
 * sticky app-unlock binding, a real OperatorConsoleService triage, all tied by the real
 * GdprDeletionCoordinator. One persona-signed delete request drives the whole chain:
 *
 *   alias release + 30-day re-registration block + session revocation (Track A)
 *   + tombstone EVERY public post by the persona (Track B path)
 *   + purge durable flood-cap counters
 *   + RELEASE the app-unlock persona binding (so the SAME purchase can rebind -- founder flag)
 *   + purge the console triage rows for the persona's reported posts
 *   + the append-only AUDIT log REMAINS (legal record).
 *
 * Plus the fail-closed gate: a bad-signature delete purges NOTHING.
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  PERSONA_GDPR_EXPORT_DOMAIN,
  publicPostNodeKeypairFromSeed,
  signMessage,
  sha512Hex,
  type ContentManifest,
  type PublicPersona,
} from '@mylife/sync';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import {
  CommunityNode,
  InMemoryPublicationStore,
  InMemoryPublicPostStore,
  InMemoryReportStore,
  InMemoryPersonaRegistryStore,
  PersonaRegistryService,
  FileMeerkatBillingStore,
  GdprDeletionCoordinator,
} from '../index';
import { InMemoryOperatorConsoleStore, OperatorConsoleService, deriveReportKey } from '../operator-console';
import { personaBindingHash } from '../community-node-http';

const CHANNEL = 'general';
const NOW_MS = Date.parse('2026-07-06T00:00:00.000Z');
const nodeReceipt = publicPostNodeKeypairFromSeed('33'.repeat(32));
const operator = publicPostNodeKeypairFromSeed('55'.repeat(32));

function postingKeypair(persona: PublicPersona): { publicKeyHex: string; privateKeyHex: string } {
  return { publicKeyHex: persona.personaPubkey, privateKeyHex: extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey) };
}

function signDelete(persona: PublicPersona, issuedAtMs: number): string {
  const priv = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
  return bytesToHex(signMessage(priv, personaRequestBytes(PERSONA_GDPR_DELETE_DOMAIN, persona.personaPubkey, issuedAtMs)));
}

function signExport(persona: PublicPersona, issuedAtMs: number): string {
  const priv = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
  return bytesToHex(signMessage(priv, personaRequestBytes(PERSONA_GDPR_EXPORT_DOMAIN, persona.personaPubkey, issuedAtMs)));
}

async function registerPublication(node: CommunityNode, communityId: string): Promise<string> {
  const owner = generateDeviceIdentity('Publisher');
  const publicKey = new Uint8Array(nodeRandomBytes(32));
  const events = [createChannelMessage(owner, { communityId, channelId: CHANNEL, body: 'seed', hlc: { wall: '2026-07-06T00:00:10.000Z', counter: 0 } })];
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({ identity: owner, publicationId: 'pending', communityId, channelId: CHANNEL, events, publicKey, pieceStore: buildStore, now: '2026-07-06T00:00:00.000Z' });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(manifest.infoHash, i) as Uint8Array);
  const signed = createPublication(owner, {
    kind: 'channel', communityId, channelId: CHANNEL, title: 'Open', description: 'public', category: 'technology',
    contentId: record.infoHash, publicKeyHex: bytesToHex(publicKey), now: '2026-07-06T00:00:00.000Z',
    postPolicy: 'open', postNodeKeyHex: nodeReceipt.publicKeyHex,
  });
  expect((await node.registerPublication({ descriptor: signed, snapshots: [{ channelId: CHANNEL, epoch: 0, manifest, pieces }] })).ok).toBe(true);
  return signed.descriptor.publicationId;
}

const tmpDirs: string[] = [];
async function tmpDir(): Promise<string> {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-gdpr-'));
  tmpDirs.push(d);
  return d;
}

beforeEach(() => { configureSyncSecretStore(createInMemorySyncSecretStore()); });
afterEach(async () => { await Promise.all(tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true }))); });

interface Chain {
  registry: PersonaRegistryService;
  registryStore: InMemoryPersonaRegistryStore;
  node: CommunityNode;
  console: OperatorConsoleService;
  billing: FileMeerkatBillingStore;
  coordinator: GdprDeletionCoordinator;
  publicationId: string;
  persona: PublicPersona;
  posts: InMemoryPublicPostStore;
  clock: () => number;
}

async function buildChain(posts: InMemoryPublicPostStore = new InMemoryPublicPostStore()): Promise<Chain> {
  const publications = new InMemoryPublicationStore();
  const reports = new InMemoryReportStore();
  const node = new CommunityNode({ publicationStore: publications, reportStore: reports, publicPostStore: posts, postReceipt: nodeReceipt, trustedKillAuthorityDeviceId: operator.publicKeyHex });
  const publicationId = await registerPublication(node, `community-${Math.random().toString(16).slice(2)}`);

  const registryStore = new InMemoryPersonaRegistryStore();
  const registry = new PersonaRegistryService({ store: registryStore, sessionSecret: 'session-secret-for-tests-00000000', humanityRequired: false, now: () => NOW_MS });

  const persona = generatePublicPersona('poster');
  expect((await registry.register({ claim: createPersonaClaim({ persona, humanityBinding: sha512Hex(new TextEncoder().encode('t')) }) })).ok).toBe(true);

  let clock = NOW_MS;
  const console_ = new OperatorConsoleService({ node, publications, reports, posts, store: new InMemoryOperatorConsoleStore(), operator, now: () => { clock += 1000; return clock; } });

  const billing = new FileMeerkatBillingStore(await tmpDir());
  const coordinator = new GdprDeletionCoordinator({
    registry,
    postArchive: node,
    operator,
    personaBindingHash,
    appUnlock: billing,
    consoleTriage: console_,
    now: () => NOW_MS,
  });
  return { registry, registryStore, node, console: console_, billing, coordinator, publicationId, persona, posts, clock: () => clock };
}

class PausingPublicPostStore extends InMemoryPublicPostStore {
  private releaseWrite: (() => void) | null = null;
  private markWriteStarted: () => void = () => {};
  readonly writeStarted = new Promise<void>((resolve) => {
    this.markWriteStarted = resolve;
  });

  override async putPosts(
    publicationId: string,
    posts: Awaited<ReturnType<InMemoryPublicPostStore['listPosts']>>,
  ): Promise<void> {
    if (!this.releaseWrite) {
      this.markWriteStarted();
      await new Promise<void>((resolve) => { this.releaseWrite = resolve; });
    }
    super.putPosts(publicationId, posts);
  }

  release(): void {
    this.releaseWrite?.();
  }
}

describe('GDPR delete end-to-end (AC-5)', () => {
  it('one signed delete releases alias + blocks 30d + revokes sessions + tombstones posts + purges flood + releases binding + purges triage; audit remains', async () => {
    const chain = await buildChain();
    const kp = postingKeypair(chain.persona);

    // The persona posts three times (creates posts + durable flood counters).
    const created = [];
    for (let i = 0; i < 3; i += 1) {
      const post = createPublicPost(kp, { publicationId: chain.publicationId, channelId: CHANNEL, body: `post ${i}`, now: `2026-07-06T00:01:0${i}.000Z` });
      expect((await chain.node.submitPublicPost(chain.publicationId, CHANNEL, post, kp.publicKeyHex)).ok).toBe(true);
      created.push(post);
    }

    // A report is filed on one post and the operator reviews it (creates a triage row).
    const report = createPublicAbuseReport(generateDeviceIdentity('Reporter'), { publicationId: chain.publicationId, targetKind: 'post', targetId: created[0]!.postId, reason: 'harassment' });
    expect((await chain.node.submitPublicReport(chain.publicationId, report)).ok).toBe(true);
    expect((await chain.console.reviewReport({ reportKey: deriveReportKey(report), status: 'reviewed' })).ok).toBe(true);

    // The persona's $4.99 app-unlock purchase is bound to the persona (sticky).
    const personaHash = personaBindingHash(chain.persona.personaPubkey);
    await chain.billing.bindAppUnlockPersona('subject-purchase-1', personaHash);
    expect(await chain.billing.getAppUnlockPersona('subject-purchase-1')).toBe(personaHash);

    // Preconditions: posts stored, flood counters present, triage row present.
    expect((await chain.posts.listPosts(chain.publicationId)).length).toBe(3);
    expect((await chain.posts.listSubmits(chain.publicationId, chain.persona.personaPubkey.toLowerCase())).length).toBeGreaterThan(0);
    const auditBefore = (await chain.console.listAudit(50)).total;
    expect(auditBefore).toBeGreaterThan(0);

    // THE DELETE.
    const issuedAtMs = NOW_MS;
    const receipt = await chain.coordinator.deletePersona({ personaPubkey: chain.persona.personaPubkey, issuedAtMs, signatureHex: signDelete(chain.persona, issuedAtMs) });

    expect(receipt.ok).toBe(true);
    expect(receipt.releasedAlias).toBe('poster');
    expect(receipt.reregisterBlockedUntilMs).toBeGreaterThan(NOW_MS);
    expect(receipt.tombstonedPosts).toBe(3);
    expect(receipt.tombstoneRefusals).toBe(0);
    expect(receipt.floodCounterPublicationsCleared).toBe(1);
    expect(receipt.appUnlockBindingReleased).toBe(true);
    expect(receipt.triageRowsPurged).toBe(1);

    // Alias released + revoked + re-registration blocked (persona registry side).
    expect(await chain.registry.resolve('poster')).toBeNull();
    expect(await chain.registryStore.isRevoked(chain.persona.personaPubkey)).toBe(true);

    // Posts all tombstoned (gone from the page + store; a resubmit cannot resurrect them).
    expect((await chain.posts.listPosts(chain.publicationId)).length).toBe(0);
    const resubmit = await chain.node.submitPublicPost(chain.publicationId, CHANNEL, created[0]!, kp.publicKeyHex);
    expect(resubmit.ok).toBe(false);
    const latePost = createPublicPost(kp, {
      publicationId: chain.publicationId,
      channelId: CHANNEL,
      body: 'request that passed session verification before deletion',
    });
    await expect(chain.node.submitPublicPost(chain.publicationId, CHANNEL, latePost, kp.publicKeyHex))
      .resolves.toMatchObject({ ok: false, reason: 'persona_deleted' });

    // Flood counters purged.
    expect((await chain.posts.listSubmits(chain.publicationId, chain.persona.personaPubkey.toLowerCase())).length).toBe(0);

    // App-unlock binding released -> the SAME purchase can rebind to a NEW persona (founder flag).
    expect(await chain.billing.getAppUnlockPersona('subject-purchase-1')).toBeNull();
    const newHash = personaBindingHash('ab'.repeat(32));
    expect(await chain.billing.bindAppUnlockPersona('subject-purchase-1', newHash)).toBe(newHash);

    // Triage row purged.
    expect((await chain.console.listReports({ status: 'reviewed' })).total).toBe(0);

    // The append-only AUDIT log REMAINS (legal record): still at least the pre-delete rows.
    const auditAfter = (await chain.console.listAudit(50)).total;
    expect(auditAfter).toBeGreaterThanOrEqual(auditBefore);
  });

  it('fail-closed: a bad-signature delete purges NOTHING', async () => {
    const chain = await buildChain();
    const kp = postingKeypair(chain.persona);
    const post = createPublicPost(kp, { publicationId: chain.publicationId, channelId: CHANNEL, body: 'keep me' });
    expect((await chain.node.submitPublicPost(chain.publicationId, CHANNEL, post, kp.publicKeyHex)).ok).toBe(true);
    const personaHash = personaBindingHash(chain.persona.personaPubkey);
    await chain.billing.bindAppUnlockPersona('subject-1', personaHash);

    // A different persona signs (wrong key) -> registry rejects -> nothing downstream runs.
    const attacker = generatePublicPersona('attacker');
    const receipt = await chain.coordinator.deletePersona({
      personaPubkey: chain.persona.personaPubkey,
      issuedAtMs: NOW_MS,
      signatureHex: signDelete(attacker, NOW_MS), // signature by the WRONG key
    });

    expect(receipt.ok).toBe(false);
    expect(receipt.tombstonedPosts).toBe(0);
    // Post still there, alias still resolves, binding intact.
    expect((await chain.posts.listPosts(chain.publicationId)).length).toBe(1);
    expect(await chain.registry.resolve('poster')).not.toBeNull();
    expect(await chain.billing.getAppUnlockPersona('subject-1')).toBe(personaHash);
  });

  it('drains a post already in flight before enumeration so deletion cannot miss it', async () => {
    const posts = new PausingPublicPostStore();
    const chain = await buildChain(posts);
    const kp = postingKeypair(chain.persona);
    const raced = createPublicPost(kp, {
      publicationId: chain.publicationId,
      channelId: CHANNEL,
      body: 'accepted immediately before deletion',
    });

    const submit = chain.node.submitPublicPost(
      chain.publicationId,
      CHANNEL,
      raced,
      kp.publicKeyHex,
    );
    await posts.writeStarted;
    const deletion = chain.coordinator.deletePersona({
      personaPubkey: chain.persona.personaPubkey,
      issuedAtMs: NOW_MS,
      signatureHex: signDelete(chain.persona, NOW_MS),
    });
    await Promise.resolve();
    posts.release();

    await expect(submit).resolves.toMatchObject({ ok: true });
    await expect(deletion).resolves.toMatchObject({ ok: true, tombstonedPosts: 1 });
    expect(await posts.listPosts(chain.publicationId)).toHaveLength(0);
  });

  it('retains the registry row and purchase binding when any public-post tombstone is refused', async () => {
    const chain = await buildChain();
    const kp = postingKeypair(chain.persona);
    const post = createPublicPost(kp, { publicationId: chain.publicationId, channelId: CHANNEL, body: 'retry me' });
    expect((await chain.node.submitPublicPost(chain.publicationId, CHANNEL, post, kp.publicKeyHex)).ok).toBe(true);
    const personaHash = personaBindingHash(chain.persona.personaPubkey);
    await chain.billing.bindAppUnlockPersona('subject-retry', personaHash);
    const refusing = new GdprDeletionCoordinator({
      registry: chain.registry,
      postArchive: {
        blockPersonaPublicPosting: (personaPubkey) => chain.node.blockPersonaPublicPosting(personaPubkey),
        drainPersonaPublicWrites: (personaPubkey) => chain.node.drainPersonaPublicWrites(personaPubkey),
        listPublicPostsByPersona: (personaPubkey) => chain.node.listPublicPostsByPersona(personaPubkey),
        exportPublicPostsByPersona: (personaPubkey) => chain.node.exportPublicPostsByPersona(personaPubkey),
        recordPublicPostTombstone: async () => ({ ok: false, status: 503, reason: 'storage_unavailable' }),
        purgePersonaFloodCounters: (personaPubkey) => chain.node.purgePersonaFloodCounters(personaPubkey),
      },
      operator,
      personaBindingHash,
      appUnlock: chain.billing,
      now: () => NOW_MS,
    });
    const receipt = await refusing.deletePersona({
      personaPubkey: chain.persona.personaPubkey,
      issuedAtMs: NOW_MS,
      signatureHex: signDelete(chain.persona, NOW_MS),
    });
    expect(receipt).toMatchObject({ ok: false, reason: 'post_tombstone_incomplete', tombstoneRefusals: 1 });
    expect(await chain.registry.resolve('poster')).not.toBeNull();
    expect(await chain.registryStore.isRevoked(chain.persona.personaPubkey)).toBe(true);
    expect(await chain.billing.getAppUnlockPersona('subject-retry')).toBe(personaHash);
  });

  it('exports the registry record and every accepted public post held for the persona', async () => {
    const chain = await buildChain();
    const kp = postingKeypair(chain.persona);
    const post = createPublicPost(kp, { publicationId: chain.publicationId, channelId: CHANNEL, body: 'export me' });
    expect((await chain.node.submitPublicPost(chain.publicationId, CHANNEL, post, kp.publicKeyHex)).ok).toBe(true);
    const receipt = await chain.coordinator.exportPersona({
      personaPubkey: chain.persona.personaPubkey,
      issuedAtMs: NOW_MS,
      signatureHex: signExport(chain.persona, NOW_MS),
    });
    expect(receipt.ok).toBe(true);
    if (receipt.ok) {
      expect(receipt.record).toMatchObject({ alias: 'poster' });
      expect(receipt.publicPosts).toHaveLength(1);
      expect(receipt.publicPosts[0]?.post.postId).toBe(post.postId);
    }
  });
});
