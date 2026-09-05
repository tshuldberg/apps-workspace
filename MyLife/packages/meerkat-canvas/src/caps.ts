// Plan 56 section 10: caps and budgets, set now while nobody has content to
// break. These are the single source of truth for both surfaces AND the
// apply-time validators in @mylife/sync-adjacent app code; a validator
// enforces every cap it can count, the renderer enforces the rest locally.

import type { MkCanvasKind } from './types';

/** Nodes per canvas, by canvas kind. */
export const CANVAS_NODE_CAPS: Record<MkCanvasKind, number> = {
  commons: 2000,
  channel_topper: 200,
  profile: 500,
  page: 800,
  post: 100,
  pixel_board: 0, // a pixel board carries pixels (C3), never nodes
  thread_overlay: 400, // feature 12: the sticker layer over one channel's history
};

/** Strokes per canvas (with client-side coalescing). */
export const CANVAS_STROKE_CAP = 10_000;

/** Points per single stroke (coalescing bound; a longer gesture splits). */
export const CANVAS_STROKE_POINT_CAP = 1_024;

/** Pages per member per community. */
export const CANVAS_PAGES_PER_MEMBER_CAP = 20;

/** Promoted tabs per community (tab-bar legibility, owner-controlled). */
export const CANVAS_PROMOTED_TABS_CAP = 12;

/** props_json per node (raw UTF-8 bytes). */
export const CANVAS_NODE_PROPS_MAX_BYTES = 8 * 1024;

/** policy_json per canvas (raw UTF-8 bytes). */
export const CANVAS_POLICY_MAX_BYTES = 8 * 1024;

/** Asset pack manifest (C2). */
export const CANVAS_PACK_MANIFEST_MAX_BYTES = 16 * 1024;

/** Canvas events per member per hour, enforced at apply time. */
export const CANVAS_EVENT_RATE_PER_HOUR = 120;

/** Pixel board bounds (C3): max grid + default per-member placement interval. */
export const PIXEL_BOARD_MAX_SIZE = 512;
export const PIXEL_BOARD_PLACEMENT_INTERVAL_MS = 30_000;

/** Redeemable rewards per community (C4). */
export const CANVAS_REWARDS_CAP = 50;

/** Asset caps (C2): per-pack items and per-item byte budgets. */
export const CANVAS_PACK_ITEM_CAP = 64;
export const CANVAS_EMOJI_MAX_BYTES = 256 * 1024;
export const CANVAS_STICKER_MAX_BYTES = 512 * 1024;
export const CANVAS_SOUND_MAX_BYTES = 256 * 1024;
export const CANVAS_SOUND_MAX_SECONDS = 5;
export const CANVAS_WALLPAPER_MAX_BYTES = 2 * 1024 * 1024;
export const CANVAS_DECORATION_BLOB_BUDGET_BYTES = 256 * 1024 * 1024;

/** Canvas coordinate bounds (clamped numerics, F2): generous but finite. */
export const CANVAS_COORD_MIN = -100_000;
export const CANVAS_COORD_MAX = 100_000;
export const CANVAS_SIZE_MIN = 1;
export const CANVAS_SIZE_MAX = 20_000;
export const CANVAS_Z_MAX = 1_000_000;
