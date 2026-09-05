// Plan 56 C1 (3.2): the canvas node registry, the Canvas sibling of
// block-registry-core. This is the WEB twin of
// apps/meerkat/app/(root)/data/canvas-node-registry-core.ts, byte-identical
// below the header (only this header differs), parity-locked by check-meerkat-parity.mjs.
//
// Every node type gets a TOTAL, CLOSED, TYPE-EXACT Zod props schema (F8:
// ProseMirror's CVE was type confusion, not a missing allowlist): unknown keys
// rejected, styling is closed token vocabularies (F2, never CSS strings),
// assets are sealed-share columns on the event (never URLs), and navigation
// targets are in-community ids (never network destinations). An unregistered
// type, a failed parse, or a FUTURE schemaVersion renders the honest
// NodePlaceholder ("A decoration this build does not support yet"), per node,
// never whole-canvas (7.5).
//
// Anti-spoofing floor (7.4): the sticker pipeline EXCLUDES the reserved glyph
// set (locks, shields, checkmarks, official badges) so member content can
// never counterfeit a trust indicator; text nodes render in content
// typography, never chrome typography (guard-tested).

import { z } from 'zod';
import { validateBlockConfig } from './block-registry-core';

export const CANVAS_NODE_TYPES = [
  'text',
  'image',
  'sticker',
  'shape',
  'frame',
  'link_card',
  'guestbook',
  'poll',
  'counter',
  'divider',
  'button_88x31',
  'badge_case',
  'top_friends',
  'milestone',
  'block_embed',
] as const;
export type CanvasNodeType = (typeof CANVAS_NODE_TYPES)[number];

/** The closed behavior vocabulary (3.2/3.3); dispatching is host-owned. */
export const CANVAS_BEHAVIORS = ['none', 'toggle', 'flip', 'counter', 'open', 'reveal'] as const;
export type CanvasBehaviorKey = (typeof CANVAS_BEHAVIORS)[number];

/** What the receiver-side dials key on (3.6). */
export type CanvasReceiverClass = 'static' | 'animated' | 'audio' | 'interactive' | 'external_link';

const ColorToken = z.enum(['text', 'muted', 'accent', 'paper', 'surface', 'success', 'warning', 'danger', 'info']);
const SizeToken = z.enum(['s', 'm', 'l', 'xl']);
// Feature 13: tap behaviors on decorative nodes. Dispatch is host-owned and
// the resulting state is DEVICE-LOCAL (setLocalState, 3.3): a toggle/flip/
// reveal changes only what THIS viewer sees, and replicates nothing.
const TapBehavior = z.enum(['none', 'toggle', 'flip', 'reveal']);

/**
 * Reserved glyphs member stickers may NEVER carry (7.4): anything that reads
 * as a lock, shield, verification check, or official badge. Checked by code
 * point so combined emoji sequences containing one are excluded too.
 */
export const RESERVED_SPOOF_GLYPHS = [
  '\u{1F512}', // locked padlock
  '\u{1F513}', // open padlock
  '\u{1F50F}', // lock with pen
  '\u{1F510}', // lock with key
  '\u{1F6E1}', // shield
  '\u{2705}',  // white heavy check mark
  '\u{2714}',  // heavy check mark
  '\u{2611}',  // ballot box with check
  '\u{1F6C2}', // passport control (official-booth glyph)
  '\u{2696}',  // scales (official/legal)
] as const;

export function containsReservedGlyph(value: string): boolean {
  return RESERVED_SPOOF_GLYPHS.some((glyph) => value.includes(glyph));
}

/** A short emoji sticker value: bounded, no reserved glyph, no control chars. */
const StickerEmoji = z
  .string()
  .min(1)
  .max(16)
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\u0000-\u001f\u007f]+$/, 'No control characters')
  .refine((value) => !containsReservedGlyph(value), 'That glyph is reserved for app trust indicators');

/** An in-community navigation target (3.3 navigate): NEVER a URL. */
const NavigateTarget = z
  .object({
    kind: z.enum(['channel', 'post', 'canvas', 'member']),
    id: z.string().min(1).max(128),
  })
  .strict();

export interface CanvasNodeContract {
  readonly propsSchema: z.ZodType<Record<string, unknown>>;
  readonly schemaVersion: number;
  readonly layers: readonly ('background' | 'structure' | 'open')[];
  readonly behaviors: readonly CanvasBehaviorKey[];
  readonly maxPerCanvas?: number;
  readonly receiverClass: CanvasReceiverClass;
  readonly fallback: 'placeholder';
  readonly label: string;
}

export const CANVAS_NODE_REGISTRY: Record<CanvasNodeType, CanvasNodeContract> = {
  text: {
    label: 'Text',
    schemaVersion: 1,
    propsSchema: z.object({
      text: z.string().min(1).max(2000),
      size: SizeToken.optional(),
      weight: z.enum(['regular', 'bold']).optional(),
      colorToken: ColorToken.optional(),
      align: z.enum(['left', 'center', 'right']).optional(),
      behavior: TapBehavior.optional(),
    }).strict(),
    layers: ['background', 'structure', 'open'],
    behaviors: ['none', 'toggle', 'flip', 'reveal'],
    receiverClass: 'static',
    fallback: 'placeholder',
  },
  image: {
    label: 'Image',
    schemaVersion: 1,
    // The sealed asset rides the EVENT's asset columns (cid/epoch/wrapped/
    // manifest), never props; props carry presentation tokens only.
    propsSchema: z.object({
      fit: z.enum(['cover', 'contain']).optional(),
      cornerRadius: z.enum(['none', 'sm', 'md', 'round']).optional(),
      alt: z.string().max(280).optional(),
      behavior: TapBehavior.optional(),
    }).strict(),
    layers: ['background', 'structure', 'open'],
    behaviors: ['none', 'open', 'toggle', 'flip', 'reveal'],
    receiverClass: 'static',
    fallback: 'placeholder',
  },
  sticker: {
    label: 'Sticker',
    schemaVersion: 1,
    propsSchema: z.object({
      emoji: StickerEmoji,
      size: SizeToken.optional(),
      behavior: TapBehavior.optional(),
    }).strict(),
    layers: ['structure', 'open'],
    behaviors: ['none', 'toggle', 'flip', 'reveal'],
    receiverClass: 'static',
    fallback: 'placeholder',
  },
  shape: {
    label: 'Shape',
    schemaVersion: 1,
    propsSchema: z.object({
      shape: z.enum(['rect', 'ellipse', 'triangle', 'star', 'heart', 'arrow']),
      fillToken: ColorToken.optional(),
      strokeToken: ColorToken.optional(),
      strokeWidth: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4)]).optional(),
      behavior: TapBehavior.optional(),
    }).strict(),
    layers: ['background', 'structure', 'open'],
    behaviors: ['none', 'toggle', 'flip', 'reveal'],
    receiverClass: 'static',
    fallback: 'placeholder',
  },
  frame: {
    label: 'Frame',
    schemaVersion: 1,
    propsSchema: z.object({
      layout: z.enum(['free', 'flow']),
      padToken: z.enum(['none', 'sm', 'md', 'lg']).optional(),
    }).strict(),
    layers: ['structure', 'open'],
    behaviors: ['none'],
    receiverClass: 'static',
    fallback: 'placeholder',
  },
  link_card: {
    label: 'Link card',
    schemaVersion: 1,
    // navigate(target) only (3.3): a channel, post, canvas, or member INSIDE
    // the community. Structurally incapable of naming a network destination.
    propsSchema: z.object({
      label: z.string().min(1).max(120),
      target: NavigateTarget,
    }).strict(),
    layers: ['structure', 'open'],
    behaviors: ['open'],
    receiverClass: 'interactive',
    fallback: 'placeholder',
  },
  guestbook: {
    label: 'Guestbook',
    schemaVersion: 1,
    propsSchema: z.object({
      title: z.string().max(120).optional(),
      prompt: z.string().max(280).optional(),
    }).strict(),
    layers: ['structure', 'open'],
    behaviors: ['counter'],
    maxPerCanvas: 4,
    receiverClass: 'interactive',
    fallback: 'placeholder',
  },
  poll: {
    label: 'Poll',
    schemaVersion: 1,
    propsSchema: z.object({
      question: z.string().min(1).max(280),
      options: z.array(z.string().min(1).max(80)).min(2).max(8),
    }).strict(),
    layers: ['structure', 'open'],
    behaviors: ['counter'],
    maxPerCanvas: 8,
    receiverClass: 'interactive',
    fallback: 'placeholder',
  },
  counter: {
    label: 'Counter',
    schemaVersion: 1,
    propsSchema: z.object({
      label: z.string().max(80).optional(),
      style: z.enum(['stone', 'flip', 'plain']).optional(),
    }).strict(),
    layers: ['structure', 'open'],
    behaviors: ['counter'],
    maxPerCanvas: 16,
    receiverClass: 'interactive',
    fallback: 'placeholder',
  },
  divider: {
    label: 'Divider',
    schemaVersion: 1,
    propsSchema: z.object({
      style: z.enum(['line', 'dots', 'wave']).optional(),
      colorToken: ColorToken.optional(),
    }).strict(),
    layers: ['background', 'structure', 'open'],
    behaviors: ['none'],
    receiverClass: 'static',
    fallback: 'placeholder',
  },
  button_88x31: {
    // Feature 38: the web-ring era 88x31 button, reborn declarative. Members
    // design, place, and strip them onto profiles; the size is FIXED by the
    // renderer (88x31 logical px), the styling is closed tokens.
    label: '88x31 button',
    schemaVersion: 1,
    propsSchema: z.object({
      text: z.string().min(1).max(16),
      bgToken: ColorToken.optional(),
      fgToken: ColorToken.optional(),
      borderToken: ColorToken.optional(),
      blink: z.boolean().optional(),
    }).strict(),
    layers: ['structure', 'open'],
    behaviors: ['none', 'toggle', 'flip'],
    receiverClass: 'static',
    fallback: 'placeholder',
  },
  badge_case: {
    // Feature 37: the badge case, rendering ONLY badges the subject member
    // verifiably holds (resolved from signed mints/awards, 7.6). The member
    // device id whose case this is; empty = the canvas's profile subject.
    label: 'Badge case',
    schemaVersion: 1,
    propsSchema: z.object({
      memberDevice: z.string().max(128).optional(),
      title: z.string().max(60).optional(),
    }).strict(),
    layers: ['structure', 'open'],
    behaviors: ['none'],
    maxPerCanvas: 4,
    receiverClass: 'static',
    fallback: 'placeholder',
  },
  top_friends: {
    // Feature 54: the top-8. The author signs an ORDERED list of member device
    // ids; the renderer shows each member's VERIFIED name + avatar (never the
    // author's captions for them), so the claim "these are members" is checked
    // at render, and the ordering is the only authored statement.
    label: 'Top friends',
    schemaVersion: 1,
    propsSchema: z.object({
      title: z.string().max(60).optional(),
      memberDevices: z.array(z.string().min(1).max(128)).min(1).max(8),
    }).strict(),
    layers: ['structure', 'open'],
    behaviors: ['none'],
    maxPerCanvas: 2,
    receiverClass: 'static',
    fallback: 'placeholder',
  },
  milestone: {
    // Features 30/46: countdown, count-up, and anniversary cards. The DATE is
    // the only authored fact (signed); everything displayed is pure render
    // math over it and the viewer's clock: no fabricated streaks, no oracle.
    label: 'Milestone',
    schemaVersion: 1,
    propsSchema: z.object({
      title: z.string().min(1).max(60),
      dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      style: z.enum(['countdown', 'countup', 'anniversary']),
      colorToken: ColorToken.optional(),
    }).strict(),
    layers: ['structure', 'open'],
    behaviors: ['none'],
    maxPerCanvas: 12,
    receiverClass: 'static',
    fallback: 'placeholder',
  },
  block_embed: {
    label: 'Block',
    schemaVersion: 1,
    // The bridge node (3.2): wraps ANY block from the composition registry.
    // Two-stage validation: this shell, then the block's own configSchema.
    propsSchema: z.object({
      blockType: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
      config: z.record(z.unknown()),
    }).strict(),
    layers: ['structure', 'open'],
    behaviors: ['none'],
    receiverClass: 'interactive',
    fallback: 'placeholder',
  },
};

/**
 * Milestone display line (features 30/46): pure math over the SIGNED date and
 * the viewer's clock. Deterministic for a given `now`; never a claim about
 * anyone else's activity.
 */
export function milestoneLine(props: { dateIso: string; style: string }, now: Date): string {
  const target = new Date(`${props.dateIso}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return 'Invalid date';
  const dayMs = 24 * 60 * 60 * 1000;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetDay = target.getTime();
  const diffDays = Math.round((targetDay - today) / dayMs);
  if (props.style === 'countdown') {
    if (diffDays > 1) return `${diffDays} days to go`;
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === 0) return 'Today!';
    return `${Math.abs(diffDays)} days ago`;
  }
  if (props.style === 'countup') {
    if (diffDays < -1) return `Day ${Math.abs(diffDays)}`;
    if (diffDays === -1) return 'Day 1';
    if (diffDays === 0) return 'Day 0';
    return `Starts in ${diffDays} days`;
  }
  // anniversary: next occurrence of month/day, with the year count.
  const years = now.getUTCFullYear() - target.getUTCFullYear();
  let next = Date.UTC(now.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  let nextYears = years;
  if (next < today) {
    next = Date.UTC(now.getUTCFullYear() + 1, target.getUTCMonth(), target.getUTCDate());
    nextYears = years + 1;
  }
  const untilDays = Math.round((next - today) / dayMs);
  if (untilDays === 0) return nextYears > 0 ? `${nextYears} year${nextYears === 1 ? '' : 's'} today!` : 'Today!';
  return `${untilDays} days to year ${nextYears}`;
}

export function isCanvasNodeType(type: string): type is CanvasNodeType {
  return Object.prototype.hasOwnProperty.call(CANVAS_NODE_REGISTRY, type);
}

export type CanvasNodePropsParse =
  | { status: 'ok'; props: Record<string, unknown> }
  | { status: 'invalid' }
  | { status: 'unknown_type' }
  | { status: 'future_version' };

/**
 * Validate a node's props against its contract. Total: never throws. A future
 * schemaVersion is NOT a guess (F10): it degrades to the placeholder until a
 * migration understands it. block_embed runs the wrapped block's own
 * configSchema too, so the two registries cannot drift.
 */
export function validateCanvasNodeProps(
  type: string,
  schemaVersion: number,
  props: unknown,
): CanvasNodePropsParse {
  if (!isCanvasNodeType(type)) return { status: 'unknown_type' };
  const contract = CANVAS_NODE_REGISTRY[type];
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) return { status: 'invalid' };
  if (schemaVersion > contract.schemaVersion) return { status: 'future_version' };
  const parsed = contract.propsSchema.safeParse(props ?? {});
  if (!parsed.success) return { status: 'invalid' };
  if (type === 'block_embed') {
    const embed = parsed.data as { blockType: string; config: Record<string, unknown> };
    const inner = validateBlockConfig(embed.blockType, embed.config);
    if (inner.status === 'invalid') return { status: 'invalid' };
    // An unknown inner block stays 'ok' here: the renderer shows that block's
    // own honest placeholder card (the composition fallback), per node.
  }
  return { status: 'ok', props: parsed.data };
}

/** The honest placeholder line for a node that cannot render. */
export const NODE_PLACEHOLDER_LINE = 'A decoration this build does not support yet.';
