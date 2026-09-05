import { describe, expect, it } from 'vitest';
import { DEMO_DISHES } from '../demo';

const HEX_COLOR = /^#[0-9A-F]{6}$/;

describe('DEMO_DISHES', () => {
  it('loads every seeded dish with usable fallback visuals', () => {
    expect(DEMO_DISHES.length).toBeGreaterThan(0);

    for (const dish of DEMO_DISHES) {
      expect(dish.gradientFrom).toMatch(HEX_COLOR);
      expect(dish.gradientTo).toMatch(HEX_COLOR);
      expect(dish.emoji.length).toBeGreaterThan(0);
    }
  });
});
