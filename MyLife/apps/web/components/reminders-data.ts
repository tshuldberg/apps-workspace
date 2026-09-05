'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import { getEnabledModules } from '@mylife/db';
import { getRegimenSummary } from '@mylife/meds';

/**
 * A single in-tab reminder item surfaced in the persistent "due now" tray.
 *
 * Web has no background or closed-tab delivery, so these items only ever
 * represent things that are due while the hub tab is open right now. We never
 * fabricate items: an empty list means nothing is currently due.
 */
export interface DueReminder {
  /** Stable id for React keys and de-duplication. */
  id: string;
  /** Source module that produced the reminder. */
  source: 'meds' | 'workouts' | 'walk';
  /** Short headline shown in the tray and in the browser notification. */
  title: string;
  /** Supporting line, e.g. the scheduled time or dosage. */
  detail: string;
  /** Destination route when the user taps the item. */
  href: string;
}

function isModuleEnabled(moduleId: string): boolean {
  try {
    const adapter = getAdapter();
    return getEnabledModules(adapter).some((row) => row.module_id === moduleId);
  } catch {
    return false;
  }
}

/**
 * Read medication doses that are due now from the meds engine.
 *
 * "Due now" means a dose scheduled for today that is still pending and whose
 * scheduled time has already passed (or is within the next few minutes). This
 * reads through the shared meds regimen-summary engine, so it stays aligned
 * with the meds Today screen and never invents data.
 *
 * Returns an empty array when meds is disabled, has no schedule, or anything
 * fails. MEDS-SUPP will make these reminders actually populate.
 */
async function getMedsDueReminders(now: Date): Promise<DueReminder[]> {
  if (!isModuleEnabled('meds')) return [];

  try {
    ensureModuleMigrations('meds');
    const adapter = getAdapter();
    const summary = getRegimenSummary(adapter, now);
    // A 5 minute lead window so a dose shows up slightly before its time too.
    const leadMs = 5 * 60 * 1000;
    const nowMs = now.getTime();

    return summary.todaySchedule
      .filter((dose) => dose.status === 'pending')
      .filter((dose) => {
        const scheduledMs = new Date(dose.scheduledTime).getTime();
        if (Number.isNaN(scheduledMs)) return false;
        return scheduledMs - leadMs <= nowMs;
      })
      .map((dose) => {
        const scheduledMs = new Date(dose.scheduledTime).getTime();
        const timeLabel = Number.isNaN(scheduledMs)
          ? ''
          : new Date(scheduledMs).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            });
        const dosage = dose.dosage ? `, ${dose.dosage}` : '';
        return {
          id: `meds-${dose.medicationId}-${dose.scheduledTime}`,
          source: 'meds' as const,
          title: `Take ${dose.medicationName}`,
          detail: timeLabel ? `Scheduled for ${timeLabel}${dosage}` : `Due now${dosage}`,
          href: '/meds',
        };
      });
  } catch (error) {
    console.error('[reminders-data] meds due reminders failed', error);
    return [];
  }
}

/** Evening hour (local) after which an untrained day counts as "due now". */
const WORKOUT_NUDGE_HOUR = 17;

/**
 * Workout-routine nudge.
 *
 * Real signal, not a schedule: if workout reminders are enabled in the
 * workouts settings and no session has been completed today, an evening
 * nudge appears once the local clock passes WORKOUT_NUDGE_HOUR. Derived
 * entirely from real wk_workout_sessions rows and the stored preference.
 */
async function getWorkoutDueReminders(now: Date): Promise<DueReminder[]> {
  if (!isModuleEnabled('workouts')) return [];
  if (now.getHours() < WORKOUT_NUDGE_HOUR) return [];

  try {
    ensureModuleMigrations('workouts');
    const adapter = getAdapter();

    const settingsRow = adapter.query<{ value: string }>(
      `SELECT value FROM hub_settings WHERE key = ?`,
      ['workouts.phase1.settings'],
    )[0];
    if (settingsRow) {
      try {
        const parsed = JSON.parse(settingsRow.value) as { workoutReminders?: boolean };
        if (parsed.workoutReminders === false) return [];
      } catch {
        /* unreadable settings: fall through with reminders on (the default) */
      }
    }

    const today = now.toISOString().slice(0, 10);
    const doneToday =
      adapter.query<{ n: number }>(
        `SELECT COUNT(*) as n FROM wk_workout_sessions
         WHERE completed_at IS NOT NULL AND date(completed_at) = ?`,
        [today],
      )[0]?.n ?? 0;
    if (doneToday > 0) return [];

    return [
      {
        id: `workouts-train-${today}`,
        source: 'workouts' as const,
        title: 'No workout logged today',
        detail: 'Evening check-in: there is still time for a session.',
        href: '/workouts',
      },
    ];
  } catch (error) {
    console.error('[reminders-data] workout due reminders failed', error);
    return [];
  }
}

/**
 * Walk nudges.
 *
 * No cheap existing "due now" walk signal exists on web today, so this returns
 * nothing rather than inventing items. Honest empty placeholder, not fake data.
 */
async function getWalkDueReminders(): Promise<DueReminder[]> {
  return [];
}

/**
 * Aggregate all currently-due in-tab reminders across sources.
 *
 * Called on a polling interval by the client provider. Always degrades to an
 * empty list rather than throwing, so the app-wide tray can never break a route.
 */
export async function fetchDueReminders(): Promise<DueReminder[]> {
  const now = new Date();
  try {
    const [meds, workouts, walk] = await Promise.all([
      getMedsDueReminders(now),
      getWorkoutDueReminders(now),
      getWalkDueReminders(),
    ]);
    return [...meds, ...workouts, ...walk];
  } catch (error) {
    console.error('[reminders-data] fetchDueReminders failed', error);
    return [];
  }
}
