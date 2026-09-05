import { describe, it, expect } from 'vitest';
import {
  clampRegion,
  percentToPixel,
  pixelToPercent,
  regionContainsPoint,
  validateRegions,
  regionArea,
  isSmallRegion,
} from '../occlusion/engine';

describe('occlusion engine', () => {
  describe('clampRegion', () => {
    it('passes valid region through unchanged', () => {
      const r = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
      expect(clampRegion(r)).toEqual(r);
    });
    it('clamps negative values to 0', () => {
      const r = { x: -0.5, y: -0.1, width: -0.3, height: 0.4 };
      const clamped = clampRegion(r);
      expect(clamped.x).toBe(0);
      expect(clamped.y).toBe(0);
      expect(clamped.width).toBe(0);
    });
    it('clamps values above 1 to 1', () => {
      const r = { x: 1.5, y: 0.5, width: 2.0, height: 0.5 };
      const clamped = clampRegion(r);
      expect(clamped.x).toBe(1);
      expect(clamped.width).toBe(1);
    });
  });

  describe('percentToPixel', () => {
    it('converts 0.5 of 1000 to 500', () => {
      expect(percentToPixel(0.5, 1000)).toBe(500);
    });
    it('converts 0.0 to 0', () => {
      expect(percentToPixel(0, 1000)).toBe(0);
    });
    it('converts 1.0 to full dimension', () => {
      expect(percentToPixel(1, 1000)).toBe(1000);
    });
  });

  describe('pixelToPercent', () => {
    it('converts 500 of 1000 to 0.5', () => {
      expect(pixelToPercent(500, 1000)).toBe(0.5);
    });
    it('returns 0 for zero dimension', () => {
      expect(pixelToPercent(100, 0)).toBe(0);
    });
  });

  describe('regionContainsPoint', () => {
    it('returns true for point inside rect', () => {
      const r = { shape: 'rect' as const, x: 0.2, y: 0.2, width: 0.3, height: 0.3 };
      expect(regionContainsPoint(r, 0.35, 0.35)).toBe(true);
    });
    it('returns false for point outside rect', () => {
      const r = { shape: 'rect' as const, x: 0.2, y: 0.2, width: 0.3, height: 0.3 };
      expect(regionContainsPoint(r, 0.1, 0.1)).toBe(false);
    });
    it('handles ellipse hit detection correctly', () => {
      const r = { shape: 'ellipse' as const, x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
      // center of ellipse
      expect(regionContainsPoint(r, 0.4, 0.4)).toBe(true);
      // corner of bounding box (outside ellipse)
      expect(regionContainsPoint(r, 0.2, 0.2)).toBe(false);
    });
  });

  describe('validateRegions', () => {
    it('returns error for empty regions', () => {
      expect(validateRegions([])).toBe('Draw at least one region to create cards.');
    });
    it('returns null for valid regions', () => {
      expect(validateRegions([{ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }])).toBeNull();
    });
    it('returns error for zero-width region', () => {
      expect(validateRegions([{ x: 0.1, y: 0.1, width: 0, height: 0.2 }])).toBeTruthy();
    });
  });

  describe('regionArea and isSmallRegion', () => {
    it('calculates area correctly', () => {
      expect(regionArea({ width: 0.5, height: 0.4 })).toBeCloseTo(0.2);
    });
    it('detects small regions', () => {
      expect(isSmallRegion({ width: 0.1, height: 0.1 })).toBe(true); // 0.01 < 0.03
      expect(isSmallRegion({ width: 0.3, height: 0.3 })).toBe(false); // 0.09 > 0.03
    });
  });
});
