// Plan 56 feature 1: the host-owned mapping from the extended style axes to
// concrete render values. A theme can only pick closed enum values (F2); the
// numbers live HERE, identically on both surfaces, so a theme can never carry
// raw dimensions. Absent extras resolve to today's rendering exactly.

import type { MkResolvedThemeStyle, MkThemeStyleExtras } from './types';

const FONT_SCALE: Record<string, number> = { compact: 0.92, regular: 1, large: 1.12 };
const BORDER_WIDTH: Record<string, number> = { hairline: 1, regular: 2, bold: 3 };
const BUBBLE_RADIUS: Record<string, number> = { rounded: 16, square: 6, pill: 22 };

export function resolveThemeStyle(extras: MkThemeStyleExtras | null | undefined): MkResolvedThemeStyle {
  return {
    fontScale: FONT_SCALE[extras?.typographyScale ?? 'regular'] ?? 1,
    borderWidth: BORDER_WIDTH[extras?.borderWeight ?? 'hairline'] ?? 1,
    shadowDepth: extras?.shadowDepth ?? 'flat',
    bubbleRadius: BUBBLE_RADIUS[extras?.bubbleShape ?? 'rounded'] ?? 16,
    backgroundTreatment: extras?.backgroundTreatment ?? 'plain',
  };
}

/** The shape->radius table for per-author overrides (feature 4); null = unknown token. */
export function bubbleRadiusForShape(shape: string | null | undefined): number | null {
  if (!shape) return null;
  return BUBBLE_RADIUS[shape] ?? null;
}

/**
 * Merge style extras: per-axis, override wins where present (feature 3's
 * per-channel topper overrides layer over the community theme this way).
 */
export function mergeThemeExtras(
  base: MkThemeStyleExtras | null | undefined,
  override: MkThemeStyleExtras | null | undefined,
): MkThemeStyleExtras | undefined {
  if (!base && !override) return undefined;
  return { ...(base ?? {}), ...(override ?? {}) };
}
