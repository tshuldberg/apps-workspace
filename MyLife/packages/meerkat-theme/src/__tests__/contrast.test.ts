import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  ratesAA,
  ratesAAA,
  relativeLuminance,
} from '../contrast';

describe('relativeLuminance', () => {
  it('is 1 for white and 0 for black', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6);
  });

  it('accepts 3-digit hex equivalently to 6-digit', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 6);
    expect(relativeLuminance('#000')).toBeCloseTo(relativeLuminance('#000000'), 6);
  });

  it('accepts rgb() notation', () => {
    expect(relativeLuminance('rgb(255,255,255)')).toBeCloseTo(1, 6);
    expect(relativeLuminance('rgb(0, 0, 0)')).toBeCloseTo(0, 6);
  });

  it('matches the WCAG reference for mid grays', () => {
    // #777777 sRGB -> relative luminance ~0.1845 (WCAG formula).
    expect(relativeLuminance('#777777')).toBeCloseTo(0.1845, 3);
  });
});

describe('contrastRatio', () => {
  it('is exactly 21 for black on white (WCAG max)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 2);
  });

  it('is 1 for a color against itself', () => {
    expect(contrastRatio('#0E7C66', '#0E7C66')).toBeCloseTo(1, 6);
  });

  it('is symmetric (order-independent)', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#777777'),
      6,
    );
  });

  it('matches the canonical AA gray boundary on white', () => {
    // #767676 is the darkest gray that still passes AA (4.5) on white (~4.54).
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    // #777777 just misses (~4.48).
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('composites a translucent foreground over the background', () => {
    // 50% black over white renders as ~#808080 -> ratio ~3.98.
    expect(contrastRatio('rgba(0,0,0,0.5)', '#ffffff')).toBeCloseTo(3.98, 1);
    // a=1 must equal the opaque value.
    expect(contrastRatio('rgba(0,0,0,1)', '#ffffff')).toBeCloseTo(
      contrastRatio('#000000', '#ffffff'),
      6,
    );
  });
});

describe('ratesAA / ratesAAA thresholds', () => {
  it('uses 4.5 for normal text and 3.0 for large/UI', () => {
    // #767676 on white ~4.54 passes normal AA; #777777 ~4.48 fails normal but passes large.
    expect(ratesAA('#767676', '#ffffff')).toBe(true);
    expect(ratesAA('#777777', '#ffffff')).toBe(false);
    expect(ratesAA('#777777', '#ffffff', true)).toBe(true);
  });

  it('uses 7.0 for normal AAA and 4.5 for large AAA', () => {
    expect(ratesAAA('#000000', '#ffffff')).toBe(true);
    // ~4.54 fails normal AAA (7.0) but passes large AAA (4.5).
    expect(ratesAAA('#767676', '#ffffff')).toBe(false);
    expect(ratesAAA('#767676', '#ffffff', true)).toBe(true);
  });
});
