import type { ClassRow, Day, DayTime, ScheduleConflict } from '../models/schemas';

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((part) => Number.parseInt(part, 10));
  return h * 60 + m;
}

function parseDayTimes(raw: string | null | undefined): DayTime[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DayTime[]) : [];
  } catch {
    return [];
  }
}

function blockOverlap(a: DayTime, b: DayTime): number {
  if (a.day !== b.day) return 0;
  const start = Math.max(timeToMinutes(a.start_time), timeToMinutes(b.start_time));
  const end = Math.min(timeToMinutes(a.end_time), timeToMinutes(b.end_time));
  return Math.max(0, end - start);
}

/**
 * Pure schedule-conflict detector.
 *
 * Compares every pair of classes; for each shared day with any time overlap
 * emits a single ScheduleConflict carrying the overlap duration in minutes.
 */
export function detectConflicts(classes: ClassRow[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const blocksByClass = classes.map((c) => ({
    cls: c,
    blocks: parseDayTimes(c.day_times),
  }));

  for (let i = 0; i < blocksByClass.length; i += 1) {
    for (let j = i + 1; j < blocksByClass.length; j += 1) {
      const left = blocksByClass[i];
      const right = blocksByClass[j];
      const seenDays = new Set<Day>();

      for (const blockA of left.blocks) {
        for (const blockB of right.blocks) {
          const overlap = blockOverlap(blockA, blockB);
          if (overlap > 0 && !seenDays.has(blockA.day)) {
            seenDays.add(blockA.day);
            conflicts.push({
              a: left.cls,
              b: right.cls,
              day: blockA.day,
              overlap_minutes: overlap,
            });
          }
        }
      }
    }
  }

  return conflicts;
}
