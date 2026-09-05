import { describe, it, expect } from 'vitest';
import { planReminderTrigger, planStartMs, reminderId } from '../reminders';
import type { PlanRow } from '../../types';

function plan(over: Partial<Pick<PlanRow, 'id' | 'title' | 'start_at' | 'reminder_minutes'>>) {
  return {
    id: 'p1',
    title: 'Dinner at Lilia',
    start_at: '2026-07-01T20:00:00.000Z',
    reminder_minutes: 30,
    ...over,
  };
}

describe('planReminderTrigger', () => {
  const now = new Date('2026-07-01T10:00:00.000Z');

  it('returns null when reminder_minutes is null', () => {
    expect(planReminderTrigger(plan({ reminder_minutes: null }), now)).toBeNull();
  });

  it('returns null when reminder_minutes is undefined', () => {
    const p = plan({});
    delete (p as { reminder_minutes?: number | null }).reminder_minutes;
    expect(planReminderTrigger(p, now)).toBeNull();
  });

  it('returns null when start_at is missing', () => {
    expect(planReminderTrigger(plan({ start_at: '' }), now)).toBeNull();
  });

  it('returns null when start_at is unparseable', () => {
    expect(planReminderTrigger(plan({ start_at: 'not-a-date' }), now)).toBeNull();
  });

  it('returns null when the trigger is in the past', () => {
    const late = new Date('2026-07-01T19:45:00.000Z'); // after 19:30 trigger
    expect(planReminderTrigger(plan({}), late)).toBeNull();
  });

  it('returns null when the trigger equals now (boundary, not in future)', () => {
    const atTrigger = new Date('2026-07-01T19:30:00.000Z');
    expect(planReminderTrigger(plan({}), atTrigger)).toBeNull();
  });

  it('computes triggerAt as start_at minus reminder_minutes', () => {
    const r = planReminderTrigger(plan({}), now);
    expect(r).not.toBeNull();
    expect(r!.triggerAt).toBe('2026-07-01T19:30:00.000Z');
  });

  it('computes a positive floored secondsFromNow', () => {
    const r = planReminderTrigger(plan({}), now);
    // 19:30 - 10:00 = 9.5h = 34200s
    expect(r!.secondsFromNow).toBe(34200);
    expect(r!.secondsFromNow).toBeGreaterThan(0);
  });

  it('floors fractional seconds', () => {
    const oddNow = new Date('2026-07-01T19:29:58.500Z'); // 1.5s before trigger
    const r = planReminderTrigger(plan({}), oddNow);
    expect(r!.secondsFromNow).toBe(1);
  });

  it('builds title and body from the plan', () => {
    const r = planReminderTrigger(plan({ title: 'Show at Bowery', reminder_minutes: 15 }), now);
    expect(r!.planId).toBe('p1');
    expect(r!.title).toBe('Show at Bowery');
    expect(r!.body).toBe('Starts in 15 min: Show at Bowery');
  });
});

describe('planStartMs', () => {
  it('honors an explicit Z / absolute instant', () => {
    expect(planStartMs('2026-07-01T20:00:00.000Z')).toBe(Date.parse('2026-07-01T20:00:00.000Z'));
  });

  it('parses a floating wall-clock string in the local zone', () => {
    // No Z / offset: interpreted as device-local time.
    expect(planStartMs('2026-07-04T20:00')).toBe(new Date(2026, 6, 4, 20, 0, 0).getTime());
  });

  it('returns NaN for an unparseable value', () => {
    expect(Number.isNaN(planStartMs('nope'))).toBe(true);
  });
});

describe('planReminderTrigger with floating-local start (the UI format)', () => {
  it('triggers at the correct local wall time', () => {
    // 8pm local start, 60 min reminder -> 7pm local trigger.
    const now = new Date(2026, 6, 4, 18, 30, 0); // 6:30pm local
    const r = planReminderTrigger(
      { id: 'p9', title: 'Rooftop set', start_at: '2026-07-04T20:00', reminder_minutes: 60 },
      now,
    );
    expect(r).not.toBeNull();
    // tz-independent: expected computed the same local way.
    expect(r!.triggerAt).toBe(new Date(2026, 6, 4, 19, 0, 0).toISOString());
    expect(r!.secondsFromNow).toBe(1800); // 30 min
  });

  it('returns null when the local trigger is already past', () => {
    const now = new Date(2026, 6, 4, 19, 30, 0); // after the 7pm trigger
    const r = planReminderTrigger(
      { id: 'p9', title: 'Rooftop set', start_at: '2026-07-04T20:00', reminder_minutes: 60 },
      now,
    );
    expect(r).toBeNull();
  });
});

describe('reminderId', () => {
  it('is deterministic and prefixed', () => {
    expect(reminderId('abc')).toBe('mh-plan-abc');
    expect(reminderId('abc')).toBe(reminderId('abc'));
  });
});
