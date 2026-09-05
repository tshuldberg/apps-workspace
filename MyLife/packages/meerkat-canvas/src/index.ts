// @mylife/meerkat-canvas: the single, react-native-free source of truth for
// the Meerkat Canvas data vocabulary (Plan 56 section 3), shared by
// apps/meerkat (Expo) and apps/meerkat-web (Vite). Pure TypeScript: kinds,
// layers, closed token vocabularies, section-10 caps, policy/envelope/stroke
// schemas, and the portable snapshot codec. Cryptography lives in
// @mylife/sync (protocol/community-canvas.ts); per-node-type props schemas
// live in the app-side canvas node registry.

export type {
  MkCanvasBrush,
  MkCanvasColorToken,
  MkCanvasKind,
  MkCanvasLayer,
  MkCanvasLayerRole,
  MkCanvasLayoutMode,
  MkCanvasNodeGeometry,
  MkCanvasPolicy,
  MkCanvasThemeExtras,
  MkCanvasSnapshot,
  MkCanvasSnapshotNode,
  MkCanvasStrokePayload,
} from './types';
export { MK_CANVAS_BRUSHES, MK_CANVAS_COLOR_TOKENS } from './types';

export {
  CANVAS_COORD_MAX,
  CANVAS_COORD_MIN,
  CANVAS_DECORATION_BLOB_BUDGET_BYTES,
  CANVAS_EMOJI_MAX_BYTES,
  CANVAS_EVENT_RATE_PER_HOUR,
  CANVAS_NODE_CAPS,
  CANVAS_NODE_PROPS_MAX_BYTES,
  CANVAS_PACK_ITEM_CAP,
  CANVAS_PACK_MANIFEST_MAX_BYTES,
  CANVAS_PAGES_PER_MEMBER_CAP,
  CANVAS_POLICY_MAX_BYTES,
  CANVAS_PROMOTED_TABS_CAP,
  CANVAS_REWARDS_CAP,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_SOUND_MAX_BYTES,
  CANVAS_SOUND_MAX_SECONDS,
  CANVAS_STICKER_MAX_BYTES,
  CANVAS_STROKE_CAP,
  CANVAS_STROKE_POINT_CAP,
  CANVAS_WALLPAPER_MAX_BYTES,
  CANVAS_Z_MAX,
  PIXEL_BOARD_MAX_SIZE,
  PIXEL_BOARD_PLACEMENT_INTERVAL_MS,
} from './caps';

export {
  CanvasSlugSchema,
  MkCanvasBrushSchema,
  MkCanvasColorTokenSchema,
  MkCanvasKindSchema,
  MkCanvasLayerRoleSchema,
  MkCanvasLayerSchema,
  MkCanvasNodeEnvelopeSchema,
  MkCanvasNodeGeometrySchema,
  MkCanvasPolicySchema,
  MkCanvasThemeExtrasSchema,
  MkCanvasSnapshotSchema,
  MkCanvasStrokePayloadSchema,
  defaultCanvasPolicy,
} from './schema';

export {
  CANVAS_BLOB_PREFIX,
  CANVAS_DEEP_LINK_PREFIX,
  MAX_CANVAS_BLOB_BYTES,
  buildCanvasDeepLink,
  canonicalCanvasBytes,
  canvasDecodeErrorMessage,
  decodeCanvasBlob,
  encodeCanvasBlob,
  extractCanvasBlob,
  type CanvasDecodeError,
  type CanvasDecodeErrorCode,
  type CanvasDecodeResult,
} from './codec';
