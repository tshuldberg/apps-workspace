import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createHubTestDatabase,
  runModuleMigrations,
  type DatabaseAdapter,
} from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import {
  createReaderDocument,
  createReaderNote,
  deleteReaderNote,
  getReaderDocument,
  getReaderNotes,
  getReaderPreferences,
  getReaderDocuments,
  updateReaderDocumentProgress,
  upsertReaderPreferences,
} from '../index';

describe('books reader data layer', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createHubTestDatabase();
    db = testDb.adapter;
    closeDb = testDb.close;
    runModuleMigrations(db, 'books', BOOKS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    closeDb();
  });

  it('stores uploaded reader documents and progress', () => {
    const document = createReaderDocument(db, '11111111-1111-4111-8111-111111111111', {
      title: 'Demo Book',
      text_content: 'Hello world.\n\nSecond paragraph.',
      file_name: 'demo.txt',
      file_extension: 'txt',
      mime_type: 'text/plain',
    });

    expect(document.total_words).toBe(4);

    const list = getReaderDocuments(db);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Demo Book');

    updateReaderDocumentProgress(db, document.id, {
      current_position: 10,
      progress_percent: 42,
    });

    const updated = getReaderDocument(db, document.id);
    expect(updated?.current_position).toBe(10);
    expect(updated?.progress_percent).toBe(42);
    expect(updated?.last_opened_at).toBeTruthy();
  });

  it('stores notes and reader preferences per document', () => {
    const documentId = '22222222-2222-4222-8222-222222222222';
    createReaderDocument(db, documentId, {
      title: 'Annotated Book',
      text_content: 'Paragraph one.\n\nParagraph two.',
    });

    const note = createReaderNote(db, '33333333-3333-4333-8333-333333333333', {
      document_id: documentId,
      note_type: 'highlight',
      selection_start: 0,
      selection_end: 13,
      selected_text: 'Paragraph one',
      color: '#F9D976',
    });

    let notes = getReaderNotes(db, documentId);
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe(note.id);

    deleteReaderNote(db, note.id);
    notes = getReaderNotes(db, documentId);
    expect(notes).toHaveLength(0);

    expect(getReaderPreferences(db, documentId)).toBeNull();

    upsertReaderPreferences(db, {
      document_id: documentId,
      font_size: 24,
      line_height: 1.9,
      theme: 'dark',
      margin_size: 16,
    });

    const prefs = getReaderPreferences(db, documentId);
    expect(prefs?.font_size).toBe(24);
    expect(prefs?.theme).toBe('dark');
    expect(prefs?.line_height).toBe(1.9);
  });
});
