/**
 * MyTravel <-> MyHealth read-only integration.
 *
 * Surfaces vaccination reminders relevant to upcoming international trips.
 * Read-only: no schema changes, no writes.
 *
 * The Health module does not currently store a structured vaccination
 * schedule -- `hl_documents` supports a `vaccination` type but only stores
 * document blobs with an optional `document_date`. We therefore return a
 * seed list of common international travel vaccines as `recommended` and,
 * if vaccination documents exist with a `document_date` older than 5 years,
 * surface a `due` reminder referencing them.
 *
 * Degrades gracefully if `hl_documents` is missing (Health not installed).
 */

import type { DatabaseAdapter } from '@mylife/db';

export type HealthReminderUrgency = 'due' | 'upcoming' | 'recommended';

export interface HealthReminder {
  id: string;
  title: string;
  urgency: HealthReminderUrgency;
  dueOn?: string;
}

interface VaccinationDocRow {
  id: string;
  title: string | null;
  document_date: string | null;
}

/**
 * Common international travel vaccine reminders. Kept small and conservative;
 * the product surfaces these as recommendations to review with a clinician,
 * not as medical advice.
 */
const TRAVEL_VACCINE_SEED: ReadonlyArray<{ id: string; title: string }> = [
  { id: 'seed_hep_a', title: 'Hepatitis A' },
  { id: 'seed_typhoid', title: 'Typhoid' },
  { id: 'seed_mmr', title: 'MMR booster' },
  { id: 'seed_tdap', title: 'Tdap' },
];

/**
 * Return vaccination reminders for a set of destination country codes.
 *
 * If the Health module has vaccination document records whose
 * `document_date` is older than 5 years, mark them `due` with that date.
 * Always include the base seed list as `recommended`. Country codes are
 * accepted for future per-country rules but are not currently used to
 * filter -- the seed list is a safe general baseline.
 */
export function getPreTripVaccinationReminders(
  db: DatabaseAdapter,
  _destinationCountryCodes: string[],
): HealthReminder[] {
  const reminders: HealthReminder[] = [];

  let rows: VaccinationDocRow[] = [];
  try {
    rows = db.query<VaccinationDocRow>(
      `SELECT id, title, document_date
       FROM hl_documents
       WHERE type = 'vaccination'`,
    );
  } catch {
    // Health not installed -- fall through to seed-only list.
    rows = [];
  }

  const now = Date.now();
  const fiveYearsMs = 5 * 365 * 24 * 60 * 60 * 1000;

  for (const row of rows) {
    if (!row.document_date) continue;
    const givenMs = Date.parse(row.document_date);
    if (Number.isNaN(givenMs)) continue;
    if (now - givenMs >= fiveYearsMs) {
      const reminder: HealthReminder = {
        id: 'doc_' + row.id,
        title: (row.title ?? 'Vaccination') + ' booster',
        urgency: 'due',
        dueOn: row.document_date,
      };
      reminders.push(reminder);
    }
  }

  for (const seed of TRAVEL_VACCINE_SEED) {
    reminders.push({
      id: seed.id,
      title: seed.title,
      urgency: 'recommended',
    });
  }

  return reminders;
}
