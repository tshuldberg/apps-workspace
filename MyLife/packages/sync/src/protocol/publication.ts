/**
 * Publications (Plan 19, Meerkat Public Social Layer -- P0 descriptor + policy).
 *
 * A publication is a SIGNED PublicationDescriptor: a portable, content-addressed
 * pointer to a PUBLIC snapshot of a community / channel / forum / post. Unlike a
 * CommunityDescriptor (invite-only, private epoch key), a publication carries the
 * PUBLISHED read key in the clear (`publicKeyHex`), so anyone can read the public
 * snapshot anonymously. It never exposes the private community epoch key and never
 * touches `cm_messages`: a publication is a separate, owner-signed document over a
 * public content snapshot.
 *
 * Trust model (mirrors community.ts crypto, with ONE intentional divergence):
 *  - The id derives from the genesis content (sha512 over the canonical bytes with
 *    the id blanked), so it is stable across revisions and unforgeable.
 *  - There is NO genesisNonce (community.ts has one). Publication ids are therefore
 *    DETERMINISTIC: the same genesis input yields the same publicationId, so
 *    re-publishing the same snapshot is idempotent by id (plan 19 section 13). The
 *    trade-off (two byte-identical genesis descriptors collide on id) is intended.
 *  - Every revision is signed by the descriptor's ownerDeviceId and chains by
 *    previousHash. Only the owner may revise or unpublish.
 *  - `status` carries the lifecycle: active -> unpublished (owner pulled it) or
 *    killed (a trust + safety authority takes it down in a later phase). The
 *    'killed' verdict is honored only on an otherwise-valid, owner-signed
 *    descriptor, so a self-asserted unsigned killed bit can never suppress content.
 *
 * Distinct signing domain: 'meerkat-publication-v1' (never collides with the
 * community descriptor / invite domains).
 */

import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';
import type { PublicationRights } from './public-archive';

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/** Fixed public taxonomy for directory browsing. */
export type PublicCategory =
  | 'technology'
  | 'gaming'
  | 'news'
  | 'sports'
  | 'local'
  | 'hobbies'
  | 'creative'
  | 'discussion'
  | 'other';

const PUBLIC_CATEGORIES: readonly PublicCategory[] = [
  'technology', 'gaming', 'news', 'sports', 'local',
  'hobbies', 'creative', 'discussion', 'other',
];

export type PublicationKind = 'community' | 'channel' | 'forum' | 'post';
const PUBLICATION_KINDS: readonly PublicationKind[] = ['community', 'channel', 'forum', 'post'];

export type PublicationStatus = 'active' | 'unpublished' | 'killed';
export type PublicationJoinPolicy = 'request' | 'open';

/**
 * Who may POST to a publication (Plan 26 / Plan 39 P4). Distinct from joinPolicy
 * (who may join the underlying community):
 *  - 'view_only' = nobody posts through the public submit path.
 *  - 'approval'  = only members (owner-approved roster) may post.
 *  - 'open'      = verified strangers may post via the node-mediated submit route
 *                  (session + humanity + app-unlock gates, node-enforced).
 * ABSENT or unrecognized always degrades to 'view_only' (fail-closed): see
 * effectivePostPolicy.
 */
export type PublicationPostPolicy = 'view_only' | 'approval' | 'open';

const PUBLICATION_POST_POLICIES: readonly PublicationPostPolicy[] = ['view_only', 'approval', 'open'];

/**
 * Owner-signed open/request join grant (Plan 19 FF3). Present on a PublicationDescriptor
 * ONLY when the owner advertises joins. It rides INSIDE the one owner-signed descriptor
 * (no detached signature), so it is unforgeable (no owner key = no mint), bound to THIS
 * publication/community/owner/revision, and non-transplantable (there is no standalone
 * object to lift onto another publication). It carries the owner's x25519 DH PUBLIC key
 * so a joiner can SEAL a join request to the owner (request) or receive the owner's later
 * epoch-key wrap (open) -- a public key by definition, leaking nothing beyond the
 * already-published ownerDeviceId. It NEVER carries the private community epoch key:
 * redeeming a grant records an owner-authorized ROSTER membership only and confers ZERO
 * read access (the epoch key still flows solely through the owner-gated wrap rail).
 */
export interface PublicJoinGrant {
  version: 1;
  /** The owner's x25519 DH public key (64-hex). Public; lets a joiner seal/receive. */
  ownerDhPublicKey: string;
  /** A random nonce; rotating it (via revisePublication) is a lightweight revoke lever. */
  grantId: string;
}

export interface PublicationDescriptor {
  version: 1;
  /** Stable id derived from the genesis content (never changes on revision). */
  publicationId: string;
  kind: PublicationKind;
  /** Source community this publication points at. */
  communityId: string;
  /** Source channel, or null when the publication is not channel-scoped. */
  channelId: string | null;
  /** Source post, or null when the publication is not post-scoped. */
  postId: string | null;
  title: string;
  description: string;
  category: PublicCategory;
  /** Signer of every revision (the publisher). */
  ownerDeviceId: string;
  /** Public snapshot infoHash / content id (any string for P0). */
  contentId: string;
  /** The PUBLISHED read key (hex), carried in the clear: read is anonymous. */
  publicKeyHex: string;
  /** Reachability hints (relay/host URLs) -- never identity. */
  hostUrls: string[];
  revision: number;
  /** Hash of the previous SIGNED descriptor; null at genesis. */
  previousHash: string | null;
  status: PublicationStatus;
  /** request -> joining the underlying community needs approval; open -> anyone. Read is always anonymous. */
  joinPolicy: PublicationJoinPolicy;
  /**
   * Owner-signed rights/consent block (Plan 19 P9.3b). Absent on a plain
   * publication; present once the owner declares a license + rights-assertion +
   * provenance + consent for the durable public archive. These are self-declared
   * publisher CLAIMS, surfaced verbatim to readers (not platform verification).
   * Carried INSIDE the signed descriptor so the rights ride the one published_blob
   * row (cm_publications stays the SINGLE escalation point). Canonical bytes append
   * the rights ONLY when present, so a rights-less descriptor's signature is
   * byte-identical to a pre-P9 descriptor (backward compatible).
   */
  rights?: PublicationRights | null;
  /**
   * Owner-signed join grant (Plan 19 FF3). Absent on a plain publication; present once
   * the owner advertises joins (open OR request -- both need the owner DH key). Carried
   * INSIDE the signed descriptor via the same conditional-canonical-append pattern as
   * `rights`, so a grant-less descriptor canonicalizes byte-identically to a pre-FF3 one.
   */
  publicJoin?: PublicJoinGrant | null;
  /**
   * Owner-declared POSTING policy (Plan 39 P4, absorbing Plan 26 P0). Carried INSIDE
   * the signed descriptor via the same tagged conditional-canonical-append pattern as
   * `publicJoin`, so a policy-less descriptor canonicalizes byte-identically to a
   * pre-P4 one (old signatures stay valid) and adding/stripping/tampering the policy
   * breaks the owner signature. ABSENT or unrecognized = 'view_only' fail-closed
   * (effectivePostPolicy); the type is widened to string so a future policy value in
   * a foreign descriptor stays verifiable and degrades to view_only instead of
   * invalidating the whole descriptor.
   */
  postPolicy?: PublicationPostPolicy | (string & {}) | null;
  /**
   * The serving node's Ed25519 RECEIPT public key (64-hex), pinned by the owner
   * (Plan 26 P2/P7: node substitution on acceptance receipts is rejected by readers
   * verifying receipts against THIS key, not against whatever key a host presents).
   * Same tagged conditional-append pattern; absent on descriptors that never accept
   * node-mediated public posts.
   */
  postNodeKeyHex?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SignedPublicationDescriptor {
  descriptor: PublicationDescriptor;
  /** Ed25519 signature (hex) over the canonical descriptor, by ownerDeviceId. */
  signature: string;
}

function isPublicCategory(value: unknown): value is PublicCategory {
  return typeof value === 'string' && (PUBLIC_CATEGORIES as readonly string[]).includes(value);
}

function isPublicationKind(value: unknown): value is PublicationKind {
  return typeof value === 'string' && (PUBLICATION_KINDS as readonly string[]).includes(value);
}

/**
 * Canonical bytes signed/verified -- field order fixed and explicit.
 *
 * The rights block is appended ONLY when present, so a rights-less descriptor
 * canonicalizes byte-for-byte identically to a pre-P9 descriptor: existing
 * signatures stay valid and adding rights to a rights-less signed descriptor (or
 * stripping rights from a rights-bearing one) changes the field count and breaks
 * verification. The presence/absence of rights is therefore itself signed.
 */
function canonicalDescriptor(d: PublicationDescriptor, publicationIdOverride?: string): Uint8Array {
  const fields: unknown[] = [
    'meerkat-publication-v1',
    d.version,
    publicationIdOverride ?? d.publicationId,
    d.kind,
    d.communityId,
    d.channelId,
    d.postId,
    d.title,
    d.description,
    d.category,
    d.ownerDeviceId,
    d.contentId,
    d.publicKeyHex,
    [...d.hostUrls],
    d.revision,
    d.previousHash,
    d.status,
    d.joinPolicy,
    d.createdAt,
    d.updatedAt,
  ];
  if (d.rights != null) {
    fields.push([
      d.rights.license,
      d.rights.rightsAssertion,
      d.rights.provenance,
      d.rights.consentAt,
    ]);
  }
  // The join grant is appended AFTER rights and is TAGGED (the rights tuple is untagged):
  // the domain tag removes any positional ambiguity between two optional trailing blocks,
  // so (rights-absent, join-present) can never collide with (rights-present, join-absent).
  if (d.publicJoin != null) {
    fields.push([
      'meerkat-public-join-v1',
      d.publicJoin.version,
      d.publicJoin.ownerDhPublicKey,
      d.publicJoin.grantId,
    ]);
  }
  // Post policy + node receipt key (Plan 39 P4): both TAGGED, appended after publicJoin
  // in a fixed order, so no combination of optional trailing blocks is positionally
  // ambiguous and each is signature-covered exactly when present.
  if (d.postPolicy != null) {
    fields.push(['meerkat-post-policy-v1', d.postPolicy]);
  }
  if (d.postNodeKeyHex != null) {
    fields.push(['meerkat-post-node-key-v1', d.postNodeKeyHex]);
  }
  return encoder.encode(JSON.stringify(fields));
}

/**
 * The EFFECTIVE posting policy of a descriptor (Plan 39 P4). FAIL-CLOSED: only an
 * exact, recognized policy string opens posting; absent, null, or any unrecognized
 * value (including a future policy an old node does not know) is 'view_only'.
 */
export function effectivePostPolicy(descriptor: PublicationDescriptor): PublicationPostPolicy {
  const value = descriptor?.postPolicy;
  return (PUBLICATION_POST_POLICIES as readonly string[]).includes(value as string)
    ? (value as PublicationPostPolicy)
    : 'view_only';
}

/** The id is the hash of the genesis content with the id field blanked. */
function derivePublicationId(genesis: PublicationDescriptor): string {
  return sha512Hex(canonicalDescriptor(genesis, '')).slice(0, 32);
}

/** Hash of a signed descriptor (canonical + signature) -- the chain link. */
export function publicationDescriptorHash(signed: SignedPublicationDescriptor): string {
  const canonical = canonicalDescriptor(signed.descriptor);
  const sig = encoder.encode(signed.signature);
  const joined = new Uint8Array(canonical.length + sig.length);
  joined.set(canonical, 0);
  joined.set(sig, canonical.length);
  return sha512Hex(joined);
}

export interface CreatePublicationOptions {
  kind: PublicationKind;
  communityId: string;
  channelId?: string | null;
  postId?: string | null;
  title: string;
  description: string;
  category: PublicCategory;
  contentId: string;
  publicKeyHex: string;
  hostUrls?: string[];
  joinPolicy?: PublicationJoinPolicy;
  /** Optional owner-declared rights/consent block (Plan 19 P9.3b). */
  rights?: PublicationRights | null;
  /** Optional owner-signed join grant + owner DH key (Plan 19 FF3). */
  publicJoin?: PublicJoinGrant | null;
  /** Optional owner-declared posting policy (Plan 39 P4). Absent = view_only fail-closed. */
  postPolicy?: PublicationPostPolicy | null;
  /** Optional pinned node receipt public key, 64-hex (Plan 39 P4/P5). */
  postNodeKeyHex?: string | null;
  now?: string;
}

/**
 * Mint an owner-signed public-join grant BODY (Plan 19 FF3). This returns the grant
 * CONTENT only: the owner's x25519 DH PUBLIC key + a random grantId nonce, and NOTHING
 * else -- NEVER a private key, NEVER an epoch/group key. It has no standalone signature;
 * it gains its authentication only once it rides INSIDE a signed PublicationDescriptor
 * (pass it as `CreatePublicationOptions.publicJoin` at publish, or `changes.publicJoin`
 * on a revision). A grant lifted onto another descriptor therefore fails
 * verifyPublication (non-transplantable). Rotating the grantId via revisePublication is
 * the lightweight revoke lever. `randomBytes` is injected (expo-crypto on device) so this
 * stays deterministic under test and free of a Node crypto import.
 */
export function createPublicJoinGrant(
  identity: DeviceIdentity,
  randomBytes: (length: number) => Uint8Array,
): PublicJoinGrant {
  return {
    version: 1,
    ownerDhPublicKey: identity.dhPublicKey,
    grantId: bytesToHex(randomBytes(16)),
  };
}

/** Publish: genesis descriptor signed by the publishing device. */
export function createPublication(
  owner: DeviceIdentity,
  options: CreatePublicationOptions,
): SignedPublicationDescriptor {
  const now = options.now ?? new Date().toISOString();
  const descriptor: PublicationDescriptor = {
    version: 1,
    publicationId: '',
    kind: options.kind,
    communityId: options.communityId,
    channelId: options.channelId ?? null,
    postId: options.postId ?? null,
    title: options.title,
    description: options.description,
    category: options.category,
    ownerDeviceId: owner.publicKey,
    contentId: options.contentId,
    publicKeyHex: options.publicKeyHex,
    hostUrls: [...(options.hostUrls ?? [])],
    revision: 1,
    previousHash: null,
    status: 'active',
    joinPolicy: options.joinPolicy ?? 'request',
    ...(options.rights ? { rights: options.rights } : {}),
    ...(options.publicJoin ? { publicJoin: options.publicJoin } : {}),
    ...(options.postPolicy != null ? { postPolicy: options.postPolicy } : {}),
    ...(options.postNodeKeyHex != null ? { postNodeKeyHex: options.postNodeKeyHex } : {}),
    createdAt: now,
    updatedAt: now,
  };
  descriptor.publicationId = derivePublicationId(descriptor);
  return signDescriptor(owner, descriptor);
}

function signDescriptor(signer: DeviceIdentity, descriptor: PublicationDescriptor): SignedPublicationDescriptor {
  const privateKeyHex = extractSigningPrivateKeyHex(signer.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalDescriptor(descriptor)));
  return { descriptor, signature };
}

export type PublicationRevisionChanges = Partial<
  Pick<
    PublicationDescriptor,
    'title' | 'description' | 'category' | 'contentId' | 'publicKeyHex' | 'hostUrls' | 'joinPolicy' | 'publicJoin' | 'postPolicy' | 'postNodeKeyHex'
  >
>;

function nextRevision(
  owner: DeviceIdentity,
  previous: SignedPublicationDescriptor,
  patch: Partial<PublicationDescriptor>,
  now: string,
): SignedPublicationDescriptor {
  if (owner.publicKey !== previous.descriptor.ownerDeviceId) {
    throw new Error('Only the publication owner can sign a revision.');
  }
  const descriptor: PublicationDescriptor = {
    ...previous.descriptor,
    ...patch,
    hostUrls: [...(patch.hostUrls ?? previous.descriptor.hostUrls)],
    revision: previous.descriptor.revision + 1,
    previousHash: publicationDescriptorHash(previous),
    updatedAt: now,
  };
  return signDescriptor(owner, descriptor);
}

/** Re-sign a new revision (content/host/key update). Owner-only, revision-chained. */
export function revisePublication(
  owner: DeviceIdentity,
  previous: SignedPublicationDescriptor,
  changes: PublicationRevisionChanges,
  now: string = new Date().toISOString(),
): SignedPublicationDescriptor {
  return nextRevision(owner, previous, changes, now);
}

/** Take a publication down: status -> 'unpublished', as a chained owner revision. */
export function unpublish(
  owner: DeviceIdentity,
  previous: SignedPublicationDescriptor,
  now: string = new Date().toISOString(),
): SignedPublicationDescriptor {
  return nextRevision(owner, previous, { status: 'unpublished' }, now);
}

export type PublicationVerdict = 'ok' | 'invalid' | 'not_owner' | 'killed';

/**
 * Verify a signed publication descriptor.
 *
 * Validity is checked FIRST (id-derivation, chain, owner, signature); only an
 * otherwise-valid, owner-signed descriptor can ever yield 'killed'. A forged
 * status='killed' bit therefore cannot suppress a publication: flipping the bit
 * without re-signing breaks id-derivation (genesis) or the signature (revision)
 * and returns 'invalid'.
 *
 * Semantics:
 *  - 'invalid'   = malformed shape; recomputed publicationId mismatch (genesis); a
 *                  broken revision chain when `previous` is supplied (wrong
 *                  previousHash, non-incrementing revision, or mismatched id); a
 *                  revision (revision > 1) presented WITHOUT its predecessor (fail
 *                  closed); or a signature that fails to verify against the owner.
 *  - 'not_owner' = a chained revision whose ownerDeviceId differs from the genesis
 *                  owner (a takeover attempt). At genesis, a wrong-key signature is
 *                  indistinguishable from tampering and folds into 'invalid' (a
 *                  detached Ed25519 verify is binary).
 *  - 'killed'    = an otherwise-valid, owner-signed descriptor whose status is
 *                  'killed' (authority-signed kill records are a later phase; P0
 *                  only stops honoring a self-asserted unsigned killed bit).
 *  - 'ok'        = otherwise.
 *
 * Genesis (revision 1) verifies standalone (its id derives + the owner signature
 * holds). A later revision REQUIRES its `previous` to chain against; presented
 * alone it fails closed, so an attacker cannot mint a self-signed "revision 2"
 * carrying a victim's publicationId and have it pass on a signature-only check.
 */
export function verifyPublication(
  signed: SignedPublicationDescriptor,
  previous: SignedPublicationDescriptor | null = null,
): PublicationVerdict {
  const d = signed?.descriptor;
  if (!d || typeof signed.signature !== 'string') return 'invalid';
  if (
    d.version !== 1
    || typeof d.publicationId !== 'string'
    || typeof d.ownerDeviceId !== 'string'
    || typeof d.communityId !== 'string'
    || (d.channelId !== null && typeof d.channelId !== 'string')
    || (d.postId !== null && typeof d.postId !== 'string')
    || typeof d.contentId !== 'string'
    || typeof d.publicKeyHex !== 'string'
    || typeof d.title !== 'string'
    || typeof d.description !== 'string'
    || !Array.isArray(d.hostUrls)
    || typeof d.revision !== 'number'
    || (d.previousHash !== null && typeof d.previousHash !== 'string')
    || typeof d.createdAt !== 'string'
    || typeof d.updatedAt !== 'string'
    || !isPublicationKind(d.kind)
    || !isPublicCategory(d.category)
    || (d.joinPolicy !== 'request' && d.joinPolicy !== 'open')
    || (d.status !== 'active' && d.status !== 'unpublished' && d.status !== 'killed')
  ) {
    return 'invalid';
  }

  // A present rights block must be well-formed (string fields); a malformed rights
  // object is rejected fail-closed. Absent/null rights is the backward-compatible
  // default and is fine.
  if (d.rights != null) {
    const r = d.rights;
    if (
      typeof r !== 'object'
      || typeof r.license !== 'string'
      || typeof r.rightsAssertion !== 'string'
      || typeof r.provenance !== 'string'
      || typeof r.consentAt !== 'string'
    ) {
      return 'invalid';
    }
  }

  // A present join grant must be well-formed (FF3): version 1, a 64-hex x25519 owner DH
  // key, a string grantId. A malformed grant is rejected fail-closed (never thrown deep
  // in a later seal). Absent/null is the backward-compatible default.
  if (d.publicJoin != null) {
    const pj = d.publicJoin;
    if (
      typeof pj !== 'object'
      || pj.version !== 1
      || typeof pj.grantId !== 'string'
      || typeof pj.ownerDhPublicKey !== 'string'
      || !/^[0-9a-f]{64}$/i.test(pj.ownerDhPublicKey)
    ) {
      return 'invalid';
    }
  }

  // Plan 39 P4: a present postPolicy must be a string (an UNRECOGNIZED value stays
  // verifiable and degrades to view_only via effectivePostPolicy, fail-closed); a
  // present postNodeKeyHex must be a 64-hex Ed25519 key (a malformed pin is rejected
  // fail-closed rather than silently un-pinning receipts).
  if (d.postPolicy != null && typeof d.postPolicy !== 'string') return 'invalid';
  if (d.postNodeKeyHex != null
    && (typeof d.postNodeKeyHex !== 'string' || !/^[0-9a-f]{64}$/i.test(d.postNodeKeyHex))) {
    return 'invalid';
  }

  if (d.revision === 1) {
    if (previous !== null || d.previousHash !== null) return 'invalid';
    if (derivePublicationId(d) !== d.publicationId) return 'invalid';
  } else if (previous) {
    if (d.publicationId !== previous.descriptor.publicationId) return 'invalid';
    if (d.revision !== previous.descriptor.revision + 1) return 'invalid';
    if (d.previousHash !== publicationDescriptorHash(previous)) return 'invalid';
    // A chained revision MUST keep the genesis owner; a different owner is a takeover.
    if (d.ownerDeviceId !== previous.descriptor.ownerDeviceId) return 'not_owner';
  } else {
    // revision > 1 with no predecessor to chain against: fail closed. We cannot
    // confirm the id or the chain, so we never trust a signature-only check here.
    return 'invalid';
  }

  try {
    if (!verifySignature(d.ownerDeviceId, canonicalDescriptor(d), hexToBytes(signed.signature))) {
      return 'invalid';
    }
  } catch {
    return 'invalid';
  }

  // Only now, on an otherwise-valid, owner-signed descriptor, honor a killed bit.
  if (d.status === 'killed') return 'killed';

  return 'ok';
}

/**
 * Verify a TERMINAL owner takedown (unpublish / kill) against the stored GENESIS
 * (Plan 19 FF1). The public directory + serving hosts durably store only the
 * GENESIS descriptor, so a standard chained `verifyPublication` rejects a takedown
 * at revision >= 3 (it requires revision === previous.revision + 1 AND previousHash
 * adjacency). A takedown is TERMINAL and IDEMPOTENT, so adjacency is not load-
 * bearing -- only owner authentication is. This verifies, against the genesis:
 *   1. status is a takedown ('unpublished' | 'killed');
 *   2. publicationId matches the genesis;
 *   3. ownerDeviceId matches the genesis owner (no takeover);
 *   4. revision is strictly greater than the genesis revision;
 *   5. a valid Ed25519 owner signature over the canonical descriptor;
 * WITHOUT requiring previousHash adjacency. A non-owner forgery (different owner or
 * tampered bytes) fails the owner/signature check fail-closed.
 */
export function verifyOwnerTakedown(
  signed: SignedPublicationDescriptor,
  genesis: SignedPublicationDescriptor,
): boolean {
  const d = signed?.descriptor;
  const g = genesis?.descriptor;
  if (!d || !g || typeof signed.signature !== 'string') return false;
  if (d.status !== 'unpublished' && d.status !== 'killed') return false;
  if (typeof d.publicationId !== 'string' || d.publicationId !== g.publicationId) return false;
  if (typeof d.ownerDeviceId !== 'string' || d.ownerDeviceId !== g.ownerDeviceId) return false;
  if (typeof d.revision !== 'number' || d.revision <= g.revision) return false;
  try {
    return verifySignature(d.ownerDeviceId, canonicalDescriptor(d), hexToBytes(signed.signature));
  } catch {
    return false;
  }
}

/**
 * Verify ONLY the owner's Ed25519 signature over a signed publication descriptor,
 * revision-agnostically (Plan 19 FF3). Unlike `verifyPublication`, this does NOT
 * audit the revision chain or re-derive the genesis id, so it accepts a validly
 * owner-signed descriptor at ANY revision (>= 1). It mirrors `verifyOwnerTakedown`:
 * a terminal/current descriptor from the owner's OWN store has the owner signature
 * as its sole trust anchor (chain adjacency is not load-bearing when the caller
 * already knows whose store this came from).
 *
 * USE ONLY on a descriptor whose owner you have independently bound (e.g. the owner
 * approving a public-join request against ITS OWN cm_publications row, then checking
 * `descriptor.ownerDeviceId === self.publicKey`). NEVER use this on a descriptor
 * fetched from an untrusted host in place of `verifyPublication`: without the chain /
 * id-derivation audit a forged "revision 2" carrying a victim's publicationId would
 * pass this signature-only check. The shape guard rejects malformed rights / join
 * blocks fail-closed so canonicalDescriptor never throws.
 */
export function verifyPublicationOwnerSignature(signed: SignedPublicationDescriptor): boolean {
  const d = signed?.descriptor;
  if (!d || typeof signed.signature !== 'string') return false;
  if (
    d.version !== 1
    || typeof d.publicationId !== 'string'
    || typeof d.ownerDeviceId !== 'string'
    || typeof d.communityId !== 'string'
    || (d.channelId !== null && typeof d.channelId !== 'string')
    || (d.postId !== null && typeof d.postId !== 'string')
    || typeof d.contentId !== 'string'
    || typeof d.publicKeyHex !== 'string'
    || typeof d.title !== 'string'
    || typeof d.description !== 'string'
    || !Array.isArray(d.hostUrls)
    || typeof d.revision !== 'number'
    || (d.previousHash !== null && typeof d.previousHash !== 'string')
    || typeof d.createdAt !== 'string'
    || typeof d.updatedAt !== 'string'
    || !isPublicationKind(d.kind)
    || !isPublicCategory(d.category)
    || (d.joinPolicy !== 'request' && d.joinPolicy !== 'open')
    || (d.status !== 'active' && d.status !== 'unpublished' && d.status !== 'killed')
  ) {
    return false;
  }
  if (d.rights != null) {
    const r = d.rights;
    if (
      typeof r !== 'object'
      || typeof r.license !== 'string'
      || typeof r.rightsAssertion !== 'string'
      || typeof r.provenance !== 'string'
      || typeof r.consentAt !== 'string'
    ) {
      return false;
    }
  }
  if (d.publicJoin != null) {
    const pj = d.publicJoin;
    if (
      typeof pj !== 'object'
      || pj.version !== 1
      || typeof pj.grantId !== 'string'
      || typeof pj.ownerDhPublicKey !== 'string'
      || !/^[0-9a-f]{64}$/i.test(pj.ownerDhPublicKey)
    ) {
      return false;
    }
  }
  if (d.postPolicy != null && typeof d.postPolicy !== 'string') return false;
  if (d.postNodeKeyHex != null
    && (typeof d.postNodeKeyHex !== 'string' || !/^[0-9a-f]{64}$/i.test(d.postNodeKeyHex))) {
    return false;
  }
  try {
    return verifySignature(d.ownerDeviceId, canonicalDescriptor(d), hexToBytes(signed.signature));
  } catch {
    return false;
  }
}

/**
 * Whether a publication's owner-signed OPEN-join grant authorizes a join (Plan 19 FF3).
 * Fail-closed: true ONLY when the descriptor is owner-signed + active + shape-valid
 * (`verifyPublication === 'ok'`, which already covers killed/unpublished), the joinPolicy
 * is 'open', and the publicJoin grant is present. The descriptor's owner signature IS the
 * grant's authentication -- there is NO detached grant signature (a detached signature
 * would be transplantable). CRITICAL: this verifies the grant only; it confers NO read
 * access (no epoch key) -- the redeemer records a roster membership only and the real
 * key handoff still flows through the owner-gated wrap rail. The caller MUST verify a
 * FRESHLY FETCHED descriptor: a stale cached one cannot self-detect a later revoke/kill.
 */
export function verifyPublicJoinGrant(signed: SignedPublicationDescriptor): boolean {
  const d = signed?.descriptor;
  if (!d) return false;
  if (verifyPublication(signed) !== 'ok') return false;
  if (d.status !== 'active') return false;
  if (d.joinPolicy !== 'open') return false;
  return d.publicJoin != null;
}
