import { describe, expect, it } from 'vitest';
import type { ClassRow } from '../models/schemas';
import type { ScheduledBlock } from '../db/crud/classes';
import {
  buildConflictIndex,
  computeHourWindow,
  getActiveDays,
  getBlockPosition,
  getDayKey,
  getHourRows,
  getNowLinePosition,
  groupBlocksByDay,
  minutesToTime,
  pickClassColor,
  timeToMinutes,
  withAlpha,
  CLASSES_PALETTE,
} from '../ui';

function fakeRow(id: string, name = 'Class'): ClassRow {
  return {
    id,
    semester_id: 'sem-1',
    name,
    code: null,
    section: null,
    credits: 3,
    day_times: null,
    room: null,
    building: null,
    teacher_id: null,
    category_weights: null,
    current_grade: null,
    target_grade: null,
    color: '#3B82F6',
    notes_md: null,
    created_at: '2026-04-20T00:00:00Z',
    updated_at: '2026-04-20T00:00:00Z',
  };
}

describe('schedule-layout helpers', () => {
  it('round-trips minutes/time', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(0)).toBe('00:00');
  });

  it('computeHourWindow expands beyond fallback when needed', () => {
    const blocks: ScheduledBlock[] = [
      { cls: fakeRow('a'), block: { day: 'mon', start_time: '06:00', end_time: '07:00' } },
      { cls: fakeRow('b'), block: { day: 'tue', start_time: '20:00', end_time: '23:00' } },
    ];
    const win = computeHourWindow(blocks, { startHour: 8, endHour: 18 });
    expect(win.startHour).toBe(6);
    expect(win.endHour).toBe(23);
  });

  it('computeHourWindow returns fallback for empty input', () => {
    expect(computeHourWindow([])).toEqual({ startHour: 7, endHour: 22 });
  });

  it('groupBlocksByDay sorts within each day', () => {
    const blocks: ScheduledBlock[] = [
      { cls: fakeRow('a'), block: { day: 'mon', start_time: '14:00', end_time: '15:00' } },
      { cls: fakeRow('b'), block: { day: 'mon', start_time: '09:00', end_time: '10:00' } },
      { cls: fakeRow('c'), block: { day: 'wed', start_time: '08:00', end_time: '09:00' } },
    ];
    const grouped = groupBlocksByDay(blocks);
    expect(grouped.mon.map((b) => b.block.start_time)).toEqual(['09:00', '14:00']);
    expect(grouped.wed).toHaveLength(1);
    expect(grouped.tue).toEqual([]);
  });

  it('getBlockPosition computes correct top/height percentages', () => {
    const pos = getBlockPosition(
      { day: 'mon', start_time: '10:00', end_time: '11:00' },
      { startHour: 8, endHour: 18 },
    );
    // 10:00 is hour 2 of 10 -> 20%, height 1/10 -> 10%
    expect(pos.topPct).toBeCloseTo(20, 5);
    expect(pos.heightPct).toBeCloseTo(10, 5);
  });

  it('getNowLinePosition returns negative when now is before window', () => {
    const pct = getNowLinePosition(60, { startHour: 8, endHour: 18 });
    expect(pct).toBeLessThan(0);
  });

  it('getActiveDays returns only days with blocks', () => {
    const blocks: ScheduledBlock[] = [
      { cls: fakeRow('a'), block: { day: 'tue', start_time: '09:00', end_time: '10:00' } },
      { cls: fakeRow('b'), block: { day: 'fri', start_time: '13:00', end_time: '14:00' } },
    ];
    expect(getActiveDays(blocks)).toEqual(['tue', 'fri']);
  });

  it('getHourRows is inclusive of start, exclusive of end', () => {
    expect(getHourRows({ startHour: 8, endHour: 11 })).toEqual([8, 9, 10]);
  });

  it('getDayKey maps Sunday->sun, Wednesday->wed', () => {
    // 2026-04-19 is a Sunday
    expect(getDayKey(new Date('2026-04-19T12:00:00Z'))).toBe('sun');
    // 2026-04-22 is a Wednesday
    expect(getDayKey(new Date('2026-04-22T12:00:00Z'))).toBe('wed');
  });

  it('buildConflictIndex maps both sides of every conflict', () => {
    const a = fakeRow('a', 'CS 101');
    const b = fakeRow('b', 'MA 201');
    const idx = buildConflictIndex([
      { a, b, day: 'mon', overlap_minutes: 30 },
    ]);
    expect(idx.get('a')?.[0].otherId).toBe('b');
    expect(idx.get('b')?.[0].otherId).toBe('a');
    expect(idx.get('a')?.[0].overlap_minutes).toBe(30);
  });

  it('pickClassColor is stable per id and inside palette', () => {
    const c1 = pickClassColor('class-abc');
    const c2 = pickClassColor('class-abc');
    expect(c1).toBe(c2);
    expect(CLASSES_PALETTE).toContain(c1);
  });

  it('withAlpha produces rgba', () => {
    expect(withAlpha('#3B82F6', 0.2)).toBe('rgba(59, 130, 246, 0.2)');
    expect(withAlpha('not-hex', 0.5)).toBe('not-hex');
  });
});
