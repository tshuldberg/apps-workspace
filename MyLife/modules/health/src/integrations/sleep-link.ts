import type { DatabaseAdapter } from '@mylife/db';

export const MANUAL_SLEEP_BRIDGE_SETTING_KEY = 'bridge.sleepJournal.enabled';
export const SLEEP_HEALTH_BRIDGE_SETTING_KEY = 'bridge.health.enabled';

export type ManualSleepBridgeState = 'disabled' | 'needs_consent' | 'enabled';
export type SleepJournalContextStatus = 'needs_consent' | 'no_data' | 'ready';
export type SleepJournalTrend = 'improving' | 'declining' | 'stable' | 'unknown';

export interface SleepJournalDateRange {
  startDate?: string;
  endDate?: string;
}

export interface ManualSleepBridgeStatus {
  state: ManualSleepBridgeState;
  enabled: boolean;
  settingKey: string;
  copy: string;
}

export interface SleepJournalContextSummary {
  sampleSize: number;
  averageDurationHours: number | null;
  averageQualityRating: number | null;
  averageWakeCount: number | null;
  averageSleepLatencyMinutes: number | null;
  positiveWakeFeelingRate: number | null;
  mostCommonWakeFeeling: string | null;
  durationTrend: SleepJournalTrend;
  qualityTrend: SleepJournalTrend;
  firstDate: string;
  lastDate: string;
}

export interface SleepJournalContext {
  status: SleepJournalContextStatus;
  bridgeStatus: ManualSleepBridgeStatus;
  title: string;
  body: string;
  ctaLabel: string;
  ctaRoute: string;
  summary: SleepJournalContextSummary | null;
}

interface CountRow {
  count: number;
}

interface SettingRow {
  value: string | null;
}

interface SleepJournalRow {
  date: string;
  duration_minutes: number | null;
  quality_rating: number | null;
  wake_count: number | null;
  sleep_latency_minutes: number | null;
  wake_feeling: string | null;
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
      ['health', 'sleep'],
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

function writeSetting(db: DatabaseAdapter, tableName: 'hl_settings' | 'sl_settings', key: string, value: string): void {
  try {
    db.execute(
      `INSERT INTO ${tableName} (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  } catch {
    // The paired module may not have run migrations yet. The bridge status
    // still remains explicit through the Health setting.
  }
}

function bridgeConsentEnabled(db: DatabaseAdapter): boolean {
  const healthValue = readSetting(db, 'hl_settings', MANUAL_SLEEP_BRIDGE_SETTING_KEY);
  const sleepValue = readSetting(db, 'sl_settings', SLEEP_HEALTH_BRIDGE_SETTING_KEY);
  return healthValue === 'true' || sleepValue === 'true';
}

function readSleepJournalRows(
  db: DatabaseAdapter,
  dateRange: SleepJournalDateRange,
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
         date,
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

function trendFromValues(values: readonly number[]): SleepJournalTrend {
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

function summarizeRows(rows: readonly SleepJournalRow[]): SleepJournalContextSummary | null {
  const durationRows = rows.filter((row) => finiteNumber(row.duration_minutes) !== null);
  if (durationRows.length === 0) {
    return null;
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

  return {
    sampleSize: durationRows.length,
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
    firstDate: durationRows[0]?.date ?? '',
    lastDate: durationRows[durationRows.length - 1]?.date ?? '',
  };
}

function formatHours(value: number | null): string {
  return value === null ? 'sleep duration' : `${value.toFixed(1)}h`;
}

function buildReadyBody(summary: SleepJournalContextSummary): string {
  const quality =
    summary.averageQualityRating === null
      ? 'unrated quality'
      : `${summary.averageQualityRating.toFixed(1)}/5 quality`;
  return `MySleep manual journal: ${summary.sampleSize} nights averaging ${formatHours(summary.averageDurationHours)} and ${quality}.`;
}

export function getManualSleepBridgeStatus(db: DatabaseAdapter): ManualSleepBridgeStatus {
  if (!areBridgeModulesEnabled(db)) {
    return {
      state: 'disabled',
      enabled: false,
      settingKey: MANUAL_SLEEP_BRIDGE_SETTING_KEY,
      copy: 'Enable both MyHealth and MySleep to connect manual sleep journal summaries.',
    };
  }

  if (!bridgeConsentEnabled(db)) {
    return {
      state: 'needs_consent',
      enabled: false,
      settingKey: MANUAL_SLEEP_BRIDGE_SETTING_KEY,
      copy: 'Review the MySleep preview before sharing aggregate manual sleep journal trends with MyHealth.',
    };
  }

  return {
    state: 'enabled',
    enabled: true,
    settingKey: MANUAL_SLEEP_BRIDGE_SETTING_KEY,
    copy: 'MyHealth can read aggregate manual sleep journal trends from MySleep. No sleep rows are copied into Health tables.',
  };
}

export function setManualSleepBridgeEnabled(db: DatabaseAdapter, enabled: boolean): void {
  const value = enabled ? 'true' : 'false';
  writeSetting(db, 'hl_settings', MANUAL_SLEEP_BRIDGE_SETTING_KEY, value);
  writeSetting(db, 'sl_settings', SLEEP_HEALTH_BRIDGE_SETTING_KEY, value);
}

export function getSleepJournalContext(
  db: DatabaseAdapter,
  dateRange: SleepJournalDateRange = {},
): SleepJournalContext | null {
  const bridgeStatus = getManualSleepBridgeStatus(db);
  if (bridgeStatus.state === 'disabled') {
    return null;
  }

  if (bridgeStatus.state === 'needs_consent') {
    return {
      status: 'needs_consent',
      bridgeStatus,
      title: 'Connect MySleep journal',
      body: bridgeStatus.copy,
      ctaLabel: 'Review Preview',
      ctaRoute: '/sleep/insights',
      summary: null,
    };
  }

  const rows = readSleepJournalRows(db, dateRange);
  const summary = rows ? summarizeRows(rows) : null;
  if (!summary) {
    return {
      status: 'no_data',
      bridgeStatus,
      title: 'Manual sleep journal',
      body: 'No MySleep manual journal entries are available for this range yet.',
      ctaLabel: 'Open MySleep',
      ctaRoute: '/sleep',
      summary: null,
    };
  }

  return {
    status: 'ready',
    bridgeStatus,
    title: 'Manual sleep journal',
    body: buildReadyBody(summary),
    ctaLabel: 'Open MySleep',
    ctaRoute: '/sleep/insights',
    summary,
  };
}
