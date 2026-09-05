import type { ScheduledSession } from '../types';

function buildDateTime(date: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map((value) => parseInt(value, 10));
  const next = new Date(date);
  next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return next;
}

export function shouldRunToday(scheduled: ScheduledSession, date: Date): boolean {
  return scheduled.active && scheduled.daysOfWeek.includes(date.getDay());
}

export function nextRunDateTime(scheduled: ScheduledSession, fromDate: Date): Date | null {
  if (!scheduled.active || scheduled.daysOfWeek.length === 0) {
    return null;
  }

  for (let offset = 0; offset < 14; offset += 1) {
    const candidateDay = new Date(fromDate);
    candidateDay.setHours(0, 0, 0, 0);
    candidateDay.setDate(candidateDay.getDate() + offset);

    if (!shouldRunToday(scheduled, candidateDay)) {
      continue;
    }

    const candidate = buildDateTime(candidateDay, scheduled.startTime);
    if (candidate.getTime() > fromDate.getTime()) {
      return candidate;
    }
  }

  return null;
}

export function listUpcomingScheduled(
  scheduledSessions: ScheduledSession[],
  days: number,
  fromDate = new Date(),
): { scheduled: ScheduledSession; datetime: Date }[] {
  const endTime = new Date(fromDate);
  endTime.setDate(endTime.getDate() + days);

  return scheduledSessions
    .map((scheduled) => {
      const datetime = nextRunDateTime(scheduled, fromDate);
      return datetime == null ? null : { scheduled, datetime };
    })
    .filter((entry): entry is { scheduled: ScheduledSession; datetime: Date } => (
      entry != null && entry.datetime.getTime() <= endTime.getTime()
    ))
    .sort((left, right) => left.datetime.getTime() - right.datetime.getTime());
}
