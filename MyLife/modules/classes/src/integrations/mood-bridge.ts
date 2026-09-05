/**
 * Mood bridge (P9-D): pure helpers correlating academic events (assignment due
 * dates, exams, class meetings, grade releases) with mood entries.
 *
 * Consumer (MyMood) loads its own mood entries and passes them to the
 * correlation function. No DB cross-access here.
 */

import type { AssignmentRow, ClassRow } from '../models/schemas';

export type AcademicEventKind = 'due' | 'exam' | 'class' | 'grade_release';

export interface AcademicEvent {
  date: string;
  kind: AcademicEventKind;
  title: string;
  classId: string | null;
}

export interface MoodEntryLike {
  date: string;
  score: number;
}

export interface MoodEventCorrelation {
  avg_mood_pre_event: number | null;
  avg_mood_post_event: number | null;
  n: number;
}

const PRE_POST_WINDOW_DAYS = 2;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dateOnlyToTime(d: string): number {
  return new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime();
}

function withinRange(date: string, startISO: string, endISO: string): boolean {
  const t = dateOnlyToTime(date);
  return t >= dateOnlyToTime(startISO) && t <= dateOnlyToTime(endISO);
}

/**
 * Build the academic-event timeline within `[startISO, endISO]` (inclusive,
 * date-only comparison). An assignment yields a `due` event (or `exam` if
 * `type === 'exam'`); a graded assignment yields an additional `grade_release`
 * event on `graded_at`. Class meetings are not expanded here (mood doesn't need
 * one row per recurrence — that's the calendar bridge's job).
 */
export function getAcademicEventsInRange(
  assignments: Pick<
    AssignmentRow,
    'title' | 'type' | 'due_at' | 'graded_at' | 'class_id'
  >[],
  classes: Pick<ClassRow, 'id' | 'name' | 'code'>[],
  startISO: string,
  endISO: string,
): AcademicEvent[] {
  const events: AcademicEvent[] = [];

  for (const a of assignments) {
    if (a.due_at && withinRange(a.due_at, startISO, endISO)) {
      const kind: AcademicEventKind = a.type === 'exam' ? 'exam' : 'due';
      events.push({
        date: dayKey(a.due_at),
        kind,
        title: a.title,
        classId: a.class_id,
      });
    }
    if (a.graded_at && withinRange(a.graded_at, startISO, endISO)) {
      events.push({
        date: dayKey(a.graded_at),
        kind: 'grade_release',
        title: a.title,
        classId: a.class_id,
      });
    }
  }

  // Class events are date-anchored to the start of the window only as a marker
  // (one per class); mood correlation does not need per-meeting expansion.
  for (const c of classes) {
    events.push({
      date: dayKey(startISO),
      kind: 'class',
      title: c.code?.trim() || c.name,
      classId: c.id,
    });
  }

  return events;
}

/**
 * Correlate mood with events. For each event, average mood scores in the 2-day
 * window strictly BEFORE the event date and the 2-day window strictly AFTER.
 * Returns `n` = number of events that contributed at least one pre or post
 * sample.
 */
export function correlateMoodWithEvents(
  events: AcademicEvent[],
  moodEntries: MoodEntryLike[],
): MoodEventCorrelation {
  if (events.length === 0 || moodEntries.length === 0) {
    return { avg_mood_pre_event: null, avg_mood_post_event: null, n: 0 };
  }

  const moodByDay = new Map<string, number[]>();
  for (const m of moodEntries) {
    const k = dayKey(m.date);
    const arr = moodByDay.get(k) ?? [];
    arr.push(m.score);
    moodByDay.set(k, arr);
  }

  const preScores: number[] = [];
  const postScores: number[] = [];
  let n = 0;

  for (const e of events) {
    const eventDay = e.date;
    const eventTime = dateOnlyToTime(eventDay);
    let contributed = false;

    for (let offset = 1; offset <= PRE_POST_WINDOW_DAYS; offset += 1) {
      const beforeKey = new Date(eventTime - offset * 86400000)
        .toISOString()
        .slice(0, 10);
      const afterKey = new Date(eventTime + offset * 86400000)
        .toISOString()
        .slice(0, 10);
      const beforeScores = moodByDay.get(beforeKey);
      const afterScores = moodByDay.get(afterKey);
      if (beforeScores) {
        preScores.push(...beforeScores);
        contributed = true;
      }
      if (afterScores) {
        postScores.push(...afterScores);
        contributed = true;
      }
    }
    if (contributed) n += 1;
  }

  const mean = (xs: number[]): number | null =>
    xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    avg_mood_pre_event: mean(preScores),
    avg_mood_post_event: mean(postScores),
    n,
  };
}

/**
 * Render a one-line plain-language insight from a correlation result. With
 * fewer than 5 contributing events, returns a "log more moods" prompt.
 */
export function summarizeAcademicMoodInsight(
  correlation: MoodEventCorrelation,
): string {
  if (correlation.n < 5) {
    return 'Log more moods to see patterns';
  }
  const pre = correlation.avg_mood_pre_event;
  const post = correlation.avg_mood_post_event;
  if (pre === null || post === null) {
    return 'Log more moods to see patterns';
  }
  const delta = post - pre;
  if (Math.abs(delta) < 0.25) {
    return 'Mood holds steady around academic events.';
  }
  if (delta < 0) {
    return `Mood drops by ${Math.abs(delta).toFixed(1)} after academic events.`;
  }
  return `Mood lifts by ${delta.toFixed(1)} after academic events.`;
}
