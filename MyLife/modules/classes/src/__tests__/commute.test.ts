import { describe, expect, it } from 'vitest';
import {
  computeCommutes,
  summarizeCommutes,
  worstCommuteOfWeek,
  type ClassLite,
  type CommuteOptions,
} from '../engine/commute';

function makeClass(
  id: string,
  name: string,
  day_times: ClassLite['day_times'],
  building: string | null = null,
  room: string | null = null,
): ClassLite {
  return { id, name, building, room, day_times };
}

const OPTS: CommuteOptions = { defaultTravelMinutes: 10 };

describe('computeCommutes', () => {
  it('returns [] for empty input', () => {
    expect(computeCommutes([], OPTS)).toEqual([]);
  });

  it('emits no hops when classes are well-spaced (gap > longGap)', () => {
    const a = makeClass('a', 'Math', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ], 'A');
    const b = makeClass('b', 'CS', [
      { day: 'mon', start_time: '14:00', end_time: '15:00' },
    ], 'D');
    expect(computeCommutes([a, b], OPTS)).toEqual([]);
  });

  it('flags a tight transition between buildings A and D', () => {
    const a = makeClass('a', 'Math 101', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ], 'A');
    const b = makeClass('b', 'CS 102', [
      { day: 'mon', start_time: '10:12', end_time: '11:00' },
    ], 'D');
    // gap = 12, travel = 10, tight threshold default 5 → gap < 15 → tight
    const hops = computeCommutes([a, b], OPTS);
    expect(hops).toHaveLength(1);
    expect(hops[0].status).toBe('tight');
    expect(hops[0].gap_minutes).toBe(12);
    expect(hops[0].travel_minutes).toBe(10);
    expect(hops[0].day).toBe('mon');
    expect(hops[0].from.class_id).toBe('a');
    expect(hops[0].to.class_id).toBe('b');
    expect(hops[0].message).toContain('Math 101');
    expect(hops[0].message).toContain('CS 102');
  });

  it('flags an impossible transition (gap < travel)', () => {
    const a = makeClass('a', 'Math', [
      { day: 'tue', start_time: '09:00', end_time: '10:00' },
    ], 'A');
    const b = makeClass('b', 'CS', [
      { day: 'tue', start_time: '10:05', end_time: '11:00' },
    ], 'D');
    // gap = 5, travel = 10 → impossible
    const hops = computeCommutes([a, b], OPTS);
    expect(hops).toHaveLength(1);
    expect(hops[0].status).toBe('impossible');
    expect(hops[0].gap_minutes).toBe(5);
  });

  it('classifies a generous gap as comfortable', () => {
    const a = makeClass('a', 'Math', [
      { day: 'wed', start_time: '09:00', end_time: '10:00' },
    ], 'A');
    const b = makeClass('b', 'CS', [
      { day: 'wed', start_time: '10:30', end_time: '11:00' },
    ], 'D');
    // gap = 30, travel = 10, threshold 5 → 30 >= 15 → comfortable
    const hops = computeCommutes([a, b], OPTS);
    expect(hops).toHaveLength(1);
    expect(hops[0].status).toBe('comfortable');
  });

  it('uses reduced travel for same-building transitions', () => {
    const a = makeClass('a', 'Math', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ], 'A', '101');
    const b = makeClass('b', 'CS', [
      { day: 'mon', start_time: '10:03', end_time: '11:00' },
    ], 'A', '202');
    // same building → travel = max(2, floor(10/4)) = 2
    // gap = 3 → 3 >= 2 (not impossible), 3 < 2+5 → tight
    const hops = computeCommutes([a, b], OPTS);
    expect(hops).toHaveLength(1);
    expect(hops[0].travel_minutes).toBe(2);
    expect(hops[0].status).toBe('tight');
  });

  it('handles a 5-class day with 4 transitions', () => {
    const classes: ClassLite[] = [
      makeClass('c1', 'Class 1', [{ day: 'thu', start_time: '08:00', end_time: '09:00' }], 'A'),
      makeClass('c2', 'Class 2', [{ day: 'thu', start_time: '09:15', end_time: '10:15' }], 'B'),
      makeClass('c3', 'Class 3', [{ day: 'thu', start_time: '10:30', end_time: '11:30' }], 'C'),
      makeClass('c4', 'Class 4', [{ day: 'thu', start_time: '11:45', end_time: '12:45' }], 'D'),
      makeClass('c5', 'Class 5', [{ day: 'thu', start_time: '13:00', end_time: '14:00' }], 'E'),
    ];
    const hops = computeCommutes(classes, OPTS);
    expect(hops).toHaveLength(4);
    expect(hops.map((h) => h.from.class_id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(hops.map((h) => h.to.class_id)).toEqual(['c2', 'c3', 'c4', 'c5']);
    // gap = 15, travel = 10, threshold 5 → 15 < 15? false → comfortable
    expect(hops.every((h) => h.status === 'comfortable')).toBe(true);
  });

  it('respects buildingTravelOverrides matrix', () => {
    const opts: CommuteOptions = {
      defaultTravelMinutes: 10,
      buildingTravelOverrides: { A: { D: 20 } },
    };
    const a = makeClass('a', 'Math', [
      { day: 'fri', start_time: '09:00', end_time: '10:00' },
    ], 'A');
    const b = makeClass('b', 'CS', [
      { day: 'fri', start_time: '10:15', end_time: '11:00' },
    ], 'D');
    // override travel = 20, gap = 15 → 15 < 20 → impossible
    const hops = computeCommutes([a, b], opts);
    expect(hops).toHaveLength(1);
    expect(hops[0].travel_minutes).toBe(20);
    expect(hops[0].status).toBe('impossible');
  });

  it('separates hops by day for multi-day classes', () => {
    const a = makeClass('a', 'Math', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
      { day: 'wed', start_time: '09:00', end_time: '10:00' },
    ], 'A');
    const b = makeClass('b', 'CS', [
      { day: 'mon', start_time: '10:15', end_time: '11:00' },
      { day: 'wed', start_time: '10:15', end_time: '11:00' },
    ], 'B');
    const hops = computeCommutes([a, b], OPTS);
    expect(hops).toHaveLength(2);
    expect(hops.map((h) => h.day).sort()).toEqual(['mon', 'wed']);
  });

  it('skips overlapping pairs (handled by conflict detector)', () => {
    const a = makeClass('a', 'Math', [
      { day: 'mon', start_time: '09:00', end_time: '10:30' },
    ], 'A');
    const b = makeClass('b', 'CS', [
      { day: 'mon', start_time: '10:00', end_time: '11:00' },
    ], 'B');
    expect(computeCommutes([a, b], OPTS)).toEqual([]);
  });

  it('respects custom tightThresholdMinutes', () => {
    const a = makeClass('a', 'Math', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ], 'A');
    const b = makeClass('b', 'CS', [
      { day: 'mon', start_time: '10:25', end_time: '11:00' },
    ], 'B');
    // gap = 25, travel = 10, threshold = 20 → 25 < 30 → tight
    const hops = computeCommutes([a, b], { defaultTravelMinutes: 10, tightThresholdMinutes: 20 });
    expect(hops[0].status).toBe('tight');
  });

  it('treats missing buildings as distinct (uses default travel)', () => {
    const a = makeClass('a', 'Math', [
      { day: 'mon', start_time: '09:00', end_time: '10:00' },
    ]);
    const b = makeClass('b', 'CS', [
      { day: 'mon', start_time: '10:08', end_time: '11:00' },
    ]);
    const hops = computeCommutes([a, b], OPTS);
    expect(hops).toHaveLength(1);
    expect(hops[0].travel_minutes).toBe(10);
    expect(hops[0].status).toBe('impossible'); // gap 8 < 10
  });
});

describe('summarizeCommutes', () => {
  it('returns zeroed summary for empty input', () => {
    const s = summarizeCommutes([]);
    expect(s.total).toBe(0);
    expect(s.tight).toBe(0);
    expect(s.impossible).toBe(0);
    expect(s.by_day.mon).toBe(0);
    expect(s.by_day.sun).toBe(0);
  });

  it('counts tight, impossible, and per-day totals', () => {
    const classes: ClassLite[] = [
      makeClass('a', 'A', [
        { day: 'mon', start_time: '09:00', end_time: '10:00' },
        { day: 'tue', start_time: '09:00', end_time: '10:00' },
      ], 'A'),
      makeClass('b', 'B', [
        { day: 'mon', start_time: '10:05', end_time: '11:00' }, // mon: impossible (gap 5)
        { day: 'tue', start_time: '10:12', end_time: '11:00' }, // tue: tight (gap 12)
      ], 'D'),
    ];
    const hops = computeCommutes(classes, OPTS);
    const s = summarizeCommutes(hops);
    expect(s.total).toBe(2);
    expect(s.impossible).toBe(1);
    expect(s.tight).toBe(1);
    expect(s.by_day.mon).toBe(1);
    expect(s.by_day.tue).toBe(1);
    expect(s.by_day.wed).toBe(0);
  });
});

describe('worstCommuteOfWeek', () => {
  it('returns null for empty input', () => {
    expect(worstCommuteOfWeek([])).toBeNull();
  });

  it('prefers impossible over tight over comfortable', () => {
    const classes: ClassLite[] = [
      makeClass('a', 'A', [
        { day: 'mon', start_time: '09:00', end_time: '10:00' },
        { day: 'tue', start_time: '09:00', end_time: '10:00' },
        { day: 'wed', start_time: '09:00', end_time: '10:00' },
      ], 'A'),
      makeClass('b', 'B', [
        { day: 'mon', start_time: '10:30', end_time: '11:00' }, // comfortable
        { day: 'tue', start_time: '10:12', end_time: '11:00' }, // tight
        { day: 'wed', start_time: '10:05', end_time: '11:00' }, // impossible
      ], 'D'),
    ];
    const hops = computeCommutes(classes, OPTS);
    const worst = worstCommuteOfWeek(hops);
    expect(worst?.status).toBe('impossible');
    expect(worst?.day).toBe('wed');
  });
});
