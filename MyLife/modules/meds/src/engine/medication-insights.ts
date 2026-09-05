/**
 * Medication Insights Engine
 *
 * Detects patterns in medication behavior and surfaces actionable insights.
 * Pure function: takes DB adapter, returns typed insight objects.
 * No schema changes required.
 */

import type { DatabaseAdapter } from '@mylife/db';

// ── Types ────────────────────────────────────────────────────────────────────

export type InsightCategory =
  | 'adherence_pattern'
  | 'timing_pattern'
  | 'symptom_correlation'
  | 'refill_alert'
  | 'vitals_trend'
  | 'interaction_warning';

export type InsightSeverity = 'info' | 'warning' | 'alert';

export interface MedicationInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  /** The metric value that triggered this insight (e.g., 67 for "67% weekend adherence") */
  value: number | null;
  /** Reference metric for comparison (e.g., 90 for "90% weekday adherence") */
  referenceValue: number | null;
  /** ISO date when the insight was generated */
  generatedAt: string;
  /** Optional medication ID this insight relates to */
  medicationId: string | null;
}

// ── Row types ────────────────────────────────────────────────────────────────

interface DoseLogRow {
  medication_id: string;
  scheduled_time: string;
  status: string;
}

interface MedRow {
  id: string;
  name: string;
  pill_count: number | null;
  pills_per_dose: number;
  frequency: string;
  is_active: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dosesPerDay(frequency: string): number {
  switch (frequency) {
    case 'twice_daily': return 2;
    case 'three_daily': return 3;
    case 'daily': return 1;
    case 'weekly': return 1 / 7;
    case 'as_needed': return 0;
    case 'custom': return 1;
    default: return 1;
  }
}

function dayOfWeek(isoDate: string): number {
  return new Date(isoDate).getDay(); // 0=Sun, 6=Sat
}

function isWeekend(isoDate: string): boolean {
  const day = dayOfWeek(isoDate);
  return day === 0 || day === 6;
}

function timeOfDay(isoDate: string): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date(isoDate).getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

// ── Insight generators ───────────────────────────────────────────────────────

/**
 * Detect weekend vs weekday adherence differences.
 */
function detectWeekendPattern(logs: DoseLogRow[]): MedicationInsight | null {
  let weekdayTotal = 0, weekdayTaken = 0;
  let weekendTotal = 0, weekendTaken = 0;

  for (const log of logs) {
    if (log.status === 'snoozed') continue;
    const taken = log.status === 'taken' || log.status === 'late';
    if (isWeekend(log.scheduled_time)) {
      weekendTotal++;
      if (taken) weekendTaken++;
    } else {
      weekdayTotal++;
      if (taken) weekdayTaken++;
    }
  }

  if (weekdayTotal < 5 || weekendTotal < 2) return null;

  const weekdayRate = Math.round((weekdayTaken / weekdayTotal) * 100);
  const weekendRate = Math.round((weekendTaken / weekendTotal) * 100);
  const diff = weekdayRate - weekendRate;

  if (diff < 15) return null;

  return {
    id: 'weekend-adherence-dip',
    category: 'adherence_pattern',
    severity: diff > 30 ? 'warning' : 'info',
    title: 'Weekend adherence dip',
    description: `Your adherence drops to ${weekendRate}% on weekends vs ${weekdayRate}% on weekdays. Consider setting weekend-specific reminders.`,
    value: weekendRate,
    referenceValue: weekdayRate,
    generatedAt: new Date().toISOString(),
    medicationId: null,
  };
}

/**
 * Detect time-of-day adherence patterns.
 */
function detectTimingPattern(logs: DoseLogRow[]): MedicationInsight | null {
  const byTime: Record<string, { total: number; taken: number }> = {
    morning: { total: 0, taken: 0 },
    afternoon: { total: 0, taken: 0 },
    evening: { total: 0, taken: 0 },
    night: { total: 0, taken: 0 },
  };

  for (const log of logs) {
    if (log.status === 'snoozed') continue;
    const tod = timeOfDay(log.scheduled_time);
    byTime[tod].total++;
    if (log.status === 'taken' || log.status === 'late') {
      byTime[tod].taken++;
    }
  }

  // Find best and worst time slots (with enough data)
  let bestSlot = '';
  let bestRate = 0;
  let worstSlot = '';
  let worstRate = 100;

  for (const [slot, data] of Object.entries(byTime)) {
    if (data.total < 5) continue;
    const rate = Math.round((data.taken / data.total) * 100);
    if (rate > bestRate) { bestRate = rate; bestSlot = slot; }
    if (rate < worstRate) { worstRate = rate; worstSlot = slot; }
  }

  if (!bestSlot || !worstSlot || bestSlot === worstSlot) return null;
  if (bestRate - worstRate < 15) return null;

  return {
    id: 'timing-pattern',
    category: 'timing_pattern',
    severity: worstRate < 70 ? 'warning' : 'info',
    title: `${worstSlot.charAt(0).toUpperCase() + worstSlot.slice(1)} doses need attention`,
    description: `You're most consistent with ${bestSlot} medications (${bestRate}% taken on time) but ${worstSlot} doses are at ${worstRate}%. Consider adjusting your ${worstSlot} reminder timing.`,
    value: worstRate,
    referenceValue: bestRate,
    generatedAt: new Date().toISOString(),
    medicationId: null,
  };
}

/**
 * Detect medications with low individual adherence.
 */
function detectPerMedAdherence(
  logs: DoseLogRow[],
  meds: Map<string, string>,
): MedicationInsight[] {
  const byMed = new Map<string, { total: number; taken: number }>();

  for (const log of logs) {
    if (log.status === 'snoozed') continue;
    const entry = byMed.get(log.medication_id) ?? { total: 0, taken: 0 };
    entry.total++;
    if (log.status === 'taken' || log.status === 'late') entry.taken++;
    byMed.set(log.medication_id, entry);
  }

  const insights: MedicationInsight[] = [];
  for (const [medId, data] of byMed) {
    if (data.total < 7) continue;
    const rate = Math.round((data.taken / data.total) * 100);
    if (rate >= 80) continue;

    const medName = meds.get(medId) ?? 'Unknown medication';
    insights.push({
      id: `low-adherence-${medId}`,
      category: 'adherence_pattern',
      severity: rate < 50 ? 'alert' : 'warning',
      title: `Low adherence: ${medName}`,
      description: `Your adherence for ${medName} is ${rate}% over the past 30 days. ${rate < 50 ? 'This is critically low and may affect treatment effectiveness.' : 'Consider reviewing your reminder schedule.'}`,
      value: rate,
      referenceValue: 80,
      generatedAt: new Date().toISOString(),
      medicationId: medId,
    });
  }

  return insights;
}

/**
 * Detect medications running low on supply.
 */
function detectRefillAlerts(activeMeds: MedRow[]): MedicationInsight[] {
  const insights: MedicationInsight[] = [];

  for (const med of activeMeds) {
    if (med.pill_count == null || !med.is_active) continue;
    const rate = (med.pills_per_dose ?? 1) * dosesPerDay(med.frequency);
    if (rate === 0) continue;
    const daysLeft = Math.floor(med.pill_count / rate);

    if (daysLeft > 14) continue;

    insights.push({
      id: `refill-${med.id}`,
      category: 'refill_alert',
      severity: daysLeft <= 3 ? 'alert' : daysLeft <= 7 ? 'warning' : 'info',
      title: `Refill needed: ${med.name}`,
      description: daysLeft <= 0
        ? `${med.name} supply is depleted. Refill immediately.`
        : `${med.name} has ${daysLeft} day${daysLeft === 1 ? '' : 's'} of supply remaining (${med.pill_count} pills left).`,
      value: daysLeft,
      referenceValue: 14,
      generatedAt: new Date().toISOString(),
      medicationId: med.id,
    });
  }

  return insights;
}

/**
 * Detect symptom changes correlated with medication start dates.
 */
function detectSymptomCorrelation(
  db: DatabaseAdapter,
  medName: string,
  medId: string,
  medStartDate: string,
): MedicationInsight | null {
  const beforeRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM md_symptom_logs WHERE logged_at < ? AND logged_at >= datetime(?, '-30 days')`,
    [medStartDate, medStartDate],
  );
  const afterRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM md_symptom_logs WHERE logged_at >= ? AND logged_at <= datetime(?, '+30 days')`,
    [medStartDate, medStartDate],
  );

  const before = beforeRows[0]?.count ?? 0;
  const after = afterRows[0]?.count ?? 0;

  if (before < 3) return null;

  const changePercent = before > 0 ? Math.round(((after - before) / before) * 100) : 0;
  if (Math.abs(changePercent) < 20) return null;

  const direction = changePercent < 0 ? 'decreased' : 'increased';
  const severity: InsightSeverity = changePercent > 30 ? 'warning' : 'info';

  return {
    id: `symptom-correlation-${medId}`,
    category: 'symptom_correlation',
    severity,
    title: `Symptoms ${direction} after starting ${medName}`,
    description: `Symptom reports ${direction} ${Math.abs(changePercent)}% in the 30 days after starting ${medName} compared to the 30 days before.`,
    value: after,
    referenceValue: before,
    generatedAt: new Date().toISOString(),
    medicationId: medId,
  };
}

// ── Main function ────────────────────────────────────────────────────────────

/**
 * Generate all medication insights for the current user.
 * Returns insights sorted by severity (alert > warning > info).
 */
export function getMedicationInsights(db: DatabaseAdapter): MedicationInsight[] {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceISO = thirtyDaysAgo.toISOString();

  // Fetch dose logs for the past 30 days
  const logs = db.query<DoseLogRow>(
    `SELECT medication_id, scheduled_time, status
     FROM md_dose_logs
     WHERE scheduled_time >= ?
     ORDER BY scheduled_time ASC`,
    [sinceISO],
  );

  // Fetch active medications
  const medRows = db.query<MedRow>(
    `SELECT id, name, pill_count, pills_per_dose, frequency, is_active
     FROM md_medications WHERE is_active = 1`,
  );

  const medNames = new Map(medRows.map((m) => [m.id, m.name]));

  const insights: MedicationInsight[] = [];

  // Pattern detections
  const weekendInsight = detectWeekendPattern(logs);
  if (weekendInsight) insights.push(weekendInsight);

  const timingInsight = detectTimingPattern(logs);
  if (timingInsight) insights.push(timingInsight);

  // Per-medication adherence
  insights.push(...detectPerMedAdherence(logs, medNames));

  // Refill alerts
  insights.push(...detectRefillAlerts(medRows));

  // Symptom correlations for recently started medications (last 60 days)
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const recentMeds = db.query<{ id: string; name: string; created_at: string }>(
    `SELECT id, name, created_at FROM md_medications
     WHERE is_active = 1 AND created_at >= ?`,
    [sixtyDaysAgo.toISOString()],
  );

  for (const med of recentMeds) {
    const correlation = detectSymptomCorrelation(db, med.name, med.id, med.created_at);
    if (correlation) insights.push(correlation);
  }

  // Sort by severity: alert > warning > info
  const severityOrder: Record<InsightSeverity, number> = { alert: 0, warning: 1, info: 2 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return insights;
}
