import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip } from '../db/crud/trips';
import {
  filterVoiceNotesByTag,
  getTripVoiceNotes,
} from '../integrations/voice-link';

function createVoiceTables(adapter: DatabaseAdapter): void {
  adapter.execute(`
    CREATE TABLE vc_transcriptions (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      duration_seconds REAL NOT NULL
    )
  `);
  adapter.execute(`
    CREATE TABLE vc_voice_notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      transcription_id TEXT,
      tags TEXT,
      created_at TEXT NOT NULL
    )
  `);
}

function insertTranscription(
  adapter: DatabaseAdapter,
  params: { id: string; text: string; durationSeconds: number },
): void {
  adapter.execute(
    `INSERT INTO vc_transcriptions (id, text, duration_seconds)
     VALUES (?, ?, ?)`,
    [params.id, params.text, params.durationSeconds],
  );
}

function insertVoiceNote(
  adapter: DatabaseAdapter,
  params: {
    id: string;
    title: string;
    transcriptionId?: string | null;
    tags?: string | null;
    createdAt: string;
  },
): void {
  adapter.execute(
    `INSERT INTO vc_voice_notes (id, title, transcription_id, tags, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      params.id,
      params.title,
      params.transcriptionId ?? null,
      params.tags ?? null,
      params.createdAt,
    ],
  );
}

describe('@mylife/travel voice-link integration', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('getTripVoiceNotes returns [] when trip is missing', () => {
    createVoiceTables(adapter);
    expect(getTripVoiceNotes(adapter, 'trip_missing')).toEqual([]);
  });

  it('getTripVoiceNotes returns [] when trip has no window', () => {
    createVoiceTables(adapter);
    const trip = createTrip(adapter, { name: 'Undated' });
    expect(getTripVoiceNotes(adapter, trip.id)).toEqual([]);
  });

  it('getTripVoiceNotes returns [] when voice tables are missing', () => {
    const trip = createTrip(adapter, {
      name: 'Tokyo',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });
    expect(getTripVoiceNotes(adapter, trip.id)).toEqual([]);
  });

  it('getTripVoiceNotes includes notes inside the window and excludes outside', () => {
    createVoiceTables(adapter);
    insertTranscription(adapter, {
      id: 't1',
      text: 'hello tokyo',
      durationSeconds: 12.5,
    });
    const trip = createTrip(adapter, {
      name: 'Tokyo',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });

    insertVoiceNote(adapter, {
      id: 'n_before',
      title: 'Before',
      transcriptionId: 't1',
      createdAt: '2026-05-30T10:00:00Z',
    });
    insertVoiceNote(adapter, {
      id: 'n_start',
      title: 'Start',
      transcriptionId: 't1',
      createdAt: '2026-06-01T08:00:00Z',
    });
    insertVoiceNote(adapter, {
      id: 'n_mid',
      title: 'Mid',
      transcriptionId: null,
      createdAt: '2026-06-05T14:00:00Z',
    });
    insertVoiceNote(adapter, {
      id: 'n_end',
      title: 'End',
      transcriptionId: 't1',
      createdAt: '2026-06-10T23:30:00Z',
    });
    insertVoiceNote(adapter, {
      id: 'n_after',
      title: 'After',
      transcriptionId: 't1',
      createdAt: '2026-06-11T09:00:00Z',
    });

    const result = getTripVoiceNotes(adapter, trip.id);
    expect(result.map((r) => r.noteId)).toEqual(['n_start', 'n_mid', 'n_end']);
  });

  it('getTripVoiceNotes hydrates transcript and durationSeconds when present', () => {
    createVoiceTables(adapter);
    insertTranscription(adapter, {
      id: 't1',
      text: 'captured',
      durationSeconds: 42,
    });
    const trip = createTrip(adapter, {
      name: 'Trip',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });
    insertVoiceNote(adapter, {
      id: 'n1',
      title: 'With transcript',
      transcriptionId: 't1',
      createdAt: '2026-06-05T10:00:00Z',
    });
    insertVoiceNote(adapter, {
      id: 'n2',
      title: 'No transcript',
      transcriptionId: null,
      createdAt: '2026-06-06T10:00:00Z',
    });

    const result = getTripVoiceNotes(adapter, trip.id);
    expect(result[0]!.transcript).toBe('captured');
    expect(result[0]!.durationSeconds).toBe(42);
    expect(result[1]!.transcript).toBeUndefined();
    expect(result[1]!.durationSeconds).toBeUndefined();
  });

  it('filterVoiceNotesByTag returns [] when voice tables are missing', () => {
    expect(filterVoiceNotesByTag(adapter, 'travel')).toEqual([]);
  });

  it('filterVoiceNotesByTag returns [] for empty/whitespace tag', () => {
    createVoiceTables(adapter);
    expect(filterVoiceNotesByTag(adapter, '')).toEqual([]);
    expect(filterVoiceNotesByTag(adapter, '   ')).toEqual([]);
  });

  it('filterVoiceNotesByTag matches whole tokens and excludes substring hits', () => {
    createVoiceTables(adapter);
    insertVoiceNote(adapter, {
      id: 'n1',
      title: 'tagged travel',
      tags: 'travel,memory',
      createdAt: '2026-06-01T10:00:00Z',
    });
    insertVoiceNote(adapter, {
      id: 'n2',
      title: 'substring hit',
      tags: 'traveling,work',
      createdAt: '2026-06-02T10:00:00Z',
    });
    insertVoiceNote(adapter, {
      id: 'n3',
      title: 'another tagged',
      tags: 'work,travel',
      createdAt: '2026-06-03T10:00:00Z',
    });
    insertVoiceNote(adapter, {
      id: 'n4',
      title: 'untagged',
      tags: null,
      createdAt: '2026-06-04T10:00:00Z',
    });

    const result = filterVoiceNotesByTag(adapter, 'travel');
    expect(result.map((r) => r.noteId)).toEqual(['n1', 'n3']);
  });
});
