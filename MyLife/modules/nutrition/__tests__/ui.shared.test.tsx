import { describe, expect, it, vi } from 'vitest';
import { NU_CALORIE, NU_GOAL_STATUS } from '../src/ui/tokens';
import {
  getCalorieRingProgressColor,
} from '../src/ui/components/CalorieRing';
import { getMacroGoalPercent } from '../src/ui/components/MacroBar';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  Image: 'Image',
  Animated: {
    Value: class {
      constructor(public value: number) {}
    },
    spring: () => ({ start: () => undefined }),
  },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    absoluteFillObject: {},
  },
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  G: 'G',
}));

describe('nutrition shared UI helpers', () => {
  it('shifts the calorie ring to the over-goal color once consumed exceeds goal', () => {
    expect(getCalorieRingProgressColor(1850, 2200)).toBe(NU_CALORIE);
    expect(getCalorieRingProgressColor(2401, 2200)).toBe(NU_GOAL_STATUS.over);
  });

  it('calculates and clamps macro goal percentages', () => {
    expect(getMacroGoalPercent(145, 200)).toBe(72.5);
    expect(getMacroGoalPercent(260, 200)).toBe(100);
    expect(getMacroGoalPercent(45, 0)).toBe(0);
  });
});
