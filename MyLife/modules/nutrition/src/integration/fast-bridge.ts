import type { DatabaseAdapter } from '@mylife/db';

export interface EatingWindow {
  isActive: boolean;
  startedAt: string | null;
  targetHours: number | null;
  eatingWindowStart: string | null;
  eatingWindowEnd: string | null;
}

/**
 * Read MyFast eating window from ft_ tables (cross-module query).
 * Returns null if MyFast is not installed or tables don't exist.
 */
export function getEatingWindow(db: DatabaseAdapter): EatingWindow | null {
  try {
    // Check if ft_settings exists (MyFast installed)
    const tables = db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='ft_settings'",
    );
    if (tables.length === 0) return null;

    // Get default fasting plan from settings
    const planRows = db.query<{ value: string }>(
      "SELECT value FROM ft_settings WHERE key = 'defaultPlan'",
    );
    const targetHours = planRows.length > 0 ? parseInt(planRows[0].value, 10) || null : null;

    // Check for active fast
    const activeFasts = db.query<Record<string, unknown>>(
      `SELECT * FROM ft_settings WHERE key = 'activeFast'`,
    );

    if (activeFasts.length === 0 || !activeFasts[0].value) {
      return {
        isActive: false,
        startedAt: null,
        targetHours,
        eatingWindowStart: null,
        eatingWindowEnd: null,
      };
    }

    const activeFast = JSON.parse(activeFasts[0].value as string) as {
      startedAt?: string;
      targetHours?: number;
    };

    if (!activeFast.startedAt) {
      return {
        isActive: false,
        startedAt: null,
        targetHours,
        eatingWindowStart: null,
        eatingWindowEnd: null,
      };
    }

    const fastTarget = activeFast.targetHours ?? targetHours ?? 16;
    const startedAt = new Date(activeFast.startedAt);
    const eatingWindowStart = new Date(startedAt.getTime() + fastTarget * 60 * 60 * 1000);
    const eatingWindowEnd = new Date(eatingWindowStart.getTime() + (24 - fastTarget) * 60 * 60 * 1000);

    return {
      isActive: true,
      startedAt: activeFast.startedAt,
      targetHours: fastTarget,
      eatingWindowStart: eatingWindowStart.toISOString(),
      eatingWindowEnd: eatingWindowEnd.toISOString(),
    };
  } catch {
    // ft_ tables don't exist or query failed
    return null;
  }
}

/**
 * Check if currently in an eating window.
 * Returns true if no fast is active or if the fast window has passed.
 * Returns null if MyFast is not installed.
 */
export function isInEatingWindow(db: DatabaseAdapter): boolean | null {
  const window = getEatingWindow(db);
  if (window === null) return null;
  if (!window.isActive) return true;
  if (!window.eatingWindowStart) return true;

  const now = new Date();
  const windowStart = new Date(window.eatingWindowStart);
  const windowEnd = window.eatingWindowEnd ? new Date(window.eatingWindowEnd) : null;

  if (now >= windowStart && (!windowEnd || now <= windowEnd)) {
    return true;
  }
  return false;
}
