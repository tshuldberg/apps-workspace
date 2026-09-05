/**
 * MyTravel <-> MyMeds read-only integration.
 *
 * Lists currently active medications so a trip can cross-reference supply
 * against trip duration. Read-only: no schema changes, no writes.
 *
 * Degrades gracefully if `md_medications` is not present (Meds not
 * installed) -- returns `[]`.
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface MedicationLink {
  medicationId: string;
  name: string;
  doseSummary?: string;
  refillsRemaining?: number;
}

export type RefillRisk = 'ok' | 'tight' | 'risk';

interface MedicationRow {
  id: string;
  name: string | null;
  dosage: string | null;
  unit: string | null;
  frequency: string | null;
  is_active: number | null;
}

interface RefillCountRow {
  medication_id: string;
  total: number | null;
}

/**
 * Fetch active medications for a trip. The `tripId` is accepted for future
 * per-trip overrides; the current implementation lists all active meds.
 *
 * Returns `[]` if the Meds module tables are not present.
 */
export function getMedicationsForTrip(
  db: DatabaseAdapter,
  _tripId: string,
): MedicationLink[] {
  let rows: MedicationRow[];
  try {
    rows = db.query<MedicationRow>(
      `SELECT id, name, dosage, unit, frequency, is_active
       FROM md_medications
       WHERE is_active = 1
       ORDER BY sort_order ASC, name ASC`,
    );
  } catch {
    return [];
  }

  let refillTotals: RefillCountRow[] = [];
  try {
    refillTotals = db.query<RefillCountRow>(
      `SELECT medication_id, SUM(quantity) AS total
       FROM md_refills
       GROUP BY medication_id`,
    );
  } catch {
    refillTotals = [];
  }
  const refillMap = new Map<string, number>();
  for (const r of refillTotals) {
    if (typeof r.total === 'number') {
      refillMap.set(r.medication_id, r.total);
    }
  }

  return rows.map((row) => {
    const link: MedicationLink = {
      medicationId: row.id,
      name: row.name ?? '',
    };
    const doseParts: string[] = [];
    if (row.dosage) doseParts.push(row.dosage);
    if (row.unit) doseParts.push(row.unit);
    if (row.frequency) doseParts.push(row.frequency);
    if (doseParts.length > 0) {
      link.doseSummary = doseParts.join(' ');
    }
    const remaining = refillMap.get(row.id);
    if (typeof remaining === 'number') {
      link.refillsRemaining = remaining;
    }
    return link;
  });
}

/**
 * Pure refill-risk classifier.
 *
 * Compares refills-remaining against trip duration. Assumes a refill covers
 * ~30 days. If no refill info is available, returns 'ok' (we do not have
 * enough information to flag risk).
 */
export function computeRefillRisk(
  medication: MedicationLink,
  tripDurationDays: number,
): RefillRisk {
  const remaining = medication.refillsRemaining;
  if (typeof remaining !== 'number') return 'ok';
  const needed = Math.ceil(Math.max(0, tripDurationDays) / 30);
  if (remaining < needed) return 'risk';
  if (remaining === needed) return 'tight';
  return 'ok';
}
