// Publish-to-Public orchestrator (Plan 19, Meerkat Public Social Layer -- P7a,
// web twin). Byte-parity with apps/meerkat/app/(root)/data/public-publish.ts on
// all shared logic (PUBLISH_COPY, the price helpers, the orchestrator); the only
// difference is the channel-event read import path (./meerkat-data here vs
// ./community-core on mobile), exactly like feed-core is duplicated across the two
// app boundaries.
//
// The app-side EXECUTION layer behind the (P7b) publish sheet. It drives the REAL
// P0-P4 path with no simulation: list a channel's signed events from the local
// store, build a non-confidential public snapshot under a fresh published key,
// sign an owner PublicationDescriptor over the content-addressed infoHash, POST
// the descriptor + snapshot pieces to each serving host the user configured, and
// (on at least one accept) announce the publication + its serving hosts to the
// public directory so it appears in Discover. It then persists the signed
// descriptor into the device-local cm_publications row so the owner can later
// unpublish.
//
// HONESTY: both paths are real. Self-host uses the supplied serving node. Managed
// hosting requires a server-signed entitlement and mirrors only authoritative job
// state returned by the community node.

import type { DatabaseAdapter } from '@mylife/db';
import naclUtil from 'tweetnacl-util';
import {
  announceHeldContent,
  announceHost,
  announcePublication,
  buildPublicSnapshot,
  bytesToHex,
  createArchiveJob,
  ManagedArchiveClient,
  createPublication,
  createPublicJoinGrant,
  createPublicReportFetchSignature,
  deriveCategoryRid,
  isPriorityPublicReport,
  unpublish,
  verifyPublication,
  type ArchiveLicense,
  type ArchiveObjectManifestEntry,
  type ArchiveTier,
  type ChannelMessageEvent,
  type ContentManifest,
  type DeviceIdentity,
  type PublicAbuseReport,
  type PublicCategory,
  type PublicJoinGrant,
  type PublicationJoinPolicy,
  type PublicationKind,
  type PublicationPostPolicy,
  type PublicationRights,
  type RightsAssertion,
  type SignedPublicationDescriptor,
  type SnapshotPieceStore,
} from '@mylife/sync';
import { MEERKAT_HOSTED_MONTHLY_PRODUCT } from '@mylife/billing-config';
import { listChannelMessageEvents } from './meerkat-data';

const { decodeBase64, encodeBase64 } = naclUtil;

// The first-party managed-serving price, read from billing-config -- NEVER
// hardcoded (plan section 7.3 / risk 6). Reachable for the P7b publish sheet.
export const HOSTED_MONTHLY_PRICE = MEERKAT_HOSTED_MONTHLY_PRODUCT.price;

/** Format the hosted-serving price as a "$"-prefixed two-decimal amount. */
export function formatHostedPrice(price: number = HOSTED_MONTHLY_PRICE): string {
  return `$${price.toFixed(2)}`;
}

// The public-snapshot seal uses the PUBLISHED key, not an epoch key; the register
// body still carries an epoch field, fixed to the engine's public sentinel (0).
const PUBLIC_SNAPSHOT_EPOCH = 0;
// buildPublicSnapshot's infoHash is content-addressed and does NOT depend on this
// id, so a placeholder is correct: the real publicationId derives from the signed
// descriptor AFTER the contentId is known (plan section 5.2 ordering).
const PENDING_PUBLICATION_ID = 'pending';

// Verbatim section 7.3 publish copy (the 5 states) + the publish-sheet strings the
// P7b UI reuses. Exported so the sheet and the tests read the same words.
export const PUBLISH_COPY = {
  loading: 'Building and signing your public snapshot…',
  empty: 'Add at least one post before publishing.',
  errorTitle: 'Could not publish',
  errorNoHost: 'No serving host accepted the content. Check your host URL or connect hosted serving.',
  errorRateLimited: 'This host rejected the publication (rate limited). Try again later.',
  success: 'Published. Anyone with a reachable host can now read it.',
  partialDetail: 'Some hosts did not accept it; it is still readable from the ones that did.',
  confirm: 'Publish publicly',
  // The `public` audience rule's hosted notice, verbatim (audience-rule.ts:110).
  audienceHostedNotice: 'Public posts use hosted storage and moderation.',
  hostFieldLabel: 'Where will this be served? Paste your serving host URL, or connect hosted serving.',
  selfHostPath: 'Serve it yourself from a Mac mini, NAS, or VPS. Free. It is public only while your host is online.',
} as const;

/**
 * Verbatim FF3 join-policy copy for the publish sheet. HONEST: open-redeem records a
 * ROSTER membership row only, NOT read access -- the community epoch key still flows solely
 * through the owner-gated wrap rail, delivered later over a connection server. Shared by both
 * publish sheets (mobile + web) so the copy cannot drift.
 */
export const JOIN_POLICY_COPY = {
  sectionTitle: 'Joining',
  sectionHint: 'Reading stays anonymous and free for everyone. This only controls who can join the underlying community.',
  advertiseToggle: 'Allow people to join',
  advertiseHint: 'Adds a Join button on the public reader. Off = readers can only read; no one can join.',
  openLabel: 'Open',
  openHint: 'Anyone with an identity can join without approval.',
  requestLabel: 'Request',
  requestHint: 'You approve each join.',
  membershipNote: 'Joining records community membership only. It grants no read access until a connection server delivers the key.',
} as const;

/** "Published to {m} of {n} hosts." -- the Partial headline (verbatim 7.3). */
export function publishedToHostsLabel(accepted: number, total: number): string {
  return `Published to ${accepted} of ${total} hosts.`;
}

/**
 * The paid hosted-serving path copy (verbatim 7.3), price interpolated from
 * billing-config. Viewing stays free; the price is the always-on hosting capacity.
 */
export function hostedServingPath(price: number = HOSTED_MONTHLY_PRICE): string {
  return `Always-on managed serving is a paid service (${formatHostedPrice(price)}/mo). Viewing stays free for everyone; you pay for the server space your public content uses.`;
}

/** A copyable deep link to a publication (openable even if no directory lists it). */
export function publicationLink(publicationId: string): string {
  return `meerkat://public/${publicationId}`;
}

// ---------------------------------------------------------------------------
// Durable public archive (Plan 19 P9.3e). HONESTY (mission rule, the hard
// override): the publish path registers the snapshot on a serving host that
// serves an ACTIVE descriptor immediately, but it runs NO durable-archive pin and
// NO content scan here -- the at-scale AV / abuse-hash scanner that feeds the host
// archive-moderation queue is founder-ops (Tier-D). So this build NEVER renders a
// "scanned & safe / published to the archive" terminal: the archive rests in the
// honest QUEUED state until a REAL host scan result returns. No "forever" /
// "permanent" string anywhere (NC-7) -- the only live tier is self-host, which is
// online-only. Rights are SELF-DECLARED publisher claims, surfaced verbatim and
// labeled as claims, never platform verification (NC-8 requires them, no default).
// ---------------------------------------------------------------------------
export const ARCHIVE_COPY = {
  sectionTitle: 'Public archive copy',
  sectionHint: 'Self-hosted: it stays online while your host serves it. Viewing is free for everyone.',
  // Consent (required; the confirm stays disabled until it is checked).
  consent: 'Publishing to the public archive makes this readable by anyone, durably hosted, and discoverable. Anyone can copy it. You can take it down, but copies others already made may remain.',
  consentToggle: 'I understand and consent.',
  // Rights + license (REQUIRED, no default selection -- NC-8).
  rightsTitle: 'Rights (required)',
  rightsHint: 'Your claims, shown to readers as publisher claims. Meerkat does not verify them.',
  licenseTitle: 'License (required)',
  provenanceLabel: 'Source or attribution (optional)',
  provenancePlaceholder: 'Where this came from, if relevant',
  // Tier (verbatim copy; the managed price is read at runtime from billing-config).
  tierTitle: 'Hosting',
  tierCopy: 'Viewing stays free for everyone. Durable hosting uses server space: host it yourself for free while your device is online, or pay for always-on managed hosting.',
  tierSelfHost: 'Self-host (free, online-only)',
  tierManagedDisabled: 'Managed always-on hosting is not connected. Configure the hosted community service or self-host.',
  tierManagedAvailable: 'Managed publishing uploads the signed public snapshot for a real scan, durable pin, and status tracking.',
  // 5-state copy. `loading` + `queued` are what THIS build reaches; `archived` is
  // reserved for a REAL approved + clean + pinned host result (gated, founder-ops)
  // and is NEVER rendered as a terminal here.
  loading: 'Publishing and queuing your archive copy for review…',
  empty: 'Add at least one post before archiving.',
  queued: 'Scanning and queued for review…',
  queuedDetail: 'It is not archived until a host confirms a clean scan.',
  archived: 'Published to the public archive. Viewing is free; it stays online while a host serves it.',
  errorTitle: 'Could not archive',
  // Only ever shown on a REAL host reason: storage-cap on a real `storage_cap`
  // reject (a route this build does not yet call), flagged on a real rejected scan.
  errorStorageCap: 'Host is over its storage cap (add space or self-host).',
  errorFlagged: 'This content was flagged in review and was not published.',
} as const;

/** Rights-assertion options (engine taxonomy). REQUIRED, no default selection (NC-8). */
export const RIGHTS_ASSERTION_OPTIONS: ReadonlyArray<{ value: RightsAssertion; label: string }> = [
  { value: 'i_own', label: 'I own this' },
  { value: 'i_have_permission', label: 'I have permission' },
  { value: 'public_domain', label: 'Public domain' },
  { value: 'fair_use', label: 'Fair use' },
];

/** License options (engine taxonomy). REQUIRED, no default selection (NC-8). */
export const ARCHIVE_LICENSE_OPTIONS: ReadonlyArray<{ value: ArchiveLicense; label: string }> = [
  { value: 'all_rights_reserved', label: 'All rights reserved' },
  { value: 'cc_by', label: 'CC BY' },
  { value: 'cc_by_sa', label: 'CC BY-SA' },
  { value: 'cc0', label: 'CC0' },
  { value: 'public_domain', label: 'Public domain' },
  { value: 'other', label: 'Other' },
];

/** Managed always-on tier label, price interpolated from billing-config at runtime. */
export function archiveManagedTierLabel(price: number = HOSTED_MONTHLY_PRICE): string {
  return `Managed always-on (paid, ${formatHostedPrice(price)}/mo)`;
}

export type PublishStateKind = 'success' | 'partial' | 'error' | 'empty';

export interface PublishHostResult {
  /** The serving host URL the descriptor was registered against. */
  url: string;
  /** True only on a real HTTP 200 accept from the host. */
  accepted: boolean;
  /** The HTTP status (0 on a network/transport failure). */
  status: number;
  /** The host's machine-readable reject reason, when it returned one. */
  reason?: string;
}

export interface PublishResult {
  state: PublishStateKind;
  /** The state's verbatim headline copy. */
  message: string;
  /** The Partial secondary line, present only in the partial state. */
  detail?: string;
  /** The derived publication id, null only when guarded as Empty. */
  publicationId: string | null;
  /** meerkat://public/{id}, present only when at least one host serves it. */
  link: string | null;
  /** Per-host accept/reject results, in request order. */
  hosts: PublishHostResult[];
  /** True only after a real announce to the directory succeeded. */
  announced: boolean;
  /**
   * Present ONLY when a durable-archive job was created (Plan 19 P9.3e). moderationState
   * starts pending and advances only from managed-host status responses. Never fabricated.
   */
  archive?: {
    jobId: string;
    tier: ArchiveTier;
    moderationState: 'pending' | 'approved' | 'rejected' | 'failed';
    status: string;
    lastErrorCode?: string;
  };
}

/** Injectable WebSocket constructor (defaults to the global one in the app). */
type DirectoryWebSocket = Parameters<typeof announcePublication>[0]['webSocketImpl'];

export interface PublishChannelInput {
  db: DatabaseAdapter;
  /** The publishing owner (community owner for community/channel/forum kinds). */
  identity: DeviceIdentity;
  communityId: string;
  channelId: string;
  title: string;
  description: string;
  category: PublicCategory;
  /** Real serving host URLs the user configured (self-host or hosted). */
  hostUrls: string[];
  /** The public-directory host to announce to (empty = serve without discovery). */
  directoryUrl: string;
  postId?: string | null;
  /** request -> the owner approves each join; open -> anyone with an identity can join. Default 'request'. */
  joinPolicy?: PublicationJoinPolicy;
  /**
   * FF3: advertise joins by minting an owner-signed public-join grant onto the descriptor. The
   * grant carries ONLY the owner's x25519 PUBLIC DH key + a nonce (NEVER a private/epoch key). It
   * is emitted for BOTH policies (open + request both need the owner DH key; joinPolicy decides
   * open-redeem vs request-seal). Off (default) = no grant, byte-identical to a pre-FF3 descriptor.
   */
  advertiseJoins?: boolean;
  /**
   * Wire humanity token from the device wallet (Plan 24 P3): humanity-gated
   * serving hosts require it on a FIRST-revision (genesis) register, which every
   * publishChannelPublicly register is. The publish sheet supplies
   * getStoredHumanityToken(db); omitted = no header, and a gated host rejects
   * honestly with humanity_required. SINGLE-USE: with multiple humanity-gated
   * hosts sharing one redeem service, only the FIRST register spends it and the
   * rest see already_spent (the sheet publishes to one host, so this is a
   * documented limit, not a live path); a multi-host gated publish needs one
   * token per gated host.
   */
  humanityToken?: string | null;
  /**
   * Owner-declared POSTING policy (Plan 39 P4). Absent = view_only fail-closed:
   * nobody can post through the public submit route. 'open'/'approval' also
   * require `postNodeKeyHex` (the serving node refuses to countersign posts for
   * a publication that does not pin its receipt key).
   */
  postPolicy?: PublicationPostPolicy | null;
  /** The serving node's receipt PUBLIC key (64-hex) to pin (Plan 39 P4/P5). */
  postNodeKeyHex?: string | null;
  kind?: PublicationKind;
  /**
   * Plan 51 P3: the anonymous verification-account credential header for the public
   * register + archive intake HTTP call, computed by the publish sheet via
   * account-core.presentCredentialHeader. Absent = byte-identical to the pre-Plan-51
   * publish. Carries NO account identifier (AC-2).
   */
  credentialHeaders?: Record<string, string>;
  /**
   * Durable-archive step (Plan 19 P9.3e). When present, the descriptor is signed
   * WITH these rights (so the reader sees them as publisher claims, byte-bound into
   * the signature) and an owner-signed ArchiveJob + the rights/consent mirror + a
   * PENDING moderation row are persisted after a successful publish. Absent = the
   * legacy P7a behavior (no rights on the descriptor, no archive job).
   */
  archive?: {
    rights: PublicationRights;
    tier: ArchiveTier;
    /** Required for managed tier. The entitlement is used in memory and never persisted. */
    managed?: { baseUrl: string; entitlementToken: string };
  };
}

export interface PublishDeps {
  buildPublicSnapshot: typeof buildPublicSnapshot;
  createPublication: typeof createPublication;
  announcePublication: typeof announcePublication;
  announceHeldContent: typeof announceHeldContent;
  listChannelMessageEvents: (
    db: DatabaseAdapter,
    communityId: string,
    channelId: string,
  ) => ChannelMessageEvent[];
  fetchFn: typeof fetch;
  webSocketImpl?: DirectoryWebSocket;
  randomBytes: (byteCount: number) => Uint8Array;
  now: () => string;
}

function defaultRandomBytes(byteCount: number): Uint8Array {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('publishChannelPublicly: no secure random source; inject deps.randomBytes.');
  }
  return cryptoApi.getRandomValues(new Uint8Array(byteCount));
}

export const DEFAULT_PUBLISH_DEPS: PublishDeps = {
  buildPublicSnapshot,
  createPublication,
  announcePublication,
  announceHeldContent,
  listChannelMessageEvents,
  fetchFn: (globalThis.fetch?.bind(globalThis) as typeof fetch),
  randomBytes: defaultRandomBytes,
  now: () => new Date().toISOString(),
};

/** A throwaway in-memory piece store for the build phase only (pieces go to hosts). */
class InMemoryPublishPieceStore implements SnapshotPieceStore {
  private readonly pieces = new Map<string, Uint8Array>();
  private key(infoHash: string, index: number): string {
    return `${infoHash}:${index}`;
  }
  put(infoHash: string, index: number, bytes: Uint8Array): void {
    this.pieces.set(this.key(infoHash, index), bytes);
  }
  get(infoHash: string, index: number): Uint8Array | null {
    return this.pieces.get(this.key(infoHash, index)) ?? null;
  }
  removeContent(infoHash: string): void {
    for (const k of [...this.pieces.keys()]) {
      if (k.startsWith(`${infoHash}:`)) this.pieces.delete(k);
    }
  }
}

function trimHost(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

interface RegisterBody {
  descriptor: SignedPublicationDescriptor;
  snapshots: { channelId: string; epoch: number; manifest: ContentManifest; pieces: string[] }[];
}

/** POST the owner-signed descriptor + base64 pieces to one serving host. When the
 * wallet supplies a humanity token it rides the x-mk-humanity header (Plan 24 P3:
 * humanity-gated hosts require it on a FIRST-revision register; open self-host
 * nodes ignore it). Never fabricated: absent token = absent header, and a gated
 * host then answers 401 humanity_required honestly. */
async function registerWithHost(
  fetchFn: typeof fetch,
  host: string,
  publicationId: string,
  body: RegisterBody,
  humanityToken?: string | null,
  entitlementToken?: string | null,
  // Plan 51 P3: the anonymous verification-account credential header, computed by
  // the publish sheet via account-core.presentCredentialHeader and threaded in.
  // Absent leaves this register byte-identical to before. It carries NO account
  // identifier (AC-2); public-publish never imports account-core so it (and its web
  // twin) stay free of the account layer.
  credentialHeaders?: Record<string, string>,
): Promise<PublishHostResult> {
  const base = trimHost(host);
  if (!base) return { url: host, accepted: false, status: 0, reason: 'bad_host_url' };
  try {
    const res = await fetchFn(`${base}/public/${encodeURIComponent(publicationId)}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(humanityToken ? { 'x-mk-humanity': humanityToken } : {}),
        ...(entitlementToken ? { Authorization: `Bearer ${entitlementToken}` } : {}),
        ...(credentialHeaders ?? {}),
      },
      body: JSON.stringify(body),
    });
    if (res.status === 200) return { url: host, accepted: true, status: 200 };
    let reason: string | undefined;
    try {
      const json = (await res.json()) as { reason?: string };
      reason = typeof json?.reason === 'string' ? json.reason : undefined;
    } catch {
      reason = undefined;
    }
    return { url: host, accepted: false, status: res.status, reason };
  } catch {
    return { url: host, accepted: false, status: 0, reason: 'network_error' };
  }
}

/** Persist the signed descriptor locally so the owner can later unpublish. */
function persistPublicationRow(
  db: DatabaseAdapter,
  signed: SignedPublicationDescriptor,
  now: string,
): void {
  const d = signed.descriptor;
  db.execute(
    `INSERT OR REPLACE INTO cm_publications (
      publication_id, community_id, channel_id, post_id, kind, title, description,
      category, owner_device_id, content_id, public_key_hex, host_urls, revision,
      status, join_policy, signature_hex, rights_json, public_join_json,
      post_policy, post_node_key_hex, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.publicationId,
      d.communityId,
      d.channelId,
      d.postId,
      d.kind,
      d.title,
      d.description,
      d.category,
      d.ownerDeviceId,
      d.contentId,
      d.publicKeyHex,
      JSON.stringify(d.hostUrls),
      d.revision,
      d.status,
      d.joinPolicy,
      signed.signature,
      // The signed rights ride here ON cm_publications (which replicates with the
      // owner), so reconstructGenesis can rebuild a rights-bearing descriptor
      // byte-exact for a takedown even on a second device. null = a rights-less
      // (legacy / non-archived) publication.
      d.rights ? JSON.stringify(d.rights) : null,
      // FF3: the signed public-join grant rides here too, so a takedown of an ADVERTISED
      // publication reconstructs byte-exact (the grant tag is part of the owner signature).
      // null = a grant-less (not advertised) publication.
      d.publicJoin ? JSON.stringify(d.publicJoin) : null,
      // Plan 39 P4: the signed posting policy + pinned node receipt key ride here
      // too, so a policy-bearing descriptor reconstructs byte-exact for takedowns
      // and revisions (both are signature-covered tagged appends).
      d.postPolicy ?? null,
      d.postNodeKeyHex ?? null,
      d.createdAt,
      now,
    ],
  );
}

/**
 * Publish a channel publicly. Drives the REAL build -> sign -> register -> announce
 * -> persist path. Returns the section 7.3 state (Empty / Error / Success / Partial)
 * with the verbatim copy, the derived publicationId + copyable link, and per-host
 * results. Both self-host and managed paths use real serving endpoints. Deps default
 * to the real engine + global fetch/WS;
 * tests and the e2e inject the seams.
 */
export async function publishChannelPublicly(
  overrides: Partial<PublishDeps>,
  input: PublishChannelInput,
): Promise<PublishResult> {
  const deps: PublishDeps = { ...DEFAULT_PUBLISH_DEPS, ...overrides };
  const { db, identity, communityId, channelId } = input;
  const kind: PublicationKind = input.kind ?? 'channel';
  const managedEntitlement = input.archive?.tier === 'managed'
    ? input.archive.managed?.entitlementToken.trim() || null
    : null;
  if (input.archive?.tier === 'managed' && !managedEntitlement) {
    return {
      state: 'error', message: PUBLISH_COPY.errorNoHost, publicationId: null,
      link: null, hosts: [], announced: false,
    };
  }

  // Empty guard: never build an empty signed snapshot (plan section 7.3 Empty).
  const events = deps.listChannelMessageEvents(db, communityId, channelId);
  if (events.length === 0) {
    return {
      state: 'empty',
      message: PUBLISH_COPY.empty,
      publicationId: null,
      link: null,
      hosts: [],
      announced: false,
    };
  }

  const now = deps.now();

  // 1) Build the snapshot FIRST under a fresh, non-secret published key, into a
  //    throwaway store; the contentId (infoHash) is content-addressed.
  const publicKey = Uint8Array.from(deps.randomBytes(32) as ArrayLike<number>);
  if (publicKey.length !== 32) {
    throw new Error('publishChannelPublicly: randomBytes must return 32 bytes for the published key.');
  }
  const buildStore = new InMemoryPublishPieceStore();
  const record = await deps.buildPublicSnapshot({
    identity,
    publicationId: PENDING_PUBLICATION_ID,
    communityId,
    channelId,
    events,
    publicKey,
    pieceStore: buildStore,
    now,
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: string[] = [];
  for (let index = 0; index < manifest.pieces.length; index += 1) {
    const bytes = buildStore.get(record.infoHash, index);
    if (!bytes) {
      throw new Error('publishChannelPublicly: snapshot piece store is missing a built piece.');
    }
    pieces.push(encodeBase64(bytes));
  }

  // 2) THEN sign the owner descriptor over the real contentId; id derives from it.
  // FF3: when the owner advertises joins, mint the owner-signed public-join grant so it rides
  // INSIDE this one signed descriptor (unforgeable, non-transplantable). Emitted for BOTH policies
  // (open + request both need the owner DH key). Fail-closed: skip advertising if this identity has
  // no DH public key rather than emit a malformed grant. The grant carries ONLY the owner PUBLIC DH
  // key + a nonce -- NEVER a private/epoch key.
  const publicJoin: PublicJoinGrant | null =
    input.advertiseJoins && identity.dhPublicKey
      ? createPublicJoinGrant(identity, deps.randomBytes)
      : null;
  const signed = deps.createPublication(identity, {
    kind,
    communityId,
    channelId,
    postId: input.postId ?? null,
    title: input.title,
    description: input.description,
    category: input.category,
    contentId: record.infoHash,
    publicKeyHex: bytesToHex(publicKey),
    hostUrls: input.hostUrls,
    joinPolicy: input.joinPolicy,
    // The FF3 owner-signed join grant (null unless advertiseJoins). createPublication appends it to
    // the canonical bytes ONLY when present, so a grant-less publish stays byte-identical to pre-FF3.
    publicJoin,
    // Sign the owner-declared rights INTO the descriptor when archiving, so the
    // reader sees them as publisher claims. `?? null` (never `{}`): an empty object
    // is truthy, would append an all-undefined rights tuple, and would break the
    // derived publicationId + every legacy rights-less publish.
    rights: input.archive?.rights ?? null,
    // Plan 39 P4: sign the posting policy + pinned node receipt key INTO the
    // descriptor (tagged conditional append; absent = view_only fail-closed).
    postPolicy: input.postPolicy ?? null,
    postNodeKeyHex: input.postNodeKeyHex ?? null,
    now,
  });
  const publicationId = signed.descriptor.publicationId;

  // 3) Register the descriptor + snapshot pieces on every configured serving host.
  const body: RegisterBody = {
    descriptor: signed,
    snapshots: [{ channelId, epoch: PUBLIC_SNAPSHOT_EPOCH, manifest, pieces }],
  };
  const hosts: PublishHostResult[] = [];
  for (const host of input.hostUrls) {
    hosts.push(await registerWithHost(
      deps.fetchFn, host, publicationId, body, input.humanityToken, managedEntitlement, input.credentialHeaders,
    ));
  }
  const accepted = hosts.filter((h) => h.accepted);

  // No host accepted -> honest Error state. Nothing is announced or persisted.
  if (accepted.length === 0) {
    const rateLimited = hosts.some((h) => h.status === 429 || h.reason === 'rate_limited');
    return {
      state: 'error',
      message: rateLimited ? PUBLISH_COPY.errorRateLimited : PUBLISH_COPY.errorNoHost,
      publicationId,
      link: null,
      hosts,
      announced: false,
    };
  }

  // 4) At least one host serves it: announce to the directory (so it appears in
  //    Discover) and announce each accepting host as a real serving source.
  let announced = false;
  if (trimHost(input.directoryUrl)) {
    try {
      await deps.announcePublication({
        url: input.directoryUrl,
        signed,
        webSocketImpl: deps.webSocketImpl,
      });
      for (const host of accepted) {
        await deps.announceHeldContent({
          url: input.directoryUrl,
          contentId: record.infoHash,
          hostUrl: host.url,
          webSocketImpl: deps.webSocketImpl,
        });
      }
      announced = true;
    } catch {
      announced = false;
    }
  }

  // 5) Persist the signed descriptor AND the snapshot pieces so the owner can
  //    later unpublish: the host's register route requires the descriptor's
  //    contentId among the supplied snapshots, so unpublishPublicly re-sends these.
  persistPublicationRow(db, signed, now);
  persistPublicationSnapshot(db, publicationId, channelId, PUBLIC_SNAPSHOT_EPOCH, manifest, pieces, now);

  // Durable-archive step: only on the accepted path, against the FIRST accepting host
  // (the real serving host). Records the owner intent + the rights/consent mirror + a
  // PENDING moderation row; no bytes/scan are fabricated.
  let archive: PublishResult['archive'];
  if (input.archive) {
    const objectBytes = pieces.map((piece) => decodeBase64(piece));
    const objectManifest: ArchiveObjectManifestEntry[] = objectBytes.map((bytes, index) => ({
      index,
      hash: manifest.pieces[index]!,
      size: bytes.byteLength,
    }));
    const totalBytes = objectBytes.reduce((total, bytes) => total + bytes.byteLength, 0);
    const persisted = persistArchiveArtifacts(
      db, identity, signed, input.archive, accepted[0]!.url, objectManifest, totalBytes, now,
    );
    archive = {
      jobId: persisted.job.job.jobId,
      tier: input.archive.tier,
      moderationState: 'pending',
      status: input.archive.tier === 'managed' ? 'created' : 'consented',
    };
    if (input.archive.tier === 'managed') {
      if (!input.archive.managed) {
        archive = { ...archive, moderationState: 'failed', status: 'failed', lastErrorCode: 'managed_not_configured' };
      } else {
        try {
          const client = new ManagedArchiveClient({
            baseUrl: input.archive.managed.baseUrl,
            entitlementToken: input.archive.managed.entitlementToken,
            fetchImpl: deps.fetchFn,
          });
          const submitted = await client.submit(persisted.job, identity, objectBytes);
          archive = { ...archive, status: submitted.status };
        } catch (error) {
          const code = error instanceof Error && 'code' in error && typeof error.code === 'string'
            ? error.code
            : 'archive_unavailable';
          archive = { ...archive, moderationState: 'failed', status: 'failed', lastErrorCode: code };
        }
      }
      db.execute(
        'UPDATE cm_archive_jobs SET status = ?, updated_at = ? WHERE job_id = ?',
        [archive.status, now, archive.jobId],
      );
    }
  }

  const link = publicationLink(publicationId);
  if (accepted.length === input.hostUrls.length) {
    return { state: 'success', message: PUBLISH_COPY.success, publicationId, link, hosts, announced, ...(archive ? { archive } : {}) };
  }
  return {
    state: 'partial',
    message: publishedToHostsLabel(accepted.length, input.hostUrls.length),
    detail: PUBLISH_COPY.partialDetail,
    publicationId,
    link,
    hosts,
    announced,
    ...(archive ? { archive } : {}),
  };
}

/**
 * Persist the durable-archive artifacts for an accepted public publish (Plan 19
 * P9.3e). Builds the owner-signed ArchiveJob over the SIGNED descriptor + the SAME
 * rights object that rode into the descriptor (so the signed rights + the local
 * mirror cannot diverge), then writes three local rows:
 *   - cm_archive_jobs: status 'consented' with the exact built piece count and byte total.
 *   - cm_publication_rights: the local rights/consent mirror + its signature (a
 *     query/UI convenience; takedown reconstruction reads cm_publications.rights_json,
 *     not this device_local mirror).
 *   - cm_archive_moderation: PENDING / unscanned -- the host scan result is mirrored
 *     later; this build never writes a fabricated 'clean'.
 * The host runs verifyArchiveJob before pinning (the fail-closed NC-8 gate); this
 * only records the owner intent + consent.
 */
function persistArchiveArtifacts(
  db: DatabaseAdapter,
  owner: DeviceIdentity,
  signed: SignedPublicationDescriptor,
  archive: { rights: PublicationRights; tier: ArchiveTier },
  hostUrl: string,
  objects: readonly ArchiveObjectManifestEntry[],
  totalBytes: number,
  now: string,
): { job: ReturnType<typeof createArchiveJob> } {
  const job = createArchiveJob(owner, signed, {
    tier: archive.tier,
    hostUrl,
    objects,
    rights: archive.rights,
    now,
  });
  const d = signed.descriptor;
  db.execute(
    `INSERT OR REPLACE INTO cm_archive_jobs (
      job_id, publication_id, content_id, tier, host_url, status, total_bytes, pieces,
      consent_sig_hex, signature_hex, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'consented', ?, ?, ?, ?, ?, ?)`,
    [job.job.jobId, d.publicationId, d.contentId, archive.tier, hostUrl, totalBytes, objects.length, job.rightsSignature, job.signature, now, now],
  );
  db.execute(
    `INSERT OR REPLACE INTO cm_publication_rights (
      publication_id, license, rights_assertion, provenance, consent_at, signature_hex
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [d.publicationId, archive.rights.license, archive.rights.rightsAssertion, archive.rights.provenance, archive.rights.consentAt, job.rightsSignature],
  );
  db.execute(
    `INSERT OR REPLACE INTO cm_archive_moderation (
      publication_id, content_id, host_url, state, scan_result, decided_at, source_host, fetched_at
    ) VALUES (?, ?, ?, 'pending', 'unscanned', NULL, ?, ?)`,
    [d.publicationId, d.contentId, hostUrl, hostUrl, now],
  );
  return { job };
}

export interface ManagedArchiveJobSummary {
  jobId: string;
  publicationId: string;
  hostUrl: string;
  status: string;
  updatedAt: string;
}

interface ManagedArchiveJobRow {
  job_id: string;
  publication_id: string;
  host_url: string;
  status: string;
  updated_at: string;
}

/** List the owner's managed jobs from the personal-replica mirror. */
export function listManagedArchiveJobs(db: DatabaseAdapter): ManagedArchiveJobSummary[] {
  return db.query<ManagedArchiveJobRow>(
    `SELECT job_id, publication_id, host_url, status, updated_at
       FROM cm_archive_jobs WHERE tier = 'managed' ORDER BY updated_at DESC`,
  ).map((row) => ({
    jobId: row.job_id,
    publicationId: row.publication_id,
    hostUrl: row.host_url,
    status: row.status,
    updatedAt: row.updated_at,
  }));
}

function requireManagedArchiveJob(db: DatabaseAdapter, jobId: string): ManagedArchiveJobRow {
  const row = db.query<ManagedArchiveJobRow>(
    `SELECT job_id, publication_id, host_url, status, updated_at
       FROM cm_archive_jobs WHERE job_id = ? AND tier = 'managed' LIMIT 1`,
    [jobId],
  )[0];
  if (!row) throw new Error('Managed archive job is not available on this device.');
  return row;
}

function mirrorManagedArchiveStatus(
  db: DatabaseAdapter,
  row: ManagedArchiveJobRow,
  status: string,
  scanOutcomeClass: 'clean' | 'rejected' | 'review_required' | null,
  lastErrorCode: string | null,
  now: string,
): void {
  const state = scanOutcomeClass === 'clean' ? 'approved' : scanOutcomeClass === 'rejected' ? 'rejected' : 'pending';
  const scanResult = scanOutcomeClass
    ?? (status === 'takedown_pending' || status === 'removed' ? status : lastErrorCode ? `error:${lastErrorCode}` : 'unscanned');
  db.transaction(() => {
    db.execute('UPDATE cm_archive_jobs SET status = ?, updated_at = ? WHERE job_id = ?', [status, now, row.job_id]);
    db.execute(
      `UPDATE cm_archive_moderation
          SET state = ?, scan_result = ?, decided_at = ?, fetched_at = ?
        WHERE publication_id = ? AND host_url = ?`,
      [state, scanResult, scanOutcomeClass ? now : null, now, row.publication_id, row.host_url],
    );
  });
}

/** Fetch and atomically mirror server-authoritative status. No entitlement is required. */
export async function refreshManagedArchiveJob(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  jobId: string,
  fetchFn: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<ManagedArchiveJobSummary> {
  const row = requireManagedArchiveJob(db, jobId);
  const status = await new ManagedArchiveClient({ baseUrl: row.host_url, fetchImpl: fetchFn, now }).status(jobId, identity);
  const updatedAt = now().toISOString();
  mirrorManagedArchiveStatus(db, row, status.status, status.scanOutcomeClass, status.lastErrorCode, updatedAt);
  return { jobId, publicationId: row.publication_id, hostUrl: row.host_url, status: status.status, updatedAt };
}

/** Request owner-authenticated takedown and mirror only the returned server state. */
export async function cancelManagedArchiveJob(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  jobId: string,
  fetchFn: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<ManagedArchiveJobSummary> {
  const row = requireManagedArchiveJob(db, jobId);
  const cancelled = await new ManagedArchiveClient({ baseUrl: row.host_url, fetchImpl: fetchFn, now }).cancel(jobId, identity);
  const updatedAt = now().toISOString();
  mirrorManagedArchiveStatus(db, row, cancelled.status, null, null, updatedAt);
  return { jobId, publicationId: row.publication_id, hostUrl: row.host_url, status: cancelled.status, updatedAt };
}

// ---------------------------------------------------------------------------
// Publish-sheet (P7b) seams: a REAL reachability probe, the confirm-enable gate,
// and the result -> 5-state copy mapping. Pure + Node-testable so the sheet's
// gating and the verbatim copy mapping are verifiable without React.
// ---------------------------------------------------------------------------

/** Outcome of a real reachability probe against a serving host. */
export type HostProbeResult =
  | { reachable: true; status: number }
  | { reachable: false; reason: 'empty' | 'bad_url' | 'unreachable'; status: number };

/**
 * Really probe a serving host for reachability before the owner can publish. A
 * reachable host answers `GET {host}/healthz` with HTTP 200 (the community-node
 * / public-directory health route). Fail-closed: an empty or non-http URL, a
 * non-200, or a thrown transport error all return unreachable, so the sheet
 * keeps Publish disabled. This NEVER reports reachable without a real 200 -- the
 * probe is not faked.
 */
export async function probeServingHost(
  host: string,
  fetchFn: typeof fetch = DEFAULT_PUBLISH_DEPS.fetchFn,
): Promise<HostProbeResult> {
  const base = trimHost(host);
  if (!base) return { reachable: false, reason: 'empty', status: 0 };
  if (!/^https?:\/\//i.test(base)) return { reachable: false, reason: 'bad_url', status: 0 };
  try {
    const res = await fetchFn(`${base}/healthz`, { method: 'GET' });
    if (res.status === 200) return { reachable: true, status: 200 };
    return { reachable: false, reason: 'unreachable', status: res.status };
  } catch {
    return { reachable: false, reason: 'unreachable', status: 0 };
  }
}

/** The fields that gate the "Publish publicly" confirm button (plan 7.3). */
export interface PublishGateInput {
  title: string;
  category: PublicCategory | null;
  /** True only after a real probe returned reachable for the chosen host. */
  hostReachable: boolean;
  /** True only when the author explicitly selected the Public audience. */
  audienceIsPublic: boolean;
}

/**
 * Whether "Publish publicly" is enabled. Disabled until a title + a category + a
 * REACHABLE (probed) host are present and the author has explicitly chosen the
 * Public audience (plan 7.3). Pure so the gating is unit-testable.
 */
export function canConfirmPublish(input: PublishGateInput): boolean {
  return (
    input.title.trim().length > 0 &&
    input.category !== null &&
    input.hostReachable &&
    input.audienceIsPublic
  );
}

/** The fields that gate the durable-archive confirm (Plan 19 P9.3e, NC-8). */
export interface ArchiveGateInput extends PublishGateInput {
  /** The required consent checkbox; the confirm stays disabled until it is checked. */
  consentChecked: boolean;
  /** The required rights assertion; NO default selection (NC-8). */
  rightsAssertion: RightsAssertion | null;
  /** The required license; NO default selection (NC-8). */
  license: ArchiveLicense | null;
}

/**
 * Whether "Publish publicly" is enabled for a PUBLIC publish that goes through the
 * durable-archive step. Extends canConfirmPublish with the mandatory consent + rights
 * gate (NC-8): the confirm stays disabled until the author checks consent AND picks
 * BOTH a rights assertion and a license (neither has a default). Pure + unit-testable.
 */
export function canConfirmArchivePublish(input: ArchiveGateInput): boolean {
  return (
    canConfirmPublish(input) &&
    input.consentChecked &&
    input.rightsAssertion !== null &&
    input.license !== null
  );
}

/** The publish sheet's rendered fields for a finished publish (5-state copy). */
export interface PublishResultView {
  heading: string;
  body: string;
  detail: string | null;
  /** The copyable meerkat://public/{id} link, present only when served. */
  link: string | null;
  tone: 'success' | 'partial' | 'error' | 'empty';
}

/**
 * Map a PublishResult to the verbatim section 7.3 sheet copy. The orchestrator
 * already chose the state + headline; this only frames it for the sheet (Error
 * shows the "Could not publish" title above the returned reason). No new copy.
 */
export function publishResultView(result: PublishResult): PublishResultView {
  switch (result.state) {
    case 'success':
      return { heading: PUBLISH_COPY.success, body: '', detail: null, link: result.link, tone: 'success' };
    case 'partial':
      return {
        heading: result.message,
        body: result.detail ?? PUBLISH_COPY.partialDetail,
        detail: result.detail ?? PUBLISH_COPY.partialDetail,
        link: result.link,
        tone: 'partial',
      };
    case 'error':
      return { heading: PUBLISH_COPY.errorTitle, body: result.message, detail: null, link: null, tone: 'error' };
    case 'empty':
      return { heading: PUBLISH_COPY.empty, body: '', detail: null, link: null, tone: 'empty' };
  }
}

/** The publish-sheet view for a finished durable-archive publish (Plan 19 P9.3e). */
export interface ArchivePublishResultView extends PublishResultView {
  /**
   * The honest durable-archive sub-state line shown below the publish result. In THIS
   * build it is the QUEUED state ('Scanning and queued for review…') because no real
   * host scan has returned -- it NEVER claims the content was archived or reviewed. It
   * advances to the verbatim 'Published to the public archive.' ONLY on a real
   * approved + clean host scan (founder-ops), or the flagged error on a real rejected
   * scan. Null when no archive was requested or the publish itself failed.
   */
  archiveNote: string | null;
  archiveNoteDetail: string | null;
}

/**
 * Map a PublishResult (with an optional archive sub-result) to the sheet copy. The
 * base publish 5-state view is unchanged: it honestly reports whether the content is
 * served + readable (the register path serves an active descriptor immediately). When
 * a durable-archive job was created, an honest sub-state note is added that reflects
 * the REAL moderation state -- 'pending' (this build) renders the QUEUED note, never a
 * fabricated 'archived & reviewed'. The verbatim ARCHIVE_COPY.archived terminal is
 * reached ONLY when a real host scan returns approved+clean (moderationState
 * 'approved'); 'rejected' surfaces the flagged note. No permanence claim (NC-7).
 */
export function archivePublishResultView(result: PublishResult): ArchivePublishResultView {
  const base = publishResultView(result);
  // No archive note unless an archive was actually requested AND the publish landed.
  if (!result.archive || (result.state !== 'success' && result.state !== 'partial')) {
    return { ...base, archiveNote: null, archiveNoteDetail: null };
  }
  switch (result.archive.moderationState) {
    case 'approved':
      // Reserved for a REAL approved + clean host scan result (founder-ops). Not
      // reachable in this build, where moderationState is always 'pending'.
      return { ...base, archiveNote: ARCHIVE_COPY.archived, archiveNoteDetail: null };
    case 'rejected':
      return { ...base, archiveNote: ARCHIVE_COPY.errorFlagged, archiveNoteDetail: null };
    case 'failed':
      return {
        ...base,
        archiveNote: ARCHIVE_COPY.errorTitle,
        archiveNoteDetail: result.archive.lastErrorCode ?? 'archive_unavailable',
      };
    case 'pending':
      return { ...base, archiveNote: ARCHIVE_COPY.queued, archiveNoteDetail: ARCHIVE_COPY.queuedDetail };
  }
}

// ---------------------------------------------------------------------------
// Moderation-at-scale (Plan 19 §9 / §10 P8): the owner "Public reports" queue +
// the real Unpublish action. All seams (fetch, WebSocket, the engine fns) are
// injected so the screen runs the real path and the tests/e2e drive the SAME
// function against live servers (TC-8). No simulation: a report is fetched with a
// real owner-signed GET; an unpublish re-registers the signed UNPUBLISHED revision
// on each host (so it 404s) AND re-announces it to the directory (so it drops from
// browse/trending), exactly mirroring the P8a relay e2e wire.
// ---------------------------------------------------------------------------

/** Verbatim §9 owner-moderation copy. Honest: never claims removal that did not happen. */
export const PUBLIC_REPORTS_COPY = {
  sectionTitle: 'Public reports',
  hint: 'Reports filed by readers against your published content, fetched from the host.',
  loading: 'Loading public reports from the host…',
  empty: 'No public reports for your published content.',
  unreachable: 'Could not reach a host to load public reports.',
  noHosts: 'No serving host is configured for this publication.',
  priorityBadge: 'Priority',
  reviewedAction: 'Reviewed',
  unpublishAction: 'Unpublish',
  // Unpublish result copy. Honest: the wording reflects exactly what propagated.
  unpublishedFull: 'Unpublished. Removed from the directory and every serving host.',
  unpublishedPartial: 'Unpublished. Removed from the directory and some serving hosts; the rest stop serving once they apply the unpublished revision.',
  unpublishedDirectoryOnly: 'Removed from the public directory. No serving host confirmed removal; it stops being served when each host applies the unpublished revision.',
  unpublishedHostsOnly: 'Removed from the serving host(s). The public directory was not reachable, so it may still appear in browse until it is re-announced.',
  unpublishFailed: 'Could not unpublish. No serving host or the directory accepted the unpublished revision.',
  alreadyUnpublished: 'This publication is already unpublished.',
  notOwner: 'Only the owner can unpublish this publication.',
  cannotReconstruct: 'Could not rebuild the signed publication to unpublish it.',
} as const;

/** A publication this device OWNS (owner_device_id === identity.publicKey). */
export interface OwnedPublication {
  publicationId: string;
  communityId: string;
  channelId: string | null;
  title: string;
  category: PublicCategory;
  status: string;
  /** Reachable serving hosts the publication was registered against. */
  hostUrls: string[];
}

interface PublicationRow {
  publication_id: string;
  community_id: string;
  channel_id: string | null;
  post_id: string | null;
  kind: PublicationKind;
  title: string;
  description: string;
  category: PublicCategory;
  owner_device_id: string;
  content_id: string;
  public_key_hex: string;
  host_urls: string;
  revision: number;
  status: string;
  join_policy: PublicationJoinPolicy;
  signature_hex: string;
  /** Canonical JSON of the signed rights block (Plan 19 P9.3e); null when rights-less. */
  rights_json: string | null;
  /** Canonical JSON of the signed public-join grant (Plan 19 FF3); null when not advertised. */
  public_join_json: string | null;
  /** The signed posting policy (Plan 39 P4); null when absent (view_only fail-closed). */
  post_policy: string | null;
  /** The signed pinned node receipt key (Plan 39 P4); null when absent. */
  post_node_key_hex: string | null;
  created_at: string;
  updated_at: string;
}

function parseHostUrlsJson(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * List the publications this device owns, newest first. Pass a communityId to
 * scope the list to one community (the owner-review panel renders per community).
 */
export function listOwnedPublications(
  db: DatabaseAdapter,
  ownerDeviceId: string,
  communityId?: string,
): OwnedPublication[] {
  const rows = communityId
    ? db.query<PublicationRow>(
        `SELECT * FROM cm_publications WHERE owner_device_id = ? AND community_id = ? ORDER BY updated_at DESC`,
        [ownerDeviceId, communityId],
      )
    : db.query<PublicationRow>(
        `SELECT * FROM cm_publications WHERE owner_device_id = ? ORDER BY updated_at DESC`,
        [ownerDeviceId],
      );
  return rows.map((r) => ({
    publicationId: r.publication_id,
    communityId: r.community_id,
    channelId: r.channel_id,
    title: r.title,
    category: r.category,
    status: r.status,
    hostUrls: parseHostUrlsJson(r.host_urls),
  }));
}

/**
 * Reconstruct the SIGNED descriptor at the row's CURRENT revision from a persisted
 * cm_publications row, so unpublishPublicly can sign a TERMINAL takedown chained at
 * row.revision + 1 (Plan 19 FF1). A genesis (revision 1) reconstructs byte-exact and
 * self-verifies 'ok'. A revised row (revision > 1) CANNOT self-verify standalone --
 * the prior link's hash is not stored and verifyPublication requires the predecessor
 * to chain a revision -- so it is returned WITHOUT the standalone verify, previousHash
 * null. That is safe because the ONLY caller (unpublishPublicly) uses this solely as
 * the `previous` input to unpublish(), which reads the descriptor fields and signs a
 * FRESH owner takedown at revision + 1. The directory + serving host accept that
 * takedown via verifyOwnerTakedown, which is owner-authenticated and IGNORES
 * previousHash (a terminal takedown is idempotent, so chain adjacency is not load-
 * bearing -- only the owner signature is). Returns null only when a genesis row fails
 * its own owner-signature self-check (field drift).
 */
function reconstructGenesis(row: PublicationRow): SignedPublicationDescriptor | null {
  const signed: SignedPublicationDescriptor = {
    descriptor: {
      version: 1,
      publicationId: row.publication_id,
      kind: row.kind,
      communityId: row.community_id,
      channelId: row.channel_id,
      postId: row.post_id,
      title: row.title,
      description: row.description,
      category: row.category,
      ownerDeviceId: row.owner_device_id,
      contentId: row.content_id,
      publicKeyHex: row.public_key_hex,
      hostUrls: parseHostUrlsJson(row.host_urls),
      revision: row.revision,
      // The prior link's hash is not persisted. verifyOwnerTakedown (the terminal
      // verifier the directory + host use) ignores previousHash, so null is correct
      // at any revision here; a genesis is previousHash null by definition.
      previousHash: null,
      status: row.status as SignedPublicationDescriptor['descriptor']['status'],
      joinPolicy: row.join_policy,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    signature: row.signature_hex,
  };
  // Re-attach the signed rights block from cm_publications.rights_json (NOT the
  // device_local cm_publication_rights mirror, which does not replicate), so a
  // rights-bearing descriptor reconstructs byte-exact at ANY revision -- canonicalDescriptor
  // reads a fixed [license, rightsAssertion, provenance, consentAt] tuple, so key
  // order is irrelevant. A corrupt cache is ignored (a rights-less reconstruction
  // still self-verifies for rights-less publications).
  if (row.rights_json != null) {
    try {
      const rights = JSON.parse(row.rights_json) as PublicationRights;
      if (rights && typeof rights === 'object') signed.descriptor.rights = rights;
    } catch {
      // Ignore a corrupt rights cache; the genesis self-check below catches drift.
    }
  }
  // Re-attach the signed public-join grant from cm_publications.public_join_json (FF3) so a
  // grant-bearing descriptor reconstructs byte-exact at ANY revision, mirroring rights above:
  // canonicalDescriptor appends the grant tag ONLY when present, so an owner takedown of an
  // ADVERTISED publication self-verifies. A corrupt cache is ignored (a grant-less reconstruction
  // still self-verifies for grant-less publications).
  if (row.public_join_json != null) {
    try {
      const publicJoin = JSON.parse(row.public_join_json) as PublicJoinGrant;
      if (publicJoin && typeof publicJoin === 'object') signed.descriptor.publicJoin = publicJoin;
    } catch {
      // Ignore a corrupt grant cache; the genesis self-check below catches drift.
    }
  }
  // Plan 39 P4: re-attach the signed posting policy + pinned node receipt key,
  // mirroring rights/publicJoin above (tagged conditional appends: present iff
  // stored, so a policy-less reconstruction stays byte-exact for legacy rows).
  if (row.post_policy != null) signed.descriptor.postPolicy = row.post_policy;
  if (row.post_node_key_hex != null) signed.descriptor.postNodeKeyHex = row.post_node_key_hex;
  // A genesis (revision 1) is byte-exact: if field drift breaks the owner signature,
  // bail rather than chain a takedown the host would reject. A revision > 1 cannot
  // self-verify standalone (its predecessor is not stored), so return it as-is for
  // unpublishPublicly to chain a fresh owner-signed takedown off.
  if (row.revision === 1) return verifyPublication(signed) === 'ok' ? signed : null;
  return signed;
}

/**
 * Reconstruct the SIGNED descriptor at a publication's CURRENT stored revision
 * (Plan 19 FF3), for approvePublicJoinRequest's `publication` input. Reuses the
 * same reconstruction reconstructGenesis already does for unpublishPublicly, but
 * exposed for a caller that needs the CURRENT descriptor (not a takedown-chain
 * input): the engine re-verifies the owner SIGNATURE over whatever is returned
 * here (verifyPublicationOwnerSignature, revision-agnostic), so returning the row
 * as-is at any revision is correct. Returns null only when no row exists for
 * publicationId, or (at revision 1) the row fails its own genesis self-check.
 */
export function getCurrentPublicationDescriptor(
  db: DatabaseAdapter,
  publicationId: string,
): SignedPublicationDescriptor | null {
  const rows = db.query<PublicationRow>(
    `SELECT * FROM cm_publications WHERE publication_id = ?`,
    [publicationId],
  );
  const row = rows[0];
  if (!row) return null;
  return reconstructGenesis(row);
}

interface SnapshotRow {
  channel_id: string;
  epoch: number;
  manifest_json: string;
  pieces_json: string;
}

interface StoredSnapshot {
  channelId: string;
  epoch: number;
  manifest: ContentManifest;
  pieces: string[];
}

/** Persist an owned publication's published snapshot pieces (base64) + manifest. */
function persistPublicationSnapshot(
  db: DatabaseAdapter,
  publicationId: string,
  channelId: string,
  epoch: number,
  manifest: ContentManifest,
  pieces: string[],
  now: string,
): void {
  db.execute(
    `INSERT OR REPLACE INTO cm_publication_snapshots (
      publication_id, channel_id, epoch, manifest_json, pieces_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [publicationId, channelId, epoch, JSON.stringify(manifest), JSON.stringify(pieces), now],
  );
}

/** Load an owned publication's persisted snapshots (empty when none were kept). */
function loadPublicationSnapshots(db: DatabaseAdapter, publicationId: string): StoredSnapshot[] {
  const rows = db.query<SnapshotRow>(
    `SELECT channel_id, epoch, manifest_json, pieces_json FROM cm_publication_snapshots WHERE publication_id = ?`,
    [publicationId],
  );
  const out: StoredSnapshot[] = [];
  for (const row of rows) {
    try {
      const manifest = JSON.parse(row.manifest_json) as ContentManifest;
      const pieces = JSON.parse(row.pieces_json) as string[];
      if (Array.isArray(pieces)) out.push({ channelId: row.channel_id, epoch: row.epoch, manifest, pieces });
    } catch {
      // Skip a corrupt local snapshot row; directory removal still proceeds.
    }
  }
  return out;
}

// -------- Owner Public-reports queue (the §9 owner-fetch GET) -----------------

/** One host-intake report, owner-fetched: the signed report + a priority flag. */
export interface OwnerPublicReport {
  report: PublicAbuseReport;
  signature: string;
  /** csam/illegal are priority (recomputed locally via isPriorityPublicReport). */
  priority: boolean;
}

export type OwnerReportsResult =
  | { ok: true; reports: OwnerPublicReport[] }
  | { ok: false; reason: 'no_hosts' | 'unreachable' };

interface ReportsWireBody {
  reports?: Array<{ report?: PublicAbuseReport; signature?: string; priority?: boolean }>;
}

export interface OwnerReportsDeps {
  createPublicReportFetchSignature: typeof createPublicReportFetchSignature;
  isPriorityPublicReport: typeof isPriorityPublicReport;
  fetchFn: typeof fetch;
  now: () => string;
}

const DEFAULT_OWNER_REPORTS_DEPS: OwnerReportsDeps = {
  createPublicReportFetchSignature,
  isPriorityPublicReport,
  fetchFn: (globalThis.fetch?.bind(globalThis) as typeof fetch),
  now: () => new Date().toISOString(),
};

function comparePriorityThenRecency(a: OwnerPublicReport, b: OwnerPublicReport): number {
  if (a.priority !== b.priority) return a.priority ? -1 : 1;
  if (a.report.reportedAt !== b.report.reportedAt) return a.report.reportedAt < b.report.reportedAt ? 1 : -1;
  return 0;
}

/**
 * Fetch the host-stored reports for an OWNED publication, proving ownership with an
 * Ed25519 signature over a canonical (publicationId, ts). Tries each serving host in
 * turn; the first HTTP 200 wins. Reports are returned priority-first (csam/illegal),
 * then most recent. Honest failure: no hosts -> no_hosts; every host failing or a
 * non-200 -> unreachable. Priority is recomputed locally, never trusted from the wire.
 */
export async function fetchOwnerPublicReports(
  input: { identity: DeviceIdentity; publicationId: string; hostUrls: string[] },
  overrides: Partial<OwnerReportsDeps> = {},
): Promise<OwnerReportsResult> {
  const deps = { ...DEFAULT_OWNER_REPORTS_DEPS, ...overrides };
  const hosts = input.hostUrls.map(trimHost).filter((h) => h.length > 0 && /^https?:\/\//i.test(h));
  if (hosts.length === 0) return { ok: false, reason: 'no_hosts' };
  const ts = deps.now();
  const sig = deps.createPublicReportFetchSignature(input.identity, input.publicationId, ts);
  for (const base of hosts) {
    try {
      const res = await deps.fetchFn(`${base}/public/${encodeURIComponent(input.publicationId)}/reports`, {
        method: 'GET',
        headers: { 'x-mk-ts': ts, 'x-mk-owner-sig': sig },
      });
      if (res.status !== 200) continue;
      const body = (await res.json()) as ReportsWireBody;
      const reports: OwnerPublicReport[] = [];
      for (const rec of body.reports ?? []) {
        if (!rec?.report || typeof rec.signature !== 'string') continue;
        reports.push({
          report: rec.report,
          signature: rec.signature,
          priority: deps.isPriorityPublicReport(rec.report),
        });
      }
      reports.sort(comparePriorityThenRecency);
      return { ok: true, reports };
    } catch {
      // try the next host
    }
  }
  return { ok: false, reason: 'unreachable' };
}

// -------- Local "Reviewed" markers for host-intake reports --------------------

interface ReviewSigRow { report_sig: string }

/** Mark a host-intake report reviewed locally (keyed by its Ed25519 signature). */
export function markPublicReportReviewed(
  db: DatabaseAdapter,
  publicationId: string,
  reportSig: string,
  now: string = new Date().toISOString(),
): void {
  db.execute(
    `INSERT OR REPLACE INTO cm_public_report_reviews (report_sig, publication_id, reviewed_at)
     VALUES (?, ?, ?)`,
    [reportSig, publicationId, now],
  );
}

/** The set of report signatures the owner has already reviewed for a publication. */
export function listReviewedReportSigs(db: DatabaseAdapter, publicationId: string): Set<string> {
  const rows = db.query<ReviewSigRow>(
    `SELECT report_sig FROM cm_public_report_reviews WHERE publication_id = ?`,
    [publicationId],
  );
  return new Set(rows.map((r) => r.report_sig));
}

// -------- The real Unpublish action ------------------------------------------

export interface UnpublishHostResult {
  url: string;
  /** True only on a real HTTP 200 register of the unpublished revision. */
  removed: boolean;
  status: number;
  reason?: string;
}

export interface UnpublishResult {
  ok: boolean;
  reason?: 'not_found' | 'not_owner' | 'already_unpublished' | 'cannot_reconstruct';
  /** Honest headline reflecting exactly what propagated. */
  message: string;
  publicationId: string;
  /** True only after the directory accepted the unpublished re-announce. */
  directoryRemoved: boolean;
  hosts: UnpublishHostResult[];
  removedHosts: number;
}

/** Injectable WebSocket constructor (defaults to the global one), shared with publish. */
export interface UnpublishDeps {
  unpublish: typeof unpublish;
  announceHost: typeof announceHost;
  deriveCategoryRid: typeof deriveCategoryRid;
  fetchFn: typeof fetch;
  webSocketImpl?: DirectoryWebSocket;
  now: () => string;
}

const DEFAULT_UNPUBLISH_DEPS: UnpublishDeps = {
  unpublish,
  announceHost,
  deriveCategoryRid,
  fetchFn: (globalThis.fetch?.bind(globalThis) as typeof fetch),
  now: () => new Date().toISOString(),
};

interface UnpublishInput {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  publicationId: string;
  /** The public-directory host to re-announce the unpublished revision to. */
  directoryUrl: string;
}

/** Re-register an unpublished revision on one host; removed === HTTP 200. */
async function reregisterUnpublished(
  fetchFn: typeof fetch,
  host: string,
  publicationId: string,
  body: RegisterBody,
): Promise<UnpublishHostResult> {
  const base = trimHost(host);
  if (!base) return { url: host, removed: false, status: 0, reason: 'bad_host_url' };
  try {
    const res = await fetchFn(`${base}/public/${encodeURIComponent(publicationId)}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 200) return { url: host, removed: true, status: 200 };
    let reason: string | undefined;
    try {
      const json = (await res.json()) as { reason?: string };
      reason = typeof json?.reason === 'string' ? json.reason : undefined;
    } catch {
      reason = undefined;
    }
    return { url: host, removed: false, status: res.status, reason };
  } catch {
    return { url: host, removed: false, status: 0, reason: 'network_error' };
  }
}

function unpublishMessage(directoryRemoved: boolean, removedHosts: number, totalHosts: number): string {
  if (removedHosts > 0 && removedHosts === totalHosts && directoryRemoved) return PUBLIC_REPORTS_COPY.unpublishedFull;
  if (removedHosts > 0 && directoryRemoved) return PUBLIC_REPORTS_COPY.unpublishedPartial;
  if (removedHosts > 0 && !directoryRemoved) return PUBLIC_REPORTS_COPY.unpublishedHostsOnly;
  if (directoryRemoved) return PUBLIC_REPORTS_COPY.unpublishedDirectoryOnly;
  return PUBLIC_REPORTS_COPY.unpublishFailed;
}

/**
 * Unpublish an OWNED publication for real. Loads the genesis from the persisted
 * cm_publications row, signs the chained UNPUBLISHED revision with the owner key,
 * re-registers it (with the stored snapshot pieces, so the host's content check
 * passes) on every serving host (the host then 404s), and re-announces the
 * unpublished revision to the directory via the raw announce verb (so
 * recordUnpublish drops it from browse/trending). The local row is moved to
 * 'unpublished'. The result reflects EXACTLY what propagated; nothing is faked.
 */
export async function unpublishPublicly(
  overrides: Partial<UnpublishDeps>,
  input: UnpublishInput,
): Promise<UnpublishResult> {
  const deps = { ...DEFAULT_UNPUBLISH_DEPS, ...overrides };
  const { db, identity, publicationId } = input;

  const rows = db.query<PublicationRow>(
    `SELECT * FROM cm_publications WHERE publication_id = ?`,
    [publicationId],
  );
  const row = rows[0];
  if (!row) {
    return { ok: false, reason: 'not_found', message: PUBLIC_REPORTS_COPY.unpublishFailed, publicationId, directoryRemoved: false, hosts: [], removedHosts: 0 };
  }
  if (row.owner_device_id !== identity.publicKey) {
    return { ok: false, reason: 'not_owner', message: PUBLIC_REPORTS_COPY.notOwner, publicationId, directoryRemoved: false, hosts: [], removedHosts: 0 };
  }
  if (row.status !== 'active') {
    return { ok: false, reason: 'already_unpublished', message: PUBLIC_REPORTS_COPY.alreadyUnpublished, publicationId, directoryRemoved: false, hosts: [], removedHosts: 0 };
  }
  const genesis = reconstructGenesis(row);
  if (!genesis) {
    return { ok: false, reason: 'cannot_reconstruct', message: PUBLIC_REPORTS_COPY.cannotReconstruct, publicationId, directoryRemoved: false, hosts: [], removedHosts: 0 };
  }

  const now = deps.now();
  const pulled = deps.unpublish(identity, genesis, now);

  // Re-register the unpublished revision on each host WITH the stored snapshot
  // pieces (the host's register route requires the descriptor's contentId among
  // the supplied snapshots). When no local snapshot was kept, the host cannot be
  // made to 404 from here; the directory removal below still applies.
  const snapshots = loadPublicationSnapshots(db, publicationId);
  const hostUrls = parseHostUrlsJson(row.host_urls);
  const hosts: UnpublishHostResult[] = [];
  if (snapshots.length > 0) {
    const body: RegisterBody = {
      descriptor: pulled,
      snapshots: snapshots.map((s) => ({ channelId: s.channelId, epoch: s.epoch, manifest: s.manifest, pieces: s.pieces })),
    };
    for (const host of hostUrls) {
      hosts.push(await reregisterUnpublished(deps.fetchFn, host, publicationId, body));
    }
  } else {
    for (const host of hostUrls) {
      hosts.push({ url: host, removed: false, status: 0, reason: 'no_local_snapshot' });
    }
  }
  const removedHosts = hosts.filter((h) => h.removed).length;

  // Re-announce the unpublished revision to the directory via the RAW announce
  // verb under the publication's category rid. announcePublication REFUSES a
  // non-active descriptor, so this uses the lower-level announceHost (same wire as
  // the P8a e2e), and the directory's recordUnpublish removes it from browse.
  let directoryRemoved = false;
  if (trimHost(input.directoryUrl)) {
    try {
      await deps.announceHost({
        url: input.directoryUrl,
        rid: deps.deriveCategoryRid(genesis.descriptor.category),
        record: JSON.stringify(pulled),
        webSocketImpl: deps.webSocketImpl as never,
      });
      directoryRemoved = true;
    } catch {
      directoryRemoved = false;
    }
  }

  // Move the local row to 'unpublished' (revision/signature follow the pulled
  // revision) so the owner's own state matches what it just propagated.
  persistPublicationRow(db, pulled, now);

  return {
    ok: directoryRemoved || removedHosts > 0,
    message: unpublishMessage(directoryRemoved, removedHosts, hostUrls.length),
    publicationId,
    directoryRemoved,
    hosts,
    removedHosts,
  };
}
