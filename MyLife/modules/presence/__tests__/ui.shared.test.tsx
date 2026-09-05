import { describe, expect, it } from 'vitest';
import {
  getDailyTimeCardDeltaState,
  getXPLevelBarProgress,
} from '../src/ui/logic';

describe('presence shared UI helpers', () => {
  it('returns the correct delta sign state for under and over usage', () => {
    expect(getDailyTimeCardDeltaState(-30)).toMatchObject({
      direction: 'under',
      icon: 'arrow_downward',
      label: 'below average',
    });

    expect(getDailyTimeCardDeltaState(18)).toMatchObject({
      direction: 'over',
      icon: 'arrow_upward',
      label: 'above average',
    });
  });

  it('calculates XP level bar progress from current and next level bounds', () => {
    expect(
      getXPLevelBarProgress({
        totalXP: 720,
        currentLevelXP: 600,
        nextLevelXP: 1000,
      }),
    ).toBeCloseTo(0.3, 5);
  });
});
