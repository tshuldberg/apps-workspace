// Built-in preset registry. Every preset is AA-verified by the iterating test in
// __tests__/presets.test.ts (TC-4); the High-Contrast preset additionally
// reaches AAA on body text. Open Burrow is the default and an exact port of the
// shipped tokens.ts palette.

import type { MkThemeProfile } from '../types';
import { OPEN_BURROW } from './open-burrow';
import { CALM } from './calm';
import { SOCIAL } from './social';
import { PLAYFUL } from './playful';
import { SERIOUS } from './serious';
import { HIGH_CONTRAST } from './high-contrast';
import { LAUNCH_PRESETS } from './launch';

export const DEFAULT_PRESET_ID = 'open-burrow';

export const PRESETS: readonly MkThemeProfile[] = [
  OPEN_BURROW,
  CALM,
  SOCIAL,
  PLAYFUL,
  SERIOUS,
  ...LAUNCH_PRESETS,
  HIGH_CONTRAST,
];

export const PRESET_IDS: readonly string[] = PRESETS.map((p) => p.id);

const PRESET_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

/** Look up a built-in preset by id. Returns undefined for custom/unknown ids. */
export function getPreset(id: string): MkThemeProfile | undefined {
  return PRESET_BY_ID.get(id);
}

/** True when an id names a reserved built-in preset (never a custom uuid). */
export function isPresetId(id: string): boolean {
  return PRESET_BY_ID.has(id);
}

export {
  OPEN_BURROW,
  CALM,
  SOCIAL,
  PLAYFUL,
  SERIOUS,
  HIGH_CONTRAST,
};
