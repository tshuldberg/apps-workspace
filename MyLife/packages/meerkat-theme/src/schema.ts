// Zod schema for MkThemeProfile. This is the input-validation security boundary
// (below the UI): only strict color forms and numbers reach the resolved tokens,
// so an imported/pasted theme can never inject CSS/JS when web maps a token to a
// `--mk-*` custom-property value. The codec (Phase 2) layers a size cap + version
// gate on top; this schema is the structural + per-value guard.

import { z } from 'zod';
import type { MkThemeProfile } from './types';

/**
 * The only color forms a theme may carry: #rgb, #rgba, #rrggbb, #rrggbbaa,
 * rgb(), rgba(). Named colors, `url()`, `var()`, and arbitrary strings are
 * rejected so nothing arbitrary lands in a CSS custom-property value.
 */
// Channel = strict integer 0-255; alpha = 0, 1, or a 0..1 decimal. No decimal
// channels, no out-of-range values: the regex is a real validity guarantee, not
// just a shape check.
const CH = String.raw`(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)`;
const ALPHA = String.raw`(0|1|0?\.\d+|1\.0+)`;
// Spaces only between rgb() tokens (NOT \s, which would admit newlines/tabs that
// can break out of an HTML attribute value if a consumer interpolates the color
// into a style string). Outer whitespace is stripped by ColorStringSchema.trim().
const SP = ' *';
export const COLOR_RE = new RegExp(
  `^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\\(${SP}${CH}${SP},${SP}${CH}${SP},${SP}${CH}${SP}(,${SP}${ALPHA}${SP})?\\))$`,
);

export const ColorStringSchema = z
  .string()
  .trim() // strip stray whitespace/newlines so stored values are always clean
  .regex(COLOR_RE, 'Must be a #hex, rgb(), or rgba() color');

export const MkPrimaryColorsSchema = z
  .object({
    accent: ColorStringSchema,
    background: ColorStringSchema,
    surface: ColorStringSchema,
    text: ColorStringSchema,
    danger: ColorStringSchema,
    warning: ColorStringSchema,
    info: ColorStringSchema,
    success: ColorStringSchema,
  })
  .strict();

/** Every one of the 22 tokens, all optional (advanced overrides / preset tuning). */
export const MkColorsPartialSchema = z
  .object({
    background: ColorStringSchema,
    surface: ColorStringSchema,
    surfaceElevated: ColorStringSchema,
    surfaceHigh: ColorStringSchema,
    accent: ColorStringSchema,
    accentDim: ColorStringSchema,
    onAccent: ColorStringSchema,
    text: ColorStringSchema,
    textSecondary: ColorStringSchema,
    textTertiary: ColorStringSchema,
    danger: ColorStringSchema,
    warning: ColorStringSchema,
    info: ColorStringSchema,
    success: ColorStringSchema,
    dangerSoft: ColorStringSchema,
    warningSoft: ColorStringSchema,
    successSoft: ColorStringSchema,
    infoSoft: ColorStringSchema,
    border: ColorStringSchema,
    borderStrong: ColorStringSchema,
    glass: ColorStringSchema,
    glassBorder: ColorStringSchema,
  })
  .partial()
  .strict();

export const MkModeSpecSchema = z
  .object({
    primary: MkPrimaryColorsSchema,
    overrides: MkColorsPartialSchema.optional(),
  })
  .strict();

export const MkRadiusScaleSchema = z.enum(['sm', 'md', 'lg']);
export const MkDensitySchema = z.enum(['compact', 'cozy', 'comfortable']);
export const MkHeadingWeightSchema = z.enum(['600', '700', '800']);

// Plan 56 feature 1: extended style axes, all closed enums (F2), all optional.
export const MkThemeStyleExtrasSchema = z
  .object({
    typographyScale: z.enum(['compact', 'regular', 'large']).optional(),
    borderWeight: z.enum(['hairline', 'regular', 'bold']).optional(),
    shadowDepth: z.enum(['flat', 'soft', 'deep']).optional(),
    bubbleShape: z.enum(['rounded', 'square', 'pill']).optional(),
    backgroundTreatment: z.enum(['plain', 'tinted', 'washed']).optional(),
    bubbleShapesByRole: z
      .object({
        owner: z.enum(['rounded', 'square', 'pill']).optional(),
        admin: z.enum(['rounded', 'square', 'pill']).optional(),
        member: z.enum(['rounded', 'square', 'pill']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const MkThemeProfileSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(120),
    register: z.string().max(40).optional(),
    basePresetId: z.string().max(120).optional(),
    shape: z.object({ radius: MkRadiusScaleSchema }).strict(),
    density: MkDensitySchema,
    headingWeight: MkHeadingWeightSchema,
    styleExtras: MkThemeStyleExtrasSchema.optional(),
    light: MkModeSpecSchema,
    dark: MkModeSpecSchema.optional(),
  })
  .strict();

export type MkThemeProfileInput = z.input<typeof MkThemeProfileSchema>;
export type MkThemeProfileParsed = z.infer<typeof MkThemeProfileSchema>;

// Optional signed-author attribution carried alongside an exported theme. The
// signature is an Ed25519 detached signature (64 bytes = 128 hex) over the
// canonical profile bytes, produced by the device's existing key. It attests
// WHO authored a theme; it is NOT a trust/safety boundary (a validated theme is
// safe regardless), so an invalid signature only downgrades the label.
export const MkThemeAuthorSchema = z
  .object({
    name: z.string().min(1).max(60),
    publicKey: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Must be a 64-char hex Ed25519 public key'),
    signature: z.string().regex(/^[0-9a-fA-F]{128}$/, 'Must be a 128-char hex Ed25519 signature'),
  })
  .strict();

export type MkThemeAuthor = z.infer<typeof MkThemeAuthorSchema>;

/** Strict parse with a typed result. Never throws. */
export function validateThemeProfile(value: unknown):
  | { success: true; profile: MkThemeProfile }
  | { success: false; errors: string[] } {
  const result = MkThemeProfileSchema.safeParse(value);
  if (result.success) return { success: true, profile: result.data as MkThemeProfile };
  return {
    success: false,
    errors: result.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    ),
  };
}
