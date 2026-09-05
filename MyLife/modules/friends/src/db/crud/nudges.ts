/**
 * Nudge CRUD operations.
 *
 * Nudges are system-generated reminders to reach out to people.
 * They can be dismissed, snoozed, or acted on.
 */

import type { DatabaseAdapter } from '@mylife/db';

// ── Types ──────────────────────────────────────────────────────────

export interface NudgeRow {
  id: string;
  person_id: string;
  type: 'havent_seen' | 'birthday_coming' | 'anniversary';
  triggered_at: string;
  dismissed: number;
  snoozed_until: string | null;
  acted_on: number;
  created_at: string;
}

export interface NudgeRecord {
  id: string;
  person_id: string;
  type: 'havent_seen' | 'birthday_coming' | 'anniversary';
  triggered_at: string;
  dismissed: boolean;
  snoozed_until: string | null;
  acted_on: boolean;
  created_at: string;
}

export interface NudgeInput {
  person_id: string;
  type: 'havent_seen' | 'birthday_coming' | 'anniversary';
  triggered_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

function deserialize(row: NudgeRow): NudgeRecord {
  return {
    ...row,
    dismissed: row.dismissed === 1,
    acted_on: row.acted_on === 1,
  };
}

// ── CRUD ────────────────────────────────────────────────────────────

export function createNudge(
  db: DatabaseAdapter,
  input: NudgeInput,
): NudgeRecord {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO fn_nudges (id, person_id, type, triggered_at, dismissed, snoozed_until, acted_on, created_at)
     VALUES (?, ?, ?, ?, 0, NULL, 0, ?)`,
    [id, input.person_id, input.type, input.triggered_at, now],
  );

  return {
    id,
    person_id: input.person_id,
    type: input.type,
    triggered_at: input.triggered_at,
    dismissed: false,
    snoozed_until: null,
    acted_on: false,
    created_at: now,
  };
}

export function getNudge(
  db: DatabaseAdapter,
  id: string,
): NudgeRecord | null {
  const rows = db.query<NudgeRow>(
    `SELECT * FROM fn_nudges WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? deserialize(rows[0]) : null;
}

export function dismissNudge(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE fn_nudges SET dismissed = 1 WHERE id = ?`, [id]);
}

export function snoozeNudge(
  db: DatabaseAdapter,
  id: string,
  until: string,
): void {
  db.execute(`UPDATE fn_nudges SET snoozed_until = ? WHERE id = ?`, [
    until,
    id,
  ]);
}

export function actOnNudge(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE fn_nudges SET acted_on = 1 WHERE id = ?`, [id]);
}

/**
 * List active nudges: not dismissed, not acted on, and not currently snoozed.
 * A snoozed nudge becomes active again once snoozed_until is in the past.
 */
export function listActiveNudges(
  db: DatabaseAdapter,
  now?: string,
): NudgeRecord[] {
  const currentTime = now ?? new Date().toISOString();
  const rows = db.query<NudgeRow>(
    `SELECT * FROM fn_nudges
     WHERE dismissed = 0
       AND acted_on = 0
       AND (snoozed_until IS NULL OR snoozed_until < ?)
     ORDER BY triggered_at DESC`,
    [currentTime],
  );
  return rows.map(deserialize);
}

/**
 * List all nudges for a specific person (any status).
 */
export function listNudgesForPerson(
  db: DatabaseAdapter,
  personId: string,
): NudgeRecord[] {
  const rows = db.query<NudgeRow>(
    `SELECT * FROM fn_nudges WHERE person_id = ? ORDER BY created_at DESC`,
    [personId],
  );
  return rows.map(deserialize);
}

/**
 * Delete dismissed nudges older than N days (default 90).
 * Only removes nudges that are dismissed or acted on.
 */
export function cleanupOldNudges(
  db: DatabaseAdapter,
  olderThanDays: number = 90,
): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  const cutoffIso = cutoff.toISOString();

  db.execute(
    `DELETE FROM fn_nudges
     WHERE (dismissed = 1 OR acted_on = 1)
       AND created_at < ?`,
    [cutoffIso],
  );
}
