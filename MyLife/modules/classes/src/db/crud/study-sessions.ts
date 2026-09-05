import type { DatabaseAdapter } from '@mylife/db';
import {
  StudySessionInputSchema,
  StudySessionRowSchema,
  StudySessionUpdateSchema,
  type ClassRow,
  type StudySessionInput,
  type StudySessionRow,
  type StudySessionUpdate,
} from '../../models/schemas';

const DEFAULT_TIMER_TYPE = 'freeform' as const;

function serializeStringArray(
  value: string[] | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  if (value.length === 0) return null;
  return JSON.stringify(value);
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function createStudySession(
  db: DatabaseAdapter,
  id: string,
  input: StudySessionInput,
): StudySessionRow {
  const parsed = StudySessionInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: StudySessionRow = {
    id,
    class_id: parsed.class_id ?? null,
    started_at: parsed.started_at,
    duration_minutes: parsed.duration_minutes,
    location: parsed.location ?? null,
    productivity_rating: parsed.productivity_rating ?? null,
    focus_notes: parsed.focus_notes ?? null,
    companion_ids: serializeStringArray(parsed.companion_ids),
    topics_covered: serializeStringArray(parsed.topics_covered),
    timer_type: parsed.timer_type ?? DEFAULT_TIMER_TYPE,
    pomodoro_count: parsed.pomodoro_count ?? 0,
    created_at: now,
  };

  db.execute(
    `INSERT INTO cs_study_sessions
      (id, class_id, started_at, duration_minutes, location, productivity_rating,
       focus_notes, companion_ids, topics_covered, timer_type, pomodoro_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.class_id,
      row.started_at,
      row.duration_minutes,
      row.location,
      row.productivity_rating,
      row.focus_notes,
      row.companion_ids,
      row.topics_covered,
      row.timer_type,
      row.pomodoro_count,
      row.created_at,
    ],
  );

  return StudySessionRowSchema.parse(row);
}

export function getStudySession(
  db: DatabaseAdapter,
  id: string,
): StudySessionRow | null {
  const rows = db.query<StudySessionRow>(
    `SELECT * FROM cs_study_sessions WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? StudySessionRowSchema.parse(rows[0]) : null;
}

const UPDATABLE_COLUMNS = new Set([
  'class_id',
  'started_at',
  'duration_minutes',
  'location',
  'productivity_rating',
  'focus_notes',
  'timer_type',
  'pomodoro_count',
]);

export function updateStudySession(
  db: DatabaseAdapter,
  id: string,
  updates: StudySessionUpdate,
): void {
  const parsed = StudySessionUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'companion_ids') {
      fields.push('companion_ids = ?');
      values.push(serializeStringArray(value as string[] | null | undefined));
      continue;
    }
    if (key === 'topics_covered') {
      fields.push('topics_covered = ?');
      values.push(serializeStringArray(value as string[] | null | undefined));
      continue;
    }
    if (!UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0) return;

  db.execute(
    `UPDATE cs_study_sessions SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteStudySession(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM cs_study_sessions WHERE id = ?`, [id]);
}

export function listStudySessionsByClass(
  db: DatabaseAdapter,
  classId: string,
  limit?: number,
): StudySessionRow[] {
  const sql = limit
    ? `SELECT * FROM cs_study_sessions WHERE class_id = ? ORDER BY started_at DESC LIMIT ?`
    : `SELECT * FROM cs_study_sessions WHERE class_id = ? ORDER BY started_at DESC`;
  const params: unknown[] = limit ? [classId, limit] : [classId];
  return db
    .query<StudySessionRow>(sql, params)
    .map((row) => StudySessionRowSchema.parse(row));
}

export function listStudySessionsByDateRange(
  db: DatabaseAdapter,
  start: string,
  end: string,
): StudySessionRow[] {
  return db
    .query<StudySessionRow>(
      `SELECT * FROM cs_study_sessions
       WHERE started_at >= ? AND started_at < ?
       ORDER BY started_at ASC`,
      [start, end],
    )
    .map((row) => StudySessionRowSchema.parse(row));
}

// ---- Aggregates / analytics ----

export interface PerClassHours {
  class_id: string | null;
  hours: number;
  percent: number;
}

export interface WeeklySummary {
  total_hours: number;
  by_class: PerClassHours[];
  avg_productivity: number | null;
  study_days: number;
  streak: number;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getWeeklySummary(
  db: DatabaseAdapter,
  weekStart: string,
): WeeklySummary {
  const startISO = `${weekStart.slice(0, 10)}T00:00:00.000Z`;
  const endDay = addDaysISO(weekStart.slice(0, 10), 7);
  const endISO = `${endDay}T00:00:00.000Z`;

  const sessions = listStudySessionsByDateRange(db, startISO, endISO);

  const totalMinutes = sessions.reduce(
    (sum, s) => sum + s.duration_minutes,
    0,
  );
  const totalHours = totalMinutes / 60;

  const byClassMap = new Map<string | null, number>();
  for (const s of sessions) {
    const key = s.class_id ?? null;
    byClassMap.set(key, (byClassMap.get(key) ?? 0) + s.duration_minutes);
  }
  const by_class: PerClassHours[] = Array.from(byClassMap.entries())
    .map(([class_id, minutes]) => ({
      class_id,
      hours: minutes / 60,
      percent: totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0,
    }))
    .sort((a, b) => b.hours - a.hours);

  const ratings = sessions
    .map((s) => s.productivity_rating)
    .filter((r): r is number => typeof r === 'number');
  const avg_productivity =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null;

  const studyDayKeys = new Set(sessions.map((s) => dayKey(s.started_at)));
  const study_days = studyDayKeys.size;

  // Streak across the week window: count consecutive most-recent days ending
  // at the latest study day within the window.
  let streak = 0;
  if (studyDayKeys.size > 0) {
    const sortedDays = Array.from(studyDayKeys).sort();
    const lastDay = sortedDays[sortedDays.length - 1];
    let cursor = lastDay;
    while (studyDayKeys.has(cursor)) {
      streak += 1;
      cursor = addDaysISO(cursor, -1);
    }
  }

  return {
    total_hours: totalHours,
    by_class,
    avg_productivity,
    study_days,
    streak,
  };
}

export interface SubjectAllocation {
  class_id: string;
  actual_hours: number;
  target_percent: number;
  actual_percent: number;
  delta_percent: number;
}

export function getSubjectTimeAllocation(
  classes: Pick<ClassRow, 'id' | 'credits'>[],
  sessions: StudySessionRow[],
): SubjectAllocation[] {
  const totalCredits = classes.reduce((sum, c) => sum + (c.credits || 0), 0);
  const totalMinutes = sessions.reduce(
    (sum, s) => sum + s.duration_minutes,
    0,
  );

  const minutesByClass = new Map<string, number>();
  for (const s of sessions) {
    if (!s.class_id) continue;
    minutesByClass.set(
      s.class_id,
      (minutesByClass.get(s.class_id) ?? 0) + s.duration_minutes,
    );
  }

  return classes.map((cls) => {
    const minutes = minutesByClass.get(cls.id) ?? 0;
    const target_percent =
      totalCredits > 0 ? (cls.credits / totalCredits) * 100 : 0;
    const actual_percent =
      totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0;
    return {
      class_id: cls.id,
      actual_hours: minutes / 60,
      target_percent,
      actual_percent,
      delta_percent: actual_percent - target_percent,
    };
  });
}

export interface LocationStat {
  location: string;
  total_hours: number;
  avg_productivity: number | null;
  session_count: number;
}

export function getLocationStats(sessions: StudySessionRow[]): LocationStat[] {
  const map = new Map<
    string,
    { minutes: number; ratings: number[]; count: number }
  >();
  for (const s of sessions) {
    if (!s.location) continue;
    const entry = map.get(s.location) ?? {
      minutes: 0,
      ratings: [],
      count: 0,
    };
    entry.minutes += s.duration_minutes;
    entry.count += 1;
    if (typeof s.productivity_rating === 'number') {
      entry.ratings.push(s.productivity_rating);
    }
    map.set(s.location, entry);
  }
  return Array.from(map.entries())
    .map(([location, v]) => ({
      location,
      total_hours: v.minutes / 60,
      avg_productivity:
        v.ratings.length > 0
          ? v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length
          : null,
      session_count: v.count,
    }))
    .sort((a, b) => b.total_hours - a.total_hours);
}

export interface StreakInfo {
  current_streak_days: number;
  longest_streak_days: number;
  last_study_date: string | null;
}

export function getStreakInfo(
  sessions: StudySessionRow[],
  today?: string,
): StreakInfo {
  if (sessions.length === 0) {
    return {
      current_streak_days: 0,
      longest_streak_days: 0,
      last_study_date: null,
    };
  }
  const days = Array.from(
    new Set(sessions.map((s) => dayKey(s.started_at))),
  ).sort();

  // Longest streak across all data.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    const prev = days[i - 1];
    const curr = days[i];
    if (addDaysISO(prev, 1) === curr) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  const lastDay = days[days.length - 1];
  const todayKey = today ? dayKey(today) : new Date().toISOString().slice(0, 10);
  const yesterdayKey = addDaysISO(todayKey, -1);

  // Current streak counts only if last study day is today or yesterday.
  let current = 0;
  if (lastDay === todayKey || lastDay === yesterdayKey) {
    const dayset = new Set(days);
    let cursor = lastDay;
    while (dayset.has(cursor)) {
      current += 1;
      cursor = addDaysISO(cursor, -1);
    }
  }

  return {
    current_streak_days: current,
    longest_streak_days: longest,
    last_study_date: lastDay,
  };
}
