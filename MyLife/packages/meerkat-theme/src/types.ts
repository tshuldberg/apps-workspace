// Canonical theme types for Meerkat, shared by the Expo app and the Vite web
// app. Pure TypeScript: no react, no react-native, no DOM. The mobile
// `theme/tokens.ts` and web `theme/palette.ts` re-export `MkColors` from here so
// there is a single canonical token type across both surfaces.

/** The two resolvable palette modes. `system` is a UI-level choice that picks one of these. */
export type MkPaletteMode = 'light' | 'dark';

/**
 * The full resolved color set every screen reads. This is the canonical 22-token
 * superset (a strict superset of `@mylife/ui`'s BaseColors, which is why Meerkat
 * keeps its own type rather than adopting ThemeProfile). All values are concrete
 * color strings after resolution (`#rgb` / `#rrggbb` / `#rrggbbaa` / `rgb()` / `rgba()`).
 */
export interface MkColors {
  // Surfaces (lowest to highest).
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHigh: string;

  // Brand signal.
  accent: string;
  accentDim: string;
  onAccent: string;

  // Text.
  text: string;
  textSecondary: string;
  textTertiary: string;

  // Semantic.
  danger: string;
  warning: string;
  info: string;
  success: string;

  // Soft semantic fills (notice/result boxes).
  dangerSoft: string;
  warningSoft: string;
  successSoft: string;
  infoSoft: string;

  // Lines + glass.
  border: string;
  borderStrong: string;
  glass: string;
  glassBorder: string;
}

/** The eight colors a user edits directly; every other token is derived from these. */
export interface MkPrimaryColors {
  accent: string;
  background: string;
  surface: string;
  text: string;
  danger: string;
  warning: string;
  info: string;
  success: string;
}

/** The 14 derived tokens `deriveColors` fills in from the 8 primaries. */
export type MkDerivedColors = Omit<MkColors, keyof MkPrimaryColors>;

export type MkRadiusScale = 'sm' | 'md' | 'lg';
export type MkDensity = 'compact' | 'cozy' | 'comfortable';
export type MkHeadingWeight = '600' | '700' | '800';

// Plan 56 feature 1: extended style axes, closed enums layered on the profile
// (F2: never free-form values). All optional so every existing theme keeps
// verifying and decoding; an older build's strict schema rejects a blob that
// carries them and the consumer falls back to the accent path (fail safe).
export type MkTypographyScale = 'compact' | 'regular' | 'large';
export type MkBorderWeight = 'hairline' | 'regular' | 'bold';
export type MkShadowDepth = 'flat' | 'soft' | 'deep';
export type MkBubbleShape = 'rounded' | 'square' | 'pill';
export type MkBackgroundTreatment = 'plain' | 'tinted' | 'washed';

export interface MkThemeStyleExtras {
  typographyScale?: MkTypographyScale;
  borderWeight?: MkBorderWeight;
  shadowDepth?: MkShadowDepth;
  bubbleShape?: MkBubbleShape;
  backgroundTreatment?: MkBackgroundTreatment;
  /**
   * Plan 56 feature 4: bubble skins per ROLE from the same closed shape
   * catalog. A role's entry beats the community-wide bubbleShape for that
   * role's authors; absent entries fall through. Roles only, never per-device
   * free-form styling (the shape stays a closed token either way).
   */
  bubbleShapesByRole?: {
    owner?: MkBubbleShape;
    admin?: MkBubbleShape;
    member?: MkBubbleShape;
  };
}

/**
 * Concrete values the extended axes resolve to (host-owned mapping; a theme
 * can never carry raw numbers or CSS). Defaults are today's rendering, so a
 * theme without extras changes nothing.
 */
export interface MkResolvedThemeStyle {
  /** Multiplier over the base font size (community content surfaces). */
  fontScale: number;
  /** Panel/hairline border width in px. */
  borderWidth: number;
  shadowDepth: MkShadowDepth;
  /** Chat bubble corner radius in px. */
  bubbleRadius: number;
  backgroundTreatment: MkBackgroundTreatment;
}

/**
 * One mode of a theme: the user-chosen primaries plus optional advanced
 * overrides for any of the 22 tokens (the "Advanced" editor disclosure and the
 * brand-tuned preset values). `resolveProfile` derives the rest, then applies
 * `overrides` on top.
 */
export interface MkModeSpec {
  primary: MkPrimaryColors;
  overrides?: Partial<MkColors>;
}

/**
 * A full theme. Device-local; never replicated. `light` is required; `dark` is
 * optional (a single-mode theme falls back via `effectiveMode`). `version` gates
 * forward-compatibility on import.
 */
export interface MkThemeProfile {
  version: 1;
  id: string;
  name: string;
  /** Display register tag, e.g. "Calm" | "Vibrant" | "High contrast". */
  register?: string;
  /** Provenance: the preset this was forked from, or undefined. */
  basePresetId?: string;
  shape: { radius: MkRadiusScale };
  density: MkDensity;
  headingWeight: MkHeadingWeight;
  /** Plan 56 feature 1: extended style axes (optional; absent = today's look). */
  styleExtras?: MkThemeStyleExtras;
  light: MkModeSpec;
  dark?: MkModeSpec;
}
