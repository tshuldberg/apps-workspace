import { describe, expect, it } from 'vitest';
import {
  buildIcsEvents,
  type ScheduleBlock,
} from '../integrations/calendar-bridge';

const semester = {
  id: 's1',
  name: 'Spring 2026',
  start_date: '2026-01-12', // Monday
  end_date: '2026-05-03',
};

describe('buildIcsEvents', () => {
  it('returns [] when semester has no start_date', () => {
    expect(
      buildIcsEvents(
        [],
        [],
        { ...semester, start_date: null },
      ),
    ).toEqual([]);
  });

  it('emits one event per schedule block on first matching weekday', () => {
    const blocks: ScheduleBlock[] = [
      {
        classId: 'c1',
        className: 'Algorithms',
        classCode: 'CS 401',
        day: 'mon',
        start_time: '09:00',
        end_time: '10:30',
        location: 'Hall 101',
      },
    ];
    const events = buildIcsEvents(blocks, [], semester);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('CS 401: Algorithms');
    expect(events[0].dtstart).toBe('2026-01-12T09:00:00.000Z');
    expect(events[0].dtend).toBe('2026-01-12T10:30:00.000Z');
    expect(events[0].description).toContain('Hall 101');
    expect(events[0].allDay).toBe(false);
  });

  it('shifts to next matching weekday when block.day != start weekday', () => {
    const blocks: ScheduleBlock[] = [
      {
        classId: 'c1',
        className: 'Algorithms',
        classCode: null,
        day: 'wed',
        start_time: '14:00',
        end_time: '15:00',
      },
    ];
    const events = buildIcsEvents(blocks, [], semester);
    expect(events[0].dtstart.startsWith('2026-01-14')).toBe(true);
  });

  it('emits all-day events for assignments with due dates', () => {
    const events = buildIcsEvents(
      [],
      [
        {
          id: 'a1',
          title: 'Project 1',
          due_at: '2026-04-15T23:59:00.000Z',
          class_id: 'c1',
          description_md: 'See syllabus',
        },
      ],
      semester,
    );
    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(true);
    expect(events[0].summary).toBe('Due: Project 1');
    expect(events[0].dtstart.startsWith('2026-04-15')).toBe(true);
  });

  it('skips assignments without due_at', () => {
    const events = buildIcsEvents(
      [],
      [
        {
          id: 'a1',
          title: 'Whenever',
          due_at: null,
          class_id: 'c1',
          description_md: null,
        },
      ],
      semester,
    );
    expect(events).toHaveLength(0);
  });

  it('uses className when classCode is missing', () => {
    const events = buildIcsEvents(
      [
        {
          classId: 'c1',
          className: 'Music',
          classCode: null,
          day: 'mon',
          start_time: '09:00',
          end_time: '10:00',
        },
      ],
      [],
      semester,
    );
    expect(events[0].summary).toBe('Music');
  });
});
