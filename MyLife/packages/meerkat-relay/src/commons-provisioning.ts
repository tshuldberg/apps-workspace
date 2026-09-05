/**
 * "The Commons" provisioning (Plan 39, P8). The Commons is the FIRST-PARTY, system-owned
 * open-mode base feed: a set of open-post publications (one per TOPIC CHANNEL) under a shared
 * `the-commons` community namespace, signed by an OPERATOR descriptor key held by first-party
 * ops. This module is the pure builder the first-party community node uses to BOOT The Commons:
 * given the operator identity + a topic list, it produces registerable open publications (a
 * genesis snapshot + an owner-signed descriptor per topic).
 *
 * Honesty + policy:
 *  - Every Commons publication is `postPolicy: 'open'` (anyone verified + unlocked may post,
 *    node-enforced) and pins the node's receipt key so posts are dual-signed (Plan 39 P5/P6).
 *  - The Commons publications are what the first-party node flags GATED for verify-to-view
 *    (Plan 39 P9): `isCommonsPublicationId` over the provisioned id set is the gate predicate.
 *  - The operator key custody + real provisioning run are founder-ops; the RUNBOOK is
 *    docs/guides/the-commons-provisioning-runbook.md. This builder is deterministic under an
 *    injected clock + PRNG so it is testable and reproducible.
 */

import {
  buildPublicSnapshot,
  bytesToHex,
  createChannelMessage,
  createPublication,
  verifyPublication,
  type ContentManifest,
  type DeviceIdentity,
  type PublicCategory,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { InMemorySeederPieceStore } from './seeder-node';

/** The system community namespace for the first-party base feed. */
export const COMMONS_COMMUNITY_ID = 'the-commons';

export interface CommonsTopic {
  /** The topic channel id (stable, used in routes). */
  channelId: string;
  title: string;
  description: string;
  category: PublicCategory;
}

/** The default topic channels for The Commons (the chip rail of the base feed). */
export const DEFAULT_COMMONS_TOPICS: readonly CommonsTopic[] = [
  { channelId: 'commons', title: 'The Commons', description: 'The first-party open feed for everyone.', category: 'discussion' },
  { channelId: 'technology', title: 'Technology', description: 'Software, hardware, and the systems around them.', category: 'technology' },
  { channelId: 'gaming', title: 'Gaming', description: 'Games, players, and play.', category: 'gaming' },
  { channelId: 'news', title: 'News', description: 'What is happening, from real people.', category: 'news' },
  { channelId: 'sports', title: 'Sports', description: 'Teams, matches, and the games we watch.', category: 'sports' },
  { channelId: 'local', title: 'Local', description: 'What is happening where you are.', category: 'local' },
  { channelId: 'hobbies', title: 'Hobbies', description: 'Gardening, cooking, making, and more.', category: 'hobbies' },
  { channelId: 'creative', title: 'Creative', description: 'Art, writing, music, and craft.', category: 'creative' },
];

/** A single provisioned Commons topic publication, ready to register on the community node. */
export interface CommonsTopicPublication {
  topic: CommonsTopic;
  descriptor: SignedPublicationDescriptor;
  publicationId: string;
  channelId: string;
  manifest: ContentManifest;
  pieces: Uint8Array[];
}

export interface BuildCommonsOptions {
  /** The operator DEVICE identity that signs the Commons descriptors (founder-ops custody). */
  operator: DeviceIdentity;
  /** The node's post-receipt PUBLIC key (64-hex) pinned into each descriptor (dual-signature). */
  postNodeKeyHex: string;
  /** Topic channels to provision. Defaults to DEFAULT_COMMONS_TOPICS. */
  topics?: readonly CommonsTopic[];
  /** Injected PRNG for the per-publication seal public key. */
  randomBytes: (length: number) => Uint8Array;
  /** Injected clock. */
  now?: string;
}

/**
 * Build the registerable open publications for The Commons: one open-post 'channel' publication
 * per topic, each carrying an operator-signed genesis welcome event. The result is fed straight
 * into the community node's public register route.
 */
export async function buildCommonsProvisioning(options: BuildCommonsOptions): Promise<CommonsTopicPublication[]> {
  const topics = options.topics ?? DEFAULT_COMMONS_TOPICS;
  const now = options.now ?? new Date().toISOString();
  const out: CommonsTopicPublication[] = [];
  for (const topic of topics) {
    const publicKey = options.randomBytes(32);
    // A genesis welcome event: buildPublicSnapshot requires at least one event, and it seeds
    // the topic so the cold-start page has real, operator-signed content from the start.
    const genesis = createChannelMessage(options.operator, {
      communityId: COMMONS_COMMUNITY_ID,
      channelId: topic.channelId,
      body: `Welcome to ${topic.title}. This is a public, first-party space; posts here are public and signed by their author.`,
      hlc: { wall: now, counter: 0 },
    });
    const store = new InMemorySeederPieceStore();
    const record = await buildPublicSnapshot({
      identity: options.operator,
      publicationId: 'pending',
      communityId: COMMONS_COMMUNITY_ID,
      channelId: topic.channelId,
      events: [genesis],
      publicKey,
      pieceStore: store,
      now,
    });
    const manifest = JSON.parse(record.manifestJson) as ContentManifest;
    const pieces: Uint8Array[] = [];
    for (let i = 0; i < manifest.pieces.length; i += 1) {
      pieces.push((await store.get(record.infoHash, i)) as Uint8Array);
    }
    const descriptor = createPublication(options.operator, {
      kind: 'channel',
      communityId: COMMONS_COMMUNITY_ID,
      channelId: topic.channelId,
      title: topic.title,
      description: topic.description,
      category: topic.category,
      contentId: record.infoHash,
      publicKeyHex: bytesToHex(publicKey),
      postPolicy: 'open',
      postNodeKeyHex: options.postNodeKeyHex,
      now,
    });
    out.push({
      topic,
      descriptor,
      publicationId: descriptor.descriptor.publicationId,
      channelId: topic.channelId,
      manifest,
      pieces,
    });
  }
  return out;
}

/**
 * A verify-to-view gate predicate (Plan 39 P9) over a provisioned Commons id set: returns true
 * for a publication that belongs to The Commons, so the first-party node gates its reads.
 */
export function commonsGatePredicate(provisioned: CommonsTopicPublication[]): (publicationId: string) => boolean {
  const ids = new Set(provisioned.map((p) => p.publicationId));
  return (publicationId: string) => ids.has(publicationId);
}

/**
 * The persisted form of a provisioned Commons set. The public snapshot seal uses random AEAD
 * nonces, so provisioning is NOT reproducible from a seed: the operator provisions ONCE
 * (offline, with the custodied key), PERSISTS this file, and the first-party node LOADS it on
 * boot (see the runbook). It carries no secrets: descriptors are owner-signed public data and
 * the snapshot pieces are the same opaque bytes the node already serves publicly.
 */
export interface SerializedCommonsPublication {
  publicationId: string;
  channelId: string;
  descriptor: SignedPublicationDescriptor;
  manifest: ContentManifest;
  piecesBase64: string[];
}

/** Serialize a provisioned Commons set for the operator to persist + deploy. */
export function serializeCommonsProvisioning(provisioned: CommonsTopicPublication[]): string {
  const rows: SerializedCommonsPublication[] = provisioned.map((p) => ({
    publicationId: p.publicationId,
    channelId: p.channelId,
    descriptor: p.descriptor,
    manifest: p.manifest,
    piecesBase64: p.pieces.map((piece) => Buffer.from(piece).toString('base64')),
  }));
  return JSON.stringify({ version: 1, community: COMMONS_COMMUNITY_ID, publications: rows });
}

/**
 * Parse + VALIDATE a persisted Commons set the node loads on boot. Fail-closed: a row whose
 * descriptor does not verify, whose community is not The Commons, or whose id does not match the
 * descriptor is rejected (returns null) so a tampered file can never provision a rogue feed.
 */
export function parseCommonsProvisioning(json: string): SerializedCommonsPublication[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const rows = (parsed as { publications?: unknown }).publications;
  if (!Array.isArray(rows)) return null;
  const out: SerializedCommonsPublication[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') return null;
    const r = row as Partial<SerializedCommonsPublication>;
    if (
      typeof r.publicationId !== 'string' || typeof r.channelId !== 'string'
      || !r.descriptor || !r.manifest || !Array.isArray(r.piecesBase64)
    ) return null;
    // Shape-validate the manifest + every piece BEFORE the boot path touches them, so a
    // JSON-valid but malformed row fails CLOSED here rather than throwing later (crash loop).
    const manifest = r.manifest as { pieces?: unknown };
    if (!Array.isArray(manifest.pieces) || manifest.pieces.length !== r.piecesBase64.length) return null;
    if (!r.piecesBase64.every((b) => typeof b === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(b))) return null;
    if (verifyPublication(r.descriptor) !== 'ok') return null;
    if (r.descriptor.descriptor.communityId !== COMMONS_COMMUNITY_ID) return null;
    if (r.descriptor.descriptor.publicationId !== r.publicationId) return null;
    out.push({ publicationId: r.publicationId, channelId: r.channelId, descriptor: r.descriptor, manifest: r.manifest, piecesBase64: r.piecesBase64 });
  }
  return out;
}
