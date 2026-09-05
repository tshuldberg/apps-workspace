import type { DatabaseAdapter } from '@mylife/db';
import type {
  WeatherCorrelationResult,
  WeatherSnapshot,
  WeatherSymptomLink,
  WeatherTriggerProfile,
} from '../models/weather';
import {
  calculateWeatherCorrelation,
  identifyTriggerProfile,
  shouldShowForecastAlert,
} from './engine';

export type WeatherFactorKey = 'pressure' | 'temperature' | 'humidity' | 'wind';

export interface WeatherCorrelationPoint {
  id: string;
  severity: number;
  pressure: number | null;
  temperature: number | null;
  humidity: number | null;
  wind: number | null;
  capturedAt: string;
}

export interface WeatherTriggerAlert {
  id: string;
  level: 'high' | 'medium' | 'info';
  title: string;
  detail: string;
}

export interface WeatherTriggerInsights {
  latestSnapshot: WeatherSnapshot | null;
  points: WeatherCorrelationPoint[];
  correlations: WeatherCorrelationResult[];
  profile: WeatherTriggerProfile | null;
  alerts: WeatherTriggerAlert[];
}

function rowToWeatherLink(row: Record<string, unknown>): WeatherSymptomLink {
  return {
    id: row.id as string,
    weatherSnapshotId: row.weather_snapshot_id as string,
    symptomLogId: row.symptom_log_id as string,
    createdAt: row.created_at as string,
  };
}

function normalizeLowerBound(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length === 10 ? `${value}T00:00:00.000Z` : value;
}

function normalizeUpperBound(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length === 10 ? `${value}T23:59:59.999Z` : value;
}

function rowToWeatherSnapshot(row: Record<string, unknown>): WeatherSnapshot {
  return {
    id: row.id as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    temperatureC: (row.temperature_c as number) ?? null,
    humidityPercent: (row.humidity_percent as number) ?? null,
    pressureMb: (row.pressure_mb as number) ?? null,
    pressureChange3h: (row.pressure_change_3h as number) ?? null,
    windSpeedKmh: (row.wind_speed_kmh as number) ?? null,
    weatherCode: (row.weather_code as number) ?? null,
    weatherDescription: (row.weather_description as string) ?? null,
    capturedAt: row.captured_at as string,
    createdAt: row.created_at as string,
  };
}

function buildAlerts(
  snapshot: WeatherSnapshot | null,
  profile: WeatherTriggerProfile | null,
): WeatherTriggerAlert[] {
  if (!snapshot) {
    return [];
  }

  const alerts: WeatherTriggerAlert[] = [];

  if (snapshot.pressureChange3h != null && snapshot.pressureChange3h <= -3) {
    alerts.push({
      id: 'pressure-drop',
      level: 'high',
      title: 'Rapid pressure drop',
      detail: `${Math.abs(snapshot.pressureChange3h).toFixed(1)} mb fall over the last 3 hours may match your headache and pain triggers.`,
    });
  }

  if (snapshot.humidityPercent != null && snapshot.humidityPercent >= 70) {
    alerts.push({
      id: 'humidity-spike',
      level: snapshot.humidityPercent >= 80 ? 'high' : 'medium',
      title: 'Humidity spike',
      detail: `${Math.round(snapshot.humidityPercent)}% humidity can amplify joint pain, swelling, or fatigue days.`,
    });
  }

  if (
    shouldShowForecastAlert(
      profile,
      snapshot.pressureMb != null ? snapshot.pressureMb - 6 : null,
      snapshot.pressureMb,
    )
  ) {
    alerts.push({
      id: 'trigger-profile-pressure',
      level: 'medium',
      title: 'Pressure trigger profile active',
      detail: profile?.description ?? 'Recent pressure patterns line up with your linked symptom history.',
    });
  }

  if (alerts.length === 0 && profile) {
    alerts.push({
      id: 'profile-summary',
      level: 'info',
      title: 'Correlation profile ready',
      detail: profile.description,
    });
  }

  return alerts;
}

export function getWeatherSnapshots(
  db: DatabaseAdapter,
  limit: number = 30,
): WeatherSnapshot[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM md_weather_snapshots ORDER BY captured_at DESC LIMIT ?',
      [limit],
    )
    .map(rowToWeatherSnapshot);
}

export function getCurrentWeather(
  db: DatabaseAdapter,
): WeatherSnapshot | null {
  return getWeatherSnapshots(db, 1)[0] ?? null;
}

export function getWeatherHistory(
  db: DatabaseAdapter,
  limit: number = 30,
): WeatherSnapshot[] {
  return getWeatherSnapshots(db, limit);
}

export function getWeatherSymptomLinks(
  db: DatabaseAdapter,
): WeatherSymptomLink[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM md_weather_symptom_links ORDER BY created_at DESC',
    )
    .map(rowToWeatherLink);
}

export function createWeatherLink(
  db: DatabaseAdapter,
  id: string,
  weatherSnapshotId: string,
  symptomLogId: string,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT OR IGNORE INTO md_weather_symptom_links (id, weather_snapshot_id, symptom_log_id, created_at)
     VALUES (?, ?, ?, ?)`,
    [id, weatherSnapshotId, symptomLogId, now],
  );
}

export function getWeatherCorrelationPoints(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
): WeatherCorrelationPoint[] {
  let sql = `
    SELECT
      ws.id,
      sl.severity,
      ws.pressure_mb,
      ws.temperature_c,
      ws.humidity_percent,
      ws.wind_speed_kmh,
      ws.captured_at
    FROM md_weather_symptom_links link
    JOIN md_weather_snapshots ws ON ws.id = link.weather_snapshot_id
    JOIN md_symptom_logs sl ON sl.id = link.symptom_log_id
    WHERE 1 = 1
  `;
  const params: unknown[] = [];
  const normalizedFrom = normalizeLowerBound(from);
  const normalizedTo = normalizeUpperBound(to);

  if (normalizedFrom) {
    sql += ' AND ws.captured_at >= ?';
    params.push(normalizedFrom);
  }
  if (normalizedTo) {
    sql += ' AND ws.captured_at <= ?';
    params.push(normalizedTo);
  }

  sql += ' ORDER BY ws.captured_at DESC';

  return db.query<Record<string, unknown>>(sql, params).map((row) => ({
    id: row.id as string,
    severity: row.severity as number,
    pressure: (row.pressure_mb as number) ?? null,
    temperature: (row.temperature_c as number) ?? null,
    humidity: (row.humidity_percent as number) ?? null,
    wind: (row.wind_speed_kmh as number) ?? null,
    capturedAt: row.captured_at as string,
  }));
}

export function getWeatherCorrelations(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
): WeatherCorrelationResult[] {
  return calculateWeatherCorrelation(getWeatherCorrelationPoints(db, from, to));
}

export function getTriggerAlerts(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
): WeatherTriggerAlert[] {
  return getWeatherTriggerInsights(db, from, to).alerts;
}

export function getWeatherTriggerInsights(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
): WeatherTriggerInsights {
  const latestSnapshot = getCurrentWeather(db);
  const points = getWeatherCorrelationPoints(db, from, to);
  const correlations = getWeatherCorrelations(db, from, to);
  const profile = identifyTriggerProfile(correlations);

  return {
    latestSnapshot,
    points,
    correlations,
    profile,
    alerts: buildAlerts(latestSnapshot, profile),
  };
}
