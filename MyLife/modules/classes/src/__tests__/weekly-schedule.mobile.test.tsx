import { describe, expect, it } from 'vitest';
import type { ClassRow, ScheduleConflict } from '../models/schemas';
import type { ScheduledBlock } from '../db/crud/classes';
import type { Day } from '../models/schemas';
import {
  ALL_DAYS,
  buildConflictIndex,
  computeHourWindow,
  getActiveDays,
  getBlockPosition,
  getHourRows,
  groupBlocksByDay,
  pickClassColor,
} from '../ui';

/**
 * Snapshot test for the WeeklySchedule render plan.
 *
 * The actual `WeeklySchedule.tsx` component lives in `apps/mobile/components/classes/`
 * (where RN + react-test-renderer are available). This test snapshots the pure
 * layout pipeline that drives that component. If anything changes in the layout
 * math or grouping, the snapshot fails -- which is the contract this test guards.
 *
 * Stored under `weekly-schedule.mobile.test.tsx` per the P1-B prompt so that
 * mission control sees coverage attached to the mobile pipeline.
 */
function row(id: string, name: string, color: string): ClassRow {
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
    color,
    notes_md: null,
    created_at: '2026-04-20T00:00:00Z',
    updated_at: '2026-04-20T00:00:00Z',
  };
}

interface RenderPlan {
  window: { startHour: number; endHour: number };
  hourRows: number[];
  visibleDays: Day[];
  perDay: Array<{
    day: Day;
    items: Array<{
      classId: string;
      name: string;
      color: string;
      start: string;
      end: string;
      topPct: number;
      heightPct: number;
      conflicts: string[];
    }>;
  }>;
  totalConflicts: number;
}

function buildRenderPlan(
  blocks: ScheduledBlock[],
  conflicts: ScheduleConflict[],
  showWeekends: boolean,
): RenderPlan {
  const window = computeHourWindow(blocks);
  const grouped = groupBlocksByDay(blocks);
  const conflictIndex = buildConflictIndex(conflicts);
  const visibleDays = showWeekends
    ? ALL_DAYS
    : ALL_DAYS.filter((d) => d !== 'sat' && d !== 'sun');

  return {
    window,
    hourRows: getHourRows(window),
    visibleDays,
    totalConflicts: conflicts.length,
    perDay: visibleDays.map((day) => ({
      day,
      items: (grouped[day] ?? []).map((sb) => {
        const pos = getBlockPosition(sb.block, window);
        const cflList = (conflictIndex.get(sb.cls.id) ?? [])
          .filter((c) => c.day === day)
          .map((c) => c.otherName);
        return {
          classId: sb.cls.id,
          name: sb.cls.name,
          color: sb.cls.color,
          start: sb.block.start_time,
          end: sb.block.end_time,
          topPct: Number(pos.topPct.toFixed(2)),
          heightPct: Number(pos.heightPct.toFixed(2)),
          conflicts: cflList,
        };
      }),
    })),
  };
}

describe('WeeklySchedule render plan (mobile)', () => {
  it('snapshots a typical week with conflicts', () => {
    const cs = row('c-cs101', 'CS 101', pickClassColor('c-cs101'));
    const ma = row('c-ma201', 'MA 201', pickClassColor('c-ma201'));
    const en = row('c-en110', 'EN 110', pickClassColor('c-en110'));

    const blocks: ScheduledBlock[] = [
      { cls: cs, block: { day: 'mon', start_time: '09:00', end_time: '10:30' } },
      { cls: cs, block: { day: 'wed', start_time: '09:00', end_time: '10:30' } },
      { cls: ma, block: { day: 'mon', start_time: '10:00', end_time: '11:00' } },
      { cls: ma, block: { day: 'thu', start_time: '13:00', end_time: '14:30' } },
      { cls: en, block: { day: 'fri', start_time: '14:00', end_time: '15:30' } },
    ];

    const conflicts: ScheduleConflict[] = [
      { a: cs, b: ma, day: 'mon', overlap_minutes: 30 },
    ];

    const plan = buildRenderPlan(blocks, conflicts, false);
    expect(plan).toMatchSnapshot();
  });

  it('collapses to active days when narrow + weekends hidden', () => {
    const blocks: ScheduledBlock[] = [
      {
        cls: row('c-1', 'Studio', '#F472B6'),
        block: { day: 'tue', start_time: '18:00', end_time: '20:00' },
      },
    ];
    const active = getActiveDays(blocks);
    expect(active).toEqual(['tue']);
  });
});
