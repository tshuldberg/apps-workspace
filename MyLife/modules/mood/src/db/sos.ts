import type { DatabaseAdapter } from '@mylife/db';
import type { SosSession, EmergencyContact, CreateSosSessionInput, CompleteSosSessionInput, CreateEmergencyContactInput } from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function rowToSosSession(row: Record<string, unknown>): SosSession {
  return {
    id: row.id as string,
    triggerMoodScore: (row.trigger_mood_score as number) ?? null,
    stepsCompleted: row.steps_completed as number,
    totalDurationSeconds: row.total_duration_seconds as number,
    exitMoodScore: (row.exit_mood_score as number) ?? null,
    breathingPattern: (row.breathing_pattern as string) ?? null,
    groundingCompleted: (row.grounding_completed as number) === 1,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToContact(row: Record<string, unknown>): EmergencyContact {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    relationship: (row.relationship as string) ?? null,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createSosSession(
  db: DatabaseAdapter,
  id: string,
  input: CreateSosSessionInput,
): SosSession {
  const now = nowIso();
  db.execute(
    `INSERT INTO mo_sos_sessions (id, trigger_mood_score, breathing_pattern, started_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.triggerMoodScore ?? null, input.breathingPattern ?? null, now, now],
  );
  return {
    id,
    triggerMoodScore: input.triggerMoodScore ?? null,
    stepsCompleted: 0,
    totalDurationSeconds: 0,
    exitMoodScore: null,
    breathingPattern: input.breathingPattern ?? null,
    groundingCompleted: false,
    startedAt: now,
    completedAt: null,
    createdAt: now,
  };
}

export function completeSosSession(
  db: DatabaseAdapter,
  id: string,
  input: CompleteSosSessionInput,
): void {
  const now = nowIso();
  db.execute(
    `UPDATE mo_sos_sessions SET steps_completed = ?, total_duration_seconds = ?, exit_mood_score = ?, grounding_completed = ?, completed_at = ? WHERE id = ?`,
    [input.stepsCompleted, input.totalDurationSeconds, input.exitMoodScore ?? null, input.groundingCompleted ? 1 : 0, now, id],
  );
}

export function getSosSession(db: DatabaseAdapter, id: string): SosSession | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_sos_sessions WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToSosSession(rows[0]) : null;
}

export function getSosSessions(db: DatabaseAdapter, limit = 50): SosSession[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_sos_sessions ORDER BY started_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToSosSession);
}

export function createEmergencyContact(
  db: DatabaseAdapter,
  id: string,
  input: CreateEmergencyContactInput,
): EmergencyContact {
  const now = nowIso();
  db.execute(
    `INSERT INTO mo_emergency_contacts (id, name, phone, relationship, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.phone ?? null, input.relationship ?? null, input.sortOrder ?? 0, now, now],
  );
  return {
    id,
    name: input.name,
    phone: input.phone ?? null,
    relationship: input.relationship ?? null,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getEmergencyContacts(db: DatabaseAdapter, limit = 100): EmergencyContact[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_emergency_contacts ORDER BY sort_order ASC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToContact);
}

export function deleteEmergencyContact(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM mo_emergency_contacts WHERE id = ?`, [id]);
  return true;
}
