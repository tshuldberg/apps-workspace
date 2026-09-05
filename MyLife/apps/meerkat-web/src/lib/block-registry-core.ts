// Composition plan 2.1: the block registry, the generalization of
// MEDIA_TYPE_REGISTRY. This is the WEB twin of
// apps/meerkat/app/(root)/data/block-registry-core.ts, byte-identical below
// the header (only this header differs), parity-locked by scripts/check-meerkat-parity.mjs.
//
// A block type resolves through an in-code registry map (zod configSchema +
// declared data sources + capability gates per entry). Adding a block is a
// one-file entry -- NOT schema-as-data, NOT a plugin framework, no dynamic
// code loading. Renderers stay OUT of this core (they touch native modules):
// per-surface renderer maps live in components/blocks/registry.tsx (mobile)
// and src/ui/blocks/registry.tsx (web), keyed by block type. An UNKNOWN block
// type, a failed config parse, or a capability-ungated block fails SAFE to the
// honest BlockPlaceholder -- per block, never whole-screen.
//
// Sandbox rule (enforced by block-data-scope.test.ts on both surfaces): a
// block renderer receives ONLY query functions for the tables its contract
// declares in dataSources. Blocks never fetch the network directly; the embed
// block's consent gate is the single sanctioned exception (composition 9).

import { z } from 'zod';

/** Capabilities a community owner can declare ON in the layout document (2.3). */
export const CAPABILITY_KEYS = [
  'video',
  'live',
  'shortform',
  'store',
  'tiers',
  'embeds',
  'offline_download',
] as const;
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

/** Human labels for capabilities (owner settings + honest pending copy). */
export const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  video: 'Video',
  live: 'Live stage',
  shortform: 'Short videos',
  store: 'Storefront',
  tiers: 'Membership tiers',
  embeds: 'Link embeds',
  offline_download: 'Offline downloads',
};

/**
 * The honest line shown when a capability is DECLARED by the owner but this
 * build's runtime cannot deliver it (composition 2.3: declared is never
 * available). Copy never claims a capability the runtime cannot deliver.
 */
export const CAPABILITY_UNAVAILABLE_COPY: Record<CapabilityKey, string> = {
  video: 'Video is enabled here, but playback needs the full app build.',
  live: 'Live stage is enabled here, but this build has no room server configured.',
  shortform: 'Short videos are enabled here, but playback needs the full app build.',
  store: 'The storefront is enabled here, but this build has no billing service configured.',
  tiers: 'Membership tiers are enabled here, but this build has no billing service configured.',
  embeds: 'Link embeds are enabled here, but this build cannot show them yet.',
  offline_download: 'Offline downloads are enabled here, but this build cannot run them yet.',
};

export type BlockSurface = 'home' | 'channel' | 'both';

/**
 * Channel kinds that resolve to a default block stack (composition 3). 'chat'
 * and 'library' keep their existing dedicated surfaces; the rest are new kind
 * VALUES riding the signed kind slot (old clients render the read-only
 * unknown-kind banner, correction 1.1).
 */
export const BLOCK_CHANNEL_KINDS = [
  'video',
  'live',
  'shortform',
  'forum',
  'timeline',
  'gallery',
  'store',
  'events',
  'page',
] as const;
export type BlockChannelKind = (typeof BLOCK_CHANNEL_KINDS)[number];

export interface BlockContract {
  /** Per-block config carried in the layout document (strict, closed). */
  readonly configSchema: z.ZodType<Record<string, unknown>>;
  /** Exact cm_/mk_ tables this block's renderer may read (block-data-scope test). */
  readonly dataSources: readonly string[];
  /** Capability-manifest gates: every listed key must be declared AND available. */
  readonly requires: readonly CapabilityKey[];
  readonly surfaces: BlockSurface;
  /** Set when this block is the view contract for a channel kind. */
  readonly channelKind?: BlockChannelKind;
  /** Unknown/ungated blocks render a safe honest card, never an error. */
  readonly fallback: 'placeholder';
  /** Human label (editor palette + placeholder copy). */
  readonly label: string;
}

export const KNOWN_BLOCK_TYPES = [
  'hero',
  'chat',
  'posts',
  'timeline',
  'gallery',
  'video_gallery',
  'video_player',
  'live_stage',
  'shortform_pager',
  'files',
  'store',
  'tiers',
  'embed',
  'events',
  'page',
  'members',
] as const;
export type KnownBlockType = (typeof KNOWN_BLOCK_TYPES)[number];

/** Bounded, network-incapable config primitives. NO field may carry a URL. */
const BoundedText = z.string().max(280);
const BoundedBody = z.string().max(4000);
const ChannelRef = z.string().min(1).max(128);
const LibraryRef = z.string().min(1).max(128);
const ItemRef = z.string().min(1).max(128);

export const BLOCK_REGISTRY: Record<KnownBlockType, BlockContract> = {
  hero: {
    label: 'Hero',
    configSchema: z.object({
      title: BoundedText.optional(),
      subtitle: BoundedText.optional(),
      /** Renders the community's signature-verified banner/icon, never a URL. */
      showBanner: z.boolean().optional(),
    }).strict(),
    dataSources: ['cm_community_identity'],
    requires: [],
    surfaces: 'home',
    fallback: 'placeholder',
  },
  chat: {
    label: 'Chat',
    configSchema: z.object({ channelId: ChannelRef.optional() }).strict(),
    dataSources: ['cm_messages', 'cm_message_attachments', 'cm_reactions', 'cm_profiles', 'cm_read_state'],
    requires: [],
    surfaces: 'both',
    fallback: 'placeholder',
  },
  posts: {
    label: 'Posts',
    configSchema: z.object({ channelId: ChannelRef.optional() }).strict(),
    dataSources: ['cm_posts', 'cm_messages', 'cm_post_tags', 'cm_post_lifecycle', 'cm_profiles'],
    requires: [],
    surfaces: 'both',
    channelKind: 'forum',
    fallback: 'placeholder',
  },
  timeline: {
    label: 'Timeline',
    configSchema: z.object({ channelId: ChannelRef.optional() }).strict(),
    dataSources: ['cm_posts', 'cm_messages', 'cm_profiles'],
    requires: [],
    surfaces: 'both',
    channelKind: 'timeline',
    fallback: 'placeholder',
  },
  gallery: {
    label: 'Gallery',
    configSchema: z.object({
      channelId: ChannelRef.optional(),
      libraryId: LibraryRef.optional(),
    }).strict(),
    dataSources: ['cm_libraries', 'cm_library_items'],
    requires: [],
    surfaces: 'both',
    channelKind: 'gallery',
    fallback: 'placeholder',
  },
  video_gallery: {
    label: 'Video gallery',
    configSchema: z.object({
      channelId: ChannelRef.optional(),
      libraryId: LibraryRef.optional(),
    }).strict(),
    dataSources: ['cm_libraries', 'cm_library_items', 'cm_library_progress'],
    requires: ['video'],
    surfaces: 'both',
    channelKind: 'video',
    fallback: 'placeholder',
  },
  video_player: {
    label: 'Video player',
    configSchema: z.object({ itemId: ItemRef.optional() }).strict(),
    dataSources: ['cm_library_items', 'cm_library_progress'],
    requires: ['video'],
    surfaces: 'both',
    fallback: 'placeholder',
  },
  live_stage: {
    label: 'Live stage',
    configSchema: z.object({ channelId: ChannelRef.optional() }).strict(),
    dataSources: ['cm_messages', 'cm_profiles'],
    requires: ['live'],
    surfaces: 'both',
    channelKind: 'live',
    fallback: 'placeholder',
  },
  shortform_pager: {
    label: 'Short videos',
    configSchema: z.object({ channelId: ChannelRef.optional() }).strict(),
    dataSources: ['cm_libraries', 'cm_library_items', 'cm_posts', 'cm_messages'],
    requires: ['shortform'],
    surfaces: 'both',
    channelKind: 'shortform',
    fallback: 'placeholder',
  },
  files: {
    label: 'Files',
    configSchema: z.object({ channelId: ChannelRef.optional() }).strict(),
    dataSources: ['cm_messages', 'cm_message_attachments', 'cm_file_requests'],
    requires: [],
    surfaces: 'both',
    fallback: 'placeholder',
  },
  store: {
    label: 'Store',
    configSchema: z.object({}).strict(),
    dataSources: ['cm_store_listings'],
    requires: ['store'],
    surfaces: 'both',
    channelKind: 'store',
    fallback: 'placeholder',
  },
  tiers: {
    label: 'Membership tiers',
    // Tier definitions live in the layout document itself; the block reads none
    // of the synced tables.
    configSchema: z.object({}).strict(),
    dataSources: [],
    requires: ['tiers'],
    surfaces: 'home',
    fallback: 'placeholder',
  },
  embed: {
    label: 'Embed',
    // The embed block renders SENDER-generated verified previews only (NC-2);
    // its consent-gated open flow is the one sanctioned network path
    // (composition 9) and arrives with that phase. No config field is a URL.
    configSchema: z.object({}).strict(),
    dataSources: [],
    requires: ['embeds'],
    surfaces: 'both',
    fallback: 'placeholder',
  },
  events: {
    label: 'Events',
    configSchema: z.object({ channelId: ChannelRef.optional() }).strict(),
    dataSources: ['cm_posts', 'cm_messages', 'cm_profiles'],
    requires: [],
    surfaces: 'both',
    channelKind: 'events',
    fallback: 'placeholder',
  },
  page: {
    label: 'Page',
    configSchema: z.object({
      title: BoundedText.optional(),
      body: BoundedBody.optional(),
    }).strict(),
    dataSources: [],
    requires: [],
    surfaces: 'both',
    channelKind: 'page',
    fallback: 'placeholder',
  },
  members: {
    label: 'Members',
    configSchema: z.object({
      maxShown: z.number().int().min(1).max(50).optional(),
    }).strict(),
    dataSources: ['cm_profiles'],
    requires: [],
    surfaces: 'home',
    fallback: 'placeholder',
  },
};

export function isKnownBlockType(type: string): type is KnownBlockType {
  return Object.prototype.hasOwnProperty.call(BLOCK_REGISTRY, type);
}

/**
 * Editor field descriptors, one per config key (composition 2.4: per-block
 * config sheets are generated from the block's schema; these descriptors are
 * that schema's UI projection, kept adjacent so a schema change updates its
 * editor field in the same file). Kinds: text/multiline (bounded strings),
 * channel (picker over the descriptor's channels), number (bounded integer).
 */
export interface BlockConfigFieldDesc {
  readonly key: string;
  readonly kind: 'text' | 'multiline' | 'channel' | 'number';
  readonly label: string;
  readonly max?: number;
}

export const BLOCK_CONFIG_FIELDS: Record<KnownBlockType, readonly BlockConfigFieldDesc[]> = {
  hero: [
    { key: 'title', kind: 'text', label: 'Title', max: 280 },
    { key: 'subtitle', kind: 'text', label: 'Subtitle', max: 280 },
  ],
  chat: [{ key: 'channelId', kind: 'channel', label: 'Channel' }],
  posts: [{ key: 'channelId', kind: 'channel', label: 'Channel' }],
  timeline: [{ key: 'channelId', kind: 'channel', label: 'Channel' }],
  gallery: [{ key: 'channelId', kind: 'channel', label: 'Channel' }],
  video_gallery: [{ key: 'channelId', kind: 'channel', label: 'Channel' }],
  video_player: [],
  live_stage: [{ key: 'channelId', kind: 'channel', label: 'Channel' }],
  shortform_pager: [{ key: 'channelId', kind: 'channel', label: 'Channel' }],
  files: [{ key: 'channelId', kind: 'channel', label: 'Channel' }],
  store: [],
  tiers: [],
  embed: [],
  events: [{ key: 'channelId', kind: 'channel', label: 'Channel' }],
  page: [
    { key: 'title', kind: 'text', label: 'Title', max: 280 },
    { key: 'body', kind: 'multiline', label: 'Body', max: 4000 },
  ],
  members: [{ key: 'maxShown', kind: 'number', label: 'Members shown', max: 50 }],
};

/**
 * Default block stack per block-backed channel kind (composition 3). The
 * layout document can override per channel; with no override, a channel of
 * this kind renders exactly this stack.
 */
export const DEFAULT_KIND_BLOCKS: Record<BlockChannelKind, ReadonlyArray<{ type: KnownBlockType; config: Record<string, unknown> }>> = {
  video: [{ type: 'video_gallery', config: {} }],
  live: [{ type: 'live_stage', config: {} }, { type: 'chat', config: {} }],
  shortform: [{ type: 'shortform_pager', config: {} }],
  forum: [{ type: 'posts', config: {} }],
  timeline: [{ type: 'timeline', config: {} }],
  gallery: [{ type: 'gallery', config: {} }],
  store: [{ type: 'store', config: {} }],
  events: [{ type: 'events', config: {} }],
  page: [{ type: 'page', config: {} }],
};

export type BlockConfigParse =
  | { status: 'ok'; config: Record<string, unknown> }
  | { status: 'invalid' }
  | { status: 'unknown_type' };

/**
 * Validate a block node's config against its contract. Total: never throws.
 * An unknown type or a failed parse degrades to the placeholder, per node.
 */
export function validateBlockConfig(type: string, config: unknown): BlockConfigParse {
  if (!isKnownBlockType(type)) return { status: 'unknown_type' };
  const parsed = BLOCK_REGISTRY[type].configSchema.safeParse(config ?? {});
  if (!parsed.success) return { status: 'invalid' };
  return { status: 'ok', config: parsed.data };
}

/**
 * Runtime substrate flags, computed by each surface from REAL runtime state
 * (native module presence, configured service URLs), never hardcoded true.
 * A capability missing from the record is treated as unavailable (fail
 * closed): declared is never available (composition 2.3).
 */
export type BlockRuntime = Partial<Record<CapabilityKey, boolean>>;

export type BlockAvailability =
  | { status: 'available' }
  | { status: 'needs_capability'; capability: CapabilityKey }
  | { status: 'declared_unavailable'; capability: CapabilityKey }
  | { status: 'unknown_type' };

/**
 * Two-layer honesty (composition 2.3): DECLARED = the owner turned it on
 * (signed, gossiped); AVAILABLE = declared AND the runtime substrate exists.
 * A block with no capability gates is always available.
 */
export function resolveBlockAvailability(
  type: string,
  declaredCapabilities: readonly string[],
  runtime: BlockRuntime,
): BlockAvailability {
  if (!isKnownBlockType(type)) return { status: 'unknown_type' };
  for (const capability of BLOCK_REGISTRY[type].requires) {
    if (!declaredCapabilities.includes(capability)) {
      return { status: 'needs_capability', capability };
    }
    if (runtime[capability] !== true) {
      return { status: 'declared_unavailable', capability };
    }
  }
  return { status: 'available' };
}

/** The honest placeholder line for a non-available block. Null when available. */
export function blockPlaceholderLine(availability: BlockAvailability): string | null {
  switch (availability.status) {
    case 'available':
      return null;
    case 'unknown_type':
      return 'This community uses a block this build does not support yet.';
    case 'needs_capability': {
      const label = CAPABILITY_LABELS[availability.capability];
      return `This block needs ${label} turned on in community settings.`;
    }
    case 'declared_unavailable':
      return CAPABILITY_UNAVAILABLE_COPY[availability.capability];
  }
}
