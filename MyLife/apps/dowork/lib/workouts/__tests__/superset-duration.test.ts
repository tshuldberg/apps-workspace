import { describe, expect, it } from 'vitest';
import { estimateSupersetDurationSeconds } from '../superset-duration';

describe('estimateSupersetDurationSeconds', () => {
  it('returns 0 for no slots', () => {
    expect(estimateSupersetDurationSeconds([])).toBe(0);
  });

  it('rests once per round, not once per slot per set', () => {
    // Two slots, both 4 sets, both 60s rest. Rest should apply once per
    // round (4 rounds x 60s = 240s), not once per slot per set (2 x 4 x 60 = 480s).
    const slots = [
      { sets: 4, reps: 10, restAfter: 60 },
      { sets: 4, reps: 10, restAfter: 60 },
    ];
    const workSeconds = 4 * 10 * 3 * 2; // sets * reps * 3s/rep * 2 slots
    const expectedRest = 4 * 60; // roundCount * restPerRound
    expect(estimateSupersetDurationSeconds(slots)).toBe(workSeconds + expectedRest);
  });

  it('uses the max sets across slots as the round count when slots differ', () => {
    const slots = [
      { sets: 3, reps: 8, restAfter: 45 },
      { sets: 5, reps: 12, restAfter: 30 },
    ];
    const workSeconds = 3 * 8 * 3 + 5 * 12 * 3;
    const roundCount = 5; // max sets
    const restPerRound = 45; // max restAfter
    expect(estimateSupersetDurationSeconds(slots)).toBe(workSeconds + roundCount * restPerRound);
  });

  it('uses the reps floor of 8 for low-rep work sets', () => {
    const slots = [{ sets: 3, reps: 3, restAfter: 60 }];
    const workSeconds = 3 * 8 * 3; // reps floored to 8
    const expectedRest = 3 * 60;
    expect(estimateSupersetDurationSeconds(slots)).toBe(workSeconds + expectedRest);
  });

  it('does not multiply rest by the number of slots', () => {
    const twoSlots = estimateSupersetDurationSeconds([
      { sets: 4, reps: 10, restAfter: 60 },
      { sets: 4, reps: 10, restAfter: 60 },
    ]);
    const threeSlots = estimateSupersetDurationSeconds([
      { sets: 4, reps: 10, restAfter: 60 },
      { sets: 4, reps: 10, restAfter: 60 },
      { sets: 4, reps: 10, restAfter: 60 },
    ]);
    // Adding a third identical slot should only add work time, not more rest.
    const workDelta = threeSlots - twoSlots;
    expect(workDelta).toBe(4 * 10 * 3);
  });
});
