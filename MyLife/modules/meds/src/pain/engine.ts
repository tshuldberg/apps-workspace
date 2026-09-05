import type { PainEntry, BodyZone, PainHeatmapEntry } from '../models/pain';
import { BODY_ZONES } from '../models/pain';

/**
 * Calculate a heatmap showing pain frequency per body zone.
 * Returns normalized intensity (0-1) per zone. Zones with <3 entries are suppressed.
 */
export function calculateHeatmap(
  entries: PainEntry[],
  minEntries: number = 3,
): PainHeatmapEntry[] {
  const counts = new Map<BodyZone, number>();
  for (const e of entries) {
    counts.set(e.bodyZone, (counts.get(e.bodyZone) ?? 0) + 1);
  }

  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) maxCount = count;
  }

  return BODY_ZONES.map((zone) => {
    const count = counts.get(zone) ?? 0;
    return {
      zone,
      intensity: count >= minEntries && maxCount > 0 ? count / maxCount : 0,
      count,
    };
  }).filter((h) => h.count > 0);
}

/**
 * Get body zones with active (unresolved) pain.
 */
export function getActiveZones(entries: PainEntry[]): PainEntry[] {
  return entries.filter((e) => e.resolvedAt == null);
}

/**
 * Calculate average pain severity per zone.
 */
export function getAverageSeverityByZone(
  entries: PainEntry[],
): Map<BodyZone, number> {
  const zoneTotals = new Map<BodyZone, { sum: number; count: number }>();

  for (const e of entries) {
    const existing = zoneTotals.get(e.bodyZone) ?? { sum: 0, count: 0 };
    existing.sum += e.severity;
    existing.count++;
    zoneTotals.set(e.bodyZone, existing);
  }

  const result = new Map<BodyZone, number>();
  for (const [zone, { sum, count }] of zoneTotals) {
    result.set(zone, Math.round((sum / count) * 10) / 10);
  }
  return result;
}

export interface PainMedicationCorrelation {
  zone: BodyZone;
  medName: string;
  avgBefore: number;
  avgAfter: number;
  severityDelta: number;
  entryCount: number;
}

/**
 * Correlate pain severity in a body zone with medication start dates.
 * Compares average severity before and after each medication's created_at.
 */
export function getPainMedicationCorrelation(
  entries: PainEntry[],
  medications: Array<{ name: string; createdAt: string }>,
  minEntries: number = 5,
): PainMedicationCorrelation[] {
  const zoneEntries = new Map<BodyZone, PainEntry[]>();
  for (const e of entries) {
    const existing = zoneEntries.get(e.bodyZone) ?? [];
    existing.push(e);
    zoneEntries.set(e.bodyZone, existing);
  }

  const results: PainMedicationCorrelation[] = [];

  for (const [zone, zEntries] of zoneEntries) {
    if (zEntries.length < minEntries) continue;

    for (const med of medications) {
      const before = zEntries.filter((e) => e.startedAt < med.createdAt);
      const after = zEntries.filter((e) => e.startedAt >= med.createdAt);

      if (before.length < 2 || after.length < 2) continue;

      const avgBefore = before.reduce((s, e) => s + e.severity, 0) / before.length;
      const avgAfter = after.reduce((s, e) => s + e.severity, 0) / after.length;

      results.push({
        zone,
        medName: med.name,
        avgBefore: Math.round(avgBefore * 10) / 10,
        avgAfter: Math.round(avgAfter * 10) / 10,
        severityDelta: Math.round((avgAfter - avgBefore) * 10) / 10,
        entryCount: zEntries.length,
      });
    }
  }

  return results.sort((a, b) => a.severityDelta - b.severityDelta);
}
