import type { JournalDashboard, JournalEntry } from '../types';

export function countWords(body: string): number {
  const trimmed = body.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export function estimateReadingTimeMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200));
}

function previousDay(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function calculateJournalStreak(
  distinctDatesDesc: string[],
  referenceDate: string,
): Pick<JournalDashboard, 'currentStreak' | 'longestStreak'> {
  if (distinctDatesDesc.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 0;
  let running = 0;
  let previous: string | null = null;

  for (const date of [...distinctDatesDesc].sort()) {
    if (!previous || previousDay(date) === previous) {
      running += 1;
    } else {
      longestStreak = Math.max(longestStreak, running);
      running = 1;
    }
    previous = date;
  }
  longestStreak = Math.max(longestStreak, running);

  const referenceOrGrace = new Set([referenceDate, previousDay(referenceDate)]);
  if (!referenceOrGrace.has(distinctDatesDesc[0])) {
    return { currentStreak: 0, longestStreak };
  }

  let currentStreak = 1;
  let expected = previousDay(distinctDatesDesc[0]);
  for (let index = 1; index < distinctDatesDesc.length; index += 1) {
    const date = distinctDatesDesc[index];
    if (date !== expected) {
      break;
    }
    currentStreak += 1;
    expected = previousDay(expected);
  }

  return { currentStreak, longestStreak };
}

export function summarizeMoodDistribution(entries: JournalEntry[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((summary, entry) => {
    if (entry.mood) {
      summary[entry.mood] = (summary[entry.mood] ?? 0) + 1;
    }
    return summary;
  }, {});
}
