import { describe, expect, it } from 'vitest';
import {
  calculateChallengeProgressPercent,
  suggestSocialHandle,
} from '../presentation';

describe('presentation helpers', () => {
  it('normalizes handles into lowercase underscore-safe slugs', () => {
    expect(suggestSocialHandle('Trey Porter')).toBe('trey_porter');
    expect(suggestSocialHandle('!!')).toBe('mylife_user');
  });

  it('computes average challenge completion across goals', () => {
    const percent = calculateChallengeProgressPercent(
      {
        goals: [
          {
            id: 'goal-1',
            targetCount: 10,
          },
          {
            id: 'goal-2',
            targetCount: 5,
          },
        ],
      } as any,
      {
        progress: {
          'goal-1': 5,
          'goal-2': 5,
        },
      },
    );

    expect(percent).toBe(75);
  });
});
