// @mylife/meerkat-theme: the single, react-native-free source of truth for the
// Meerkat theme system, shared by apps/meerkat (Expo) and apps/meerkat-web
// (Vite). Pure TypeScript: schema, contrast math, token derivation, and profile
// resolution. Presets, codec, QR, and the local generator land in later phases.

export type {
  MkColors,
  MkDerivedColors,
  MkPrimaryColors,
  MkPaletteMode,
  MkModeSpec,
  MkThemeProfile,
  MkRadiusScale,
  MkDensity,
  MkHeadingWeight,
  MkThemeStyleExtras,
  MkResolvedThemeStyle,
  MkTypographyScale,
  MkBorderWeight,
  MkShadowDepth,
  MkBubbleShape,
  MkBackgroundTreatment,
} from './types';

export { bubbleRadiusForShape, mergeThemeExtras, resolveThemeStyle } from './style';

export {
  parseColor,
  relativeLuminance,
  contrastRatio,
  ratesAA,
  ratesAAA,
  type Rgba,
} from './contrast';

export {
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  adjustLightness,
  mix,
  withAlpha,
  type Hsl,
} from './color-math';

export { deriveColors } from './derive';

export { resolveProfile, effectiveMode, mirrorMode } from './resolve';

export {
  COLOR_RE,
  ColorStringSchema,
  MkPrimaryColorsSchema,
  MkColorsPartialSchema,
  MkModeSpecSchema,
  MkThemeProfileSchema,
  MkRadiusScaleSchema,
  MkDensitySchema,
  MkHeadingWeightSchema,
  validateThemeProfile,
  type MkThemeProfileInput,
  type MkThemeProfileParsed,
} from './schema';

export {
  DEFAULT_PRESET_ID,
  PRESETS,
  PRESET_IDS,
  getPreset,
  isPresetId,
  OPEN_BURROW,
  CALM,
  SOCIAL,
  PLAYFUL,
  SERIOUS,
  HIGH_CONTRAST,
} from './presets';

export {
  THEME_BLOB_PREFIX,
  THEME_DEEP_LINK_PREFIX,
  MAX_THEME_BLOB_BYTES,
  encodeThemeBlob,
  decodeThemeBlob,
  buildThemeBlob,
  buildThemeDeepLink,
  extractThemeBlob,
  decodeErrorMessage,
  canonicalThemeBytes,
  verifyThemeAuthor,
  type ThemeDecodeErrorCode,
  type ThemeDecodeError,
  type ThemeDecodeResult,
  type MkThemeAuthor,
} from './codec';

export { MkThemeAuthorSchema } from './schema';

export { generatePalette } from './generate';

export {
  encodeQrMatrix,
  qrCanEncode,
  qrByteCeiling,
  QrTooLargeError,
  type QrEcLevel,
  type QrMatrix,
} from './qr';

export {
  qrMatrixToSvgPath,
  qrToSvgPath,
  type QrSvgPath,
} from './qr-svg';
