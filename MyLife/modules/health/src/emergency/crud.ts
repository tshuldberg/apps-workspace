import type { DatabaseAdapter } from '@mylife/db';
import type { EmergencyInfo, UpdateEmergencyInfoInput } from './types';

const PROFILE_ID = 'profile';

/**
 * Get the singleton emergency info profile.
 * Returns null if no profile has been created yet.
 */
export function getEmergencyInfo(db: DatabaseAdapter): EmergencyInfo | null {
  const rows = db.query<EmergencyInfo>(
    'SELECT * FROM hl_emergency_info WHERE id = ?',
    [PROFILE_ID],
  );
  return rows[0] ?? null;
}

/**
 * Upsert the emergency info profile.
 * Creates the singleton row if it doesn't exist, otherwise updates it.
 */
export function updateEmergencyInfo(
  db: DatabaseAdapter,
  input: UpdateEmergencyInfoInput,
): void {
  const existing = getEmergencyInfo(db);

  if (!existing) {
    db.execute(
      `INSERT INTO hl_emergency_info (id, full_name, date_of_birth, blood_type, allergies, conditions, emergency_contacts, insurance_provider, insurance_policy_number, insurance_group_number, primary_physician, physician_phone, organ_donor, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        PROFILE_ID,
        input.full_name ?? null,
        input.date_of_birth ?? null,
        input.blood_type ?? null,
        input.allergies ?? null,
        input.conditions ?? null,
        input.emergency_contacts ?? null,
        input.insurance_provider ?? null,
        input.insurance_policy_number ?? null,
        input.insurance_group_number ?? null,
        input.primary_physician ?? null,
        input.physician_phone ?? null,
        input.organ_donor != null ? (input.organ_donor ? 1 : 0) : null,
        input.notes ?? null,
      ],
    );
    return;
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.full_name !== undefined) { sets.push('full_name = ?'); params.push(input.full_name); }
  if (input.date_of_birth !== undefined) { sets.push('date_of_birth = ?'); params.push(input.date_of_birth); }
  if (input.blood_type !== undefined) { sets.push('blood_type = ?'); params.push(input.blood_type); }
  if (input.allergies !== undefined) { sets.push('allergies = ?'); params.push(input.allergies); }
  if (input.conditions !== undefined) { sets.push('conditions = ?'); params.push(input.conditions); }
  if (input.emergency_contacts !== undefined) { sets.push('emergency_contacts = ?'); params.push(input.emergency_contacts); }
  if (input.insurance_provider !== undefined) { sets.push('insurance_provider = ?'); params.push(input.insurance_provider); }
  if (input.insurance_policy_number !== undefined) { sets.push('insurance_policy_number = ?'); params.push(input.insurance_policy_number); }
  if (input.insurance_group_number !== undefined) { sets.push('insurance_group_number = ?'); params.push(input.insurance_group_number); }
  if (input.primary_physician !== undefined) { sets.push('primary_physician = ?'); params.push(input.primary_physician); }
  if (input.physician_phone !== undefined) { sets.push('physician_phone = ?'); params.push(input.physician_phone); }
  if (input.organ_donor !== undefined) { sets.push('organ_donor = ?'); params.push(input.organ_donor ? 1 : 0); }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  params.push(PROFILE_ID);

  db.execute(
    `UPDATE hl_emergency_info SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}
