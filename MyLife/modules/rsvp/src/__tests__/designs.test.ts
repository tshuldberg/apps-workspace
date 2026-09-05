import { describe, expect, it } from 'vitest';
import { INVITATION_DESIGNS, getDesigns, getDesignById, getDesignsByCategory, applyDesignOverrides, autoContrastTextColor } from '../engines/designs';

describe('designs engine', () => {
  it('has exactly 20 designs', () => {
    expect(INVITATION_DESIGNS).toHaveLength(20);
    expect(getDesigns()).toHaveLength(20);
  });

  it('each design has required fields', () => {
    for (const d of INVITATION_DESIGNS) {
      expect(d.id).toBeTruthy();
      expect(d.name).toBeTruthy();
      expect(d.category).toBeTruthy();
      expect(d.backgroundColor).toBeTruthy();
      expect(d.accentColor).toBeTruthy();
      expect(d.textColor).toBeTruthy();
      expect(d.headerFont).toBeTruthy();
      expect(typeof d.headerWeight).toBe('number');
    }
  });

  it('has 4 designs per category', () => {
    for (const cat of ['celebration', 'elegant', 'casual', 'seasonal', 'minimal'] as const) {
      expect(getDesignsByCategory(cat)).toHaveLength(4);
    }
  });

  it('getDesignById returns correct design', () => {
    const confetti = getDesignById('confetti');
    expect(confetti).not.toBeNull();
    expect(confetti!.name).toBe('Confetti');
    expect(confetti!.category).toBe('celebration');
  });

  it('getDesignById returns null for unknown ID', () => {
    expect(getDesignById('nonexistent')).toBeNull();
  });

  it('applyDesignOverrides merges custom_json overrides', () => {
    const base = getDesignById('confetti')!;
    const result = applyDesignOverrides(base, '{"accentColor":"#00FF00"}');
    expect(result.accentColor).toBe('#00FF00');
    expect(result.backgroundColor).toBe(base.backgroundColor); // unchanged
  });

  it('applyDesignOverrides handles null customJson', () => {
    const base = getDesignById('confetti')!;
    const result = applyDesignOverrides(base, null);
    expect(result).toEqual(base);
  });

  it('applyDesignOverrides handles invalid JSON', () => {
    const base = getDesignById('confetti')!;
    const result = applyDesignOverrides(base, 'not json');
    expect(result).toEqual(base);
  });

  it('autoContrastTextColor returns light text for dark backgrounds', () => {
    expect(autoContrastTextColor('#0A0A0F')).toBe('#F0F0F5');
    expect(autoContrastTextColor('#1A1025')).toBe('#F0F0F5');
  });

  it('autoContrastTextColor returns dark text for light backgrounds', () => {
    expect(autoContrastTextColor('#FFFFFF')).toBe('#1A1A24');
    expect(autoContrastTextColor('#F5F0EB')).toBe('#1A1A24');
  });
});
