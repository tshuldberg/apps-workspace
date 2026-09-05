import type { DatabaseAdapter } from '@mylife/db';
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  CreateAppointmentInput,
} from '../models/appointment';

function rowToAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: row.id as string,
    title: row.title as string,
    appointmentType: row.appointment_type as AppointmentType,
    providerContactId: (row.provider_contact_id as string) ?? null,
    providerName: (row.provider_name as string) ?? null,
    specialty: (row.specialty as string) ?? null,
    scheduledAt: row.scheduled_at as string,
    location: (row.location as string) ?? null,
    notes: (row.notes as string) ?? null,
    reminderEnabled: !!(row.reminder_enabled as number),
    reminderMinutesBefore: (row.reminder_minutes_before as number) ?? 120,
    status: row.status as AppointmentStatus,
    linkedMedicationIds: row.linked_medication_ids
      ? JSON.parse(row.linked_medication_ids as string)
      : [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createAppointment(
  db: DatabaseAdapter,
  id: string,
  input: CreateAppointmentInput,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO md_appointments
      (id, title, appointment_type, provider_contact_id, provider_name, specialty,
       scheduled_at, location, notes, reminder_enabled, reminder_minutes_before,
       status, linked_medication_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title,
      input.appointmentType ?? 'checkup',
      input.providerContactId ?? null,
      input.providerName ?? null,
      input.specialty ?? null,
      input.scheduledAt,
      input.location ?? null,
      input.notes ?? null,
      input.reminderEnabled === false ? 0 : 1,
      input.reminderMinutesBefore ?? 120,
      input.status ?? 'scheduled',
      JSON.stringify(input.linkedMedicationIds ?? []),
      now,
      now,
    ],
  );
}

export function getAppointments(
  db: DatabaseAdapter,
  opts?: {
    status?: AppointmentStatus;
    from?: string;
    to?: string;
    limit?: number;
  },
): Appointment[] {
  let sql = 'SELECT * FROM md_appointments WHERE 1 = 1';
  const params: unknown[] = [];

  if (opts?.status) {
    sql += ' AND status = ?';
    params.push(opts.status);
  }
  if (opts?.from) {
    sql += ' AND scheduled_at >= ?';
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ' AND scheduled_at <= ?';
    params.push(opts.to);
  }

  sql += ' ORDER BY scheduled_at ASC LIMIT ?';
  params.push(opts?.limit ?? 500);

  return db.query<Record<string, unknown>>(sql, params).map(rowToAppointment);
}

export function getAppointmentById(
  db: DatabaseAdapter,
  id: string,
): Appointment | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM md_appointments WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToAppointment(rows[0]) : null;
}

export function getUpcomingAppointments(
  db: DatabaseAdapter,
  fromIso: string = new Date().toISOString(),
): Appointment[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_appointments
       WHERE status = 'scheduled' AND scheduled_at >= ?
       ORDER BY scheduled_at ASC`,
      [fromIso],
    )
    .map(rowToAppointment);
}

export function getPastAppointments(
  db: DatabaseAdapter,
  beforeIso: string = new Date().toISOString(),
): Appointment[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_appointments
       WHERE scheduled_at < ?
       ORDER BY scheduled_at DESC`,
      [beforeIso],
    )
    .map(rowToAppointment);
}

export function updateAppointment(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<CreateAppointmentInput>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.title !== undefined) {
    sets.push('title = ?');
    params.push(updates.title);
  }
  if (updates.appointmentType !== undefined) {
    sets.push('appointment_type = ?');
    params.push(updates.appointmentType);
  }
  if (updates.providerContactId !== undefined) {
    sets.push('provider_contact_id = ?');
    params.push(updates.providerContactId || null);
  }
  if (updates.providerName !== undefined) {
    sets.push('provider_name = ?');
    params.push(updates.providerName || null);
  }
  if (updates.specialty !== undefined) {
    sets.push('specialty = ?');
    params.push(updates.specialty || null);
  }
  if (updates.scheduledAt !== undefined) {
    sets.push('scheduled_at = ?');
    params.push(updates.scheduledAt);
  }
  if (updates.location !== undefined) {
    sets.push('location = ?');
    params.push(updates.location || null);
  }
  if (updates.notes !== undefined) {
    sets.push('notes = ?');
    params.push(updates.notes || null);
  }
  if (updates.reminderEnabled !== undefined) {
    sets.push('reminder_enabled = ?');
    params.push(updates.reminderEnabled ? 1 : 0);
  }
  if (updates.reminderMinutesBefore !== undefined) {
    sets.push('reminder_minutes_before = ?');
    params.push(updates.reminderMinutesBefore);
  }
  if (updates.status !== undefined) {
    sets.push('status = ?');
    params.push(updates.status);
  }
  if (updates.linkedMedicationIds !== undefined) {
    sets.push('linked_medication_ids = ?');
    params.push(JSON.stringify(updates.linkedMedicationIds));
  }

  if (sets.length === 0) {
    return;
  }

  sets.push('updated_at = ?');
  params.push(new Date().toISOString(), id);
  db.execute(`UPDATE md_appointments SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteAppointment(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_appointments WHERE id = ?', [id]);
}
