import type { DatabaseAdapter } from '@mylife/db';
import type { Medication, CreateMedicationInput } from '../models/medication';
import { createRemindersForMedication } from '../reminders/scheduler';

// ---------------------------------------------------------------------------
// Medication grouping (supplements vs prescriptions)
//
// The schema has no dedicated category column, so grouping is stored as a
// lightweight, tolerant tag at the start of the medication `notes` field.
// This keeps the change additive and mobile-safe: any reader that ignores the
// tag still gets a valid notes string, and untagged medications default to the
// prescription group. The tag is parsed back out for display so users never
// see it in their own notes text.
// ---------------------------------------------------------------------------

export type MedicationGroup = 'prescription' | 'supplement';

/** Marker prepended to notes for medications the user filed as a supplement. */
export const SUPPLEMENT_NOTE_TAG = '[supplement]';

/**
 * Classify a medication into a display group.
 * Pure: reads only the notes tag. Untagged medications are prescriptions.
 */
export function classifyMedicationGroup(
  medication: { notes?: string | null },
): MedicationGroup {
  const notes = medication.notes ?? '';
  return notes.trimStart().startsWith(SUPPLEMENT_NOTE_TAG) ? 'supplement' : 'prescription';
}

/**
 * Strip the grouping tag from a notes string for user-facing display.
 * Returns null when nothing remains so empty notes stay empty.
 */
export function stripMedicationGroupTag(notes?: string | null): string | null {
  if (!notes) return null;
  const trimmed = notes.trimStart();
  if (!trimmed.startsWith(SUPPLEMENT_NOTE_TAG)) return notes;
  const remainder = trimmed.slice(SUPPLEMENT_NOTE_TAG.length).trimStart();
  return remainder.length > 0 ? remainder : null;
}

/**
 * Build a notes string that encodes the chosen group, preserving any
 * user-written notes. Pass the user notes WITHOUT the tag; this owns the tag.
 */
export function withMedicationGroup(
  group: MedicationGroup,
  userNotes?: string | null,
): string | null {
  const clean = stripMedicationGroupTag(userNotes) ?? '';
  if (group !== 'supplement') {
    return clean.length > 0 ? clean : null;
  }
  return clean.length > 0 ? `${SUPPLEMENT_NOTE_TAG} ${clean}` : SUPPLEMENT_NOTE_TAG;
}

// ---------------------------------------------------------------------------
// Row mapper (includes v2 columns: pill_count, pills_per_dose, time_slots, end_date)
// ---------------------------------------------------------------------------

function rowToMedication(row: Record<string, unknown>): Medication {
  return {
    id: row.id as string,
    name: row.name as string,
    dosage: (row.dosage as string) ?? null,
    unit: (row.unit as string) ?? null,
    frequency: row.frequency as Medication['frequency'],
    instructions: (row.instructions as string) ?? null,
    prescriber: (row.prescriber as string) ?? null,
    pharmacy: (row.pharmacy as string) ?? null,
    refillDate: (row.refill_date as string) ?? null,
    pillCount: (row.pill_count as number) ?? null,
    pillsPerDose: (row.pills_per_dose as number) ?? 1,
    timeSlots: row.time_slots ? JSON.parse(row.time_slots as string) : [],
    endDate: (row.end_date as string) ?? null,
    isActive: !!(row.is_active as number),
    sortOrder: row.sort_order as number,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Extended medication CRUD
// ---------------------------------------------------------------------------

export interface CreateMedicationOptions {
  /**
   * Whether to auto-create `md_reminders` rows from the medication's time
   * slots. Defaults to true so a timed medication immediately lands on the
   * due-today schedule and the app-wide reminder tray. Callers that manage
   * reminders themselves, or that expose a per-medication "reminders off"
   * toggle, can pass false to keep full control of reminder creation.
   */
  autoCreateReminders?: boolean;
}

/**
 * Create a medication with all v2 fields.
 *
 * When the medication has one or more time slots and a schedulable frequency
 * (anything other than `as_needed` or `custom`), matching `md_reminders` rows
 * are created automatically so the dose lands on the due-today schedule and in
 * the app-wide reminder tray, unless `options.autoCreateReminders` is false.
 * Reminder creation is delete-then-insert, so any later explicit
 * `createRemindersForMedication` call stays idempotent.
 */
export function createMedicationExtended(
  db: DatabaseAdapter,
  id: string,
  input: CreateMedicationInput,
  options?: CreateMedicationOptions,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO md_medications
      (id, name, dosage, unit, frequency, instructions, prescriber, pharmacy,
       refill_date, pill_count, pills_per_dose, time_slots, end_date,
       sort_order, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.dosage ?? null,
      input.unit ?? null,
      input.frequency ?? 'daily',
      input.instructions ?? null,
      input.prescriber ?? null,
      input.pharmacy ?? null,
      input.refillDate ?? null,
      input.pillCount ?? null,
      input.pillsPerDose ?? 1,
      JSON.stringify(input.timeSlots ?? []),
      input.endDate ?? null,
      input.sortOrder ?? 0,
      input.notes ?? null,
      now,
      now,
    ],
  );

  const autoCreateReminders = options?.autoCreateReminders ?? true;
  if (autoCreateReminders && (input.timeSlots ?? []).length > 0) {
    let counter = 0;
    createRemindersForMedication(db, id, () => `rem-${id}-${++counter}-${Date.now()}`);
  }
}

/**
 * Get a medication by ID with v2 columns.
 */
export function getMedicationExtended(db: DatabaseAdapter, id: string): Medication | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM md_medications WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToMedication(rows[0]) : null;
}

/**
 * Get all active medications with v2 columns.
 */
export function getActiveMedications(db: DatabaseAdapter, limit: number = 500): Medication[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM md_medications WHERE is_active = 1 ORDER BY sort_order ASC, name ASC LIMIT ?',
      [limit],
    )
    .map(rowToMedication);
}

/**
 * Set absolute pill count for a medication.
 */
export function updatePillCount(
  db: DatabaseAdapter,
  medicationId: string,
  count: number,
): void {
  db.execute(
    `UPDATE md_medications SET pill_count = ?, updated_at = ? WHERE id = ?`,
    [count, new Date().toISOString(), medicationId],
  );
}

/**
 * Decrement pill count by pills_per_dose (called when a dose is taken).
 * Clamps at zero.
 */
export function decrementPillCount(
  db: DatabaseAdapter,
  medicationId: string,
): void {
  db.execute(
    `UPDATE md_medications
     SET pill_count = MAX(0, COALESCE(pill_count, 0) - pills_per_dose),
         updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), medicationId],
  );
}
