/**
 * @mylife/meerkat-canvas: schema boundaries (F8 type-exact, F2 clamped
 * numerics, closed token vocabularies), section-10 caps exposure, policy
 * defaults, and the snapshot codec round trip with every decode guard.
 */

import { describe, expect, it } from 'vitest';
import {
  CANVAS_BLOB_PREFIX,
  CANVAS_EVENT_RATE_PER_HOUR,
  CANVAS_NODE_CAPS,
  CANVAS_NODE_PROPS_MAX_BYTES,
  CANVAS_PROMOTED_TABS_CAP,
  CANVAS_STROKE_CAP,
  MkCanvasNodeEnvelopeSchema,
  MkCanvasPolicySchema,
  MkCanvasStrokePayloadSchema,
  buildCanvasDeepLink,
  decodeCanvasBlob,
  defaultCanvasPolicy,
  encodeCanvasBlob,
  extractCanvasBlob,
  type MkCanvasSnapshot,
} from '../index';

const NODE = {
  nodeType: 'text',
  schemaVersion: 1,
  layer: 'open' as const,
  geometry: { x: 10, y: 20, w: 200, h: 80, rotation: 0, z: 5 },
  props: { text: 'hello burrow' },
  parentId: null,
  localId: 'n1',
};

const SNAPSHOT: MkCanvasSnapshot = {
  kind: 'commons',
  policy: defaultCanvasPolicy(),
  nodes: [NODE],
};

describe('section 10 caps', () => {
  it('exposes the plan values verbatim', () => {
    expect(CANVAS_NODE_CAPS.commons).toBe(2000);
    expect(CANVAS_NODE_CAPS.channel_topper).toBe(200);
    expect(CANVAS_NODE_CAPS.profile).toBe(500);
    expect(CANVAS_NODE_CAPS.page).toBe(800);
    expect(CANVAS_NODE_CAPS.post).toBe(100);
    expect(CANVAS_STROKE_CAP).toBe(10_000);
    expect(CANVAS_NODE_PROPS_MAX_BYTES).toBe(8 * 1024);
    expect(CANVAS_PROMOTED_TABS_CAP).toBe(12);
    expect(CANVAS_EVENT_RATE_PER_HOUR).toBe(120);
  });
});

describe('policy schema', () => {
  it('accepts the default and rejects unknown keys / roles', () => {
    expect(MkCanvasPolicySchema.safeParse(defaultCanvasPolicy()).success).toBe(true);
    expect(MkCanvasPolicySchema.safeParse({ ...defaultCanvasPolicy(), extra: 1 }).success).toBe(false);
    const badRole = { ...defaultCanvasPolicy(), layers: { background: 'anyone', structure: 'curator', open: 'member' } };
    expect(MkCanvasPolicySchema.safeParse(badRole).success).toBe(false);
  });
});

describe('node envelope schema', () => {
  it('accepts a bounded node and keeps the two forward-compat holes open', () => {
    expect(MkCanvasNodeEnvelopeSchema.safeParse(NODE).success).toBe(true);
    // Unknown node types and future schemaVersions PASS the envelope (the app
    // registry renders the honest placeholder); unknown KEYS never pass.
    expect(MkCanvasNodeEnvelopeSchema.safeParse({ ...NODE, nodeType: 'hologram_2029', schemaVersion: 999 }).success).toBe(true);
    expect(MkCanvasNodeEnvelopeSchema.safeParse({ ...NODE, onClick: 'evil' }).success).toBe(false);
  });

  it('clamps geometry (F2: numbers, never strings; bounded)', () => {
    expect(MkCanvasNodeEnvelopeSchema.safeParse({ ...NODE, geometry: { ...NODE.geometry, x: '10' } }).success).toBe(false);
    expect(MkCanvasNodeEnvelopeSchema.safeParse({ ...NODE, geometry: { ...NODE.geometry, x: Number.POSITIVE_INFINITY } }).success).toBe(false);
    expect(MkCanvasNodeEnvelopeSchema.safeParse({ ...NODE, geometry: { ...NODE.geometry, w: 10_000_000 } }).success).toBe(false);
    expect(MkCanvasNodeEnvelopeSchema.safeParse({ ...NODE, geometry: { ...NODE.geometry, rotation: 720 } }).success).toBe(false);
  });
});

describe('stroke payload schema', () => {
  it('accepts a bounded stroke with closed brush/color/width vocab only', () => {
    const stroke = { points: [[0, 0], [10, 10]], brush: 'pen', colorToken: 'accent', width: 2 };
    expect(MkCanvasStrokePayloadSchema.safeParse(stroke).success).toBe(true);
    expect(MkCanvasStrokePayloadSchema.safeParse({ ...stroke, colorToken: '#ff0000' }).success).toBe(false);
    expect(MkCanvasStrokePayloadSchema.safeParse({ ...stroke, brush: 'chainsaw' }).success).toBe(false);
    expect(MkCanvasStrokePayloadSchema.safeParse({ ...stroke, width: 5 }).success).toBe(false);
    expect(MkCanvasStrokePayloadSchema.safeParse({ ...stroke, points: [[0, 0]] }).success).toBe(false);
  });
});

describe('snapshot codec', () => {
  it('round-trips and wraps/extracts the deep link', () => {
    const blob = encodeCanvasBlob(SNAPSHOT);
    expect(blob.startsWith(CANVAS_BLOB_PREFIX)).toBe(true);
    const decoded = decodeCanvasBlob(blob);
    expect(decoded.success).toBe(true);
    if (!decoded.success) throw new Error('expected success');
    expect(decoded.snapshot).toEqual(SNAPSHOT);
    const link = buildCanvasDeepLink(SNAPSHOT);
    expect(extractCanvasBlob(link)).toBe(blob);
  });

  it('decode guards: wrong namespace, newer version, corrupted checksum', () => {
    expect(decodeCanvasBlob('meerkat-layout:v1:abc:00000000')).toMatchObject({ success: false, error: { code: 'malformed' } });
    expect(decodeCanvasBlob('meerkat-canvas:v9:abc:00000000')).toMatchObject({ success: false, error: { code: 'newer-version' } });
    const blob = encodeCanvasBlob(SNAPSHOT);
    const flipped = blob.slice(0, -1) + (blob.endsWith('0') ? '1' : '0');
    expect(decodeCanvasBlob(flipped)).toMatchObject({ success: false, error: { code: 'checksum' } });
  });
});
