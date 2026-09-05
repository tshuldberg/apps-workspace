/**
 * Weekly health digest engine.
 * Compiles cross-domain weekly summary from pre-fetched data.
 * Pure functions, no side effects.
 *
 * The digest aggregates sleep, vitals, medication, mood, activity,
 * and mindfulness data into a structured report with highlights and concerns.
 */

export interface DigestSleepDay {
  date: string;
  qualityScore: number;
  durationMinutes: number;
}

export interface DigestVitalReading {
  type: string;
  date: string;
  value: number;
}

export interface DigestMoodEntry {
  date: string;
  pleasantness: 'pleasant' | 'unpleasant' | 'neutral';
}

export interface DigestActivityDay {
  date: string;
  steps: number;
  stepsGoal: number;
}

export interface DigestFastingDay {
  date: string;
  completed: boolean;
}

export interface WeeklyDigestInput {
  dateFrom: string;
  dateTo: string;
  sleepSessions: DigestSleepDay[];
  vitalReadings: DigestVitalReading[];
  medicationAdherence: number;
  moodEntries: DigestMoodEntry[];
  activityDays: DigestActivityDay[];
  fastingDays: DigestFastingDay[];
  breathingSessions: number;
  meditationMinutes: number;
}

export interface SleepDigest {
  averageQuality: number;
  averageDuration: number;
  bestNight: string | null;
  worstNight: string | null;
  totalNights: number;
}

export interface VitalsDigest {
  types: string[];
  totalReadings: number;
  averagesByType: Record<string, number>;
}

export interface MoodDigest {
  totalEntries: number;
  pleasantPercent: number;
  unpleasantPercent: number;
  neutralPercent: number;
}

export interface ActivityDigest {
  averageSteps: number;
  goalHitDays: number;
  totalDays: number;
  totalSteps: number;
}

export interface FastingDigest {
  completedDays: number;
  totalDays: number;
  completionRate: number;
}

export interface MindfulnessDigest {
  breathingSessions: number;
  meditationMinutes: number;
  totalMinutes: number;
}

export interface WeeklyDigest {
  period: { from: string; to: string };
  sections: {
    sleep: SleepDigest;
    vitals: VitalsDigest;
    medication: { adherenceRate: number };
    mood: MoodDigest;
    activity: ActivityDigest;
    fasting: FastingDigest;
    mindfulness: MindfulnessDigest;
  };
  highlights: string[];
  concerns: string[];
}

function round(value: number, decimals = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function summarizeSleep(sessions: DigestSleepDay[]): SleepDigest {
  if (sessions.length === 0) {
    return { averageQuality: 0, averageDuration: 0, bestNight: null, worstNight: null, totalNights: 0 };
  }
  const totalQuality = sessions.reduce((sum, s) => sum + s.qualityScore, 0);
  const totalDuration = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const sorted = [...sessions].sort((a, b) => b.qualityScore - a.qualityScore);

  return {
    averageQuality: round(totalQuality / sessions.length),
    averageDuration: round(totalDuration / sessions.length),
    bestNight: sorted[0]?.date ?? null,
    worstNight: sorted[sorted.length - 1]?.date ?? null,
    totalNights: sessions.length,
  };
}

export function summarizeVitals(readings: DigestVitalReading[]): VitalsDigest {
  const byType = new Map<string, number[]>();
  for (const r of readings) {
    const arr = byType.get(r.type) ?? [];
    arr.push(r.value);
    byType.set(r.type, arr);
  }
  const averagesByType: Record<string, number> = {};
  for (const [type, values] of byType) {
    averagesByType[type] = round(values.reduce((a, b) => a + b, 0) / values.length);
  }
  return {
    types: [...byType.keys()],
    totalReadings: readings.length,
    averagesByType,
  };
}

export function summarizeMood(entries: DigestMoodEntry[]): MoodDigest {
  if (entries.length === 0) {
    return { totalEntries: 0, pleasantPercent: 0, unpleasantPercent: 0, neutralPercent: 0 };
  }
  const pleasant = entries.filter((e) => e.pleasantness === 'pleasant').length;
  const unpleasant = entries.filter((e) => e.pleasantness === 'unpleasant').length;
  const neutral = entries.length - pleasant - unpleasant;
  return {
    totalEntries: entries.length,
    pleasantPercent: round((pleasant / entries.length) * 100),
    unpleasantPercent: round((unpleasant / entries.length) * 100),
    neutralPercent: round((neutral / entries.length) * 100),
  };
}

export function summarizeActivity(days: DigestActivityDay[]): ActivityDigest {
  if (days.length === 0) {
    return { averageSteps: 0, goalHitDays: 0, totalDays: 0, totalSteps: 0 };
  }
  const totalSteps = days.reduce((sum, d) => sum + d.steps, 0);
  const goalHitDays = days.filter((d) => d.steps >= d.stepsGoal).length;
  return {
    averageSteps: Math.round(totalSteps / days.length),
    goalHitDays,
    totalDays: days.length,
    totalSteps,
  };
}

export function summarizeFasting(days: DigestFastingDay[]): FastingDigest {
  if (days.length === 0) {
    return { completedDays: 0, totalDays: 0, completionRate: 0 };
  }
  const completed = days.filter((d) => d.completed).length;
  return {
    completedDays: completed,
    totalDays: days.length,
    completionRate: round((completed / days.length) * 100),
  };
}

export function generateHighlights(digest: WeeklyDigest): string[] {
  const highlights: string[] = [];
  const { sections } = digest;

  if (sections.sleep.averageQuality >= 80) {
    highlights.push(`Excellent sleep quality this week (avg ${sections.sleep.averageQuality}%).`);
  }
  if (sections.medication.adherenceRate >= 95) {
    highlights.push(`Near-perfect medication adherence (${sections.medication.adherenceRate}%).`);
  }
  if (sections.activity.goalHitDays >= 5) {
    highlights.push(`Hit step goals ${sections.activity.goalHitDays} out of ${sections.activity.totalDays} days.`);
  }
  if (sections.fasting.completionRate >= 80 && sections.fasting.totalDays > 0) {
    highlights.push(`Strong fasting consistency (${sections.fasting.completionRate}% completion).`);
  }
  if (sections.mood.pleasantPercent >= 70 && sections.mood.totalEntries > 0) {
    highlights.push(`Mostly positive mood this week (${sections.mood.pleasantPercent}% pleasant).`);
  }
  if (sections.mindfulness.totalMinutes >= 30) {
    highlights.push(`${sections.mindfulness.totalMinutes} minutes of mindfulness practice.`);
  }

  return highlights;
}

export function generateConcerns(digest: WeeklyDigest): string[] {
  const concerns: string[] = [];
  const { sections } = digest;

  if (sections.sleep.averageQuality > 0 && sections.sleep.averageQuality < 50) {
    concerns.push(`Low sleep quality this week (avg ${sections.sleep.averageQuality}%). Consider adjusting your sleep routine.`);
  }
  if (sections.medication.adherenceRate < 80 && sections.medication.adherenceRate > 0) {
    concerns.push(`Medication adherence dropped to ${sections.medication.adherenceRate}%. Check your reminder settings.`);
  }
  if (sections.mood.unpleasantPercent > 50 && sections.mood.totalEntries > 0) {
    concerns.push(`More unpleasant moods than usual (${sections.mood.unpleasantPercent}%). Consider a CBT exercise or talking to someone.`);
  }
  if (sections.activity.totalDays > 0 && sections.activity.goalHitDays === 0) {
    concerns.push('Step goals missed every day this week. Even a short walk helps.');
  }

  return concerns;
}

export function compileWeeklyDigest(input: WeeklyDigestInput): WeeklyDigest {
  const sleep = summarizeSleep(input.sleepSessions);
  const vitals = summarizeVitals(input.vitalReadings);
  const mood = summarizeMood(input.moodEntries);
  const activity = summarizeActivity(input.activityDays);
  const fasting = summarizeFasting(input.fastingDays);
  const mindfulness: MindfulnessDigest = {
    breathingSessions: input.breathingSessions,
    meditationMinutes: input.meditationMinutes,
    totalMinutes: input.meditationMinutes + input.breathingSessions * 5, // ~5 min per session
  };

  const digest: WeeklyDigest = {
    period: { from: input.dateFrom, to: input.dateTo },
    sections: {
      sleep,
      vitals,
      medication: { adherenceRate: input.medicationAdherence },
      mood,
      activity,
      fasting,
      mindfulness,
    },
    highlights: [],
    concerns: [],
  };

  digest.highlights = generateHighlights(digest);
  digest.concerns = generateConcerns(digest);

  return digest;
}
