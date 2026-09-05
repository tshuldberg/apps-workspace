/**
 * Regimen Summary Engine
 *
 * Generates a daily health briefing that combines all data sources into
 * a single, scannable summary. Powers the Today screen "command center."
 * Pure function: takes DB adapter + date, returns structured summary.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { escapeLike } from '../db/crud';
import { getMedicationInsights, type MedicationInsight } from './medication-insights';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScheduledDose {
  medicationId: string;
  medicationName: string;
  dosage: string | null;
  scheduledTime: string;
  status: 'pending' | 'taken' | 'skipped' | 'late' | 'snoozed';
}

export interface VitalsSnapshot {
  latestBP: { systolic: number; diastolic: number; category: string; measuredAt: string } | null;
  latestGlucose: { value: number; unit: string; rangeStatus: string; measuredAt: string } | null;
  latestA1c: { value: number; source: string; recordedAt: string } | null;
}

export interface ActiveAlert {
  type: 'low_supply' | 'missed_dose' | 'high_glucose' | 'low_glucose' | 'bp_crisis' | 'insight';
  severity: 'info' | 'warning' | 'alert';
  message: string;
  medicationId: string | null;
}

export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface RegimenSummary {
  /** ISO date this summary is for */
  date: string;
  /** Current adherence streak in days */
  adherenceStreak: number;
  /** 7-day adherence percentage */
  adherence7d: number;
  /** Scheduled doses for today */
  todaySchedule: ScheduledDose[];
  /** Count of doses taken / total for today */
  todayProgress: { taken: number; total: number };
  /** Latest vitals readings */
  vitals: VitalsSnapshot;
  /** Active alerts requiring attention */
  alerts: ActiveAlert[];
  /** Top insights from medication insights engine */
  topInsights: MedicationInsight[];
  /** Overall wellness trend direction over 7 days */
  wellnessTrend: TrendDirection;
  /** Number of active medications */
  activeMedicationCount: number;
}

// ── Row types ────────────────────────────────────────────────────────────────

interface DoseScheduleRow {
  medication_id: string;
  med_name: string;
  dosage: string | null;
  time: string;
}

interface DoseLogStatusRow {
  medication_id: string;
  scheduled_time: string;
  status: string;
}

interface BPRow {
  systolic: number;
  diastolic: number;
  category: string;
  measured_at: string;
}

interface GlucoseRow {
  value: number;
  unit: string;
  range_status: string;
  measured_at: string;
}

interface A1cRow {
  value: number;
  source: string;
  recorded_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calculateStreak(db: DatabaseAdapter): number {
  const rows = db.query<{ dt: string; total: number; taken: number }>(
    `SELECT DATE(scheduled_time) as dt,
            COUNT(*) as total,
            SUM(CASE WHEN status IN ('taken', 'late') THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs
     WHERE status != 'snoozed'
     GROUP BY DATE(scheduled_time)
     ORDER BY dt DESC
     LIMIT 365`,
  );

  let streak = 0;
  for (const row of rows) {
    if (row.total === 0) continue;
    const rate = row.taken / row.total;
    if (rate >= 0.8) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function calculate7dAdherence(db: DatabaseAdapter): number {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = db.query<{ total: number; taken: number }>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status IN ('taken', 'late') THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs
     WHERE scheduled_time >= ? AND status != 'snoozed'`,
    [sevenDaysAgo.toISOString()],
  );

  if (rows[0].total === 0) return 100;
  return Math.round((rows[0].taken / rows[0].total) * 100);
}

function getVitals(db: DatabaseAdapter): VitalsSnapshot {
  const bpRows = db.query<BPRow>(
    `SELECT systolic, diastolic, category, measured_at
     FROM md_bp_readings ORDER BY measured_at DESC LIMIT 1`,
  );

  const glucoseRows = db.query<GlucoseRow>(
    `SELECT value, unit, range_status, measured_at
     FROM md_glucose_readings ORDER BY measured_at DESC LIMIT 1`,
  );

  const a1cRows = db.query<A1cRow>(
    `SELECT value, source, recorded_at
     FROM md_a1c_records ORDER BY recorded_at DESC LIMIT 1`,
  );

  return {
    latestBP: bpRows[0] ? {
      systolic: bpRows[0].systolic,
      diastolic: bpRows[0].diastolic,
      category: bpRows[0].category,
      measuredAt: bpRows[0].measured_at,
    } : null,
    latestGlucose: glucoseRows[0] ? {
      value: glucoseRows[0].value,
      unit: glucoseRows[0].unit,
      rangeStatus: glucoseRows[0].range_status,
      measuredAt: glucoseRows[0].measured_at,
    } : null,
    latestA1c: a1cRows[0] ? {
      value: a1cRows[0].value,
      source: a1cRows[0].source,
      recordedAt: a1cRows[0].recorded_at,
    } : null,
  };
}

function determineWellnessTrend(db: DatabaseAdapter): TrendDirection {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Compare adherence this week vs last week
  const thisWeek = db.query<{ total: number; taken: number }>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status IN ('taken', 'late') THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs
     WHERE scheduled_time >= ? AND status != 'snoozed'`,
    [sevenDaysAgo.toISOString()],
  );

  const lastWeek = db.query<{ total: number; taken: number }>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status IN ('taken', 'late') THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs
     WHERE scheduled_time >= ? AND scheduled_time < ? AND status != 'snoozed'`,
    [fourteenDaysAgo.toISOString(), sevenDaysAgo.toISOString()],
  );

  const thisRate = thisWeek[0].total > 0 ? thisWeek[0].taken / thisWeek[0].total : 1;
  const lastRate = lastWeek[0].total > 0 ? lastWeek[0].taken / lastWeek[0].total : 1;

  const diff = thisRate - lastRate;
  if (diff > 0.05) return 'improving';
  if (diff < -0.05) return 'declining';
  return 'stable';
}

// ── Main function ────────────────────────────────────────────────────────────

/**
 * Generate a complete regimen summary for the given date.
 */
export function getRegimenSummary(db: DatabaseAdapter, date?: Date): RegimenSummary {
  const targetDate = date ?? new Date();
  const dateStr = targetDate.toISOString().slice(0, 10);

  // Today's schedule from active reminders
  const dayOfWeek = targetDate.getDay();
  const scheduleRows = db.query<DoseScheduleRow>(
    `SELECT r.medication_id, m.name as med_name, m.dosage, r.time
     FROM md_reminders r
     JOIN md_medications m ON r.medication_id = m.id
     WHERE r.is_active = 1 AND m.is_active = 1
       AND r.days_of_week LIKE ? ESCAPE '\\'
     ORDER BY r.time ASC`,
    [`%${escapeLike(String(dayOfWeek))}%`],
  );

  // Today's dose logs
  const todayLogs = db.query<DoseLogStatusRow>(
    `SELECT medication_id, scheduled_time, status
     FROM md_dose_logs
     WHERE DATE(scheduled_time) = ?`,
    [dateStr],
  );

  // The set of canonical slot times for today, keyed by medication + slot time.
  // A dose logged against one of these is an exact match for that slot.
  const slotKeys = new Set(
    scheduleRows.map((row) => `${row.medication_id}-${dateStr}T${row.time}`),
  );

  // Exact-key matches: a dose logged against this slot's canonical time.
  const logMap = new Map<string, string>();
  // Per-medication queue of logs that did NOT line up with a canonical slot
  // time. This resolves the common case where a dose is taken ad hoc (logged
  // with the moment it was taken, not the slot's canonical time). Each such
  // log is consumed in order so a single "take" marks exactly one pending slot
  // done, keeping the due-today checklist and the app-wide reminder tray in
  // agreement instead of leaving the slot stuck on pending.
  const fallbackByMedication = new Map<string, string[]>();
  for (const log of todayLogs) {
    const key = `${log.medication_id}-${log.scheduled_time}`;
    if (slotKeys.has(key)) {
      logMap.set(key, log.status);
    } else {
      const queue = fallbackByMedication.get(log.medication_id) ?? [];
      queue.push(log.status);
      fallbackByMedication.set(log.medication_id, queue);
    }
  }

  const todaySchedule: ScheduledDose[] = scheduleRows.map((row) => {
    const scheduledTime = `${dateStr}T${row.time}`;
    const exactKey = `${row.medication_id}-${scheduledTime}`;
    let status = (logMap.get(exactKey) as ScheduledDose['status']) ?? 'pending';

    if (status === 'pending') {
      const queue = fallbackByMedication.get(row.medication_id);
      if (queue && queue.length > 0) {
        status = queue.shift() as ScheduledDose['status'];
      }
    }

    return {
      medicationId: row.medication_id,
      medicationName: row.med_name,
      dosage: row.dosage,
      scheduledTime,
      status,
    };
  });

  const taken = todaySchedule.filter((d) => d.status === 'taken' || d.status === 'late').length;

  // Vitals
  const vitals = getVitals(db);

  // Alerts from insights engine
  const allInsights = getMedicationInsights(db);
  const alerts: ActiveAlert[] = allInsights
    .filter((i) => i.severity === 'alert' || i.severity === 'warning')
    .map((i) => ({
      type: 'insight' as const,
      severity: i.severity,
      message: i.title,
      medicationId: i.medicationId,
    }));

  // Add vitals-based alerts
  if (vitals.latestBP && vitals.latestBP.category === 'crisis') {
    alerts.unshift({
      type: 'bp_crisis',
      severity: 'alert',
      message: `BP reading ${vitals.latestBP.systolic}/${vitals.latestBP.diastolic} is in crisis range`,
      medicationId: null,
    });
  }

  if (vitals.latestGlucose) {
    if (vitals.latestGlucose.rangeStatus === 'very_high') {
      alerts.unshift({
        type: 'high_glucose',
        severity: 'alert',
        message: `Glucose ${vitals.latestGlucose.value} ${vitals.latestGlucose.unit} is very high`,
        medicationId: null,
      });
    } else if (vitals.latestGlucose.rangeStatus === 'very_low') {
      alerts.unshift({
        type: 'low_glucose',
        severity: 'alert',
        message: `Glucose ${vitals.latestGlucose.value} ${vitals.latestGlucose.unit} is very low`,
        medicationId: null,
      });
    }
  }

  // Active med count
  const activeCountRows = db.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM md_medications WHERE is_active = 1`,
  );

  return {
    date: dateStr,
    adherenceStreak: calculateStreak(db),
    adherence7d: calculate7dAdherence(db),
    todaySchedule,
    todayProgress: { taken, total: todaySchedule.length },
    vitals,
    alerts,
    topInsights: allInsights.slice(0, 5),
    wellnessTrend: determineWellnessTrend(db),
    activeMedicationCount: activeCountRows[0]?.c ?? 0,
  };
}
