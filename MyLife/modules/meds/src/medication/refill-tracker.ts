import type { DatabaseAdapter } from '@mylife/db';
import type { Refill, CreateRefillInput } from '../models/refill';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToRefill(row: Record<string, unknown>): Refill {
  return {
    id: row.id as string,
    medicationId: row.medication_id as string,
    quantity: row.quantity as number,
    refillDate: row.refill_date as string,
    pharmacy: (row.pharmacy as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Refill operations
// ---------------------------------------------------------------------------

/**
 * Record a refill and add quantity to the medication's pill_count.
 */
export function recordRefill(
  db: DatabaseAdapter,
  id: string,
  input: CreateRefillInput,
): void {
  const now = new Date().toISOString();
  db.transaction(() => {
    db.execute(
      `INSERT INTO md_refills (id, medication_id, quantity, refill_date, pharmacy, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.medicationId,
        input.quantity,
        input.refillDate ?? now.slice(0, 10),
        input.pharmacy ?? null,
        input.notes ?? null,
        now,
      ],
    );
    // Add quantity to current pill count
    db.execute(
      `UPDATE md_medications
       SET pill_count = COALESCE(pill_count, 0) + ?,
           updated_at = ?
       WHERE id = ?`,
      [input.quantity, now, input.medicationId],
    );
  });
}

/**
 * Get refill history for a medication, newest first.
 */
export function getRefillHistory(
  db: DatabaseAdapter,
  medicationId: string,
  limit: number = 100,
): Refill[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM md_refills WHERE medication_id = ? ORDER BY refill_date DESC, created_at DESC LIMIT ?',
      [medicationId, limit],
    )
    .map(rowToRefill);
}

// ---------------------------------------------------------------------------
// Burn rate / supply calculations
// ---------------------------------------------------------------------------

/** Frequency string to doses per day. */
function dosesPerDay(frequency: string): number {
  switch (frequency) {
    case 'twice_daily':
      return 2;
    case 'daily':
      return 1;
    case 'weekly':
      return 1 / 7;
    case 'as_needed':
      return 0;
    case 'custom':
      return 1; // default assumption for custom
    default:
      return 1;
  }
}

/**
 * Calculate daily pill burn rate: pills_per_dose * doses_per_day.
 * Returns 0 for as_needed medications.
 */
export function calculateBurnRate(
  db: DatabaseAdapter,
  medicationId: string,
): number {
  const rows = db.query<Record<string, unknown>>(
    'SELECT frequency, pills_per_dose FROM md_medications WHERE id = ?',
    [medicationId],
  );
  if (rows.length === 0) return 0;
  const freq = rows[0].frequency as string;
  const pillsPerDose = (rows[0].pills_per_dose as number) ?? 1;
  return pillsPerDose * dosesPerDay(freq);
}

/**
 * Calculate days of supply remaining: pill_count / burn_rate.
 * Returns Infinity if burn_rate is 0 (as_needed), null if no pill count set.
 */
export function getDaysRemaining(
  db: DatabaseAdapter,
  medicationId: string,
): number | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT pill_count, frequency, pills_per_dose FROM md_medications WHERE id = ?',
    [medicationId],
  );
  if (rows.length === 0) return null;
  const pillCount = rows[0].pill_count as number | null;
  if (pillCount === null) return null;
  const freq = rows[0].frequency as string;
  const pillsPerDose = (rows[0].pills_per_dose as number) ?? 1;
  const rate = pillsPerDose * dosesPerDay(freq);
  if (rate === 0) return Infinity;
  return Math.floor(pillCount / rate);
}

export interface LowSupplyAlert {
  medicationId: string;
  name: string;
  pillCount: number;
  daysRemaining: number;
}

/**
 * Get all active medications with fewer than `thresholdDays` of supply remaining.
 * Default threshold is 7 days.
 */
export function getLowSupplyAlerts(
  db: DatabaseAdapter,
  thresholdDays: number = 7,
): LowSupplyAlert[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT id, name, pill_count, frequency, pills_per_dose
     FROM md_medications
     WHERE is_active = 1 AND pill_count IS NOT NULL`,
  );

  const alerts: LowSupplyAlert[] = [];
  for (const row of rows) {
    const pillCount = row.pill_count as number;
    const freq = row.frequency as string;
    const pillsPerDose = (row.pills_per_dose as number) ?? 1;
    const rate = pillsPerDose * dosesPerDay(freq);
    if (rate === 0) continue; // as_needed has no burn rate
    const daysLeft = Math.floor(pillCount / rate);
    if (daysLeft < thresholdDays) {
      alerts.push({
        medicationId: row.id as string,
        name: row.name as string,
        pillCount,
        daysRemaining: daysLeft,
      });
    }
  }
  return alerts;
}
