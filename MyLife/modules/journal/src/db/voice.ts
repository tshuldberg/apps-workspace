import type { DatabaseAdapter } from '@mylife/db';
import type {
  VoiceRecording,
  CreateVoiceRecordingInput,
  TranscriptionStatus,
} from '../voice/types';
import { CreateVoiceRecordingInputSchema } from '../voice/types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `jn_vr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function rowToVoiceRecording(row: Record<string, unknown>): VoiceRecording {
  return {
    id: row.id as string,
    entryId: row.entry_id as string,
    filePath: row.file_path as string,
    durationMs: row.duration_ms as number,
    fileSizeBytes: row.file_size_bytes as number,
    transcription: (row.transcription as string) ?? null,
    transcriptionStatus: row.transcription_status as VoiceRecording['transcriptionStatus'],
    keepAudio: Number(row.keep_audio ?? 1) === 1,
    createdAt: row.created_at as string,
  };
}

export function createVoiceRecording(
  db: DatabaseAdapter,
  rawInput: CreateVoiceRecordingInput,
): VoiceRecording {
  const input = CreateVoiceRecordingInputSchema.parse(rawInput);
  const id = createId();

  db.execute(
    `INSERT INTO jn_voice_recordings (id, entry_id, file_path, duration_ms, file_size_bytes, keep_audio)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.entryId, input.filePath, input.durationMs, input.fileSizeBytes, input.keepAudio ? 1 : 0],
  );

  return getVoiceRecordingById(db, id)!;
}

export function getVoiceRecordingById(db: DatabaseAdapter, id: string): VoiceRecording | null {
  const row = db.query<Record<string, unknown>>(
    `SELECT * FROM jn_voice_recordings WHERE id = ?`,
    [id],
  )[0];
  return row ? rowToVoiceRecording(row) : null;
}

export function listVoiceRecordingsForEntry(db: DatabaseAdapter, entryId: string): VoiceRecording[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM jn_voice_recordings WHERE entry_id = ? ORDER BY created_at ASC`,
      [entryId],
    )
    .map(rowToVoiceRecording);
}

export function updateTranscriptionStatus(
  db: DatabaseAdapter,
  id: string,
  status: TranscriptionStatus,
  transcription?: string,
): void {
  if (transcription !== undefined) {
    db.execute(
      `UPDATE jn_voice_recordings SET transcription_status = ?, transcription = ? WHERE id = ?`,
      [status, transcription, id],
    );
  } else {
    db.execute(
      `UPDATE jn_voice_recordings SET transcription_status = ? WHERE id = ?`,
      [status, id],
    );
  }
}

export function deleteVoiceRecording(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM jn_voice_recordings WHERE id = ?`, [id]);
}

export function deleteVoiceRecordingsForEntry(db: DatabaseAdapter, entryId: string): void {
  db.execute(`DELETE FROM jn_voice_recordings WHERE entry_id = ?`, [entryId]);
}
