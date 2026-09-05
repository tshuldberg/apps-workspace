import type { DatabaseAdapter } from '@mylife/db';

export interface MoodMedicationCorrelation {
  medicationName: string;
  medicationStartDate: string;
  beforeAverage: number | null;
  afterAverage: number | null;
  changePercent: number | null;
  beforeDataPoints: number;
  afterDataPoints: number;
}

export interface SymptomCorrelationItem {
  symptomName: string;
  beforeCount: number;
  afterCount: number;
  changePercent: number;
}

export interface SymptomMedicationCorrelation {
  medicationName: string;
  medicationStartDate: string;
  symptoms: SymptomCorrelationItem[];
}

export interface AdherenceMoodCorrelation {
  correlationCoefficient: number;
  adherentDaysMoodAvg: number | null;
  missedDaysMoodAvg: number | null;
}

export interface WellnessTimelineEntry {
  date: string;
  moodScore: number | null;
  adherenceRate: number;
  symptomCount: number;
}

function pleasantnessToScore(p: string): number {
  if (p === 'pleasant') return 1;
  if (p === 'unpleasant') return -1;
  return 0;
}

/**
 * Compare average mood pleasantness before/after a medication start date.
 */
export function getMoodMedicationCorrelation(
  db: DatabaseAdapter,
  medicationId: string,
  days: number = 90,
): MoodMedicationCorrelation | null {
  const med = db.query<{ name: string; created_at: string }>(
    'SELECT name, created_at FROM md_medications WHERE id = ?',
    [medicationId],
  );
  if (med.length === 0) return null;

  const { name, created_at: startDate } = med[0];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  const before = db.query<{ pleasantness: string }>(
    `SELECT pleasantness FROM md_mood_entries
     WHERE recorded_at >= ? AND recorded_at < ?
     ORDER BY recorded_at`,
    [cutoffStr, startDate],
  );

  const after = db.query<{ pleasantness: string }>(
    `SELECT pleasantness FROM md_mood_entries
     WHERE recorded_at >= ?
     ORDER BY recorded_at`,
    [startDate],
  );

  const beforeAvg = before.length > 0
    ? before.reduce((sum, r) => sum + pleasantnessToScore(r.pleasantness), 0) / before.length
    : null;
  const afterAvg = after.length > 0
    ? after.reduce((sum, r) => sum + pleasantnessToScore(r.pleasantness), 0) / after.length
    : null;

  let changePercent: number | null = null;
  if (beforeAvg !== null && afterAvg !== null && beforeAvg !== 0) {
    changePercent = Math.round(((afterAvg - beforeAvg) / Math.abs(beforeAvg)) * 100);
  }

  return {
    medicationName: name,
    medicationStartDate: startDate,
    beforeAverage: beforeAvg,
    afterAverage: afterAvg,
    changePercent,
    beforeDataPoints: before.length,
    afterDataPoints: after.length,
  };
}

/**
 * Compare symptom frequency before/after a medication start date.
 */
export function getSymptomMedicationCorrelation(
  db: DatabaseAdapter,
  medicationId: string,
  days: number = 90,
): SymptomMedicationCorrelation | null {
  const med = db.query<{ name: string; created_at: string }>(
    'SELECT name, created_at FROM md_medications WHERE id = ?',
    [medicationId],
  );
  if (med.length === 0) return null;

  const { name, created_at: startDate } = med[0];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  const symptoms = db.query<{ id: string; name: string }>('SELECT id, name FROM md_symptoms');
  const result: SymptomCorrelationItem[] = [];

  for (const symptom of symptoms) {
    const beforeCount = db.query<{ c: number }>(
      `SELECT COUNT(*) as c FROM md_symptom_logs
       WHERE symptom_id = ? AND logged_at >= ? AND logged_at < ?`,
      [symptom.id, cutoffStr, startDate],
    )[0].c;

    const afterCount = db.query<{ c: number }>(
      `SELECT COUNT(*) as c FROM md_symptom_logs
       WHERE symptom_id = ? AND logged_at >= ?`,
      [symptom.id, startDate],
    )[0].c;

    if (beforeCount > 0 || afterCount > 0) {
      const changePercent = beforeCount > 0
        ? Math.round(((afterCount - beforeCount) / beforeCount) * 100)
        : afterCount > 0 ? 100 : 0;
      result.push({ symptomName: symptom.name, beforeCount, afterCount, changePercent });
    }
  }

  return { medicationName: name, medicationStartDate: startDate, symptoms: result };
}

/**
 * Correlate daily adherence with mood scores. Simple Pearson coefficient.
 */
export function getAdherenceMoodCorrelation(
  db: DatabaseAdapter,
  medicationId: string,
  days: number = 90,
): AdherenceMoodCorrelation {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Get daily adherence: 1 if all doses taken, 0 if any missed
  const doseDays = db.query<{ day: string; total: number; taken: number }>(
    `SELECT DATE(scheduled_time) as day, COUNT(*) as total,
            SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs
     WHERE medication_id = ? AND scheduled_time >= ?
     GROUP BY DATE(scheduled_time)`,
    [medicationId, cutoffStr],
  );

  // Get daily mood scores
  const moodDays = db.query<{ day: string; avg_score: number }>(
    `SELECT DATE(recorded_at) as day,
            AVG(CASE WHEN pleasantness = 'pleasant' THEN 1 WHEN pleasantness = 'unpleasant' THEN -1 ELSE 0 END) as avg_score
     FROM md_mood_entries
     WHERE recorded_at >= ?
     GROUP BY DATE(recorded_at)`,
    [cutoffStr],
  );

  const moodMap = new Map(moodDays.map((m) => [m.day, m.avg_score]));

  let adherentMoodSum = 0, adherentMoodCount = 0;
  let missedMoodSum = 0, missedMoodCount = 0;
  const pairs: { adherence: number; mood: number }[] = [];

  for (const day of doseDays) {
    const mood = moodMap.get(day.day);
    if (mood === undefined) continue;
    const adherent = day.taken === day.total ? 1 : 0;
    pairs.push({ adherence: adherent, mood });
    if (adherent) { adherentMoodSum += mood; adherentMoodCount++; }
    else { missedMoodSum += mood; missedMoodCount++; }
  }

  // Pearson correlation
  let coefficient = 0;
  if (pairs.length >= 2) {
    const n = pairs.length;
    const sumX = pairs.reduce((s, p) => s + p.adherence, 0);
    const sumY = pairs.reduce((s, p) => s + p.mood, 0);
    const sumXY = pairs.reduce((s, p) => s + p.adherence * p.mood, 0);
    const sumX2 = pairs.reduce((s, p) => s + p.adherence * p.adherence, 0);
    const sumY2 = pairs.reduce((s, p) => s + p.mood * p.mood, 0);
    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    coefficient = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  }

  return {
    correlationCoefficient: Math.round(coefficient * 1000) / 1000,
    adherentDaysMoodAvg: adherentMoodCount > 0 ? adherentMoodSum / adherentMoodCount : null,
    missedDaysMoodAvg: missedMoodCount > 0 ? missedMoodSum / missedMoodCount : null,
  };
}

/**
 * Get daily wellness timeline: mood, adherence, symptom count per day.
 */
export function getOverallWellnessTimeline(
  db: DatabaseAdapter,
  from: string,
  to: string,
): WellnessTimelineEntry[] {
  const timeline: WellnessTimelineEntry[] = [];
  const start = new Date(from);
  const end = new Date(to);

  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const prefix = `${dateStr}%`;

    const moodRows = db.query<{ pleasantness: string }>(
      `SELECT pleasantness FROM md_mood_entries WHERE recorded_at LIKE ?`,
      [prefix],
    );
    const moodScore = moodRows.length > 0
      ? moodRows.reduce((sum, r) => sum + pleasantnessToScore(r.pleasantness), 0) / moodRows.length
      : null;

    const doseRows = db.query<{ total: number; taken: number }>(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
       FROM md_dose_logs WHERE scheduled_time LIKE ?`,
      [prefix],
    );
    const total = Number(doseRows[0].total);
    const taken = Number(doseRows[0].taken ?? 0);
    const adherenceRate = total > 0
      ? Math.round((taken / total) * 100)
      : 100;

    const symptomCount = db.query<{ c: number }>(
      `SELECT COUNT(*) as c FROM md_symptom_logs WHERE logged_at LIKE ?`,
      [prefix],
    )[0].c;

    timeline.push({ date: dateStr, moodScore, adherenceRate, symptomCount });
  }

  return timeline;
}
