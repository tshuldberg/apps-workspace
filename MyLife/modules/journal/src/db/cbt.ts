import type { DatabaseAdapter } from '@mylife/db';
import type {
  ThoughtRecord,
  RecordEmotion,
  RecordDistortion,
  DistortionType,
} from '../cbt/types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `jn_tr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function rowToThoughtRecord(row: Record<string, unknown>): ThoughtRecord {
  return {
    id: row.id as string,
    entryId: row.entry_id as string,
    status: row.status as ThoughtRecord['status'],
    situation: (row.situation as string) ?? null,
    situationDate: (row.situation_date as string) ?? null,
    automaticThought: (row.automatic_thought as string) ?? null,
    thoughtBeliefBefore: (row.thought_belief_before as number) ?? null,
    rationalResponse: (row.rational_response as string) ?? null,
    evidenceFor: (row.evidence_for as string) ?? null,
    evidenceAgainst: (row.evidence_against as string) ?? null,
    thoughtBeliefAfter: (row.thought_belief_after as number) ?? null,
    outcomeNote: (row.outcome_note as string) ?? null,
    currentStep: row.current_step as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToEmotion(row: Record<string, unknown>): RecordEmotion {
  return {
    id: row.id as string,
    thoughtRecordId: row.thought_record_id as string,
    emotionName: row.emotion_name as string,
    intensityBefore: row.intensity_before as number,
    intensityAfter: (row.intensity_after as number) ?? null,
  };
}

function rowToDistortion(row: Record<string, unknown>): RecordDistortion {
  return {
    id: row.id as string,
    thoughtRecordId: row.thought_record_id as string,
    distortionType: row.distortion_type as RecordDistortion['distortionType'],
  };
}

export function createThoughtRecord(db: DatabaseAdapter, entryId: string): ThoughtRecord {
  const id = createId();
  const now = nowIso();

  db.execute(
    `INSERT INTO jn_thought_records (id, entry_id, status, situation_date, current_step, created_at, updated_at)
     VALUES (?, ?, 'draft', ?, 1, ?, ?)`,
    [id, entryId, now.slice(0, 10), now, now],
  );

  return getThoughtRecordById(db, id)!;
}

export function getThoughtRecordById(db: DatabaseAdapter, id: string): ThoughtRecord | null {
  const row = db.query<Record<string, unknown>>(
    `SELECT * FROM jn_thought_records WHERE id = ?`,
    [id],
  )[0];
  return row ? rowToThoughtRecord(row) : null;
}

export function listThoughtRecordsForEntry(db: DatabaseAdapter, entryId: string): ThoughtRecord[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM jn_thought_records WHERE entry_id = ? ORDER BY created_at ASC`,
      [entryId],
    )
    .map(rowToThoughtRecord);
}

export function listCompletedThoughtRecords(
  db: DatabaseAdapter,
  limit = 50,
  offset = 0,
): ThoughtRecord[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM jn_thought_records WHERE status = 'complete' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    )
    .map(rowToThoughtRecord);
}

export function updateThoughtRecordStep(
  db: DatabaseAdapter,
  id: string,
  step: number,
  fields: Partial<{
    situation: string;
    situationDate: string;
    automaticThought: string;
    thoughtBeliefBefore: number;
    rationalResponse: string;
    evidenceFor: string;
    evidenceAgainst: string;
    thoughtBeliefAfter: number;
    outcomeNote: string;
  }>,
): ThoughtRecord | null {
  const existing = getThoughtRecordById(db, id);
  if (!existing) return null;

  const now = nowIso();
  const sets: string[] = [`current_step = ?`, `updated_at = ?`];
  const params: unknown[] = [step, now];

  if (fields.situation !== undefined) { sets.push('situation = ?'); params.push(fields.situation); }
  if (fields.situationDate !== undefined) { sets.push('situation_date = ?'); params.push(fields.situationDate); }
  if (fields.automaticThought !== undefined) { sets.push('automatic_thought = ?'); params.push(fields.automaticThought); }
  if (fields.thoughtBeliefBefore !== undefined) { sets.push('thought_belief_before = ?'); params.push(fields.thoughtBeliefBefore); }
  if (fields.rationalResponse !== undefined) { sets.push('rational_response = ?'); params.push(fields.rationalResponse); }
  if (fields.evidenceFor !== undefined) { sets.push('evidence_for = ?'); params.push(fields.evidenceFor); }
  if (fields.evidenceAgainst !== undefined) { sets.push('evidence_against = ?'); params.push(fields.evidenceAgainst); }
  if (fields.thoughtBeliefAfter !== undefined) { sets.push('thought_belief_after = ?'); params.push(fields.thoughtBeliefAfter); }
  if (fields.outcomeNote !== undefined) { sets.push('outcome_note = ?'); params.push(fields.outcomeNote); }

  params.push(id);
  db.execute(`UPDATE jn_thought_records SET ${sets.join(', ')} WHERE id = ?`, params);

  return getThoughtRecordById(db, id);
}

export function completeThoughtRecord(db: DatabaseAdapter, id: string): ThoughtRecord | null {
  const now = nowIso();
  db.execute(
    `UPDATE jn_thought_records SET status = 'complete', current_step = 6, updated_at = ? WHERE id = ?`,
    [now, id],
  );
  return getThoughtRecordById(db, id);
}

export function deleteThoughtRecord(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM jn_thought_records WHERE id = ?`, [id]);
}

// ── Emotions ──

const MAX_EMOTIONS_PER_RECORD = 20;

export function addEmotions(
  db: DatabaseAdapter,
  thoughtRecordId: string,
  emotions: Array<{ name: string; intensityBefore: number }>,
): RecordEmotion[] {
  const bounded = emotions.slice(0, MAX_EMOTIONS_PER_RECORD);
  for (const e of bounded) {
    const id = createId();
    db.execute(
      `INSERT INTO jn_thought_record_emotions (id, thought_record_id, emotion_name, intensity_before)
       VALUES (?, ?, ?, ?)`,
      [id, thoughtRecordId, e.name, e.intensityBefore],
    );
  }
  return listEmotionsForRecord(db, thoughtRecordId);
}

export function updateEmotionAfter(
  db: DatabaseAdapter,
  emotionId: string,
  intensityAfter: number,
): void {
  db.execute(
    `UPDATE jn_thought_record_emotions SET intensity_after = ? WHERE id = ?`,
    [intensityAfter, emotionId],
  );
}

export function listEmotionsForRecord(
  db: DatabaseAdapter,
  thoughtRecordId: string,
): RecordEmotion[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM jn_thought_record_emotions WHERE thought_record_id = ? ORDER BY emotion_name ASC`,
      [thoughtRecordId],
    )
    .map(rowToEmotion);
}

// ── Distortions ──

const MAX_DISTORTIONS_PER_RECORD = 15;

export function addDistortions(
  db: DatabaseAdapter,
  thoughtRecordId: string,
  types: DistortionType[],
): RecordDistortion[] {
  const bounded = types.slice(0, MAX_DISTORTIONS_PER_RECORD);
  for (const type of bounded) {
    const id = createId();
    db.execute(
      `INSERT INTO jn_thought_record_distortions (id, thought_record_id, distortion_type)
       VALUES (?, ?, ?)`,
      [id, thoughtRecordId, type],
    );
  }
  return listDistortionsForRecord(db, thoughtRecordId);
}

export function listDistortionsForRecord(
  db: DatabaseAdapter,
  thoughtRecordId: string,
): RecordDistortion[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM jn_thought_record_distortions WHERE thought_record_id = ? ORDER BY distortion_type ASC`,
      [thoughtRecordId],
    )
    .map(rowToDistortion);
}

export function getDistortionFrequency(
  db: DatabaseAdapter,
): Array<{ distortionType: DistortionType; count: number }> {
  return db
    .query<{ distortion_type: string; count: number }>(
      `SELECT distortion_type, COUNT(*) as count
       FROM jn_thought_record_distortions d
       INNER JOIN jn_thought_records r ON r.id = d.thought_record_id
       WHERE r.status = 'complete'
       GROUP BY distortion_type
       ORDER BY count DESC`,
    )
    .map((row) => ({
      distortionType: row.distortion_type as DistortionType,
      count: row.count,
    }));
}
