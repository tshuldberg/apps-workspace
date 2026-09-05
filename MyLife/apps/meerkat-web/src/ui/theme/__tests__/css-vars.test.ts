import { describe, expect, it, vi } from 'vitest';
import { OPEN_BURROW, resolveProfile } from '@mylife/meerkat-theme';
import { applyThemeVars, themeToCssVars } from '../css-vars';

describe('themeToCssVars', () => {
  const light = themeToCssVars(resolveProfile(OPEN_BURROW, 'light'));

  it('maps all 22 tokens to kebab-case --mk-* custom properties', () => {
    const keys = Object.keys(light);
    expect(keys.length).toBe(22);
    expect(keys.every((k) => k.startsWith('--mk-'))).toBe(true);
  });

  it('matches the tokens.css variable names and values exactly (Open Burrow light)', () => {
    expect(light['--mk-background']).toBe('#F6F4EF');
    expect(light['--mk-surface-elevated']).toBe('#FBFAF7');
    expect(light['--mk-surface-high']).toBe('#E9F1ED');
    expect(light['--mk-on-accent']).toBe('#FFFFFF');
    expect(light['--mk-text-secondary']).toBe('#51635C');
    expect(light['--mk-danger-soft']).toBe('rgba(179, 65, 62, 0.08)');
    expect(light['--mk-border-strong']).toBe('rgba(32, 48, 43, 0.18)');
    expect(light['--mk-glass-border']).toBe('rgba(14, 124, 102, 0.14)');
  });

  it('emits the dark variant when resolved in dark mode', () => {
    const dark = themeToCssVars(resolveProfile(OPEN_BURROW, 'dark'));
    expect(dark['--mk-background']).toBe('#111816');
    expect(dark['--mk-on-accent']).toBe('#0B2620');
  });
});

describe('applyThemeVars', () => {
  it('sets every var on the target element style', () => {
    const setProperty = vi.fn();
    applyThemeVars(resolveProfile(OPEN_BURROW, 'light'), { style: { setProperty } });
    expect(setProperty).toHaveBeenCalledTimes(22);
    expect(setProperty).toHaveBeenCalledWith('--mk-accent', '#0E7C66');
    expect(setProperty).toHaveBeenCalledWith('--mk-surface-high', '#E9F1ED');
  });

  it('no-ops without a target and without a document', () => {
    expect(() => applyThemeVars(resolveProfile(OPEN_BURROW, 'light'))).not.toThrow();
  });
});
