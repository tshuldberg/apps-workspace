export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  pill: 999,
} as const;

// Books-domain cover sizes (will relocate to @mylife/books)
export const coverSizes = {
  small: { width: 60, height: 90 },
  medium: { width: 100, height: 150 },
  large: { width: 160, height: 240 },
  detail: { width: 200, height: 300 },
} as const;

export type CoverSize = keyof typeof coverSizes;
