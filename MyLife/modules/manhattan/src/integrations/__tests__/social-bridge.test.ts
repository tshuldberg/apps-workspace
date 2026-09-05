import { describe, it, expect } from 'vitest';
import {
  buildPlanShareInput,
  type ManhattanPlanShareInput,
} from '../social-bridge';

describe('buildPlanShareInput', () => {
  const basePlan = {
    title: 'Friday Night Out',
    start_at: '2026-07-04T20:00:00.000Z',
    end_at: null as string | null,
  };

  it('passes the plan title through unchanged', () => {
    const result = buildPlanShareInput(basePlan);
    expect(result.title).toBe('Friday Night Out');
  });

  it('defaults location to New York and eventCount to 0', () => {
    const result = buildPlanShareInput(basePlan);
    expect(result.location).toBe('New York');
    expect(result.eventCount).toBe(0);
  });

  it('applies location and eventCount overrides', () => {
    const result = buildPlanShareInput(basePlan, {
      location: 'Williamsburg',
      eventCount: 3,
    });
    expect(result.location).toBe('Williamsburg');
    expect(result.eventCount).toBe(3);
  });

  it('omits duration when end_at is null', () => {
    const result = buildPlanShareInput(basePlan);
    expect(result.duration).toBeUndefined();
    expect('duration' in result).toBe(false);
  });

  it('omits duration when end_at is absent', () => {
    const result = buildPlanShareInput({
      title: 'Open Plan',
      start_at: '2026-07-04T20:00:00.000Z',
      end_at: null,
    });
    expect(result.duration).toBeUndefined();
  });

  it('computes duration in minutes for a sub-day span', () => {
    const result = buildPlanShareInput({
      title: 'Dinner',
      start_at: '2026-07-04T19:00:00.000Z',
      end_at: '2026-07-04T21:30:00.000Z',
    });
    expect(result.duration).toBe('150 min');
  });

  it('computes duration in days for a multi-day span', () => {
    const result = buildPlanShareInput({
      title: 'Weekend Trip',
      start_at: '2026-07-04T00:00:00.000Z',
      end_at: '2026-07-06T00:00:00.000Z',
    });
    expect(result.duration).toBe('2 days');
  });

  it('uses singular day for an exactly one-day span', () => {
    const result = buildPlanShareInput({
      title: 'Day Out',
      start_at: '2026-07-04T00:00:00.000Z',
      end_at: '2026-07-05T00:00:00.000Z',
    });
    expect(result.duration).toBe('1 day');
  });

  it('omits duration for a non-positive span', () => {
    const result = buildPlanShareInput({
      title: 'Bad Range',
      start_at: '2026-07-04T21:00:00.000Z',
      end_at: '2026-07-04T20:00:00.000Z',
    });
    expect(result.duration).toBeUndefined();
  });

  it('omits duration for unparseable timestamps', () => {
    const result = buildPlanShareInput({
      title: 'Garbage',
      start_at: 'not-a-date',
      end_at: 'also-bad',
    });
    expect(result.duration).toBeUndefined();
  });

  it('returns a typed ManhattanPlanShareInput', () => {
    const result: ManhattanPlanShareInput = buildPlanShareInput(basePlan);
    expect(result).toMatchObject({
      title: 'Friday Night Out',
      location: 'New York',
      eventCount: 0,
    });
  });
});
