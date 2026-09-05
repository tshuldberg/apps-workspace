import type { DatabaseAdapter } from '@mylife/db';
import type {
  MoodEntry,
  MoodActivity,
  MoodEmotionTag,
  MoodEntryActivity,
  BreathingSession,
  MoodSetting,
  CreateMoodEntryInput,
  CreateActivityInput,
  UpdateActivityInput,
  CreateBreathingSessionInput,
  MoodEntryFilter,
  MoodDashboard,
  DailyAverage,
  ActivityCorrelation,
} from '../types';
import { CreateMoodEntryInputSchema, MoodEntryFilterSchema } from '../types';
import { DEFAULT_ACTIVITIES } from '../types';
import { calculateStreaks, pearsonCorrelation } from '../engine/streak';

// ── Helpers ────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function dateFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function rowToEntry(row: Record<string, unknown>): MoodEntry {
  return {
    id: row.id as string,
    score: row.score as number,
    note: (row.note as string) ?? null,
    loggedAt: row.logged_at as string,
    date: row.date as string,
    createdAt: row.created_at as string,
  };
}

function rowToActivity(row: Record<string, unknown>): MoodActivity {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: (row.icon as string) ?? null,
    category: (row.category as string) ?? null,
    isDefault: (row.is_default as number) === 1,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

function rowToEmotionTag(row: Record<string, unknown>): MoodEmotionTag {
  return {
    id: row.id as string,
    entryId: row.entry_id as string,
    emotion: row.emotion as MoodEmotionTag['emotion'],
    intensity: row.intensity as number,
    createdAt: row.created_at as string,
  };
}

function rowToEntryActivity(row: Record<string, unknown>): MoodEntryActivity {
  return {
    id: row.id as string,
    entryId: row.entry_id as string,
    activityId: row.activity_id as string,
    createdAt: row.created_at as string,
  };
}

function rowToBreathingSession(row: Record<string, unknown>): BreathingSession {
  return {
    id: row.id as string,
    pattern: row.pattern as BreathingSession['pattern'],
    durationSeconds: row.duration_seconds as number,
    cyclesCompleted: row.cycles_completed as number,
    completedAt: row.completed_at as string,
    createdAt: row.created_at as string,
  };
}

// ── Mood Entries ────────────────────────────────────────────────────────

export function createMoodEntry(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateMoodEntryInput,
): MoodEntry {
  const input = CreateMoodEntryInputSchema.parse(rawInput);
  const now = nowIso();
  const loggedAt = input.loggedAt ?? now;
  const date = dateFromIso(loggedAt);

  db.transaction(() => {
    db.execute(
      `INSERT INTO mo_entries (id, score, note, logged_at, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.score, input.note, loggedAt, date, now],
    );

    for (const emotionInput of input.emotions) {
      const tagId = crypto.randomUUID();
      db.execute(
        `INSERT INTO mo_emotion_tags (id, entry_id, emotion, intensity, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [tagId, id, emotionInput.emotion, emotionInput.intensity, now],
      );
    }

    for (const activityId of input.activityIds) {
      const linkId = crypto.randomUUID();
      db.execute(
        `INSERT INTO mo_entry_activities (id, entry_id, activity_id, created_at)
         VALUES (?, ?, ?, ?)`,
        [linkId, id, activityId, now],
      );
    }
  });

  return {
    id,
    score: input.score,
    note: input.note ?? null,
    loggedAt,
    date,
    createdAt: now,
  };
}

export function getMoodEntryById(db: DatabaseAdapter, id: string): MoodEntry | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_entries WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToEntry(rows[0]) : null;
}

export function getMoodEntries(
  db: DatabaseAdapter,
  rawFilter?: MoodEntryFilter,
): MoodEntry[] {
  const filter = MoodEntryFilterSchema.parse(rawFilter ?? {});
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.startDate) {
    conditions.push('date >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    conditions.push('date <= ?');
    params.push(filter.endDate);
  }
  if (filter.minScore) {
    conditions.push('score >= ?');
    params.push(filter.minScore);
  }
  if (filter.maxScore) {
    conditions.push('score <= ?');
    params.push(filter.maxScore);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_entries ${where} ORDER BY logged_at DESC LIMIT ? OFFSET ?`,
    [...params, filter.limit, filter.offset],
  );
  return rows.map(rowToEntry);
}

export function getMoodEntriesByDate(db: DatabaseAdapter, date: string, limit = 100): MoodEntry[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_entries WHERE date = ? ORDER BY logged_at DESC LIMIT ?`,
    [date, limit],
  );
  return rows.map(rowToEntry);
}

export function deleteMoodEntry(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM mo_entries WHERE id = ?`, [id]);
  return true;
}

export function getMoodEntryCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM mo_entries`);
  return rows[0].count;
}

// ── Emotion Tags ───────────────────────────────────────────────────────

export function getEmotionTagsForEntry(db: DatabaseAdapter, entryId: string, limit = 50): MoodEmotionTag[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_emotion_tags WHERE entry_id = ? LIMIT ?`,
    [entryId, limit],
  );
  return rows.map(rowToEmotionTag);
}

// ── Activities ─────────────────────────────────────────────────────────

export function createActivity(
  db: DatabaseAdapter,
  id: string,
  input: CreateActivityInput,
): MoodActivity {
  const now = nowIso();
  db.execute(
    `INSERT INTO mo_activities (id, name, icon, category, is_default, sort_order, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [id, input.name, input.icon ?? null, input.category ?? null, input.sortOrder ?? 0, now],
  );
  return {
    id,
    name: input.name,
    icon: input.icon ?? null,
    category: input.category ?? null,
    isDefault: false,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
  };
}

export function getActivities(db: DatabaseAdapter, limit = 500): MoodActivity[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_activities ORDER BY sort_order ASC, name ASC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToActivity);
}

export function getActivityById(db: DatabaseAdapter, id: string): MoodActivity | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_activities WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToActivity(rows[0]) : null;
}

export function updateActivity(
  db: DatabaseAdapter,
  id: string,
  input: UpdateActivityInput,
): MoodActivity | null {
  const existing = getActivityById(db, id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name); }
  if (input.icon !== undefined) { updates.push('icon = ?'); params.push(input.icon); }
  if (input.category !== undefined) { updates.push('category = ?'); params.push(input.category); }
  if (input.sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(input.sortOrder); }

  if (updates.length === 0) return existing;

  params.push(id);
  db.execute(`UPDATE mo_activities SET ${updates.join(', ')} WHERE id = ?`, params);
  return getActivityById(db, id);
}

export function deleteActivity(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM mo_activities WHERE id = ?`, [id]);
  return true;
}

export function getActivitiesForEntry(db: DatabaseAdapter, entryId: string, limit = 50): MoodEntryActivity[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_entry_activities WHERE entry_id = ? LIMIT ?`,
    [entryId, limit],
  );
  return rows.map(rowToEntryActivity);
}

export function seedDefaultActivities(db: DatabaseAdapter): void {
  const existing = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM mo_activities WHERE is_default = 1`,
  );
  if (existing[0].count > 0) return;

  db.transaction(() => {
    for (let i = 0; i < DEFAULT_ACTIVITIES.length; i++) {
      const a = DEFAULT_ACTIVITIES[i];
      db.execute(
        `INSERT INTO mo_activities (id, name, icon, category, is_default, sort_order, created_at)
         VALUES (?, ?, ?, ?, 1, ?, datetime('now'))`,
        [crypto.randomUUID(), a.name, a.icon, a.category, i],
      );
    }
  });
}

// ── Breathing Sessions ─────────────────────────────────────────────────

export function createBreathingSession(
  db: DatabaseAdapter,
  id: string,
  input: CreateBreathingSessionInput,
): BreathingSession {
  const now = nowIso();
  db.execute(
    `INSERT INTO mo_breathing_sessions (id, pattern, duration_seconds, cycles_completed, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.pattern, input.durationSeconds, input.cyclesCompleted, now, now],
  );
  return {
    id,
    pattern: input.pattern,
    durationSeconds: input.durationSeconds,
    cyclesCompleted: input.cyclesCompleted,
    completedAt: now,
    createdAt: now,
  };
}

export function getBreathingSessions(
  db: DatabaseAdapter,
  limit = 50,
): BreathingSession[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_breathing_sessions ORDER BY completed_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToBreathingSession);
}

// ── Settings ───────────────────────────────────────────────────────────

export function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<MoodSetting>(
    `SELECT * FROM mo_settings WHERE key = ?`,
    [key],
  );
  return rows.length > 0 ? rows[0].value : null;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO mo_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

// ── Analytics ──────────────────────────────────────────────────────────

export function getDailyAverages(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
): DailyAverage[] {
  const rows = db.query<{ date: string; avg_score: number; count: number }>(
    `SELECT date, ROUND(AVG(score), 1) as avg_score, COUNT(*) as count
     FROM mo_entries
     WHERE date >= ? AND date <= ?
     GROUP BY date
     ORDER BY date ASC`,
    [startDate, endDate],
  );
  return rows.map((r) => ({
    date: r.date,
    average: r.avg_score,
    count: r.count,
  }));
}

export function getMoodDashboard(db: DatabaseAdapter): MoodDashboard {
  const today = dateFromIso(nowIso());

  // Today entries + average
  const todayRows = db.query<{ count: number; avg_score: number | null }>(
    `SELECT COUNT(*) as count, ROUND(AVG(score), 1) as avg_score
     FROM mo_entries WHERE date = ?`,
    [today],
  );

  // 7-day average
  const weekRows = db.query<{ avg_score: number | null }>(
    `SELECT ROUND(AVG(score), 1) as avg_score
     FROM mo_entries WHERE date >= date(?, '-7 days')`,
    [today],
  );

  // 30-day average
  const monthRows = db.query<{ avg_score: number | null }>(
    `SELECT ROUND(AVG(score), 1) as avg_score
     FROM mo_entries WHERE date >= date(?, '-30 days')`,
    [today],
  );

  // Total count
  const totalRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM mo_entries`,
  );

  // Streak via engine (bounded to last 1000 distinct dates)
  const distinctDates = db.query<{ date: string }>(
    `SELECT DISTINCT date FROM mo_entries ORDER BY date DESC LIMIT 1000`,
  );
  const streaks = calculateStreaks(distinctDates.map((r) => r.date), today);

  return {
    todayEntries: todayRows[0].count,
    todayAverage: todayRows[0].avg_score,
    weekAverage: weekRows[0].avg_score,
    monthAverage: monthRows[0].avg_score,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
    totalEntries: totalRows[0].count,
  };
}

export function getActivityCorrelations(
  db: DatabaseAdapter,
  days = 30,
): ActivityCorrelation[] {
  const today = dateFromIso(nowIso());

  // Get all entries in the date range with their activity links
  const entries = db.query<{ entry_id: string; score: number }>(
    `SELECT id as entry_id, score FROM mo_entries WHERE date >= date(?, '-' || ? || ' days') ORDER BY date ASC LIMIT 5000`,
    [today, days],
  );
  if (entries.length === 0) return [];

  const activityLinks = db.query<{ entry_id: string; activity_id: string; activity_name: string }>(
    `SELECT ea.entry_id, a.id as activity_id, a.name as activity_name
     FROM mo_entry_activities ea
     JOIN mo_activities a ON a.id = ea.activity_id
     JOIN mo_entries e ON e.id = ea.entry_id
     WHERE e.date >= date(?, '-' || ? || ' days')
     LIMIT 50000`,
    [today, days],
  );

  // Build activity -> entry set map
  const activityEntries = new Map<string, { name: string; entryIds: Set<string> }>();
  for (const link of activityLinks) {
    let info = activityEntries.get(link.activity_id);
    if (!info) {
      info = { name: link.activity_name, entryIds: new Set() };
      activityEntries.set(link.activity_id, info);
    }
    info.entryIds.add(link.entry_id);
  }

  // Build entry scores lookup
  const scoreMap = new Map<string, number>();
  for (const e of entries) {
    scoreMap.set(e.entry_id, e.score);
  }

  const results: ActivityCorrelation[] = [];
  for (const [activityId, info] of activityEntries) {
    if (info.entryIds.size < 3) continue;

    // Build presence/score arrays for point-biserial correlation
    const presence: number[] = [];
    const scores: number[] = [];
    let sumWithActivity = 0;
    let countWithActivity = 0;

    for (const e of entries) {
      const has = info.entryIds.has(e.entry_id) ? 1 : 0;
      presence.push(has);
      scores.push(e.score);
      if (has) {
        sumWithActivity += e.score;
        countWithActivity++;
      }
    }

    const avgScore = countWithActivity > 0
      ? Math.round((sumWithActivity / countWithActivity) * 100) / 100
      : 0;

    results.push({
      activityId,
      activityName: info.name,
      entryCount: countWithActivity,
      averageScore: avgScore,
      pearsonR: pearsonCorrelation(presence, scores),
    });
  }

  results.sort((a, b) => (b.pearsonR ?? 0) - (a.pearsonR ?? 0));
  return results;
}

export function getTopEmotions(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
  limit = 10,
): { emotion: string; count: number }[] {
  return db.query<{ emotion: string; count: number }>(
    `SELECT emotion, COUNT(*) as count
     FROM mo_emotion_tags et
     JOIN mo_entries e ON e.id = et.entry_id
     WHERE e.date >= ? AND e.date <= ?
     GROUP BY emotion
     ORDER BY count DESC
     LIMIT ?`,
    [startDate, endDate, limit],
  );
}
