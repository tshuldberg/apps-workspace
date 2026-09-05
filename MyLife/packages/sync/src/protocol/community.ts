/**
 * Communities (plan 14, M5: MK-030 descriptor lifecycle + MK-043 channels/roles).
 *
 * A community is a SIGNED CommunityDescriptor -- id, name, hosts, catalog CID,
 * join policy, quotas, channels, members -- not a row on anyone's server. The
 * descriptor is portable: hosts are reachability hints, the catalog is content-
 * addressed, and the member list travels inside the signed document, so a
 * community can leave any host by re-signing (and, as the ultimate exit right,
 * any member can FORK it into a new community that keeps the catalog and the
 * member list). There is NO public directory: joining happens through expiring,
 * signed invite links.
 *
 * Trust model v1:
 *  - Every revision is signed by the descriptor's ownerDeviceId. Revisions
 *    chain by previousHash; communityId is derived from the genesis content,
 *    so it is stable across revisions and unforgeable.
 *  - Channels and roles live in the descriptor (MK-043, the Discord shape).
 *    Posting rights are enforced AT APPLY TIME on every receiving device via
 *    evaluateChannelPost -- never just in the UI. No server-side room state.
 *  - Invites are signed by an owner/admin listed in the descriptor and expire.
 *    The link is self-contained (carries invite + descriptor), so a join works
 *    offline once the link is delivered.
 *
 * Ownership HANDOFF (old owner blesses a new one) is deferred; the exit right
 * v1 ships is the fork.
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity, FeedPollIntervalMs, HistoryScope, SyncTransport, WorkspaceMemberRole } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';
import { isDescriptorKilled } from './abuse-rails';

const { encodeBase64, decodeBase64, decodeUTF8, encodeUTF8 } = naclUtil;
const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Descriptor (MK-030)
// ---------------------------------------------------------------------------

export interface CommunityChannel {
  id: string;
  name: string;
  /** Roles allowed to post. Undefined = any member may post. */
  postRoles?: WorkspaceMemberRole[];
  /**
   * Channel kind (Plan 38). Absent = 'chat' (legacy-safe). Read it ONLY
   * through channelKind(), which returns 'unknown' for a value this client
   * does not ship a view contract for (rendered as read-only chat + banner,
   * never a crash). All five Plan 38 channel fields use CONDITIONAL
   * inner-tuple canonical append (D.6): a channel carrying only defaults
   * serializes byte-identically to the legacy 3-tuple, so descriptors signed
   * under the old serializer keep verifying (legacy-fixture-tested).
   */
  kind?: CommunityChannelKind;
  /** Category this channel is grouped under (id into descriptor.categories). */
  categoryId?: string;
  /** Owner-set position within the channel list / its category. */
  order?: number;
  /** Short owner-set topic line shown under the channel name. */
  topic?: string;
  /** Archived: hidden from the default list, content preserved, never deleted. */
  archived?: boolean;
}

/**
 * Channel kinds this build ships view contracts for (Plan 38 A.1; extended by
 * composition plan 3). 'chat' and 'library' keep dedicated surfaces; every
 * other kind resolves to a default block stack in the app-side block registry
 * (an unavailable block renders the honest placeholder card). A kind is a new
 * VALUE riding the existing signed slot, so old clients degrade to the
 * read-only unknown-kind banner and signatures never break (correction 1.1).
 */
export const KNOWN_CHANNEL_KINDS = [
  'chat',
  'library',
  'video',
  'live',
  'shortform',
  'forum',
  'timeline',
  'gallery',
  'store',
  'events',
  'page',
  // Plan 56 C1: the Commons freeform canvas (4.1) and promoted member pages
  // both ride the kind slot; 'page' channels bind to a canvas id.
  'canvas',
] as const;
export type CommunityChannelKind = (typeof KNOWN_CHANNEL_KINDS)[number];

/** Owner-defined channel category (Plan 38 G3). */
export interface CommunityChannelCategory {
  id: string;
  name: string;
  order: number;
}

/** Community presentation layout (Plan 38 G10). Presentation, not permission. */
export type CommunityLayout = 'chat_first' | 'library_first';

export interface CommunityMember {
  deviceId: string;
  role: WorkspaceMemberRole;
  displayName?: string;
  /**
   * Member's X25519 public key (hex). The owner records it so the group-key
   * committer can wrap each epoch secret for this member (community feed P0).
   * Optional for backward compatibility; canonicalDescriptor always emits a slot.
   */
  dhPublicKey?: string;
}

export interface CommunityDescriptor {
  version: 1;
  /** Stable id derived from the genesis content (never changes on revision). */
  communityId: string;
  revision: number;
  /** Hash of the previous SIGNED descriptor; null at genesis. */
  previousHash: string | null;
  /** Random genesis entropy so identical names/owners never collide. */
  genesisNonce: string;
  /** Set on a fork: where this community's history came from (exit rights). */
  forkedFrom: { communityId: string; descriptorHash: string } | null;
  name: string;
  /** Signer of every revision of this community (handoff is future work). */
  ownerDeviceId: string;
  /** Reachability hints (relay/host URLs) -- never identity. */
  hosts: string[];
  /** Content id of the community catalog manifest, or null before first publish. */
  catalogCid: string | null;
  joinPolicy: 'invite_only';
  quotas: { maxMembers: number; maxStorageBytes: number };
  channels: CommunityChannel[];
  members: CommunityMember[];
  createdAt: string;
  updatedAt: string;
  /**
   * Community feed history scope (P0). Default `full`: new members can read all
   * history (the owner-approved relaxation). `join_point`: from-join only.
   * Optional for backward compatibility; canonicalDescriptor defaults to `full`.
   */
  historyScope?: HistoryScope;
  /**
   * Admin-set feed poll cadence (P4). Milliseconds, or `'manual'` for no auto
   * poll. Optional; canonicalDescriptor defaults to `'manual'`.
   */
  feedPollIntervalMs?: FeedPollIntervalMs;
  /**
   * Owner-signed transport policy ladder (Plan 27). `local_only`: this
   * community's rows, key wraps, and join handoffs move ONLY over local
   * transports (LAN, Nearby; BLE stays wake-signal only) -- a proximity-gated
   * space. `local_preferred`: all transports, local dialed first, remote syncs
   * labeled. `any`: all transports. Optional; ABSENT means `any` (grandfathered
   * legacy communities always synced over relay -- no promise existed). Read it
   * ONLY through communityTransportPolicy(), which fails RESTRICTIVE
   * (local_only) on an unknown value. Distinct axis from SyncTier
   * (subscription); never conflate (NC-4).
   */
  transportPolicy?: CommunityTransportPolicy;
  /**
   * Owner-defined channel categories (Plan 38). Optional; absent for legacy
   * descriptors. Together with `layout` it rides ONE conditional canonical
   * extension slot: when categories is empty/absent AND layout is the default,
   * nothing is appended, so legacy signatures keep verifying. Read through
   * communityCategories() (drops malformed entries, sorts by order).
   */
  categories?: CommunityChannelCategory[];
  /**
   * Presentation layout (Plan 38, G10): `library_first` opens the community
   * on its libraries with chat a sibling tab. Presentation only, NO security
   * semantics. Read ONLY through communityLayout(), which fails SAFE to
   * 'chat_first' on absent/unknown values.
   */
  layout?: CommunityLayout;
}

/** The community transport policy ladder (Plan 27). NOT SyncTier (NC-4). */
export type CommunityTransportPolicy = 'local_only' | 'local_preferred' | 'any';

export interface SignedCommunityDescriptor {
  descriptor: CommunityDescriptor;
  /** Ed25519 signature (hex) over the canonical descriptor, by ownerDeviceId. */
  signature: string;
}

/**
 * Canonical channel tuple (Plan 38 D.6). The legacy 3-tuple [id, name,
 * postRoles] is preserved byte-for-byte whenever every Plan 38 field holds its
 * default (absent OR explicitly-default -- canonically identical, mirroring
 * transportPolicy). Only a channel actually using organization/kind features
 * appends the 5-slot extension, so legacy signatures keep verifying while any
 * tamper of the new fields breaks the signature.
 */
function canonicalChannelTuple(c: CommunityChannel): unknown[] {
  const base: unknown[] = [c.id, c.name, c.postRoles ? [...c.postRoles] : null];
  const kind = c.kind ?? 'chat';
  const categoryId = c.categoryId ?? null;
  const order = typeof c.order === 'number' ? c.order : null;
  const topic = c.topic ?? null;
  const archived = c.archived === true;
  if (kind === 'chat' && categoryId === null && order === null && topic === null && !archived) {
    return base;
  }
  return [...base, kind, categoryId, order, topic, archived];
}

/**
 * Canonical organization extension (Plan 38): categories + layout share ONE
 * conditional trailing slot. null (nothing appended) when both hold defaults,
 * so legacy descriptors serialize byte-identically; positional ambiguity is
 * impossible because the slot always carries both values when present.
 */
function canonicalOrganizationExtension(d: CommunityDescriptor): unknown[] | null {
  const categories = (Array.isArray(d.categories) ? d.categories : []).map(
    (cat) => [cat.id, cat.name, cat.order],
  );
  const layout = d.layout ?? 'chat_first';
  if (categories.length === 0 && layout === 'chat_first') return null;
  return [categories, layout];
}

/** Canonical bytes signed/verified -- field order fixed and explicit. */
function canonicalDescriptor(d: CommunityDescriptor, communityIdOverride?: string): Uint8Array {
  const organization = canonicalOrganizationExtension(d);
  return encoder.encode(JSON.stringify([
    'meerkat-community-v1',
    d.version,
    communityIdOverride ?? d.communityId,
    d.revision,
    d.previousHash,
    d.genesisNonce,
    d.forkedFrom ? [d.forkedFrom.communityId, d.forkedFrom.descriptorHash] : null,
    d.name,
    d.ownerDeviceId,
    [...d.hosts],
    d.catalogCid,
    d.joinPolicy,
    [d.quotas.maxMembers, d.quotas.maxStorageBytes],
    d.channels.map(canonicalChannelTuple),
    d.members.map((m) => [m.deviceId, m.role, m.displayName ?? null, m.dhPublicKey ?? null]),
    d.createdAt,
    d.updatedAt,
    d.historyScope ?? 'full',
    d.feedPollIntervalMs ?? 'manual',
    // Plan 27: the transport policy is SIGNED (tamper = signature failure).
    // Absent and explicit 'any' are canonically identical, so a legacy
    // descriptor re-serialized with the default keeps verifying.
    d.transportPolicy ?? 'any',
    // Plan 38: conditional organization slot (categories + layout together).
    ...(organization ? [organization] : []),
  ]));
}

/** The id is the hash of the genesis content with the id field blanked. */
function deriveCommunityId(genesis: CommunityDescriptor): string {
  return sha512Hex(canonicalDescriptor(genesis, '')).slice(0, 32);
}

/** Hash of a signed descriptor (canonical + signature) -- the chain link. */
export function communityDescriptorHash(signed: SignedCommunityDescriptor): string {
  const canonical = canonicalDescriptor(signed.descriptor);
  const sig = encoder.encode(signed.signature);
  const joined = new Uint8Array(canonical.length + sig.length);
  joined.set(canonical, 0);
  joined.set(sig, canonical.length);
  return sha512Hex(joined);
}

export interface CreateCommunityOptions {
  name: string;
  hosts?: string[];
  catalogCid?: string | null;
  quotas?: { maxMembers: number; maxStorageBytes: number };
  channels?: CommunityChannel[];
  /** Extra members beyond the owner (who is always included as 'owner'). */
  members?: CommunityMember[];
  /** Community feed history scope (P0). Default `full`. */
  historyScope?: HistoryScope;
  /** Admin-set feed poll cadence (P4). Default `'manual'`. */
  feedPollIntervalMs?: FeedPollIntervalMs;
  /** Transport policy ladder (Plan 27). Default `any`. */
  transportPolicy?: CommunityTransportPolicy;
  /** Channel categories (Plan 38). Omitted when empty (legacy-canonical). */
  categories?: CommunityChannelCategory[];
  /** Presentation layout (Plan 38). Default `chat_first`. */
  layout?: CommunityLayout;
  now?: string;
}

/** Found a community: genesis descriptor signed by the founding device. */
export function createCommunity(
  owner: DeviceIdentity,
  options: CreateCommunityOptions,
): SignedCommunityDescriptor {
  const now = options.now ?? new Date().toISOString();
  const descriptor: CommunityDescriptor = {
    version: 1,
    communityId: '',
    revision: 1,
    previousHash: null,
    genesisNonce: bytesToHex(nacl.randomBytes(16)),
    forkedFrom: null,
    name: options.name,
    ownerDeviceId: owner.publicKey,
    hosts: [...(options.hosts ?? [])],
    catalogCid: options.catalogCid ?? null,
    joinPolicy: 'invite_only',
    quotas: options.quotas ?? { maxMembers: 64, maxStorageBytes: 10 * 1024 * 1024 * 1024 },
    channels: [...(options.channels ?? [])],
    members: [
      { deviceId: owner.publicKey, role: 'owner', displayName: owner.displayName, dhPublicKey: owner.dhPublicKey },
      ...(options.members ?? []).filter((m) => m.deviceId !== owner.publicKey),
    ],
    createdAt: now,
    updatedAt: now,
    historyScope: options.historyScope ?? 'full',
    feedPollIntervalMs: options.feedPollIntervalMs ?? 'manual',
    ...(options.transportPolicy ? { transportPolicy: options.transportPolicy } : {}),
    ...(options.categories?.length ? { categories: options.categories.map((c) => ({ ...c })) } : {}),
    ...(options.layout ? { layout: options.layout } : {}),
  };
  descriptor.communityId = deriveCommunityId(descriptor);
  return signDescriptor(owner, descriptor);
}

function signDescriptor(signer: DeviceIdentity, descriptor: CommunityDescriptor): SignedCommunityDescriptor {
  const privateKeyHex = extractSigningPrivateKeyHex(signer.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalDescriptor(descriptor)));
  return { descriptor, signature };
}

export type CommunityRevisionChanges = Partial<
  Pick<CommunityDescriptor, 'name' | 'hosts' | 'catalogCid' | 'quotas' | 'channels' | 'members' | 'historyScope' | 'feedPollIntervalMs' | 'transportPolicy' | 'categories' | 'layout'>
>;

/**
 * Re-sign a new revision (host change, member/channel updates, catalog bump).
 * Only the owner can revise; the chain (previousHash) makes the order durable.
 */
export function reviseCommunity(
  owner: DeviceIdentity,
  previous: SignedCommunityDescriptor,
  changes: CommunityRevisionChanges,
  now: string = new Date().toISOString(),
): SignedCommunityDescriptor {
  if (owner.publicKey !== previous.descriptor.ownerDeviceId) {
    throw new Error('Only the community owner can sign a revision.');
  }
  const categories = changes.categories ?? previous.descriptor.categories;
  const descriptor: CommunityDescriptor = {
    ...previous.descriptor,
    ...changes,
    hosts: [...(changes.hosts ?? previous.descriptor.hosts)],
    channels: [...(changes.channels ?? previous.descriptor.channels)],
    members: [...(changes.members ?? previous.descriptor.members)],
    quotas: changes.quotas ?? previous.descriptor.quotas,
    // Plan 38: keep the key ABSENT on a legacy descriptor that never set it,
    // so re-signing an untouched community stays on the legacy canonical form.
    ...(categories !== undefined ? { categories: categories.map((c) => ({ ...c })) } : {}),
    revision: previous.descriptor.revision + 1,
    previousHash: communityDescriptorHash(previous),
    updatedAt: now,
  };
  return signDescriptor(owner, descriptor);
}

/**
 * Owner-signed revision that removes a member (Plan 28). A thin wrapper over
 * reviseCommunity (owner-only is enforced there): drops the member from the roster
 * and bumps the revision. The epoch key ROTATION -- minting a fresh secret wrapped
 * only for the survivors -- is a SEPARATE step (commitMemberRemoval on the backing
 * workspace); this only revises the signed membership descriptor. Idempotent: a
 * device already absent from the roster still produces a valid next revision.
 */
export function removeMemberRevision(
  owner: DeviceIdentity,
  previous: SignedCommunityDescriptor,
  removedDeviceId: string,
  now: string = new Date().toISOString(),
): SignedCommunityDescriptor {
  const members = previous.descriptor.members.filter((m) => m.deviceId !== removedDeviceId);
  return reviseCommunity(owner, previous, { members }, now);
}

/**
 * Owner-signed revision that changes the community transport policy (Plan 27).
 * A thin wrapper over reviseCommunity (owner-only is enforced there). The chain
 * + the monotonic upsert guard mean members can never be rolled back to an
 * older RELAXED revision; relaxing (or hardening) the policy is always a
 * visible, signed act by the owner.
 */
export function revisePolicy(
  owner: DeviceIdentity,
  previous: SignedCommunityDescriptor,
  transportPolicy: CommunityTransportPolicy,
  now: string = new Date().toISOString(),
): SignedCommunityDescriptor {
  return reviseCommunity(owner, previous, { transportPolicy }, now);
}

/**
 * Fork: the exit right. Any device holding the descriptor can found a NEW
 * community that keeps the name, catalog CID, channels, and member list --
 * content is content-addressed, so access survives the move. The fork records
 * its origin and gets a fresh id under the new owner.
 */
export function forkCommunity(
  newOwner: DeviceIdentity,
  source: SignedCommunityDescriptor,
  options: { name?: string; hosts?: string[]; now?: string } = {},
): SignedCommunityDescriptor {
  const now = options.now ?? new Date().toISOString();
  const src = source.descriptor;
  const descriptor: CommunityDescriptor = {
    version: 1,
    communityId: '',
    revision: 1,
    previousHash: null,
    genesisNonce: bytesToHex(nacl.randomBytes(16)),
    forkedFrom: { communityId: src.communityId, descriptorHash: communityDescriptorHash(source) },
    name: options.name ?? src.name,
    ownerDeviceId: newOwner.publicKey,
    hosts: [...(options.hosts ?? src.hosts)],
    catalogCid: src.catalogCid,
    joinPolicy: 'invite_only',
    quotas: src.quotas,
    channels: [...src.channels],
    members: [
      { deviceId: newOwner.publicKey, role: 'owner', displayName: newOwner.displayName, dhPublicKey: newOwner.dhPublicKey },
      ...src.members
        .filter((m) => m.deviceId !== newOwner.publicKey)
        .map((m) => (m.role === 'owner' ? { ...m, role: 'admin' as WorkspaceMemberRole } : m)),
    ],
    createdAt: now,
    updatedAt: now,
    historyScope: src.historyScope ?? 'full',
    feedPollIntervalMs: src.feedPollIntervalMs ?? 'manual',
    // Plan 38: the fork keeps the organization (exit right covers structure).
    ...(src.categories !== undefined ? { categories: src.categories.map((c) => ({ ...c })) } : {}),
    ...(src.layout !== undefined ? { layout: src.layout } : {}),
  };
  descriptor.communityId = deriveCommunityId(descriptor);
  return signDescriptor(newOwner, descriptor);
}

/**
 * Verify a signed descriptor. Genesis (revision 1) verifies standalone: the id
 * must derive from the content and the owner's signature must hold. A later
 * revision verifies against its predecessor: chain hash, stable id, monotonic
 * revision, and the owner's signature.
 */
export function verifyCommunityDescriptor(
  signed: SignedCommunityDescriptor,
  previous: SignedCommunityDescriptor | null = null,
): boolean {
  const d = signed?.descriptor;
  if (!d || typeof signed.signature !== 'string') return false;
  if (
    d.version !== 1
    || typeof d.communityId !== 'string'
    || typeof d.ownerDeviceId !== 'string'
    || typeof d.genesisNonce !== 'string'
    || d.joinPolicy !== 'invite_only'
    || !Array.isArray(d.hosts)
    || !Array.isArray(d.channels)
    || !Array.isArray(d.members)
    // Plan 38: optional, but when present it must be an array (fail-closed).
    || (d.categories !== undefined && !Array.isArray(d.categories))
  ) {
    return false;
  }

  if (d.revision === 1) {
    if (previous !== null || d.previousHash !== null) return false;
    if (deriveCommunityId(d) !== d.communityId) return false;
  } else {
    if (!previous) return false;
    if (d.communityId !== previous.descriptor.communityId) return false;
    if (d.revision !== previous.descriptor.revision + 1) return false;
    if (d.previousHash !== communityDescriptorHash(previous)) return false;
    if (d.ownerDeviceId !== previous.descriptor.ownerDeviceId) return false;
  }

  try {
    return verifySignature(d.ownerDeviceId, canonicalDescriptor(d), hexToBytes(signed.signature));
  } catch {
    return false;
  }
}

/**
 * Verify ONLY the owner's signature over a signed descriptor (no chain audit).
 *
 * The full verifyCommunityDescriptor either verifies a genesis standalone or
 * chains a later revision against its predecessor. A community NODE that comes up
 * cold and receives the owner's CURRENT descriptor (which may already be revision
 * N) has no predecessor to chain against, but the owner signs every revision and
 * is authoritative, so verifying the owner's signature over the descriptor is the
 * correct cold-start trust check. For a genesis it ALSO confirms the id derives
 * from the content (unforgeable id). This is the same posture verifyCommunityInvite
 * uses ("for later revisions the joiner trusts the inviter's copy").
 */
export function verifyDescriptorOwnerSignature(signed: SignedCommunityDescriptor): boolean {
  const d = signed?.descriptor;
  if (!d || typeof signed.signature !== 'string') return false;
  if (
    d.version !== 1
    || typeof d.communityId !== 'string'
    || typeof d.ownerDeviceId !== 'string'
    || typeof d.genesisNonce !== 'string'
    || d.joinPolicy !== 'invite_only'
    || !Array.isArray(d.hosts)
    || !Array.isArray(d.channels)
    || !Array.isArray(d.members)
    // Plan 38: optional, but when present it must be an array (fail-closed).
    || (d.categories !== undefined && !Array.isArray(d.categories))
  ) {
    return false;
  }
  if (d.revision === 1 && deriveCommunityId(d) !== d.communityId) return false;
  try {
    return verifySignature(d.ownerDeviceId, canonicalDescriptor(d), hexToBytes(signed.signature));
  } catch {
    return false;
  }
}

/** A member's role per the descriptor, or null when not a member. */
export function communityRole(descriptor: CommunityDescriptor, deviceId: string): WorkspaceMemberRole | null {
  return descriptor.members.find((m) => m.deviceId === deviceId)?.role ?? null;
}

/**
 * The ONLY way to read a channel's kind (Plan 38 A.1). Absent means 'chat'
 * (legacy). A kind this build has no view contract for returns 'unknown' --
 * the caller renders read-only chat with a banner, never crashes and never
 * guesses. It must NOT fail to 'chat' silently: an unknown kind's content
 * semantics are unknown, so the surface has to say so.
 */
export function channelKind(channel: CommunityChannel): CommunityChannelKind | 'unknown' {
  const raw = (channel as { kind?: unknown }).kind;
  if (raw === undefined || raw === null) return 'chat';
  if ((KNOWN_CHANNEL_KINDS as readonly string[]).includes(raw as string)) {
    return raw as CommunityChannelKind;
  }
  return 'unknown';
}

/** Is this channel archived? Only an explicit true counts (fail-visible). */
export function channelArchived(channel: CommunityChannel): boolean {
  return (channel as { archived?: unknown }).archived === true;
}

/**
 * The ONLY way to read a descriptor's layout (Plan 38 G10). Absent or unknown
 * fails SAFE to 'chat_first' -- layout is presentation, so the legacy
 * rendering is always a correct fallback.
 */
export function communityLayout(descriptor: CommunityDescriptor): CommunityLayout {
  const raw = (descriptor as { layout?: unknown }).layout;
  return raw === 'library_first' ? 'library_first' : 'chat_first';
}

/**
 * Normalized channel categories: malformed entries dropped, sorted by order
 * (ties by id for determinism), duplicate ids collapsed to their first sorted
 * occurrence. Never throws on hostile input. The dedupe is apply-side
 * tolerance: descriptors signed by pre-fix owner code could mint two
 * categories with one id (position-based suffixes colliding after a
 * delete-then-add), and without it every channel assigned to that id renders
 * under BOTH groups on both surfaces.
 */
export function communityCategories(descriptor: CommunityDescriptor): CommunityChannelCategory[] {
  const raw = (descriptor as { categories?: unknown }).categories;
  if (!Array.isArray(raw)) return [];
  const sorted = raw
    .filter((c): c is CommunityChannelCategory => Boolean(
      c
      && typeof (c as CommunityChannelCategory).id === 'string'
      && typeof (c as CommunityChannelCategory).name === 'string'
      && typeof (c as CommunityChannelCategory).order === 'number'
      && Number.isFinite((c as CommunityChannelCategory).order),
    ))
    .slice()
    .sort((a, b) => (a.order === b.order ? a.id.localeCompare(b.id) : a.order - b.order));
  const seen = new Set<string>();
  return sorted.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/**
 * Channels in owner-defined presentation order: explicit `order` first
 * (missing order falls back to descriptor position), ties stay stable on
 * descriptor position. Archived channels are excluded unless asked for --
 * they are hidden, never deleted (Plan 38 G3).
 */
export function orderedChannels(
  descriptor: CommunityDescriptor,
  options: { includeArchived?: boolean } = {},
): CommunityChannel[] {
  return descriptor.channels
    .map((channel, index) => ({ channel, index }))
    .filter(({ channel }) => (options.includeArchived ? true : !channelArchived(channel)))
    .sort((a, b) => {
      const ao = typeof a.channel.order === 'number' && Number.isFinite(a.channel.order) ? a.channel.order : a.index;
      const bo = typeof b.channel.order === 'number' && Number.isFinite(b.channel.order) ? b.channel.order : b.index;
      return ao === bo ? a.index - b.index : ao - bo;
    })
    .map(({ channel }) => channel);
}

/**
 * The ONLY way to read a descriptor's transport policy (Plan 27). Absent means
 * `any` (grandfathered legacy communities, AC-6); an UNKNOWN or malformed value
 * fails RESTRICTIVE to `local_only` -- a promise field must never fail open.
 */
export function communityTransportPolicy(descriptor: CommunityDescriptor): CommunityTransportPolicy {
  const raw = (descriptor as { transportPolicy?: unknown }).transportPolicy;
  if (raw === undefined || raw === null) return 'any';
  if (raw === 'local_only' || raw === 'local_preferred' || raw === 'any') return raw;
  return 'local_only';
}

/**
 * May a community with this policy move DATA over this transport? BLE is never
 * a data path under ANY policy (wake-signal only, NC-2); `local_only` permits
 * only LAN + Nearby; `local_preferred` / `any` permit every data transport
 * (preference vs hard cap is a dial-order concern, not an allow concern).
 */
export function transportPolicyAllows(
  policy: CommunityTransportPolicy,
  transport: SyncTransport,
): boolean {
  if (transport === 'ble') return false;
  if (policy === 'local_only') return transport === 'lan' || transport === 'nearby';
  return true;
}

/**
 * The Plan 29 auto-connect seam: may THIS stored community's data move over
 * this transport? Resolves the community by id and applies its signed policy
 * through the fail-restrictive reader. An UNKNOWN community fails closed.
 */
export function transportAllowedForCommunity(
  db: DatabaseAdapter,
  communityId: string,
  transport: SyncTransport,
): boolean {
  const community = getCommunity(db, communityId);
  if (!community) return false;
  return transportPolicyAllows(communityTransportPolicy(community.descriptor), transport);
}

// ---------------------------------------------------------------------------
// Channel/role enforcement (MK-043) -- pure, called at apply time
// ---------------------------------------------------------------------------

export type ChannelPostVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'unknown_channel' | 'not_community_member' | 'channel_role_denied' };

/**
 * May `senderDeviceId` post to `channelId`? Enforced on every RECEIVING device
 * when a community row carries a channel_id -- the rejection happens at apply,
 * never just in the UI, and there is no server to hold room state.
 */
export function evaluateChannelPost(
  descriptor: CommunityDescriptor,
  senderDeviceId: string,
  channelId: string,
): ChannelPostVerdict {
  const channel = descriptor.channels.find((c) => c.id === channelId);
  if (!channel) return { allowed: false, reason: 'unknown_channel' };
  const role = communityRole(descriptor, senderDeviceId);
  if (!role) return { allowed: false, reason: 'not_community_member' };
  if (channel.postRoles && !channel.postRoles.includes(role)) {
    return { allowed: false, reason: 'channel_role_denied' };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Invites (MK-030): expiring, signed, self-contained links. No directory.
// ---------------------------------------------------------------------------

export interface CommunityInvite {
  version: 1;
  communityId: string;
  /** Binds the invite to the exact descriptor revision being shared. */
  descriptorHash: string;
  invitedByDeviceId: string;
  expiresAt: string;
  nonce: string;
}

export interface SignedCommunityInvite {
  invite: CommunityInvite;
  signature: string;
}

const INVITE_LINK_PREFIX = 'meerkat://community/join#';

function canonicalInvite(invite: CommunityInvite): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-community-invite-v1',
    invite.version,
    invite.communityId,
    invite.descriptorHash,
    invite.invitedByDeviceId,
    invite.expiresAt,
    invite.nonce,
  ]));
}

/** Create an expiring invite for a community you can administer. */
export function createCommunityInvite(
  signer: DeviceIdentity,
  signedDescriptor: SignedCommunityDescriptor,
  ttlMs: number = 48 * 60 * 60 * 1000,
  now: Date = new Date(),
): { invite: SignedCommunityInvite; link: string } {
  const role = communityRole(signedDescriptor.descriptor, signer.publicKey);
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Only a community owner or admin can create invites.');
  }
  const invite: CommunityInvite = {
    version: 1,
    communityId: signedDescriptor.descriptor.communityId,
    descriptorHash: communityDescriptorHash(signedDescriptor),
    invitedByDeviceId: signer.publicKey,
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    nonce: bytesToHex(nacl.randomBytes(12)),
  };
  const privateKeyHex = extractSigningPrivateKeyHex(signer.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalInvite(invite)));
  const signedInvite: SignedCommunityInvite = { invite, signature };
  const payload = encodeBase64(decodeUTF8(JSON.stringify({ invite: signedInvite, descriptor: signedDescriptor })));
  return { invite: signedInvite, link: `${INVITE_LINK_PREFIX}${payload}` };
}

export interface ParsedInviteLink {
  invite: SignedCommunityInvite;
  descriptor: SignedCommunityDescriptor;
}

/** Parse a self-contained invite link. Null if malformed. */
export function parseCommunityInviteLink(link: string): ParsedInviteLink | null {
  if (!link.startsWith(INVITE_LINK_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      encodeUTF8(decodeBase64(link.slice(INVITE_LINK_PREFIX.length))),
    ) as ParsedInviteLink;
    if (!parsed?.invite?.invite || !parsed?.descriptor?.descriptor) return null;
    return parsed;
  } catch {
    return null;
  }
}

export type InviteVerdict = 'ok' | 'expired' | 'invalid' | 'not_authorized';

/**
 * Verify an invite against the descriptor it carries: descriptor signature,
 * invite signature, inviter's admin rights IN that descriptor, the binding
 * hash, and expiry.
 */
export function verifyCommunityInvite(
  parsed: ParsedInviteLink,
  now: Date = new Date(),
  options: { requireDescriptorBinding?: boolean } = {},
): InviteVerdict {
  const requireDescriptorBinding = options.requireDescriptorBinding ?? true;
  const { invite, descriptor } = parsed;
  // The genesis verifies standalone; for later revisions the joiner trusts the
  // inviter's copy, bound by the invite's hash (chain audit is for members who
  // hold the history).
  if (descriptor.descriptor.revision === 1 && !verifyCommunityDescriptor(descriptor)) return 'invalid';
  try {
    if (!verifySignature(
      invite.invite.invitedByDeviceId,
      canonicalInvite(invite.invite),
      hexToBytes(invite.signature),
    )) {
      return 'invalid';
    }
  } catch {
    return 'invalid';
  }
  if (invite.invite.communityId !== descriptor.descriptor.communityId) return 'invalid';
  // The descriptor-hash binding ties an invite to the EXACT descriptor revision it
  // was minted against. The JOINER requires it (it trusts the descriptor the link
  // carried). The OWNER authorizing a join must NOT, because adding each member
  // revises the descriptor (the hash moves), which would otherwise reject every
  // joiner after the first on the same multi-use invite. The owner instead
  // authorizes on inviter authority + community id + expiry against its CURRENT
  // descriptor (community feed P7).
  if (requireDescriptorBinding && invite.invite.descriptorHash !== communityDescriptorHash(descriptor)) {
    return 'invalid';
  }
  const inviterRole = communityRole(descriptor.descriptor, invite.invite.invitedByDeviceId);
  if (inviterRole !== 'owner' && inviterRole !== 'admin') return 'not_authorized';
  if (new Date(invite.invite.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'ok';
}

// ---------------------------------------------------------------------------
// Local storage: joined communities + the workspace bridge
// ---------------------------------------------------------------------------

export interface StoredCommunity {
  communityId: string;
  descriptor: CommunityDescriptor;
  signature: string;
  myRole: WorkspaceMemberRole | null;
  joinedAt: string;
  updatedAt: string;
}

function mapCommunityRow(r: {
  community_id: string; descriptor_json: string; signature: string;
  my_role: string | null; joined_at: string; updated_at: string;
}): StoredCommunity {
  return {
    communityId: r.community_id,
    descriptor: JSON.parse(r.descriptor_json) as CommunityDescriptor,
    signature: r.signature,
    myRole: (r.my_role as WorkspaceMemberRole | null) ?? null,
    joinedAt: r.joined_at,
    updatedAt: r.updated_at,
  };
}

export function getCommunity(db: DatabaseAdapter, communityId: string): StoredCommunity | null {
  const rows = db.query<Parameters<typeof mapCommunityRow>[0]>(
    'SELECT * FROM sync_communities WHERE community_id = ?',
    [communityId],
  );
  return rows[0] ? mapCommunityRow(rows[0]) : null;
}

export function listCommunities(db: DatabaseAdapter): StoredCommunity[] {
  return db
    .query<Parameters<typeof mapCommunityRow>[0]>('SELECT * FROM sync_communities ORDER BY joined_at ASC')
    .map(mapCommunityRow);
}

/** Store/refresh a community; an older revision never overwrites a newer one. */
export function upsertCommunity(
  db: DatabaseAdapter,
  signed: SignedCommunityDescriptor,
  myDeviceId: string,
  now: string = new Date().toISOString(),
): void {
  const existing = getCommunity(db, signed.descriptor.communityId);
  if (existing && existing.descriptor.revision >= signed.descriptor.revision) return;
  db.execute(
    `INSERT INTO sync_communities (community_id, descriptor_json, signature, my_role, joined_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(community_id) DO UPDATE SET
       descriptor_json = excluded.descriptor_json,
       signature = excluded.signature,
       my_role = excluded.my_role,
       updated_at = excluded.updated_at`,
    [
      signed.descriptor.communityId,
      JSON.stringify(signed.descriptor),
      signed.signature,
      communityRole(signed.descriptor, myDeviceId),
      existing?.joinedAt ?? now,
      now,
    ],
  );
}

/**
 * Reconcile sync_workspace_members to an AUTHORITATIVE descriptor's membership.
 *
 * Close removed_at for every row the descriptor no longer lists (this flips the
 * outbound session gate and resolveInboundAuth's `removed_at IS NULL` check on
 * THIS device, so old-epoch sessions with a dropped device are refused), and
 * (re)open + role-sync a row for every listed member (a device that missed an
 * earlier ADD revision still converges; a re-added device's row reopens).
 *
 * Shared by the member-removal drain (member-removal-core) and descriptor
 * gossip (applyGossipedDescriptors) so a descriptor-applied removal takes the
 * SAME roster effect regardless of the path it arrived on. The workspace bridge
 * row must already exist (this only touches the roster table). Paired-device
 * rows are never touched here: pairing is global, community dial eligibility is
 * exactly the roster row this closes.
 */
export function reconcileCommunityRosterFromDescriptor(
  db: DatabaseAdapter,
  descriptor: CommunityDescriptor,
  now: string = new Date().toISOString(),
): void {
  const communityId = descriptor.communityId;
  const listed = descriptor.members.map((m) => m.deviceId);
  // A descriptor always lists at least its owner, so `listed` is never empty and
  // `NOT IN ()` (invalid SQL) can't be produced; guard anyway for safety.
  if (listed.length > 0) {
    const placeholders = listed.map(() => '?').join(', ');
    db.execute(
      `UPDATE sync_workspace_members SET removed_at = ?
       WHERE workspace_id = ? AND removed_at IS NULL
         AND device_id NOT IN (${placeholders})`,
      [now, communityId, ...listed],
    );
  }
  for (const member of descriptor.members) {
    db.execute(
      `INSERT INTO sync_workspace_members
         (workspace_id, device_id, role, invited_by_device_id, invited_at, removed_at)
       VALUES (?, ?, ?, ?, ?, NULL)
       ON CONFLICT(workspace_id, device_id) DO UPDATE SET
         role = excluded.role,
         removed_at = NULL`,
      [communityId, member.deviceId, member.role, descriptor.ownerDeviceId, now],
    );
  }
}

export function leaveCommunity(db: DatabaseAdapter, communityId: string): void {
  db.execute('DELETE FROM sync_communities WHERE community_id = ?', [communityId]);
}

export type JoinCommunityResult =
  | { ok: true; community: StoredCommunity }
  | { ok: false; reason: InviteVerdict | 'malformed_link' | 'killed' };

export interface JoinCommunityOptions {
  /**
   * Descriptor kill switch (MK-034): kill records from the T&S authority this
   * client trusts. A killed community refuses NEW joins here -- the same
   * boundary a rendezvous would enforce -- while existing members' local data
   * is never touched.
   */
  kills?: readonly import('./abuse-rails').SignedDescriptorKill[];
  trustedKillAuthorityDeviceId?: string;
}

/**
 * Join from an invite link: verify, store the community, and bridge it into a
 * 'community' workspace (members from the descriptor) so sessions, MK-002
 * authorization, and group keys all apply to community traffic.
 */
export function joinCommunityFromLink(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  link: string,
  now: Date = new Date(),
  options: JoinCommunityOptions = {},
): JoinCommunityResult {
  const parsed = parseCommunityInviteLink(link);
  if (!parsed) return { ok: false, reason: 'malformed_link' };
  const verdict = verifyCommunityInvite(parsed, now);
  if (verdict !== 'ok') return { ok: false, reason: verdict };

  if (
    options.kills
    && options.trustedKillAuthorityDeviceId
    && isDescriptorKilled(
      parsed.descriptor.descriptor.communityId,
      options.kills,
      options.trustedKillAuthorityDeviceId,
    )
  ) {
    return { ok: false, reason: 'killed' };
  }

  const nowIso = now.toISOString();
  const d = parsed.descriptor.descriptor;
  upsertCommunity(db, parsed.descriptor, identity.publicKey, nowIso);

  // Workspace bridge: community traffic rides the existing workspace machinery.
  const existingWs = db.query<{ id: string }>('SELECT id FROM sync_workspaces WHERE id = ?', [d.communityId]);
  if (existingWs.length === 0) {
    db.execute(
      `INSERT INTO sync_workspaces (id, display_name, workspace_type, created_by_device_id, created_at, rotated_at, current_key_version, archived_at)
       VALUES (?, ?, 'community', ?, ?, NULL, 0, NULL)`,
      [d.communityId, d.name, d.ownerDeviceId, nowIso],
    );
  }
  for (const member of d.members) {
    db.execute(
      `INSERT OR IGNORE INTO sync_workspace_members (workspace_id, device_id, role, invited_by_device_id, invited_at, removed_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [d.communityId, member.deviceId, member.role, d.ownerDeviceId, nowIso],
    );
  }

  return { ok: true, community: getCommunity(db, d.communityId)! };
}
