/**
 * Habits bridge (P9-C): pure helpers turning class data into suggested habits
 * and surfacing study streaks in a habit-friendly DTO.
 */

import { getStreakInfo, type StreakInfo } from '../db/crud/study-sessions';
import type { ClassRow, StudySessionRow } from '../models/schemas';

export type HabitFrequency = 'daily' | 'weekly' | 'class_days';

export interface SuggestedHabit {
  name: string;
  frequency: HabitFrequency;
  classId: string | null;
}

/**
 * Suggest universal + per-class habits. Always returns the universal "Study
 * daily" + "Attend all classes" pair, plus a "Read for <class>" per class.
 */
export function suggestClassHabits(
  classes: Pick<ClassRow, 'id' | 'name' | 'code'>[],
): SuggestedHabit[] {
  const out: SuggestedHabit[] = [
    { name: 'Study daily', frequency: 'daily', classId: null },
    { name: 'Attend all classes', frequency: 'class_days', classId: null },
  ];
  for (const cls of classes) {
    const label = cls.code?.trim() || cls.name;
    out.push({
      name: `Read for ${label}`,
      frequency: 'weekly',
      classId: cls.id,
    });
  }
  return out;
}

/**
 * Re-shape the existing `getStreakInfo` result into a habit-friendly DTO. Takes
 * the same inputs and returns the same shape so consumers can adapt without
 * pulling in the full classes engine surface.
 */
export function summarizeStudyStreak(
  sessions: StudySessionRow[],
  today?: string,
): StreakInfo {
  return getStreakInfo(sessions, today);
}
