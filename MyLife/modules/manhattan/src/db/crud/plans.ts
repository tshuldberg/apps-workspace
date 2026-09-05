import { v4 as uuidv4 } from 'uuid';
import type { DatabaseAdapter } from '@mylife/db';
import { PlanInputSchema, type PlanInput, type PlanRow } from '../../types';

export function createPlan(db: DatabaseAdapter, input: PlanInput): string {
  const data = PlanInputSchema.parse(input);
  const id = data.id ?? uuidv4();
  db.execute(
    `INSERT INTO mh_plans (id, title, start_at, end_at, event_id, pin_id, reminder_minutes,
       has_reservation, party_size, source)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, data.title, data.startAt, data.endAt ?? null, data.eventId ?? null, data.pinId ?? null,
     data.reminderMinutes ?? null, data.hasReservation ? 1 : 0, data.partySize, data.source],
  );
  return id;
}

export function getPlans(db: DatabaseAdapter): PlanRow[] {
  return db.query<PlanRow>(`SELECT * FROM mh_plans WHERE deleted_at IS NULL ORDER BY start_at ASC`);
}

export function getPlanById(db: DatabaseAdapter, id: string): PlanRow | null {
  const rows = db.query<PlanRow>(`SELECT * FROM mh_plans WHERE id = ? AND deleted_at IS NULL`, [id]);
  return rows[0] ?? null;
}

export function getPlansOnDay(db: DatabaseAdapter, isoDay: string): PlanRow[] {
  return db.query<PlanRow>(
    `SELECT * FROM mh_plans WHERE deleted_at IS NULL AND substr(start_at, 1, 10) = ? ORDER BY start_at ASC`,
    [isoDay],
  );
}

export function updatePlan(db: DatabaseAdapter, id: string, input: PlanInput): void {
  const data = PlanInputSchema.parse(input);
  db.execute(
    `UPDATE mh_plans SET title = ?, start_at = ?, end_at = ?, event_id = ?, pin_id = ?,
       reminder_minutes = ?, has_reservation = ?, party_size = ?, source = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [data.title, data.startAt, data.endAt ?? null, data.eventId ?? null, data.pinId ?? null,
     data.reminderMinutes ?? null, data.hasReservation ? 1 : 0, data.partySize, data.source, id],
  );
}

export function softDeletePlan(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE mh_plans SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [id]);
}

export function updatePlanCalendarEventId(
  db: DatabaseAdapter,
  planId: string,
  calendarEventId: string | null,
): void {
  db.execute(
    `UPDATE mh_plans SET calendar_event_id = ?, updated_at = datetime('now') WHERE id = ?`,
    [calendarEventId, planId],
  );
}

export function getPlanByCalendarEventId(db: DatabaseAdapter, calendarEventId: string): PlanRow | null {
  const rows = db.query<PlanRow>(
    `SELECT * FROM mh_plans WHERE calendar_event_id = ? AND deleted_at IS NULL`,
    [calendarEventId],
  );
  return rows[0] ?? null;
}
