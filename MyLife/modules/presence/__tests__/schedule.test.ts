import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  createScheduledSession,
  deleteScheduledSession,
  getScheduledSessions,
  toggleScheduledSession,
  updateScheduledSession,
} from '../src/db';
import { listUpcomingScheduled, nextRunDateTime, shouldRunToday } from '../src/engines';
import type { ScheduledSession } from '../src/types';
import { createTestAdapter } from './test-db';

describe('scheduled session CRUD', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestAdapter();
  });

  it('creates, updates, toggles, and deletes scheduled sessions', () => {
    const created = createScheduledSession(db, {
      name: 'Morning Focus',
      startTime: '08:30',
      durationMinutes: 45,
      daysOfWeek: [5, 1, 3, 1],
      whitelist: ['slack', 'messages'],
      sessionType: 'group',
    });

    expect(created.daysOfWeek).toEqual([1, 3, 5]);
    expect(created.whitelist).toEqual(['slack', 'messages']);
    expect(created.sessionType).toBe('group');
    expect(created.active).toBe(true);
    expect(getScheduledSessions(db)).toHaveLength(1);

    const updated = updateScheduledSession(db, created.id, {
      startTime: '09:00',
      durationMinutes: 30,
      daysOfWeek: [2, 4],
      whitelist: ['mail'],
      sessionType: 'beast',
      active: false,
    });

    expect(updated.startTime).toBe('09:00');
    expect(updated.durationMinutes).toBe(30);
    expect(updated.daysOfWeek).toEqual([2, 4]);
    expect(updated.whitelist).toEqual(['mail']);
    expect(updated.sessionType).toBe('beast');
    expect(updated.active).toBe(false);

    const toggled = toggleScheduledSession(db, created.id, true);
    expect(toggled.active).toBe(true);

    deleteScheduledSession(db, created.id);
    expect(getScheduledSessions(db)).toHaveLength(0);
  });
});

describe('schedule engine', () => {
  const scheduled: ScheduledSession = {
    id: 'scheduled-1',
    name: 'Weekday Focus',
    startTime: '08:00',
    durationMinutes: 45,
    daysOfWeek: [1, 3, 5],
    whitelist: ['mail'],
    sessionType: 'solo',
    active: true,
    createdAt: 0,
    updatedAt: 0,
  };

  it('detects whether a scheduled session should run on a date', () => {
    expect(shouldRunToday(scheduled, new Date('2026-04-06T10:00:00'))).toBe(true);
    expect(shouldRunToday(scheduled, new Date('2026-04-07T10:00:00'))).toBe(false);
    expect(shouldRunToday({ ...scheduled, active: false }, new Date('2026-04-06T10:00:00'))).toBe(false);
  });

  it('finds the next matching run time', () => {
    const sameDay = nextRunDateTime(scheduled, new Date('2026-04-06T07:15:00'));
    expect(sameDay?.getTime()).toBe(new Date('2026-04-06T08:00:00').getTime());

    const afterCutoff = nextRunDateTime(scheduled, new Date('2026-04-06T09:15:00'));
    expect(afterCutoff?.getTime()).toBe(new Date('2026-04-08T08:00:00').getTime());
  });

  it('lists and sorts upcoming scheduled sessions within the requested window', () => {
    const entries = listUpcomingScheduled(
      [
        scheduled,
        {
          ...scheduled,
          id: 'scheduled-2',
          name: 'Night Reset',
          startTime: '20:30',
          daysOfWeek: [1],
        },
        {
          ...scheduled,
          id: 'scheduled-3',
          name: 'Paused',
          active: false,
        },
      ],
      3,
      new Date('2026-04-06T07:00:00'),
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]?.scheduled.id).toBe('scheduled-1');
    expect(entries[1]?.scheduled.id).toBe('scheduled-2');
  });
});
