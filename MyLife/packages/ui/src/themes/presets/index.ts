import type { ThemeProfile } from '../schema';
import { COOL_OBSIDIAN } from './cool-obsidian';
import { ARCTIC_LIGHT } from './arctic-light';
import { WARM_ANALOG } from './warm-analog';
import { NEON_TERMINAL } from './neon-terminal';
import { SOFT_GRADIENT } from './soft-gradient';
import { MINIMAL_INK } from './minimal-ink';
import { CANDY_GLASS } from './candy-glass';
import { EARTH_CLAY } from './earth-clay';
import { NEUMORPHIC_SLATE } from './neumorphic-slate';
import { BESTCHEF_OBSIDIAN } from './bestchef-obsidian';
import { BESTCHEF_WARM_CREAM } from './bestchef-warm-cream';
import { BESTCHEF_WARM_CHARCOAL } from './bestchef-warm-charcoal';

export {
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
};

export const THEME_PRESETS: Record<string, ThemeProfile> = {
  'cool-obsidian': COOL_OBSIDIAN,
  'arctic-light': ARCTIC_LIGHT,
  'warm-analog': WARM_ANALOG,
  'neon-terminal': NEON_TERMINAL,
  'soft-gradient': SOFT_GRADIENT,
  'minimal-ink': MINIMAL_INK,
  'candy-glass': CANDY_GLASS,
  'earth-clay': EARTH_CLAY,
  'neumorphic-slate': NEUMORPHIC_SLATE,
  'bestchef-obsidian': BESTCHEF_OBSIDIAN,
  'bestchef-warm-cream': BESTCHEF_WARM_CREAM,
  'bestchef-warm-charcoal': BESTCHEF_WARM_CHARCOAL,
};

export const DEFAULT_THEME: ThemeProfile = COOL_OBSIDIAN;
