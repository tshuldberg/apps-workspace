import type { DatabaseAdapter } from '@mylife/db';

export interface MedicationSummary {
  name: string;
  dosage: string | null;
  startDate: string;
  adherenceRate30d: number;
  adherenceRate90d: number;
  streak: number;
  daysRemaining: number | null;
  interactionCount: number;
}

export interface OverallStats {
  totalMedications: number;
  activeMedications: number;
  overallAdherence30d: number;
  moodEntries30d: number;
  averageMoodScore: number | null;
  symptomEntries30d: number;
}

export function getOverallStats(db: DatabaseAdapter): OverallStats {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const from30 = thirtyDaysAgo.toISOString();

  const totalMedications = db.query<{ c: number }>(
    'SELECT COUNT(*) as c FROM md_medications',
  )[0].c;

  const activeMedications = db.query<{ c: number }>(
    'SELECT COUNT(*) as c FROM md_medications WHERE is_active = 1',
  )[0].c;

  const doseStats = db.query<{ total: number; taken: number }>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs WHERE scheduled_time >= ?`,
    [from30],
  );
  const overallAdherence30d = doseStats[0].total > 0
    ? Math.round((doseStats[0].taken / doseStats[0].total) * 100)
    : 100;

  const moodEntries30d = db.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM md_mood_entries WHERE recorded_at >= ?`,
    [from30],
  )[0].c;

  const moodScores = db.query<{ pleasantness: string }>(
    `SELECT pleasantness FROM md_mood_entries WHERE recorded_at >= ?`,
    [from30],
  );
  const averageMoodScore = moodScores.length > 0
    ? moodScores.reduce((sum, r) => {
        if (r.pleasantness === 'pleasant') return sum + 1;
        if (r.pleasantness === 'unpleasant') return sum - 1;
        return sum;
      }, 0) / moodScores.length
    : null;

  const symptomEntries30d = db.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM md_symptom_logs WHERE logged_at >= ?`,
    [from30],
  )[0].c;

  return {
    totalMedications,
    activeMedications,
    overallAdherence30d,
    moodEntries30d,
    averageMoodScore,
    symptomEntries30d,
  };
}
