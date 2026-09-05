/**
 * are-blaze BestChef spring presets. Every later phase that adds animated
 * primitives (vote deck, action button bar, ranked card hover, hero crown
 * pulse, etc) imports from this module so timing stays consistent across
 * the suite. Values mirror are-blaze BCTheme.swift spring tuning.
 */
export const springs = {
  /** Quick tactile feedback for tap-down / press-out scale changes. */
  tap: { damping: 18, mass: 0.6, stiffness: 280 },
  /** Default for content sliding in, panels expanding, cards settling. */
  gentle: { damping: 22, mass: 0.8, stiffness: 220 },
  /** Used when an element flies in from off-screen (toasts, banners). */
  fly: { damping: 26, mass: 1.0, stiffness: 320 },
} as const;

export type SpringName = keyof typeof springs;
export type SpringConfig = (typeof springs)[SpringName];
