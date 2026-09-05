import type { DatabaseAdapter } from '@mylife/db';
import { getMedications } from '../db/crud';
import type {
  BodyZone,
  CreatePainEntryInput,
  PainEntry,
} from '../models/pain';
import { BODY_ZONE_LABELS } from '../models/pain';
import {
  getAverageSeverityByZone,
  getPainMedicationCorrelation,
  type PainMedicationCorrelation,
} from './engine';

export interface PainRegionSummary {
  zone: BodyZone;
  label: string;
  averageSeverity: number;
  latestSeverity: number;
  entryCount: number;
}

export interface PainInsights {
  mostPainfulRegion: PainRegionSummary | null;
  peakWindow: string | null;
  topMedicationCorrelation: PainMedicationCorrelation | null;
  regionSummaries: PainRegionSummary[];
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

function rowToPainEntry(row: Record<string, unknown>): PainEntry {
  return {
    id: row.id as string,
    bodyZone: row.body_zone as BodyZone,
    severity: row.severity as number,
    painType: (row.pain_type as PainEntry['painType']) ?? null,
    durationMinutes: (row.duration_minutes as number) ?? null,
    radiation: (row.radiation as string) ?? null,
    notes: (row.notes as string) ?? null,
    startedAt: row.started_at as string,
    resolvedAt: (row.resolved_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createPainEntry(
  db: DatabaseAdapter,
  id: string,
  input: CreatePainEntryInput,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO md_pain_entries (
      id,
      body_zone,
      severity,
      pain_type,
      duration_minutes,
      radiation,
      notes,
      started_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.bodyZone,
      input.severity,
      input.painType ?? null,
      input.durationMinutes ?? null,
      input.radiation ?? null,
      input.notes ?? null,
      input.startedAt ?? now,
      now,
    ],
  );
}

export function getPainEntries(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
  limit: number = 500,
): PainEntry[] {
  let sql = 'SELECT * FROM md_pain_entries WHERE 1 = 1';
  const params: unknown[] = [];
  const normalizedFrom = normalizeLowerBound(from);
  const normalizedTo = normalizeUpperBound(to);

  if (normalizedFrom) {
    sql += ' AND started_at >= ?';
    params.push(normalizedFrom);
  }
  if (normalizedTo) {
    sql += ' AND started_at <= ?';
    params.push(normalizedTo);
  }

  sql += ' ORDER BY started_at DESC LIMIT ?';
  params.push(limit);

  return db.query<Record<string, unknown>>(sql, params).map(rowToPainEntry);
}

export function getPainByRegion(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
): PainRegionSummary[] {
  const entries = getPainEntries(db, from, to, 1000);
  const averages = getAverageSeverityByZone(entries);
  const latestByZone = new Map<BodyZone, PainEntry>();
  const counts = new Map<BodyZone, number>();

  for (const entry of entries) {
    counts.set(entry.bodyZone, (counts.get(entry.bodyZone) ?? 0) + 1);
    if (!latestByZone.has(entry.bodyZone)) {
      latestByZone.set(entry.bodyZone, entry);
    }
  }

  return [...averages.entries()]
    .map(([zone, averageSeverity]) => {
      const latest = latestByZone.get(zone);
      return {
        zone,
        label: BODY_ZONE_LABELS[zone],
        averageSeverity,
        latestSeverity: latest?.severity ?? averageSeverity,
        entryCount: counts.get(zone) ?? 0,
      } satisfies PainRegionSummary;
    })
    .sort((left, right) => {
      if (right.averageSeverity !== left.averageSeverity) {
        return right.averageSeverity - left.averageSeverity;
      }
      return right.entryCount - left.entryCount;
    });
}

export function getPainInsights(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
): PainInsights {
  const entries = getPainEntries(db, from, to, 1000);
  const regionSummaries = getPainByRegion(db, from, to);

  const timeBuckets = new Map<string, number[]>();
  for (const entry of entries) {
    const hour = new Date(entry.startedAt).getHours();
    const bucket =
      hour < 6 ? 'Overnight' :
      hour < 12 ? 'Morning' :
      hour < 18 ? 'Afternoon' :
      'Evening';
    const values = timeBuckets.get(bucket) ?? [];
    values.push(entry.severity);
    timeBuckets.set(bucket, values);
  }

  const peakWindow =
    [...timeBuckets.entries()]
      .map(([label, values]) => ({
        label,
        averageSeverity: values.reduce((sum, value) => sum + value, 0) / values.length,
      }))
      .sort((left, right) => right.averageSeverity - left.averageSeverity)[0]?.label ?? null;

  const medications = getMedications(db).map((medication) => ({
    name: medication.name,
    createdAt: medication.createdAt,
  }));
  const medicationCorrelations = getPainMedicationCorrelation(entries, medications);

  return {
    mostPainfulRegion: regionSummaries[0] ?? null,
    peakWindow,
    topMedicationCorrelation: medicationCorrelations[0] ?? null,
    regionSummaries,
  };
}
