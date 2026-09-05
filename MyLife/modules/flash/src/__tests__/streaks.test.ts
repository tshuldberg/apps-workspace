import { describe, it, expect } from 'vitest';
import {
  checkMilestone,
  getBadgeColor,
  getAtRiskState,
  getBadgeState,
  getEncouragingMessage,
} from '../streaks';

describe('Streak Milestones', () => {
  it('triggers milestone at 3 days', () => {
    const event = checkMilestone(3, 0, 0);
    expect(event).toBeTruthy();
    expect(event!.milestone.days).toBe(3);
  });

  it('triggers milestone at 7 days with enhanced flag', () => {
    const event = checkMilestone(7, 0, 0);
    expect(event!.milestone.days).toBe(7);
    expect(event!.milestone.enhanced).toBe(true);
  });

  it('at 5 days triggers milestone 3 (highest crossed milestone)', () => {
    const event = checkMilestone(5, 0, 0);
    expect(event).toBeTruthy();
    expect(event!.milestone.days).toBe(3);
  });

  it('does not trigger when lastCelebrated covers current range', () => {
    const event = checkMilestone(5, 5, 10);
    expect(event).toBeNull();
  });

  it('does not trigger already celebrated milestone', () => {
    const event = checkMilestone(7, 7, 10);
    expect(event).toBeNull();
  });

  it('triggers new record celebration', () => {
    const event = checkMilestone(15, 10, 10);
    expect(event).toBeTruthy();
    expect(event!.isNewRecord).toBe(true);
    expect(event!.milestone.days).toBe(14);
  });

  it('celebrates highest milestone when multiple crossed', () => {
    // Streak jumps from 0 to 10 (milestones 3 and 7 crossed)
    const event = checkMilestone(10, 0, 0);
    expect(event!.milestone.days).toBe(7);
  });

  it('celebrates 30-day milestone', () => {
    const event = checkMilestone(30, 14, 25);
    expect(event!.milestone.days).toBe(30);
    expect(event!.milestone.enhanced).toBe(true);
    expect(event!.isNewRecord).toBe(true);
  });
});

describe('Badge Colors', () => {
  it('returns gray for 0 streak', () => {
    expect(getBadgeColor(0)).toBe('gray');
  });

  it('returns orange for 1-6', () => {
    expect(getBadgeColor(3)).toBe('orange');
  });

  it('returns amber for 7-29', () => {
    expect(getBadgeColor(15)).toBe('amber');
  });

  it('returns red for 30+', () => {
    expect(getBadgeColor(50)).toBe('red');
  });
});

describe('At-Risk State', () => {
  it('returns true when streak >= 1 and not studied today', () => {
    expect(getAtRiskState(5, false)).toBe(true);
  });

  it('returns false when studied today', () => {
    expect(getAtRiskState(5, true)).toBe(false);
  });

  it('returns false when streak is 0', () => {
    expect(getAtRiskState(0, false)).toBe(false);
  });
});

describe('Badge State', () => {
  it('shows encouraging message when streak is broken', () => {
    const state = getBadgeState(0, 10, false);
    expect(state.encouragingMessage).toBeTruthy();
    expect(state.color).toBe('gray');
  });

  it('shows no message when streak is active', () => {
    const state = getBadgeState(5, 10, true);
    expect(state.encouragingMessage).toBeNull();
  });
});

describe('Encouraging Message', () => {
  it('returns positive message', () => {
    const msg = getEncouragingMessage();
    expect(msg).toContain('Day 1');
    expect(msg).not.toContain('lost');
  });
});
