import { z } from 'zod';
import { COGNITIVE_DISTORTIONS } from '../cbt/distortions';

// ── Types ──

export const EmotionalTrendSchema = z.enum(['improving', 'stable', 'worsening']);
export type EmotionalTrend = z.infer<typeof EmotionalTrendSchema>;

export const DistortionRankingSchema = z.object({
  type: z.string(),
  label: z.string(),
  count: z.number().int(),
});
export type DistortionRanking = z.infer<typeof DistortionRankingSchema>;

export const TherapeuticProgressSchema = z.object({
  thoughtRecordCompletionRate: z.number(),
  avgBeliefReduction: z.number(),
  topDistortions: z.array(DistortionRankingSchema),
  emotionalIntensityTrend: EmotionalTrendSchema,
  therapyPrepConsistency: z.number(),
  totalThoughtRecords: z.number().int(),
  completedThoughtRecords: z.number().int(),
  totalTherapySessions: z.number().int(),
  sessionsWithPrep: z.number().int(),
});
export type TherapeuticProgress = z.infer<typeof TherapeuticProgressSchema>;

// ── Pure Functions ──

/**
 * Ratio of completed thought records to total records. Returns 0-1.
 */
export function computeThoughtRecordCompletionRate(
  records: Array<{ status: string }>,
): number {
  if (records.length === 0) return 0;
  const completed = records.filter((r) => r.status === 'complete').length;
  return Math.round((completed / records.length) * 100) / 100;
}

/**
 * Average belief reduction (before - after) across completed thought records.
 * Positive means beliefs are being successfully challenged. Returns 0-100.
 */
export function computeAvgBeliefReduction(
  records: Array<{
    status: string;
    thoughtBeliefBefore: number | null;
    thoughtBeliefAfter: number | null;
  }>,
): number {
  const valid = records.filter(
    (r) =>
      r.status === 'complete' &&
      r.thoughtBeliefBefore !== null &&
      r.thoughtBeliefAfter !== null,
  );

  if (valid.length === 0) return 0;

  const totalReduction = valid.reduce(
    (sum, r) => sum + (r.thoughtBeliefBefore! - r.thoughtBeliefAfter!),
    0,
  );

  return Math.round((totalReduction / valid.length) * 100) / 100;
}

/**
 * Rank cognitive distortions by frequency. Returns the top N distortions
 * with human-readable labels from the distortion definitions.
 */
export function rankDistortionsByFrequency(
  distortions: Array<{ distortionType: string }>,
  limit = 5,
): DistortionRanking[] {
  const counts = new Map<string, number>();

  for (const d of distortions) {
    counts.set(d.distortionType, (counts.get(d.distortionType) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([type, count]) => {
      const def = COGNITIVE_DISTORTIONS.find((d) => d.type === type);
      return {
        type,
        label: def?.name ?? type.replace(/_/g, ' '),
        count,
      };
    });
}

/**
 * Detect emotional intensity trend by comparing average intensity
 * in the first half vs second half of emotion records (sorted by date).
 * Uses intensity_before values. Needs 4+ records to detect a trend.
 */
export function computeEmotionalIntensityTrend(
  emotions: Array<{ intensityBefore: number; date: string }>,
): EmotionalTrend {
  if (emotions.length < 4) return 'stable';

  const sorted = [...emotions].sort((a, b) => a.date.localeCompare(b.date));
  const mid = Math.floor(sorted.length / 2);

  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const avgFirst =
    firstHalf.reduce((s, e) => s + e.intensityBefore, 0) / firstHalf.length;
  const avgSecond =
    secondHalf.reduce((s, e) => s + e.intensityBefore, 0) / secondHalf.length;

  const change = avgSecond - avgFirst;

  // Lower intensity is "improving" (less emotional distress)
  if (change < -10) return 'improving';
  if (change > 10) return 'worsening';
  return 'stable';
}

/**
 * Therapy preparation consistency: ratio of therapy sessions that had
 * a therapy_prep entry created beforehand. Returns 0-1.
 */
export function computeTherapyPrepConsistency(
  entries: Array<{
    entryType: string;
    therapySessionNumber: number | null;
  }>,
): { consistency: number; totalSessions: number; sessionsWithPrep: number } {
  const sessionNumbers = new Set<number>();
  const preppedSessions = new Set<number>();

  for (const e of entries) {
    if (e.therapySessionNumber !== null) {
      sessionNumbers.add(e.therapySessionNumber);
    }
    if (e.entryType === 'therapy_prep' && e.therapySessionNumber !== null) {
      preppedSessions.add(e.therapySessionNumber);
    }
  }

  const total = sessionNumbers.size;
  const prepped = preppedSessions.size;

  return {
    consistency: total > 0 ? Math.round((prepped / total) * 100) / 100 : 0,
    totalSessions: total,
    sessionsWithPrep: prepped,
  };
}

/**
 * Aggregate all therapeutic progress metrics.
 */
export function computeTherapeuticProgress(
  thoughtRecords: Array<{
    status: string;
    thoughtBeliefBefore: number | null;
    thoughtBeliefAfter: number | null;
  }>,
  distortions: Array<{ distortionType: string }>,
  emotions: Array<{ intensityBefore: number; date: string }>,
  entries: Array<{
    entryType: string;
    therapySessionNumber: number | null;
  }>,
): TherapeuticProgress {
  const prepStats = computeTherapyPrepConsistency(entries);
  const completed = thoughtRecords.filter((r) => r.status === 'complete').length;

  return {
    thoughtRecordCompletionRate: computeThoughtRecordCompletionRate(thoughtRecords),
    avgBeliefReduction: computeAvgBeliefReduction(thoughtRecords),
    topDistortions: rankDistortionsByFrequency(distortions),
    emotionalIntensityTrend: computeEmotionalIntensityTrend(emotions),
    therapyPrepConsistency: prepStats.consistency,
    totalThoughtRecords: thoughtRecords.length,
    completedThoughtRecords: completed,
    totalTherapySessions: prepStats.totalSessions,
    sessionsWithPrep: prepStats.sessionsWithPrep,
  };
}
