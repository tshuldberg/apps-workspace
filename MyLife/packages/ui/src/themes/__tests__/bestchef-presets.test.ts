import { describe, expect, it } from 'vitest';
import {
  BESTCHEF_OBSIDIAN,
  BESTCHEF_WARM_CREAM,
  BESTCHEF_WARM_CHARCOAL,
  THEME_PRESETS,
} from '../presets';
import { ThemeProfileSchema } from '../schema';

describe('BestChef theme presets', () => {
  it.each([
    ['bestchef-obsidian', BESTCHEF_OBSIDIAN],
    ['bestchef-warm-cream', BESTCHEF_WARM_CREAM],
    ['bestchef-warm-charcoal', BESTCHEF_WARM_CHARCOAL],
  ])('%s validates against ThemeProfileSchema', (_id, preset) => {
    const result = ThemeProfileSchema.safeParse(preset);
    expect(result.success).toBe(true);
  });

  it('registers all three BestChef ids in THEME_PRESETS', () => {
    expect(THEME_PRESETS['bestchef-obsidian']).toBe(BESTCHEF_OBSIDIAN);
    expect(THEME_PRESETS['bestchef-warm-cream']).toBe(BESTCHEF_WARM_CREAM);
    expect(THEME_PRESETS['bestchef-warm-charcoal']).toBe(BESTCHEF_WARM_CHARCOAL);
  });

  it('warm-cream uses light color mode and cream canvas', () => {
    expect(BESTCHEF_WARM_CREAM.colorMode).toBe('light');
    expect(BESTCHEF_WARM_CREAM.colors.background).toBe('#FCF7F0');
  });

  it('warm-charcoal uses dark color mode and the are-blaze charcoal canvas', () => {
    expect(BESTCHEF_WARM_CHARCOAL.colorMode).toBe('dark');
    expect(BESTCHEF_WARM_CHARCOAL.colors.background).toBe('#110D08');
  });

  it('bestchef-obsidian preserves the cool-obsidian default surfaces', () => {
    expect(BESTCHEF_OBSIDIAN.colorMode).toBe('dark');
    expect(BESTCHEF_OBSIDIAN.colors.background).toBe('#131318');
  });
});
