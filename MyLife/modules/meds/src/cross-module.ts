/**
 * Cross-module interface implementation for MyMeds.
 *
 * Exposes medication data for hub-level search, dashboard summaries,
 * activity feeds, and cross-module correlation (adherence + mood time series).
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  CrossModuleInterface,
  SearchableItem,
  ModuleSummary,
  ActivityItem,
  CorrelationDataset,
  CorrelationDataPoint,
  TodayCard,
  TodayCardContext,
} from '@mylife/module-registry';
import { getRegimenSummary } from './engine/regimen-summary';

const MODULE_ID = 'meds';

// ---------------------------------------------------------------------------
// Row types for raw SQL queries
// ---------------------------------------------------------------------------

interface MedRow {
  id: string;
  name: string;
  dosage: string | null;
  unit: string | null;
  frequency: string;
  instructions: string | null;
  prescriber: string | null;
  pharmacy: string | null;
  pill_count: number | null;
  pills_per_dose: number;
  is_active: number;
  notes: string | null;
  updated_at: string;
}

interface DoseLogRow {
  id: string;
  medication_id: string;
  scheduled_time: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface RefillRow {
  id: string;
  medication_id: string;
  quantity: number;
  refill_date: string;
  pharmacy: string | null;
  created_at: string;
}

interface CountRow {
  count: number;
}

interface LastActivityRow {
  last_activity: string | null;
}

interface AdherenceDayRow {
  dt: string;
  total: number;
  taken: number;
}

// ---------------------------------------------------------------------------
// getSearchableContent
// ---------------------------------------------------------------------------

export function getSearchableContent(db: DatabaseAdapter): SearchableItem[] {
  const meds = db.query<MedRow>(
    `SELECT id, name, dosage, unit, frequency, instructions, prescriber, pharmacy,
            pill_count, pills_per_dose, is_active, notes, updated_at
     FROM md_medications
     LIMIT 500`,
  );

  const items: SearchableItem[] = [];

  for (const med of meds) {
    const tags: string[] = [];
    if (med.prescriber) tags.push(med.prescriber);
    if (med.pharmacy) tags.push(med.pharmacy);
    if (med.frequency) tags.push(med.frequency);
    if (med.is_active) tags.push('active');

    const bodyParts: string[] = [];
    if (med.dosage) bodyParts.push(`${med.dosage}${med.unit ? ' ' + med.unit : ''}`);
    if (med.instructions) bodyParts.push(med.instructions);
    if (med.notes) bodyParts.push(med.notes);

    items.push({
      moduleId: MODULE_ID,
      type: 'medication',
      title: med.name,
      body: bodyParts.length > 0 ? bodyParts.join(' - ') : undefined,
      tags: tags.length > 0 ? tags : undefined,
      itemId: med.id,
      updatedAt: med.updated_at,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// getDataSummary
// ---------------------------------------------------------------------------

/** Frequency string to doses per day (matches refill-tracker.ts). */
function dosesPerDay(frequency: string): number {
  switch (frequency) {
    case 'twice_daily': return 2;
    case 'daily': return 1;
    case 'weekly': return 1 / 7;
    case 'as_needed': return 0;
    case 'custom': return 1;
    default: return 1;
  }
}

export function getDataSummary(db: DatabaseAdapter): ModuleSummary {
  const totalRows = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM md_medications`,
  );
  const totalItems = totalRows[0]?.count ?? 0;

  const activeRows = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM md_medications WHERE is_active = 1`,
  );
  const activeMedications = activeRows[0]?.count ?? 0;

  // Overall adherence rate (last 30 days, all meds)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceISO = thirtyDaysAgo.toISOString();

  const doseRows = db.query<{ status: string }>(
    `SELECT status FROM md_dose_logs WHERE scheduled_time >= ?`,
    [sinceISO],
  );

  let taken = 0;
  let countable = 0;
  for (const row of doseRows) {
    if (row.status === 'snoozed') continue;
    countable++;
    if (row.status === 'taken' || row.status === 'late') taken++;
  }
  const adherenceRate = countable === 0
    ? 0
    : Math.round((taken / countable) * 1000) / 10;

  // Refill needed count: active meds with < 7 days supply
  const supplyRows = db.query<{ pill_count: number; frequency: string; pills_per_dose: number }>(
    `SELECT pill_count, frequency, pills_per_dose
     FROM md_medications
     WHERE is_active = 1 AND pill_count IS NOT NULL`,
  );
  let refillNeeded = 0;
  for (const row of supplyRows) {
    const rate = (row.pills_per_dose ?? 1) * dosesPerDay(row.frequency);
    if (rate === 0) continue;
    const daysLeft = Math.floor(row.pill_count / rate);
    if (daysLeft < 7) refillNeeded++;
  }

  const lastRows = db.query<LastActivityRow>(
    `SELECT MAX(created_at) as last_activity FROM md_dose_logs`,
  );
  const lastActivity = lastRows[0]?.last_activity ?? undefined;

  const stats: Record<string, number | string> = {
    activeMedications,
    adherenceRate,
    refillNeeded,
  };

  return {
    moduleId: MODULE_ID,
    totalItems,
    stats,
    lastActivity,
  };
}

// ---------------------------------------------------------------------------
// getActivityFeed
// ---------------------------------------------------------------------------

export function getActivityFeed(db: DatabaseAdapter, since: Date): ActivityItem[] {
  const sinceISO = since.toISOString();
  const items: ActivityItem[] = [];

  // Dose logs since date (taken, skipped, late)
  const doses = db.query<DoseLogRow & { med_name: string }>(
    `SELECT d.id, d.medication_id, d.scheduled_time, d.status, d.notes, d.created_at,
            m.name as med_name
     FROM md_dose_logs d
     JOIN md_medications m ON d.medication_id = m.id
     WHERE d.created_at >= ? AND d.status != 'snoozed'
     ORDER BY d.created_at DESC
     LIMIT 500`,
    [sinceISO],
  );

  for (const dose of doses) {
    let action: string;
    let description: string;

    switch (dose.status) {
      case 'taken':
        action = 'completed';
        description = `Took ${dose.med_name}`;
        break;
      case 'late':
        action = 'completed';
        description = `Took ${dose.med_name} (late)`;
        break;
      case 'skipped':
        action = 'skipped';
        description = `Skipped ${dose.med_name}`;
        break;
      default:
        action = 'logged';
        description = `Logged ${dose.med_name} dose`;
    }

    items.push({
      moduleId: MODULE_ID,
      action,
      description,
      timestamp: dose.created_at,
      itemId: dose.medication_id,
      itemType: 'medication',
    });
  }

  // Refill events since date
  const refills = db.query<RefillRow & { med_name: string }>(
    `SELECT r.id, r.medication_id, r.quantity, r.refill_date, r.pharmacy, r.created_at,
            m.name as med_name
     FROM md_refills r
     JOIN md_medications m ON r.medication_id = m.id
     WHERE r.created_at >= ?
     ORDER BY r.created_at DESC
     LIMIT 200`,
    [sinceISO],
  );

  for (const refill of refills) {
    items.push({
      moduleId: MODULE_ID,
      action: 'refilled',
      description: `Refilled ${refill.med_name} (${refill.quantity} pills)`,
      timestamp: refill.created_at,
      itemId: refill.medication_id,
      itemType: 'medication',
    });
  }

  // Sort all items by timestamp descending
  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return items;
}

// ---------------------------------------------------------------------------
// getCorrelationData
// ---------------------------------------------------------------------------

export function getCorrelationData(db: DatabaseAdapter): CorrelationDataset {
  // Daily adherence scores (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const sinceISO = ninetyDaysAgo.toISOString();

  const adherenceDays = db.query<AdherenceDayRow>(
    `SELECT DATE(scheduled_time) as dt,
            COUNT(*) as total,
            SUM(CASE WHEN status IN ('taken', 'late') THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs
     WHERE scheduled_time >= ? AND status != 'snoozed'
     GROUP BY DATE(scheduled_time)
     ORDER BY dt ASC`,
    [sinceISO],
  );

  const adherenceData: CorrelationDataPoint[] = adherenceDays.map((row) => ({
    date: row.dt,
    value: row.total > 0 ? Math.round((row.taken / row.total) * 100) : 0,
  }));

  // Daily mood intensity (last 90 days)
  const moodDays = db.query<{ dt: string; avg_intensity: number; avg_valence: number }>(
    `SELECT DATE(recorded_at) as dt,
            AVG(intensity) as avg_intensity,
            AVG(CASE
              WHEN pleasantness = 'pleasant' THEN 1.0
              WHEN pleasantness = 'neutral' THEN 0.0
              WHEN pleasantness = 'unpleasant' THEN -1.0
              ELSE 0.0
            END) as avg_valence
     FROM md_mood_entries
     WHERE recorded_at >= ?
     GROUP BY DATE(recorded_at)
     ORDER BY dt ASC`,
    [sinceISO],
  );

  const moodIntensityData: CorrelationDataPoint[] = moodDays.map((row) => ({
    date: row.dt,
    value: Math.round(row.avg_intensity * 10) / 10,
  }));

  const moodValenceData: CorrelationDataPoint[] = moodDays.map((row) => ({
    date: row.dt,
    // Normalize valence from [-1, 1] to [0, 100] for correlation
    value: Math.round((row.avg_valence + 1) * 50 * 10) / 10,
  }));

  return {
    moduleId: MODULE_ID,
    series: [
      {
        metric: 'adherence_rate',
        label: 'Daily Adherence',
        unit: '%',
        data: adherenceData,
      },
      {
        metric: 'mood_intensity',
        label: 'Mood Intensity',
        unit: 'level',
        data: moodIntensityData,
      },
      {
        metric: 'mood_valence',
        label: 'Mood Valence',
        unit: 'score',
        data: moodValenceData,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Assembled interface
// ---------------------------------------------------------------------------

function endOfUtcDay(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}

function formatDoseTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getTodayCards(db: DatabaseAdapter, context: TodayCardContext): TodayCard[] {
  const summary = getRegimenSummary(db, context.now);
  const { taken, total } = summary.todayProgress;
  if (total === 0) return [];

  const today = context.now.toISOString().slice(0, 10);
  const expiresAt = endOfUtcDay(context.now);
  const pending = summary.todaySchedule.filter((dose) => dose.status === 'pending');

  if (pending.length > 0) {
    const next = pending[0]!;
    const overdue = Date.parse(next.scheduledTime) <= context.now.getTime();
    const time = formatDoseTime(next.scheduledTime);
    return [
      {
        id: `meds.doses-due.${today}`,
        moduleId: MODULE_ID,
        kind: 'reminder',
        priority: overdue ? 85 : 75,
        title: `${pending.length} dose${pending.length === 1 ? '' : 's'} left today`,
        subtitle: time
          ? `Next: ${next.medicationName} at ${time}`
          : `Next: ${next.medicationName}`,
        cta: { label: 'Open MyMeds', route: '/meds/medications' },
        dismissible: true,
        expiresAt,
      },
    ];
  }

  return [
    {
      id: `meds.all-taken.${today}`,
      moduleId: MODULE_ID,
      kind: 'progress',
      priority: 40,
      title: 'All doses taken',
      subtitle: `${taken} of ${total} today`,
      cta: { label: 'View adherence', route: '/meds/medications' },
      dismissible: true,
      expiresAt,
    },
  ];
}

export const medsCrossModule: CrossModuleInterface = {
  getSearchableContent: (db) => getSearchableContent(db as DatabaseAdapter),
  getDataSummary: (db) => getDataSummary(db as DatabaseAdapter),
  getActivityFeed: (db, since) => getActivityFeed(db as DatabaseAdapter, since),
  getCorrelationData: (db) => getCorrelationData(db as DatabaseAdapter),
  getTodayCards: (db, context) => getTodayCards(db as DatabaseAdapter, context),
};
