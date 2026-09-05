import { describe, expect, it } from 'vitest';
import { PRESETS, getPreset } from '../presets';
import { LAUNCH_PRESETS } from '../presets/launch';
import { encodeThemeBlob, decodeThemeBlob } from '../codec';
import { resolveProfile } from '../resolve';
import { ratesAA } from '../contrast';

describe('launch theme catalog', () => {
  it('offers at least 18 distinct, shareable light/dark themes', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(PRESETS.map((preset) => preset.name)).size).toBe(PRESETS.length);
    for (const preset of PRESETS) {
      expect(getPreset(preset.id)).toEqual(preset);
      expect(decodeThemeBlob(encodeThemeBlob(preset))).toMatchObject({ success: true, theme: preset });
    }
    for (const mode of ['light', 'dark'] as const) {
      expect(new Set(PRESETS.map((preset) => resolveProfile(preset, mode).accent)).size).toBe(PRESETS.length);
    }
  });

  it('keeps new-theme secondary text and accent actions legible on content surfaces', () => {
    for (const preset of LAUNCH_PRESETS) {
      for (const mode of ['light', 'dark'] as const) {
        const c = resolveProfile(preset, mode);
        for (const surface of [c.background, c.surface, c.surfaceElevated]) {
          expect(ratesAA(c.textSecondary, surface), `${preset.id}/${mode} secondary text`).toBe(true);
          expect(ratesAA(c.accent, surface), `${preset.id}/${mode} accent text`).toBe(true);
        }
      }
    }
  });
});
