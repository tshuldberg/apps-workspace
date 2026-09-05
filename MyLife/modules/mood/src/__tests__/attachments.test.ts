import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { MOOD_MODULE } from '../definition';
import { createMoodEntry } from '../db/crud';
import {
  createAttachment,
  getAttachmentsForEntry,
  getAttachmentById,
  getAttachmentsByType,
  deleteAttachment,
  getAttachmentCount,
} from '../db/attachments';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('mood', MOOD_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Attachment CRUD', () => {
  it('creates a photo attachment', () => {
    createMoodEntry(testDb.adapter, 'e1', { score: 7 });
    const att = createAttachment(testDb.adapter, 'att-1', {
      entryId: 'e1',
      type: 'photo',
      filePath: '/photos/mood-1.jpg',
      fileSizeBytes: 102400,
      mimeType: 'image/jpeg',
      width: 1920,
      height: 1080,
    });
    expect(att.id).toBe('att-1');
    expect(att.type).toBe('photo');
    expect(att.fileSizeBytes).toBe(102400);
    expect(att.width).toBe(1920);
    expect(att.durationSeconds).toBeNull();
  });

  it('creates a voice attachment', () => {
    createMoodEntry(testDb.adapter, 'e1', { score: 5 });
    const att = createAttachment(testDb.adapter, 'att-2', {
      entryId: 'e1',
      type: 'voice',
      filePath: '/audio/mood-1.m4a',
      fileSizeBytes: 51200,
      durationSeconds: 30.5,
      mimeType: 'audio/m4a',
    });
    expect(att.type).toBe('voice');
    expect(att.durationSeconds).toBe(30.5);
    expect(att.width).toBeNull();
  });

  it('retrieves attachments for an entry', () => {
    createMoodEntry(testDb.adapter, 'e1', { score: 7 });
    createAttachment(testDb.adapter, 'att-1', {
      entryId: 'e1', type: 'photo', filePath: '/p1.jpg',
      fileSizeBytes: 100, mimeType: 'image/jpeg',
    });
    createAttachment(testDb.adapter, 'att-2', {
      entryId: 'e1', type: 'voice', filePath: '/v1.m4a',
      fileSizeBytes: 200, mimeType: 'audio/m4a',
    });
    const atts = getAttachmentsForEntry(testDb.adapter, 'e1');
    expect(atts).toHaveLength(2);
  });

  it('retrieves attachment by id', () => {
    createMoodEntry(testDb.adapter, 'e1', { score: 7 });
    createAttachment(testDb.adapter, 'att-1', {
      entryId: 'e1', type: 'photo', filePath: '/p1.jpg',
      fileSizeBytes: 100, mimeType: 'image/jpeg',
    });
    const att = getAttachmentById(testDb.adapter, 'att-1');
    expect(att).not.toBeNull();
    expect(att!.filePath).toBe('/p1.jpg');
  });

  it('returns null for missing attachment', () => {
    expect(getAttachmentById(testDb.adapter, 'missing')).toBeNull();
  });

  it('filters attachments by type', () => {
    createMoodEntry(testDb.adapter, 'e1', { score: 7 });
    createAttachment(testDb.adapter, 'att-1', {
      entryId: 'e1', type: 'photo', filePath: '/p1.jpg',
      fileSizeBytes: 100, mimeType: 'image/jpeg',
    });
    createAttachment(testDb.adapter, 'att-2', {
      entryId: 'e1', type: 'voice', filePath: '/v1.m4a',
      fileSizeBytes: 200, mimeType: 'audio/m4a',
    });
    expect(getAttachmentsByType(testDb.adapter, 'photo')).toHaveLength(1);
    expect(getAttachmentsByType(testDb.adapter, 'voice')).toHaveLength(1);
  });

  it('deletes attachment', () => {
    createMoodEntry(testDb.adapter, 'e1', { score: 7 });
    createAttachment(testDb.adapter, 'att-1', {
      entryId: 'e1', type: 'photo', filePath: '/p1.jpg',
      fileSizeBytes: 100, mimeType: 'image/jpeg',
    });
    deleteAttachment(testDb.adapter, 'att-1');
    expect(getAttachmentById(testDb.adapter, 'att-1')).toBeNull();
  });

  it('counts attachments for entry', () => {
    createMoodEntry(testDb.adapter, 'e1', { score: 7 });
    createAttachment(testDb.adapter, 'att-1', {
      entryId: 'e1', type: 'photo', filePath: '/p1.jpg',
      fileSizeBytes: 100, mimeType: 'image/jpeg',
    });
    createAttachment(testDb.adapter, 'att-2', {
      entryId: 'e1', type: 'voice', filePath: '/v1.m4a',
      fileSizeBytes: 200, mimeType: 'audio/m4a',
    });
    expect(getAttachmentCount(testDb.adapter, 'e1')).toBe(2);
  });

  it('cascades delete when entry is deleted', () => {
    createMoodEntry(testDb.adapter, 'e1', { score: 7 });
    createAttachment(testDb.adapter, 'att-1', {
      entryId: 'e1', type: 'photo', filePath: '/p1.jpg',
      fileSizeBytes: 100, mimeType: 'image/jpeg',
    });
    testDb.adapter.execute(`DELETE FROM mo_entries WHERE id = ?`, ['e1']);
    expect(getAttachmentCount(testDb.adapter, 'e1')).toBe(0);
  });
});
