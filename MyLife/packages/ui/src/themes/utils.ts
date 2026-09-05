import { ThemeProfileSchema, type ThemeProfile, type ColorMode } from './schema';

/**
 * Resolve a token that may be flat or paired into the value for the active
 * color scheme. Paired tokens have shape { light, dark }; flat tokens are
 * returned unchanged. Used by paired BestChef presets and theme-aware
 * primitives to pick the right swatch for the active mode.
 */
export function pickToken<T>(
  token: T | { light: T; dark: T },
  scheme: ColorMode,
): T {
  if (
    token !== null &&
    typeof token === 'object' &&
    'light' in (token as Record<string, unknown>) &&
    'dark' in (token as Record<string, unknown>)
  ) {
    const paired = token as { light: T; dark: T };
    return scheme === 'dark' ? paired.dark : paired.light;
  }
  return token as T;
}

export type ValidateResult =
  | { success: true; theme: ThemeProfile }
  | { success: false; errors: string[] };

export function validateTheme(json: unknown): ValidateResult {
  const result = ThemeProfileSchema.safeParse(json);
  if (result.success) {
    return { success: true, theme: result.data };
  }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  return { success: false, errors };
}

type Plain = Record<string, unknown>;

function isPlainObject(value: unknown): value is Plain {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function deepMerge<T>(base: T, partial: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(partial)) {
    return (partial === undefined ? base : (partial as T));
  }
  const out: Plain = { ...(base as unknown as Plain) };
  for (const key of Object.keys(partial)) {
    const baseVal = (base as unknown as Plain)[key];
    const partialVal = partial[key];
    if (isPlainObject(baseVal) && isPlainObject(partialVal)) {
      out[key] = deepMerge(baseVal, partialVal);
    } else if (partialVal !== undefined) {
      out[key] = partialVal;
    }
  }
  return out as unknown as T;
}

export function mergeTheme(
  base: ThemeProfile,
  partial: Partial<ThemeProfile>,
): ThemeProfile {
  return deepMerge(base, partial);
}

const FONT_STACK_FALLBACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const MONO_FALLBACK = 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace';
const SERIF_FALLBACK = 'Georgia, "Times New Roman", serif';

const SERIF_FONTS = new Set([
  'Newsreader',
  'Playfair Display',
  'Literata',
  'Lora',
  'Merriweather',
  'Crimson Pro',
]);

const MONO_FONTS = new Set([
  'JetBrains Mono',
  'Fira Code',
  'IBM Plex Mono',
  'Source Code Pro',
  'Roboto Mono',
]);

export function resolveFont(fontFamily: string): string {
  if (!fontFamily || fontFamily.trim().length === 0) {
    return FONT_STACK_FALLBACK;
  }
  const name = fontFamily.trim();
  const quoted = name.includes(' ') ? `"${name}"` : name;
  if (MONO_FONTS.has(name)) {
    return `${quoted}, ${MONO_FALLBACK}`;
  }
  if (SERIF_FONTS.has(name)) {
    return `${quoted}, ${SERIF_FALLBACK}`;
  }
  return `${quoted}, ${FONT_STACK_FALLBACK}`;
}

export function themeToCSS(theme: ThemeProfile): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(theme.colors)) {
    vars[`--theme-color-${toKebab(key)}`] = value;
  }

  vars['--theme-glass-card-fill'] = theme.glass.cardFill;
  vars['--theme-glass-card-border'] = theme.glass.cardBorder;
  vars['--theme-glass-strong-fill'] = theme.glass.strongFill;
  vars['--theme-glass-strong-border'] = theme.glass.strongBorder;
  vars['--theme-glass-dock-fill'] = theme.glass.dockFill;
  vars['--theme-glass-dock-border'] = theme.glass.dockBorder;
  vars['--theme-glass-blur'] = `${theme.glass.blurIntensity}px`;

  vars['--theme-font-display'] = resolveFont(theme.fonts.display);
  vars['--theme-font-body'] = resolveFont(theme.fonts.body);
  if (theme.fonts.mono) {
    vars['--theme-font-mono'] = resolveFont(theme.fonts.mono);
  }

  for (const [variant, entry] of Object.entries(theme.typeScale)) {
    const prefix = `--theme-type-${toKebab(variant)}`;
    vars[`${prefix}-size`] = `${entry.size}px`;
    vars[`${prefix}-weight`] = entry.weight;
    vars[`${prefix}-line-height`] = `${entry.lineHeight}px`;
    if ('letterSpacing' in entry && typeof entry.letterSpacing === 'number') {
      vars[`${prefix}-letter-spacing`] = `${entry.letterSpacing}px`;
    }
  }

  vars['--theme-surface-treatment'] = theme.surfaces.treatment;
  vars['--theme-radius-card'] = `${theme.surfaces.cornerRadius.card}px`;
  vars['--theme-radius-button'] = `${theme.surfaces.cornerRadius.button}px`;
  vars['--theme-radius-icon'] = `${theme.surfaces.cornerRadius.icon}px`;
  vars['--theme-radius-tab-bar'] = `${theme.surfaces.cornerRadius.tabBar}px`;
  vars['--theme-shadow-card'] = theme.surfaces.shadows.card;
  vars['--theme-shadow-elevated'] = theme.surfaces.shadows.elevated;
  if (theme.surfaces.shadows.pressed) {
    vars['--theme-shadow-pressed'] = theme.surfaces.shadows.pressed;
  }

  vars['--theme-layout-dashboard'] = theme.layout.dashboardStyle;
  vars['--theme-layout-grid-columns'] = String(theme.layout.moduleGridColumns);
  vars['--theme-layout-tab-bar'] = theme.layout.tabBarStyle;
  vars['--theme-layout-header'] = theme.layout.headerStyle;
  vars['--theme-spacing-xs'] = `${theme.layout.spacing.xs}px`;
  vars['--theme-spacing-sm'] = `${theme.layout.spacing.sm}px`;
  vars['--theme-spacing-md'] = `${theme.layout.spacing.md}px`;
  vars['--theme-spacing-lg'] = `${theme.layout.spacing.lg}px`;
  vars['--theme-spacing-xl'] = `${theme.layout.spacing.xl}px`;

  return vars;
}

function toKebab(input: string): string {
  return input.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
