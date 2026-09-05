import { describe, expect, it } from 'vitest';
import { pickToken } from '../utils';

describe('pickToken', () => {
  it('returns flat string unchanged for either scheme', () => {
    expect(pickToken('#FFB877', 'dark')).toBe('#FFB877');
    expect(pickToken('#FFB877', 'light')).toBe('#FFB877');
  });

  it('selects the dark variant when scheme is dark', () => {
    const paired = { light: '#FCF7F0', dark: '#110D08' };
    expect(pickToken(paired, 'dark')).toBe('#110D08');
  });

  it('selects the light variant when scheme is light', () => {
    const paired = { light: '#FCF7F0', dark: '#110D08' };
    expect(pickToken(paired, 'light')).toBe('#FCF7F0');
  });

  it('preserves generic value type for non-string tokens', () => {
    const paired = {
      light: { from: '#F26A3A', to: '#F2A93A', angle: 135 },
      dark: { from: '#C7522E', to: '#C77B25', angle: 135 },
    };
    expect(pickToken(paired, 'dark').from).toBe('#C7522E');
    expect(pickToken(paired, 'light').from).toBe('#F26A3A');
  });

  it('treats objects without both light and dark as flat', () => {
    const obj = { foo: 1 } as unknown as string;
    expect(pickToken(obj, 'dark')).toBe(obj);
  });
});
