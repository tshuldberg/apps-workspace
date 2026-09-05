export interface CommandProgress {
  commandName: string;
  sessionCount: number;
  averageRating: number | null;
  isAutoMastery: boolean;
}

export interface TrainingSummary {
  totalSessions: number;
  uniqueCommands: number;
  masteredCount: number;
  learningCount: number;
  practicingCount: number;
  masteryRate: number;
}

export interface TrainingStreak {
  streak: number;
  lastTrainingDate: string | null;
}

/**
 * Calculate progress for a specific command based on training logs.
 * Auto-mastery threshold: 5+ sessions with avg rating >= 4.0
 */
export function calculateCommandProgress(
  logs: Array<{ successRating: number | null }>,
): CommandProgress & { sessionCount: number; averageRating: number | null } {
  const ratedLogs = logs.filter((l) => l.successRating !== null);
  const sessionCount = logs.length;
  const averageRating = ratedLogs.length > 0
    ? Math.round((ratedLogs.reduce((sum, l) => sum + l.successRating!, 0) / ratedLogs.length) * 10) / 10
    : null;
  const isAutoMastery = ratedLogs.length >= 5 && averageRating !== null && averageRating >= 4.0;

  return { commandName: '', sessionCount, averageRating, isAutoMastery };
}

/**
 * Get training summary across all commands.
 */
export function getTrainingSummary(
  commands: Array<{ status: string }>,
): TrainingSummary {
  const masteredCount = commands.filter((c) => c.status === 'mastered').length;
  const learningCount = commands.filter((c) => c.status === 'learning').length;
  const practicingCount = commands.filter((c) => c.status === 'practicing').length;
  const total = commands.length;

  return {
    totalSessions: 0,
    uniqueCommands: total,
    masteredCount,
    learningCount,
    practicingCount,
    masteryRate: total > 0 ? Math.round((masteredCount / total) * 100) : 0,
  };
}

/**
 * Calculate training streak (consecutive days with at least one training session).
 */
export function calculateTrainingStreak(
  trainingDates: string[],
  today: string,
): TrainingStreak {
  if (trainingDates.length === 0) {
    return { streak: 0, lastTrainingDate: null };
  }

  const uniqueDates = [...new Set(trainingDates)].sort().reverse();
  let streak = 0;
  let checkDate = today;

  if (uniqueDates[0] !== today) {
    const yesterday = addDays(today, -1);
    if (uniqueDates[0] !== yesterday) {
      return { streak: 0, lastTrainingDate: uniqueDates[0] };
    }
    checkDate = yesterday;
  }

  const dateSet = new Set(uniqueDates);
  while (dateSet.has(checkDate)) {
    streak++;
    checkDate = addDays(checkDate, -1);
  }

  return { streak, lastTrainingDate: uniqueDates[0] };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
