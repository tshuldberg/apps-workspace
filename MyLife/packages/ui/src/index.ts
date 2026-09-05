// Tokens
export { colors, surfaceTiers } from './tokens/colors';
export type { ModuleName, SurfaceTier } from './tokens/colors';
export { spacing, borderRadius, coverSizes } from './tokens/spacing';
export type { CoverSize } from './tokens/spacing';
export { typography, fontFamilies, fontStacks } from './tokens/typography';
export type { TypographyVariant } from './tokens/typography';
export { shadows } from './tokens/shadows';
export { glass, glassWeb, glassFills, glassBorders, glassBlurs } from './tokens/glass';
export { navigation } from './tokens/navigation';
export type { NavigationTokens } from './tokens/navigation';

// Constants
export { BRAND_NAME, BRAND_DOMAIN } from './constants/brand';

// Components
export { Card } from './components/Card';
export { Button } from './components/Button';
export { Text } from './components/Text';
export { ModuleThemeProvider, useModuleTheme } from './components/ModuleThemeProvider';

// Theme system (user-selectable profiles)
export {
  ThemeProvider,
  useTheme,
  useThemeColors,
  useThemeFonts,
  useThemeLayout,
  useThemeSurfaces,
  useThemeTypeScale,
} from './context/ThemeProvider';
export type { ThemeProviderProps } from './context/ThemeProvider';

export {
  ThemeProfileSchema,
  BaseColorsSchema,
  GlassSchema,
  FontFamilySchema,
  TypeScaleSchema,
  SurfaceSchema,
  LayoutSchema,
  ColorModeSchema,
  PairedColorSchema,
} from './themes/schema';
export type {
  ThemeProfile,
  BaseColors,
  GlassTokens,
  FontFamily,
  TypeScale,
  TypeScaleEntry,
  LabelTypeScaleEntry,
  Surfaces,
  SurfaceTreatment,
  Layout,
  DashboardStyle,
  TabBarStyle,
  HeaderStyle,
  ColorMode,
  PairedColor,
} from './themes/schema';

export {
  THEME_PRESETS,
  DEFAULT_THEME,
  COOL_OBSIDIAN,
  ARCTIC_LIGHT,
  WARM_ANALOG,
  NEON_TERMINAL,
  SOFT_GRADIENT,
  MINIMAL_INK,
  CANDY_GLASS,
  EARTH_CLAY,
  NEUMORPHIC_SLATE,
  BESTCHEF_OBSIDIAN,
  BESTCHEF_WARM_CREAM,
  BESTCHEF_WARM_CHARCOAL,
} from './themes/presets';

export { validateTheme, mergeTheme, resolveFont, themeToCSS, pickToken } from './themes/utils';
export type { ValidateResult } from './themes/utils';

// Auth-domain components
export { PasswordStrengthMeter } from './components/PasswordStrengthMeter';
export { PasswordInput } from './components/PasswordInput';
export { PassphraseRecommendation } from './components/PassphraseRecommendation';
export { AuthForm } from './components/AuthForm';
export { ModuleAuthPicker } from './components/ModuleAuthPicker';

// Release state components
export { BetaDisclaimer } from './components/BetaDisclaimer';

// Legal/compliance components
export { HealthDataConsentDialog } from './components/HealthDataConsentDialog';

// Onboarding components
export { OnboardingPage, OnboardingFeatureRow } from './components/OnboardingPage';
export { OnboardingFlow } from './components/OnboardingFlow';

// Books-domain components (future: relocate to @mylife/books)
export { BookCover } from './components/BookCover';
export { StarRating } from './components/StarRating';
export { ShelfBadge } from './components/ShelfBadge';
export { TagPill } from './components/TagPill';
export { ReadingGoalRing } from './components/ReadingGoalRing';
export { SearchBar } from './components/SearchBar';

// Shared state components
export { EmptyState } from './components/EmptyState';
export { LoadingState } from './components/LoadingState';
export { ErrorState } from './components/ErrorState';

// Social-domain components
export { ShareCard } from './components/ShareCard';
