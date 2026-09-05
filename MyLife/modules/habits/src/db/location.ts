import type { DatabaseAdapter } from '@mylife/db';

export interface CreateLocationReminderInput {
  habitId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  triggerType?: string;
}

export function createLocationReminder(db: DatabaseAdapter, id: string, input: CreateLocationReminderInput): void {
  db.execute(
    `INSERT INTO hb_location_reminders (id, habit_id, location_name, latitude, longitude, radius_meters, trigger_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.habitId, input.locationName, input.latitude, input.longitude,
     input.radiusMeters ?? 100, input.triggerType ?? 'arrival'],
  );
}

export function getLocationReminder(db: DatabaseAdapter, habitId: string) {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM hb_location_reminders WHERE habit_id = ?', [habitId]);
  return rows.length > 0 ? mapReminder(rows[0]) : null;
}

export function getAllActiveLocationReminders(db: DatabaseAdapter) {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_location_reminders WHERE is_active = 1',
  ).map(mapReminder);
}

export function updateLocationReminder(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<CreateLocationReminderInput>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.locationName !== undefined) { fields.push('location_name = ?'); values.push(updates.locationName); }
  if (updates.latitude !== undefined) { fields.push('latitude = ?'); values.push(updates.latitude); }
  if (updates.longitude !== undefined) { fields.push('longitude = ?'); values.push(updates.longitude); }
  if (updates.radiusMeters !== undefined) { fields.push('radius_meters = ?'); values.push(updates.radiusMeters); }
  if (updates.triggerType !== undefined) { fields.push('trigger_type = ?'); values.push(updates.triggerType); }

  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(`UPDATE hb_location_reminders SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deactivateLocationReminder(db: DatabaseAdapter, id: string): void {
  const now = new Date().toISOString();
  db.execute(
    'UPDATE hb_location_reminders SET is_active = 0, updated_at = ? WHERE id = ?',
    [now, id],
  );
}

export function deleteLocationReminder(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_location_reminders WHERE id = ?', [id]);
}

function mapReminder(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    locationName: row.location_name as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    radiusMeters: row.radius_meters as number,
    triggerType: row.trigger_type as string,
    isActive: (row.is_active as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
