import {
  DAY_ORDER,
  type ClassRow,
  type Day,
  type DayTime,
  type TeacherRow,
} from '../models/schemas';

export interface UpcomingOfficeHour {
  teacher_id: string;
  teacher_name: string;
  class_codes: string[];
  day: Day;
  start_time: string;
  end_time: string;
  office_location: string | null;
  days_from_today: number;
}

const DAY_KEYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function parseOfficeHours(raw: string | null | undefined): DayTime[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DayTime[]) : [];
  } catch {
    return [];
  }
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((part) => Number.parseInt(part, 10));
  return h * 60 + m;
}

/**
 * Convert a JS Date to our day-of-week index where mon=0...sun=6.
 */
function todayIndex(today: Date): number {
  // JS Date: Sun=0, Mon=1, ..., Sat=6. Remap so mon=0...sun=6.
  const js = today.getDay();
  return js === 0 ? 6 : js - 1;
}

function classCodesForTeacher(
  teacherId: string,
  classes: ClassRow[],
): string[] {
  const codes: string[] = [];
  for (const c of classes) {
    if (c.teacher_id !== teacherId) continue;
    const code = c.code?.trim();
    codes.push(code && code.length > 0 ? code : c.name);
  }
  return codes;
}

/**
 * Pure helper: for the current week, return the next N office-hour blocks
 * across all teachers attached to the provided classes, sorted by
 * (days_from_today, start_time).
 *
 * Wraparound rules:
 * - days_from_today wraps the week (today=0, tomorrow=1, ..., yesterday=6).
 * - A block whose day == today and whose start_time AND end_time are both in
 *   the past sorts AFTER blocks later this week (treated as days_from_today=7).
 * - A block on today whose start has passed but end hasn't is still "today"
 *   (days_from_today=0).
 */
export function getUpcomingOfficeHours(
  teachers: TeacherRow[],
  classes: ClassRow[],
  today: Date,
  limit = 5,
): UpcomingOfficeHour[] {
  const todayIdx = todayIndex(today);
  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  const rows: UpcomingOfficeHour[] = [];

  for (const teacher of teachers) {
    const blocks = parseOfficeHours(teacher.office_hours);
    if (blocks.length === 0) continue;
    const codes = classCodesForTeacher(teacher.id, classes);

    for (const block of blocks) {
      const dayIdx = DAY_ORDER[block.day as Day];
      let distance = (dayIdx - todayIdx + 7) % 7;
      if (distance === 0) {
        const startMin = timeToMinutes(block.start_time);
        const endMin = timeToMinutes(block.end_time);
        if (startMin < nowMinutes && endMin <= nowMinutes) {
          distance = 7;
        }
      }
      rows.push({
        teacher_id: teacher.id,
        teacher_name: teacher.name,
        class_codes: codes,
        day: block.day as Day,
        start_time: block.start_time,
        end_time: block.end_time,
        office_location: teacher.office_location,
        days_from_today: distance,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.days_from_today !== b.days_from_today) {
      return a.days_from_today - b.days_from_today;
    }
    if (a.start_time !== b.start_time) {
      return a.start_time < b.start_time ? -1 : 1;
    }
    return a.teacher_name.localeCompare(b.teacher_name);
  });

  return rows.slice(0, limit);
}

export const OFFICE_HOURS_DAY_LABELS: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const OFFICE_HOURS_DAY_LABELS_SHORT: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export function formatRelativeDayLabel(daysFromToday: number, day: Day): string {
  if (daysFromToday === 0) return 'Today';
  if (daysFromToday === 1) return 'Tomorrow';
  if (daysFromToday >= 7) return `Next ${OFFICE_HOURS_DAY_LABELS[day]}`;
  return OFFICE_HOURS_DAY_LABELS[day];
}

export { DAY_KEYS as OFFICE_HOURS_DAY_KEYS };
