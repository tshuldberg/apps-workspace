import { z } from 'zod';

const FontWeightSchema = z.union([
  z.literal('100'),
  z.literal('200'),
  z.literal('300'),
  z.literal('400'),
  z.literal('500'),
  z.literal('600'),
  z.literal('700'),
  z.literal('800'),
  z.literal('900'),
]);

const TypeScaleEntrySchema = z.object({
  size: z.number().positive(),
  weight: FontWeightSchema,
  lineHeight: z.number().positive(),
});

const LabelTypeScaleEntrySchema = TypeScaleEntrySchema.extend({
  letterSpacing: z.number(),
});

export const BaseColorsSchema = z.object({
  background: z.string(),
  surface: z.string(),
  surfaceElevated: z.string(),
  text: z.string(),
  textSecondary: z.string(),
  textTertiary: z.string(),
  border: z.string(),
  danger: z.string(),
  success: z.string(),
  warning: z.string(),
  accent: z.string(),
  primary: z.string(),
  primaryContainer: z.string(),
});

export const GlassSchema = z.object({
  cardFill: z.string(),
  cardBorder: z.string(),
  strongFill: z.string(),
  strongBorder: z.string(),
  dockFill: z.string(),
  dockBorder: z.string(),
  blurIntensity: z.number().min(0).max(100),
});

export const FontFamilySchema = z.object({
  display: z.string().min(1),
  body: z.string().min(1),
  mono: z.string().min(1).optional(),
});

export const TypeScaleSchema = z.object({
  heroTitle: TypeScaleEntrySchema,
  heading: TypeScaleEntrySchema,
  subheading: TypeScaleEntrySchema,
  body: TypeScaleEntrySchema,
  caption: TypeScaleEntrySchema,
  label: LabelTypeScaleEntrySchema,
});

export const SurfaceTreatmentSchema = z.union([
  z.literal('glass'),
  z.literal('solid'),
  z.literal('gradient'),
  z.literal('neumorphic'),
  z.literal('flat'),
]);

export const SurfaceSchema = z.object({
  treatment: SurfaceTreatmentSchema,
  cornerRadius: z.object({
    card: z.number().nonnegative(),
    button: z.number().nonnegative(),
    icon: z.number().nonnegative(),
    tabBar: z.number().nonnegative(),
  }),
  shadows: z.object({
    card: z.string(),
    elevated: z.string(),
    pressed: z.string().optional(),
  }),
});

export const DashboardStyleSchema = z.union([
  z.literal('bento-grid'),
  z.literal('list'),
  z.literal('cards-horizontal'),
]);

export const TabBarStyleSchema = z.union([
  z.literal('floating-pill'),
  z.literal('bottom-attached'),
  z.literal('minimal-dots'),
]);

export const HeaderStyleSchema = z.union([
  z.literal('wordmark'),
  z.literal('logo'),
  z.literal('minimal'),
]);

export const LayoutSchema = z.object({
  dashboardStyle: DashboardStyleSchema,
  moduleGridColumns: z.number().int().min(3).max(5),
  tabBarStyle: TabBarStyleSchema,
  headerStyle: HeaderStyleSchema,
  spacing: z.object({
    xs: z.number().nonnegative(),
    sm: z.number().nonnegative(),
    md: z.number().nonnegative(),
    lg: z.number().nonnegative(),
    xl: z.number().nonnegative(),
  }),
});

export const ColorModeSchema = z.union([z.literal('dark'), z.literal('light')]);

/**
 * Paired token shape for color values that carry both a light and dark
 * variant. Theme presets that want to support both color modes from a single
 * profile can populate `colorsLight` alongside `colors`. Existing presets keep
 * a single flat `colors` block (backwards compatible) and consumers can
 * resolve a paired value with `pickToken(value, scheme)` from utils.
 */
export const PairedColorSchema = z.object({
  light: z.string(),
  dark: z.string(),
});

export type PairedColor = z.infer<typeof PairedColorSchema>;

export const ThemeProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  author: z.string(),
  version: z.string().min(1),
  colorMode: ColorModeSchema,
  colors: BaseColorsSchema,
  /**
   * Optional alternate color palette for the opposite color mode. When the
   * profile's colorMode is 'dark', colorsLight is the light counterpart and
   * vice versa. Theme-aware consumers can resolve via pickToken.
   */
  colorsLight: BaseColorsSchema.optional(),
  colorsDark: BaseColorsSchema.optional(),
  glass: GlassSchema,
  fonts: FontFamilySchema,
  typeScale: TypeScaleSchema,
  surfaces: SurfaceSchema,
  layout: LayoutSchema,
});

export type BaseColors = z.infer<typeof BaseColorsSchema>;
export type GlassTokens = z.infer<typeof GlassSchema>;
export type FontFamily = z.infer<typeof FontFamilySchema>;
export type TypeScaleEntry = z.infer<typeof TypeScaleEntrySchema>;
export type LabelTypeScaleEntry = z.infer<typeof LabelTypeScaleEntrySchema>;
export type TypeScale = z.infer<typeof TypeScaleSchema>;
export type SurfaceTreatment = z.infer<typeof SurfaceTreatmentSchema>;
export type Surfaces = z.infer<typeof SurfaceSchema>;
export type DashboardStyle = z.infer<typeof DashboardStyleSchema>;
export type TabBarStyle = z.infer<typeof TabBarStyleSchema>;
export type HeaderStyle = z.infer<typeof HeaderStyleSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type ColorMode = z.infer<typeof ColorModeSchema>;
export type ThemeProfile = z.infer<typeof ThemeProfileSchema>;
