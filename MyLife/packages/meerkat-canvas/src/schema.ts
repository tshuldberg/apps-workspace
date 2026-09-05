// Zod schemas for the Canvas vocabulary: the input-validation boundary for
// UNTRUSTED canvas data (policy blobs, node envelopes, stroke payloads,
// snapshot/draft blobs). F8: type-exact, closed, bounded. Two deliberate
// forward-compat holes, both fail-SAFE downstream:
//   - a node envelope's `nodeType` is any bounded slug and its `props` are
//     opaque here (an unknown type or future schemaVersion renders the honest
//     NodePlaceholder in the app registry, never rejects the set);
//   - geometry is clamped numerics, never strings (F2).
// Everything else is closed: unknown keys are rejected so a hostile payload
// cannot smuggle bytes for a future parser.

import { z } from 'zod';
import {
  CANVAS_COORD_MAX,
  CANVAS_COORD_MIN,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_STROKE_POINT_CAP,
  CANVAS_Z_MAX,
} from './caps';
import { MK_CANVAS_BRUSHES, MK_CANVAS_COLOR_TOKENS } from './types';
import type { MkCanvasPolicy } from './types';

const SLUG_RE = /^[a-z][a-z0-9_-]{0,63}$/;
export const CanvasSlugSchema = z.string().regex(SLUG_RE, 'Must be a lowercase slug (max 64)');

export const MkCanvasKindSchema = z.enum(['commons', 'channel_topper', 'profile', 'post', 'pixel_board', 'page', 'thread_overlay']);
export const MkCanvasLayerSchema = z.enum(['background', 'structure', 'open']);
export const MkCanvasLayerRoleSchema = z.enum(['owner', 'curator', 'member']);
export const MkCanvasColorTokenSchema = z.enum(MK_CANVAS_COLOR_TOKENS);
export const MkCanvasBrushSchema = z.enum(MK_CANVAS_BRUSHES);

// Feature 3: per-channel theme overrides ride the OWNER-SIGNED topper policy,
// never descriptor fields. Closed enums only; the vocabulary mirrors
// @mylife/meerkat-theme's MkThemeStyleExtras (an app-side guard test pins the
// two so they cannot drift).
export const MkCanvasThemeExtrasSchema = z
  .object({
    typographyScale: z.enum(['compact', 'regular', 'large']).optional(),
    borderWeight: z.enum(['hairline', 'regular', 'bold']).optional(),
    shadowDepth: z.enum(['flat', 'soft', 'deep']).optional(),
    bubbleShape: z.enum(['rounded', 'square', 'pill']).optional(),
    backgroundTreatment: z.enum(['plain', 'tinted', 'washed']).optional(),
  })
  .strict();

export const MkCanvasPolicySchema = z
  .object({
    layers: z
      .object({
        background: MkCanvasLayerRoleSchema,
        structure: MkCanvasLayerRoleSchema,
        open: MkCanvasLayerRoleSchema,
      })
      .strict(),
    memberBuild: z.boolean(),
    layout: z.enum(['free', 'flow']),
    themeExtras: MkCanvasThemeExtrasSchema.optional(),
    // C3 Plaza: bounded grid + per-member interval (owner may only go STRICTER
    // than the protocol minimum; the sync validator clamps regardless).
    pixel: z
      .object({
        w: z.number().int().min(8).max(512),
        h: z.number().int().min(8).max(512),
        intervalSeconds: z.number().int().min(30).max(24 * 60 * 60),
      })
      .strict()
      .optional(),
  })
  .strict();

/** The safe default policy (feature 14): background owner, structure curator, open members-on. */
export function defaultCanvasPolicy(): MkCanvasPolicy {
  return {
    layers: { background: 'owner', structure: 'curator', open: 'member' },
    memberBuild: true,
    layout: 'free',
  };
}

const CoordSchema = z.number().finite().min(CANVAS_COORD_MIN).max(CANVAS_COORD_MAX);
const SizeSchema = z.number().finite().min(CANVAS_SIZE_MIN).max(CANVAS_SIZE_MAX);

export const MkCanvasNodeGeometrySchema = z
  .object({
    x: CoordSchema,
    y: CoordSchema,
    w: SizeSchema,
    h: SizeSchema,
    rotation: z.number().finite().min(-360).max(360),
    z: z.number().int().min(-CANVAS_Z_MAX).max(CANVAS_Z_MAX),
  })
  .strict();

/**
 * The node ENVELOPE (structure only). Per-type props validation is the app
 * registry's job (canvas-node-registry-core); this layer guarantees shape,
 * bounds, and that props is a plain object.
 */
export const MkCanvasNodeEnvelopeSchema = z
  .object({
    nodeType: CanvasSlugSchema,
    schemaVersion: z.number().int().min(1).max(10_000),
    layer: MkCanvasLayerSchema,
    geometry: MkCanvasNodeGeometrySchema,
    props: z.record(z.unknown()),
    parentId: z.string().min(1).max(128).nullable(),
    localId: z.string().min(1).max(128),
  })
  .strict();

export const MkCanvasStrokePayloadSchema = z
  .object({
    points: z
      .array(z.tuple([CoordSchema, CoordSchema]))
      .min(2)
      .max(CANVAS_STROKE_POINT_CAP),
    brush: MkCanvasBrushSchema,
    colorToken: MkCanvasColorTokenSchema,
    width: z.union([
      z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6), z.literal(8),
    ]),
  })
  .strict();

export const MkCanvasSnapshotSchema = z
  .object({
    kind: MkCanvasKindSchema,
    policy: MkCanvasPolicySchema,
    nodes: z.array(MkCanvasNodeEnvelopeSchema).max(2000),
  })
  .strict();
