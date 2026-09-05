/**
 * 8-color academic palette derived from the MyClasses accent (#3B82F6).
 * Used to assign distinct block colors when a class has no explicit color set
 * and to drive the AddClass color-picker swatches. All hues stay readable on
 * the Obsidian Noir surface.
 */
export const CLASSES_PALETTE = [
  '#3B82F6', // accent blue
  '#8B5CF6', // violet
  '#22C55E', // green
  '#F97316', // orange
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F59E0B', // amber
  '#EF4444', // red
] as const;

export type ClassesPaletteColor = (typeof CLASSES_PALETTE)[number];

/**
 * Pick a stable palette color for a class id. Same id always returns same hex.
 */
export function pickClassColor(seed: string): ClassesPaletteColor {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % CLASSES_PALETTE.length;
  return CLASSES_PALETTE[idx];
}

/**
 * Convert a #RRGGBB hex into an `rgba(r,g,b,a)` string. Used for fading the
 * block background while keeping the border at full strength.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}
