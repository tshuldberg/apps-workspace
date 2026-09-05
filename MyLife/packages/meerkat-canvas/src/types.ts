// @mylife/meerkat-canvas types: the Canvas data vocabulary (Plan 56 section
// 3.1). Pure TypeScript, react-native-free, shared by apps/meerkat and
// apps/meerkat-web. A canvas is a SET of independently signed node rows, never
// a document blob; this package carries the closed vocabularies (kinds,
// layers, tokens), the caps (section 10), the policy/envelope schemas, and the
// portable snapshot codec used by drafts and (later) snapshot dreams.

/** Where a canvas attaches (section 3.1). */
export type MkCanvasKind =
  | 'commons'
  | 'channel_topper'
  | 'profile'
  | 'post'
  | 'pixel_board'
  | 'page'
  | 'thread_overlay';

/** The three-layer permission model (section 3.1 / feature 14). */
export type MkCanvasLayer = 'background' | 'structure' | 'open';

/** Layout modes (section 3.1): free = mmm.page, flow = webpage sections. */
export type MkCanvasLayoutMode = 'free' | 'flow';

/**
 * Closed color-token vocabulary for member content. Tokens resolve to the
 * ACTIVE theme palette at render time; a token is never a CSS/color string
 * (F2), so member content cannot carry arbitrary style bytes.
 */
export const MK_CANVAS_COLOR_TOKENS = [
  'text',
  'muted',
  'accent',
  'paper',
  'surface',
  'success',
  'warning',
  'danger',
  'info',
] as const;
export type MkCanvasColorToken = (typeof MK_CANVAS_COLOR_TOKENS)[number];

/** Who may place nodes on a layer (resolved against community roles). */
export type MkCanvasLayerRole = 'owner' | 'curator' | 'member';

/** The per-canvas policy carried in cm_canvas.policy_json (8 KB cap). */
/** Feature 3: the closed per-channel style axes a topper policy may carry. */
export interface MkCanvasThemeExtras {
  typographyScale?: 'compact' | 'regular' | 'large';
  borderWeight?: 'hairline' | 'regular' | 'bold';
  shadowDepth?: 'flat' | 'soft' | 'deep';
  bubbleShape?: 'rounded' | 'square' | 'pill';
  backgroundTreatment?: 'plain' | 'tinted' | 'washed';
}

export interface MkCanvasPolicy {
  /** Minimum role per layer. Defaults: background owner, structure curator, open member. */
  layers: Record<MkCanvasLayer, MkCanvasLayerRole>;
  /** The one-bit "Members can build" toggle (feature 14). Off = open layer closes. */
  memberBuild: boolean;
  layout: MkCanvasLayoutMode;
  /** Feature 3: per-channel theme override (owner-signed topper policy only). */
  themeExtras?: MkCanvasThemeExtras;
  /** C3 Plaza (pixel_board only): grid size + per-member placement interval. */
  pixel?: { w: number; h: number; intervalSeconds: number };
}

/** A canvas node's geometry (free layout; flow ignores x/y and stacks by z). */
export interface MkCanvasNodeGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: number;
}

/** One stroke's payload (section 3.1): points + closed brush/color/width vocab. */
export const MK_CANVAS_BRUSHES = ['pen', 'marker', 'highlighter'] as const;
export type MkCanvasBrush = (typeof MK_CANVAS_BRUSHES)[number];

export interface MkCanvasStrokePayload {
  points: ReadonlyArray<readonly [number, number]>;
  brush: MkCanvasBrush;
  colorToken: MkCanvasColorToken;
  width: 1 | 2 | 3 | 4 | 6 | 8;
}

/** A portable node record inside a canvas snapshot/draft blob. */
export interface MkCanvasSnapshotNode {
  nodeType: string;
  schemaVersion: number;
  layer: MkCanvasLayer;
  geometry: MkCanvasNodeGeometry;
  props: Record<string, unknown>;
  parentId: string | null;
  /** Local id inside the snapshot, so frames can nest (never a live event id). */
  localId: string;
}

/** The portable canvas snapshot (drafts now; snapshot dreams in C3). */
export interface MkCanvasSnapshot {
  kind: MkCanvasKind;
  policy: MkCanvasPolicy;
  nodes: MkCanvasSnapshotNode[];
}
