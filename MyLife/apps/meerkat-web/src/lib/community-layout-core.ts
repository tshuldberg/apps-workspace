// Composition plan 2.2: resolveActiveLayout, the ONE pure choke point that
// decides which composition renders for a community's surfaces. This is the
// WEB twin of apps/meerkat/app/(root)/data/community-layout-core.ts,
// byte-identical below the header (only this header differs), parity-locked by
// scripts/check-meerkat-parity.mjs (CORE_TWINS).
//
// Resolution (mirrors resolveActiveTheme's fail-safe discipline):
//   1. a VERIFIED owner-signed cm_layout event whose blob decodes through the
//      @mylife/meerkat-layout codec -> the composed layout document;
//   2. anything else (no event, tombstone, malformed/undecodable blob) ->
//      fail SAFE to the legacy rendering (communityLayout()'s
//      chat_first/library_first surfaces), never a broken screen.
// Per-node degradation is the registry's job: a malformed or unknown block
// node inside a VALID document renders the honest BlockPlaceholder alone
// (composition 2.2), never fails the whole document.
//
// Non-removable floors (composition 2.4), enforced by the HOSTS that render a
// resolved layout, asserted by tests on both surfaces: every community always
// exposes its channel list and settings OUTSIDE the block stack, and any block
// presenting ranked content always renders the ranking picker with
// 'chronological' present. A layout document cannot hide the honesty surfaces.

import { decodeLayoutBlob, type MkBlockNode, type MkLayoutDocument } from '@mylife/meerkat-layout';
import type { CommunityLayout, CommunityLayoutEvent } from '@mylife/sync';
import { resolveCommunityLayout } from '@mylife/sync';
import {
  BLOCK_REGISTRY,
  DEFAULT_KIND_BLOCKS,
  isKnownBlockType,
  resolveBlockAvailability,
  validateBlockConfig,
  type BlockAvailability,
  type BlockChannelKind,
  type BlockRuntime,
} from './block-registry-core';

/** Which rule produced the active layout (drives honest labels + tests). */
export type ActiveLayoutSource = 'layout_document' | 'legacy';

export interface ResolveActiveLayoutInput {
  /** All parseable cm_layout events stored for this community. */
  events: readonly CommunityLayoutEvent[];
  /** The stored descriptor's ownerDeviceId (the verification anchor). */
  ownerDeviceId: string;
  /** The descriptor's legacy presentation (communityLayout()), the fail-safe. */
  legacyLayout: CommunityLayout;
}

export type ResolveActiveLayoutResult =
  | { source: 'layout_document'; document: MkLayoutDocument; revision: number }
  | { source: 'legacy'; legacyLayout: CommunityLayout };

/**
 * The single layout choke point. Pure and TOTAL: it never throws, and a
 * missing/tombstoned/malformed layout fails SAFE to the legacy rendering.
 */
export function resolveActiveLayout(input: ResolveActiveLayoutInput): ResolveActiveLayoutResult {
  const legacy = { source: 'legacy' as const, legacyLayout: input.legacyLayout };
  const winner = resolveCommunityLayout(input.events, input.ownerDeviceId);
  if (!winner || winner.layoutBlob === null) return legacy;
  const decoded = decodeLayoutBlob(winner.layoutBlob);
  if (!decoded.success) return legacy;
  return { source: 'layout_document', document: decoded.layout, revision: winner.revision };
}

/**
 * One placed block, resolved for rendering: config parsed against the block's
 * contract and availability computed against the declared capabilities + real
 * runtime. A node that fails any step carries its honest degraded state; the
 * surrounding stack renders unaffected (per-node fail-safe).
 */
export interface ResolvedBlockNode {
  type: string;
  /** Parsed config when renderable; null when the node degrades. */
  config: Record<string, unknown> | null;
  availability: BlockAvailability;
  /** True only when the renderer map should mount the real block component. */
  renderable: boolean;
}

function resolveNode(
  node: MkBlockNode,
  declaredCapabilities: readonly string[],
  runtime: BlockRuntime,
): ResolvedBlockNode {
  const availability = resolveBlockAvailability(node.type, declaredCapabilities, runtime);
  if (availability.status !== 'available') {
    return { type: node.type, config: null, availability, renderable: false };
  }
  const parse = validateBlockConfig(node.type, node.config);
  if (parse.status !== 'ok') {
    // A known-but-malformed config degrades to the unknown-type placeholder
    // copy; it is still per-node, never whole-screen.
    return { type: node.type, config: null, availability: { status: 'unknown_type' }, renderable: false };
  }
  return { type: node.type, config: parse.config, availability, renderable: true };
}

/** Resolve a raw block stack for rendering (per-node fail-safe). */
export function resolveBlockStack(
  nodes: readonly MkBlockNode[],
  declaredCapabilities: readonly string[],
  runtime: BlockRuntime,
): ResolvedBlockNode[] {
  return nodes.map((node) => resolveNode(node, declaredCapabilities, runtime));
}

/**
 * The block stack for a channel: the layout document's per-channel override
 * when one exists, else the kind's default stack (composition 3), else null
 * when the kind has no block contract ('chat' and 'library' keep their
 * dedicated surfaces; 'unknown' renders the existing read-only banner).
 */
export function channelBlockStack(
  document: MkLayoutDocument | null,
  channelId: string,
  kind: string,
): MkBlockNode[] | null {
  const override = document?.channels[channelId];
  if (override && override.length > 0) return [...override];
  if ((DEFAULT_KIND_BLOCKS as Record<string, unknown>)[kind]) {
    return DEFAULT_KIND_BLOCKS[kind as BlockChannelKind].map((node) => ({
      type: node.type,
      config: { ...node.config },
    }));
  }
  return null;
}

/**
 * Editor-side structural check for a draft document: every node's type/config
 * validated, per-surface placement checked. Returns the list of human-readable
 * problems (empty = publishable). The codec's schema remains the hard
 * boundary; this adds the registry-aware checks the codec cannot know.
 */
export function draftLayoutProblems(document: MkLayoutDocument): string[] {
  const problems: string[] = [];
  const check = (nodes: readonly MkBlockNode[], surface: 'home' | 'channel', where: string) => {
    for (const node of nodes) {
      if (!isKnownBlockType(node.type)) {
        // Unknown types are allowed in a stored document (forward compat) but
        // the editor should not let the owner PLACE one from this build.
        problems.push(`${where}: "${node.type}" is not a block this build can place.`);
        continue;
      }
      const parse = validateBlockConfig(node.type, node.config);
      if (parse.status !== 'ok') {
        problems.push(`${where}: "${node.type}" has invalid settings.`);
      }
      const allowed = validateBlockSurface(node.type, surface);
      if (!allowed) {
        problems.push(`${where}: "${node.type}" cannot be placed on the ${surface} surface.`);
      }
    }
  };
  check(document.home, 'home', 'Home');
  for (const [channelId, nodes] of Object.entries(document.channels)) {
    check(nodes, 'channel', `Channel ${channelId}`);
  }
  return problems;
}

function validateBlockSurface(type: string, surface: 'home' | 'channel'): boolean {
  if (!isKnownBlockType(type)) return false;
  const contract = BLOCK_REGISTRY[type].surfaces;
  return contract === 'both' || contract === surface;
}
