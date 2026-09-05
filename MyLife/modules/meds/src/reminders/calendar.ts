import type { DatabaseAdapter } from '@mylife/db';
import { escapeLike } from '../db/crud';

// ---------------------------------------------------------------------------
// Adherence calendar views
// ---------------------------------------------------------------------------

export type DayStatus = 'taken' | 'missed' | 'late' | 'partial' | 'none';

export interface DayAdherence {
  date: string;
  status: DayStatus;
}

/**
 * Get per-day adherence for a single medication in a given month.
 * Month format: "YYYY-MM"
 *
 * Status logic per day:
 * - all taken/late -> 'taken'
 * - all skipped -> 'missed'
 * - mix -> 'partial'
 * - no logs -> 'none'
 */
export function getAdherenceByDay(
  db: DatabaseAdapter,
  medicationId: string,
  month: string,
): DayAdherence[] {
  const rows = db.query<{ dt: string; status: string }>(
    `SELECT DATE(scheduled_time) as dt, status
     FROM md_dose_logs
     WHERE medication_id = ? AND scheduled_time LIKE ? ESCAPE '\\'
     ORDER BY scheduled_time ASC`,
    [medicationId, `${escapeLike(month)}%`],
  );

  // Group by date
  const byDate = new Map<string, string[]>();
  for (const row of rows) {
    const statuses = byDate.get(row.dt) ?? [];
    statuses.push(row.status);
    byDate.set(row.dt, statuses);
  }

  // Build all days in the month
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, mon, 0).getDate();

  const result: DayAdherence[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const statuses = byDate.get(dateStr);
    if (!statuses || statuses.length === 0) {
      result.push({ date: dateStr, status: 'none' });
      continue;
    }

    const finalStatuses = statuses.filter((s) => s !== 'snoozed');
    if (finalStatuses.length === 0) {
      result.push({ date: dateStr, status: 'none' });
      continue;
    }

    const allTaken = finalStatuses.every((s) => s === 'taken' || s === 'late');
    const allMissed = finalStatuses.every((s) => s === 'skipped');
    const hasLate = finalStatuses.some((s) => s === 'late');

    if (allTaken && hasLate) {
      result.push({ date: dateStr, status: 'late' });
    } else if (allTaken) {
      result.push({ date: dateStr, status: 'taken' });
    } else if (allMissed) {
      result.push({ date: dateStr, status: 'missed' });
    } else {
      result.push({ date: dateStr, status: 'partial' });
    }
  }

  return result;
}

export interface MedDayStatus {
  medicationId: string;
  name: string;
  status: DayStatus;
  accentColor: string;
}

export interface CalendarDay {
  date: string;
  meds: MedDayStatus[];
}

/**
 * Combined adherence calendar for all active medications in a month.
 * Returns one entry per day with per-medication statuses.
 */
export function getAdherenceCalendar(
  db: DatabaseAdapter,
  month: string,
): CalendarDay[] {
  // Get all active medications
  const meds = db.query<Record<string, unknown>>(
    'SELECT id, name FROM md_medications WHERE is_active = 1 ORDER BY sort_order ASC, name ASC',
  );

  // Get all dose logs for this month across all meds
  const allLogs = db.query<{ medication_id: string; dt: string; status: string }>(
    `SELECT medication_id, DATE(scheduled_time) as dt, status
     FROM md_dose_logs
     WHERE scheduled_time LIKE ? ESCAPE '\\'
     ORDER BY scheduled_time ASC`,
    [`${escapeLike(month)}%`],
  );

  // Group: medicationId -> date -> statuses
  const grouped = new Map<string, Map<string, string[]>>();
  for (const log of allLogs) {
    if (!grouped.has(log.medication_id)) grouped.set(log.medication_id, new Map());
    const dateMap = grouped.get(log.medication_id)!;
    const statuses = dateMap.get(log.dt) ?? [];
    statuses.push(log.status);
    dateMap.set(log.dt, statuses);
  }

  // Build calendar
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, mon, 0).getDate();

  const accentColor = '#06B6D4'; // module accent

  const result: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayMeds: MedDayStatus[] = [];

    for (const med of meds) {
      const medId = med.id as string;
      const medName = med.name as string;
      const dateMap = grouped.get(medId);
      const statuses = dateMap?.get(dateStr)?.filter((s) => s !== 'snoozed') ?? [];

      let status: DayStatus;
      if (statuses.length === 0) {
        status = 'none';
      } else {
        const allTaken = statuses.every((s) => s === 'taken' || s === 'late');
        const allMissed = statuses.every((s) => s === 'skipped');
        if (allTaken) status = statuses.some((s) => s === 'late') ? 'late' : 'taken';
        else if (allMissed) status = 'missed';
        else status = 'partial';
      }

      dayMeds.push({ medicationId: medId, name: medName, status, accentColor });
    }

    result.push({ date: dateStr, meds: dayMeds });
  }

  return result;
}
