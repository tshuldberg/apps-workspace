import type { PlanRow } from '../types';

export interface PlanReminder {
  planId: string;
  title: string;
  body: string;
  triggerAt: string;
  secondsFromNow: number;
}

/**
 * Parse a plan start time to an absolute epoch (ms).
 *
 * Plan start times are floating wall-clock strings ('YYYY-MM-DDTHH:mm') entered
 * in the UI; they are interpreted in the device's local zone, which is where the
 * reminder fires. If the string already carries a 'Z' or an explicit offset, it
 * is an absolute instant and is honored as-is. Returns NaN when unparseable.
 */
export function planStartMs(value: string): number {
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) {
    return Date.parse(value);
  }
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return NaN;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    m[4] ? Number(m[4]) : 0,
    m[5] ? Number(m[5]) : 0,
    m[6] ? Number(m[6]) : 0,
  ).getTime();
}

/**
 * Pure mapper from a plan to a single reminder notification.
 * The app layer schedules the result via expo-notifications.
 * Returns null when there is nothing to schedule.
 */
export function planReminderTrigger(
  plan: Pick<PlanRow, 'id' | 'title' | 'start_at' | 'reminder_minutes'>,
  now: Date = new Date(),
): PlanReminder | null {
  const { reminder_minutes } = plan;
  if (reminder_minutes === null || reminder_minutes === undefined) return null;
  if (!plan.start_at) return null;

  const startMs = planStartMs(plan.start_at);
  if (Number.isNaN(startMs)) return null;

  const triggerMs = startMs - reminder_minutes * 60_000;
  const secondsFromNow = Math.floor((triggerMs - now.getTime()) / 1000);
  if (secondsFromNow <= 0) return null;

  return {
    planId: plan.id,
    title: plan.title,
    body: `Starts in ${reminder_minutes} min: ${plan.title}`,
    triggerAt: new Date(triggerMs).toISOString(),
    secondsFromNow,
  };
}

/** Deterministic notification id for schedule/cancel idempotency. */
export function reminderId(planId: string): string {
  return `mh-plan-${planId}`;
}
