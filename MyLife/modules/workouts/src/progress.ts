import type {
  ProgressSession,
  ProgressExercise,
  SetWeightRow,
  StreakInfo,
  VolumeStats,
  PersonalRecord,
  PeriodSummary,
  WorkoutHistoryEntry,
  WeightPR,
} from './types';

export function calculateStreaks(sessions: ProgressSession[]): StreakInfo {
  if (sessions.length === 0) {
    return { current: 0, longest: 0, lastWorkoutDate: null };
  }

  const dayMs = 86400000;
  const dateSet = new Set<number>();
  for (const s of sessions) {
    if (s.completed_at) {
      dateSet.add(Math.floor(Date.parse(s.completed_at) / dayMs));
    }
  }
  const dates = Array.from(dateSet).sort((a, b) => b - a);
  if (dates.length === 0) {
    return { current: 0, longest: 0, lastWorkoutDate: null };
  }

  const lastWorkoutDate = new Date(dates[0] * dayMs).toISOString().slice(0, 10);

  const todayEpochDay = Math.floor(Date.now() / dayMs);
  const streakActive = dates[0] === todayEpochDay || dates[0] === todayEpochDay - 1;

  let current = 0;
  let longest = 0;
  let streak = 1;

  for (let i = 1; i < dates.length; i++) {
    const diffDays = dates[i - 1] - dates[i];

    if (diffDays === 1) {
      streak++;
    } else {
      if (i === 1 || current === 0) {
        if (streakActive && current === 0) current = streak;
      }
      longest = Math.max(longest, streak);
      streak = 1;
    }
  }

  if (streakActive && current === 0) current = streak;
  longest = Math.max(longest, streak);

  return { current, longest, lastWorkoutDate };
}

export function calculateVolume(
  sessions: ProgressSession[],
  exerciseMap: Record<string, ProgressExercise>,
): VolumeStats {
  const stats: VolumeStats = {
    totalSessions: 0,
    totalExercises: 0,
    totalSets: 0,
    totalReps: 0,
    totalDurationMinutes: 0,
    byMuscleGroup: {},
  };

  for (const session of sessions) {
    if (!session.completed_at) continue;
    stats.totalSessions++;

    const startMs = Date.parse(session.started_at);
    const endMs = Date.parse(session.completed_at);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
      stats.totalDurationMinutes += (endMs - startMs) / 60000;
    }

    for (const ce of session.exercises_completed) {
      if (ce.skipped) continue;
      stats.totalExercises++;
      stats.totalSets += ce.sets_completed;
      stats.totalReps += ce.reps_completed ?? 0;

      const exercise = exerciseMap[ce.exercise_id];
      if (exercise) {
        for (const mg of exercise.muscle_groups) {
          stats.byMuscleGroup[mg] = (stats.byMuscleGroup[mg] ?? 0) + 1;
        }
      }
    }
  }

  stats.totalDurationMinutes = Math.round(stats.totalDurationMinutes);
  return stats;
}

export function calculatePersonalRecords(
  sessions: ProgressSession[],
  exerciseMap: Record<string, ProgressExercise>,
): PersonalRecord[] {
  const records = new Map<
    string,
    { maxReps: number; maxSets: number; maxDuration: number | null; achievedAt: string }
  >();

  for (const session of sessions) {
    if (!session.completed_at) continue;

    for (const ce of session.exercises_completed) {
      if (ce.skipped) continue;
      const existing = records.get(ce.exercise_id);
      const reps = ce.reps_completed ?? 0;
      const sets = ce.sets_completed;
      const dur = ce.duration_actual;

      if (!existing) {
        records.set(ce.exercise_id, {
          maxReps: reps,
          maxSets: sets,
          maxDuration: dur,
          achievedAt: session.completed_at,
        });
      } else {
        let updated = false;
        if (reps > existing.maxReps) {
          existing.maxReps = reps;
          updated = true;
        }
        if (sets > existing.maxSets) {
          existing.maxSets = sets;
          updated = true;
        }
        if (dur !== null && (existing.maxDuration === null || dur > existing.maxDuration)) {
          existing.maxDuration = dur;
          updated = true;
        }
        if (updated) existing.achievedAt = session.completed_at;
      }
    }
  }

  const result: PersonalRecord[] = [];
  for (const [exerciseId, rec] of records) {
    const exercise = exerciseMap[exerciseId];
    result.push({
      exerciseId,
      exerciseName: exercise?.name ?? 'Unknown Exercise',
      ...rec,
    });
  }

  return result.sort((a, b) => (b.maxReps + b.maxSets) - (a.maxReps + a.maxSets));
}

export function getWeeklySummaries(
  sessions: ProgressSession[],
  weekCount: number = 8,
): PeriodSummary[] {
  const dayMs = 86400000;
  const weekMs = 7 * dayMs;
  const nowMs = Date.now();
  const maxAgeMs = weekCount * weekMs;
  const buckets = Array.from({ length: weekCount }, () => ({
    sessions: 0,
    totalMinutes: 0,
    totalReps: 0,
  }));

  for (const session of sessions) {
    if (!session.completed_at) continue;

    const completedAtMs = new Date(session.completed_at).getTime();
    const ageMs = nowMs - completedAtMs;
    if (ageMs < 0 || ageMs >= maxAgeMs) continue;

    const weekIndex = Math.floor(ageMs / weekMs);
    const bucket = buckets[weekIndex];
    bucket.sessions += 1;
    bucket.totalMinutes +=
      (completedAtMs - new Date(session.started_at).getTime()) / 60000;

    for (const ce of session.exercises_completed) {
      if (!ce.skipped) bucket.totalReps += ce.reps_completed ?? 0;
    }
  }

  const summaries: PeriodSummary[] = [];
  for (let w = 0; w < weekCount; w++) {
    const weekStart = new Date(nowMs - (w + 1) * weekMs);
    const startLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const bucket = buckets[w];
    summaries.push({
      label: w === 0 ? 'This Week' : w === 1 ? 'Last Week' : startLabel,
      sessions: bucket.sessions,
      totalMinutes: Math.round(bucket.totalMinutes),
      totalReps: bucket.totalReps,
    });
  }

  return summaries;
}

export function buildHistory(
  sessions: ProgressSession[],
  workoutTitles: Record<string, string>,
): WorkoutHistoryEntry[] {
  const entries: WorkoutHistoryEntry[] = [];

  for (const session of sessions) {
    if (!session.completed_at) continue;

    let exercisesCompleted = 0;
    let totalReps = 0;
    for (const ce of session.exercises_completed) {
      if (ce.skipped) continue;
      exercisesCompleted += 1;
      totalReps += ce.reps_completed ?? 0;
    }

    const startedAtMs = Date.parse(session.started_at);
    const completedAtMs = Date.parse(session.completed_at);
    const durationMinutes =
      !Number.isNaN(startedAtMs) && !Number.isNaN(completedAtMs)
        ? Math.round((completedAtMs - startedAtMs) / 60000)
        : 0;

    entries.push({
      sessionId: session.id,
      workoutId: session.workout_id,
      workoutTitle: workoutTitles[session.workout_id] ?? 'Workout',
      date: session.completed_at,
      durationMinutes,
      exercisesCompleted,
      exercisesTotal: session.exercises_completed.length,
      totalReps,
    });
  }

  entries.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return entries;
}

export function calculateWeightPRs(
  sets: SetWeightRow[],
): Map<string, WeightPR> {
  const prs = new Map<string, WeightPR>();

  for (const set of sets) {
    const existing = prs.get(set.exerciseId);

    if (!existing) {
      prs.set(set.exerciseId, {
        maxWeight: set.weight,
        max1RM: set.estimated1rm,
        date: set.createdAt,
      });
    } else {
      let updated = false;
      if (set.weight > existing.maxWeight) {
        existing.maxWeight = set.weight;
        updated = true;
      }
      if (set.estimated1rm > existing.max1RM) {
        existing.max1RM = set.estimated1rm;
        updated = true;
      }
      if (updated) {
        existing.date = set.createdAt;
      }
    }
  }

  return prs;
}
