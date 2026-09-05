import type { DatabaseAdapter } from '@mylife/db';

export const HEALTH_SLEEP_JOURNAL_BRIDGE_SETTING_KEY = 'bridge.sleepJournal.enabled';
export const SLEEP_HEALTH_BRIDGE_SETTING_KEY = 'bridge.health.enabled';

export type HealthBridgeSummaryStatus =
  | 'disabled'
  | 'needs_consent'
  | 'no_data'
  | 'reportable';

export type HealthBridgeTrend = 'improving' | 'declining' | 'stable' | 'unknown';

export type HealthSyncPreviewStatus = 'disabled' | 'no_data' | 'ready';

export interface HealthBridgeDateRange {
  startDate?: string;
  endDate?: string;
}

export interface HealthBridgeLatestNight {
  date: string;
  durationMinutes: number;
  durationHours: number;
  qualityRating: number | null;
  wakeFeeling: string | null;
}

export interface HealthBridgeSummary {
  status: HealthBridgeSummaryStatus;
  insight: string;
  sampleSize: number;
  averageDurationMinutes: number | null;
  averageDurationHours: number | null;
  averageQualityRating: number | null;
  averageWakeCount: number | null;
  averageSleepLatencyMinutes: number | null;
  positiveWakeFeelingRate: number | null;
  mostCommonWakeFeeling: string | null;
  durationTrend: HealthBridgeTrend;
  qualityTrend: HealthBridgeTrend;
  firstDate: string | null;
  lastDate: string | null;
  latestNight: HealthBridgeLatestNight | null;
  sharedFields: string[];
}

export interface HealthSyncPreview {
  status: HealthSyncPreviewStatus;
  consentRequired: true;
  consentSettingKey: string;
  destinationModule: 'health';
  previewCopy: string;
  summary: HealthBridgeSummary | null;
  sharedFields: string[];
  excludedFields: string[];
}

interface SleepJournalRow {
  id: string;
  date: string;
  bedtime: string | null;
  wake_time: string | null;
  duration_minutes: number | null;
  quality_rating: number | null;
  wake_count: number | null;
  sleep_latency_minutes: number | null;
  wake_feeling: string | null;
}

interface CountRow {
  count: number;
}

interface SettingRow {
  value: string | null;
}

const SHARED_FIELDS = [
  'date range',
  'night count',
  'average duration',
  'average quality rating',
  'average wake count',
  'average sleep latency',
  'wake feeling pattern',
  'latest night summary',
];

const EXCLUDED_FIELDS = [
  'dream content',
  'private notes',
  'factor notes',
  'raw sleep journal rows',
  'Health sensor sleep sessions',
  'attachments',
];

function emptySummary(status: HealthBridgeSummaryStatus): HealthBridgeSummary {
  return {
    status,
    insight: '',
    sampleSize: 0,
    averageDurationMinutes: null,
    averageDurationHours: null,
    averageQualityRating: null,
    averageWakeCount: null,
    averageSleepLatencyMinutes: null,
    positiveWakeFeelingRate: null,
    mostCommonWakeFeeling: null,
    durationTrend: 'unknown',
    qualityTrend: 'unknown',
    firstDate: null,
    lastDate: null,
    latestNight: null,
    sharedFields: [...SHARED_FIELDS],
  };
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: readonly number[], decimals = 1): number | null {
  if (values.length === 0) {
    return null;
  }
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, decimals);
}

function finiteNumber(value: number | null | undefined): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function areBridgeModulesEnabled(db: DatabaseAdapter): boolean {
  try {
    const rows = db.query<CountRow>(
      `SELECT COUNT(DISTINCT module_id) as count
       FROM hub_enabled_modules
       WHERE module_id IN (?, ?)`,
      ['sleep', 'health'],
    );
    return (rows[0]?.count ?? 0) === 2;
  } catch {
    return false;
  }
}

function readSetting(db: DatabaseAdapter, tableName: 'hl_settings' | 'sl_settings', key: string): string | null {
  try {
    return db.query<SettingRow>(
      `SELECT value FROM ${tableName} WHERE key = ? LIMIT 1`,
      [key],
    )[0]?.value ?? null;
  } catch {
    return null;
  }
}

function hasHealthBridgeConsent(db: DatabaseAdapter): boolean {
  const healthConsent = readSetting(
    db,
    'hl_settings',
    HEALTH_SLEEP_JOURNAL_BRIDGE_SETTING_KEY,
  );
  const sleepConsent = readSetting(
    db,
    'sl_settings',
    SLEEP_HEALTH_BRIDGE_SETTING_KEY,
  );
  return healthConsent === 'true' || sleepConsent === 'true';
}

function readSleepJournalRows(
  db: DatabaseAdapter,
  dateRange: HealthBridgeDateRange,
): SleepJournalRow[] | null {
  const where: string[] = [];
  const params: unknown[] = [];

  if (dateRange.startDate) {
    where.push('date >= ?');
    params.push(dateRange.startDate);
  }
  if (dateRange.endDate) {
    where.push('date <= ?');
    params.push(dateRange.endDate);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  try {
    return db.query<SleepJournalRow>(
      `SELECT
         id,
         date,
         bedtime,
         wake_time,
         duration_minutes,
         quality_rating,
         wake_count,
         sleep_latency_minutes,
         wake_feeling
       FROM sl_sleep_entries
       ${whereClause}
       ORDER BY date ASC, wake_time ASC, created_at ASC
       LIMIT 1000`,
      params,
    );
  } catch {
    return null;
  }
}

function trendFromValues(values: readonly number[]): HealthBridgeTrend {
  if (values.length < 4) {
    return 'unknown';
  }

  const midpoint = Math.floor(values.length / 2);
  const firstAverage = average(values.slice(0, midpoint));
  const secondAverage = average(values.slice(midpoint));
  if (firstAverage === null || secondAverage === null) {
    return 'unknown';
  }

  const delta = secondAverage - firstAverage;
  if (Math.abs(delta) < 0.2) {
    return 'stable';
  }
  return delta > 0 ? 'improving' : 'declining';
}

function mostCommon(values: readonly string[]): string | null {
  if (values.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function latestNightFromRow(row: SleepJournalRow): HealthBridgeLatestNight | null {
  const durationMinutes = finiteNumber(row.duration_minutes);
  if (durationMinutes === null) {
    return null;
  }

  return {
    date: row.date,
    durationMinutes,
    durationHours: round(durationMinutes / 60),
    qualityRating: finiteNumber(row.quality_rating),
    wakeFeeling: row.wake_feeling,
  };
}

function buildInsight(summary: HealthBridgeSummary): string {
  if (summary.averageDurationHours !== null && summary.averageQualityRating !== null) {
    return `Manual sleep journal shows ${summary.sampleSize} nights averaging ${summary.averageDurationHours.toFixed(1)}h with ${summary.averageQualityRating.toFixed(1)}/5 quality. Health receives this as a summary only.`;
  }

  if (summary.averageDurationHours !== null) {
    return `Manual sleep journal shows ${summary.sampleSize} nights averaging ${summary.averageDurationHours.toFixed(1)}h. Health receives this as a summary only.`;
  }

  return 'Manual sleep journal summary is available for Health after more complete sleep logs.';
}

function buildSummaryFromRows(rows: readonly SleepJournalRow[]): HealthBridgeSummary {
  const durationRows = rows.filter((row) => finiteNumber(row.duration_minutes) !== null);
  if (durationRows.length === 0) {
    return emptySummary('no_data');
  }

  const durations = durationRows
    .map((row) => finiteNumber(row.duration_minutes))
    .filter((value): value is number => value !== null);
  const qualities = durationRows
    .map((row) => finiteNumber(row.quality_rating))
    .filter((value): value is number => value !== null);
  const wakeCounts = durationRows
    .map((row) => finiteNumber(row.wake_count))
    .filter((value): value is number => value !== null);
  const latencies = durationRows
    .map((row) => finiteNumber(row.sleep_latency_minutes))
    .filter((value): value is number => value !== null);
  const wakeFeelings = durationRows
    .map((row) => row.wake_feeling)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const positiveWakeFeelings = wakeFeelings.filter(
    (value) => value === 'refreshed' || value === 'energized',
  );
  const latestNight = latestNightFromRow(durationRows[durationRows.length - 1]);

  const summary: HealthBridgeSummary = {
    ...emptySummary('reportable'),
    sampleSize: durationRows.length,
    averageDurationMinutes: average(durations, 0),
    averageDurationHours: average(durations.map((minutes) => minutes / 60)),
    averageQualityRating: average(qualities),
    averageWakeCount: average(wakeCounts),
    averageSleepLatencyMinutes: average(latencies, 0),
    positiveWakeFeelingRate:
      wakeFeelings.length > 0
        ? round((positiveWakeFeelings.length / wakeFeelings.length) * 100, 0)
        : null,
    mostCommonWakeFeeling: mostCommon(wakeFeelings),
    durationTrend: trendFromValues(durations.map((minutes) => minutes / 60)),
    qualityTrend: trendFromValues(qualities),
    firstDate: durationRows[0]?.date ?? null,
    lastDate: durationRows[durationRows.length - 1]?.date ?? null,
    latestNight,
  };

  return {
    ...summary,
    insight: buildInsight(summary),
  };
}

function buildSummaryIgnoringConsent(
  db: DatabaseAdapter,
  dateRange: HealthBridgeDateRange,
): HealthBridgeSummary {
  const rows = readSleepJournalRows(db, dateRange);
  if (!rows) {
    return emptySummary('disabled');
  }
  return buildSummaryFromRows(rows);
}

function buildPreviewCopy(summary: HealthBridgeSummary | null): string {
  if (!summary || summary.status === 'no_data') {
    return 'Health would receive only an aggregate manual sleep journal summary after you opt in. No sleep rows, notes, dreams, or sensor sleep sessions are copied.';
  }

  return `Health would receive a ${summary.sampleSize}-night aggregate with duration, quality, wake count, latency, wake feeling pattern, and latest-night summary. Raw journal rows, notes, dreams, and factors stay in MySleep.`;
}

export function getHealthBridgeSummary(
  db: DatabaseAdapter,
  dateRange: HealthBridgeDateRange = {},
): HealthBridgeSummary {
  if (!areBridgeModulesEnabled(db)) {
    return emptySummary('disabled');
  }
  if (!hasHealthBridgeConsent(db)) {
    return emptySummary('needs_consent');
  }

  return buildSummaryIgnoringConsent(db, dateRange);
}

export function buildHealthSyncPreview(
  db: DatabaseAdapter,
  dateRange: HealthBridgeDateRange = {},
): HealthSyncPreview {
  if (!areBridgeModulesEnabled(db)) {
    return {
      status: 'disabled',
      consentRequired: true,
      consentSettingKey: HEALTH_SLEEP_JOURNAL_BRIDGE_SETTING_KEY,
      destinationModule: 'health',
      previewCopy: 'Health integration is available when both MySleep and MyHealth are enabled.',
      summary: null,
      sharedFields: [...SHARED_FIELDS],
      excludedFields: [...EXCLUDED_FIELDS],
    };
  }

  const summary = buildSummaryIgnoringConsent(db, dateRange);
  const previewSummary = summary.status === 'disabled' ? null : summary;

  return {
    status: previewSummary?.status === 'reportable' ? 'ready' : 'no_data',
    consentRequired: true,
    consentSettingKey: HEALTH_SLEEP_JOURNAL_BRIDGE_SETTING_KEY,
    destinationModule: 'health',
    previewCopy: buildPreviewCopy(previewSummary),
    summary: previewSummary,
    sharedFields: [...SHARED_FIELDS],
    excludedFields: [...EXCLUDED_FIELDS],
  };
}
