import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { FLASH_MODULE } from '../definition';
import {
  createMediaFile,
  getMediaByHash,
  incrementMediaRef,
  decrementMediaRef,
  deleteOrphanMedia,
} from '../db/media';
import { validateMediaFile, mediaTagForImage, mediaTagForAudio, removeMediaTag } from '../media/types';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('flash', FLASH_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Media CRUD', () => {
  it('creates a media file record', () => {
    const media = createMediaFile(testDb.adapter, 'm1', {
      hash: 'abc123',
      filename: 'photo.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      fileSizeBytes: 1024,
      width: 800,
      height: 600,
      localPath: '/path/to/photo.jpg',
    });
    expect(media.id).toBe('m1');
    expect(media.hash).toBe('abc123');
    expect(media.referenceCount).toBe(1);
  });

  it('finds media by hash', () => {
    createMediaFile(testDb.adapter, 'm1', {
      hash: 'abc123',
      filename: 'photo.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      fileSizeBytes: 1024,
      localPath: '/path/to/photo.jpg',
    });
    const found = getMediaByHash(testDb.adapter, 'abc123');
    expect(found).toBeTruthy();
    expect(found!.id).toBe('m1');
  });

  it('increments reference count', () => {
    createMediaFile(testDb.adapter, 'm1', {
      hash: 'abc123',
      filename: 'photo.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      fileSizeBytes: 1024,
      localPath: '/path/to/photo.jpg',
    });
    incrementMediaRef(testDb.adapter, 'm1');
    const media = getMediaByHash(testDb.adapter, 'abc123');
    expect(media!.referenceCount).toBe(2);
  });

  it('decrements reference count', () => {
    createMediaFile(testDb.adapter, 'm1', {
      hash: 'abc123',
      filename: 'photo.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      fileSizeBytes: 1024,
      localPath: '/path/to/photo.jpg',
    });
    incrementMediaRef(testDb.adapter, 'm1');
    decrementMediaRef(testDb.adapter, 'm1');
    const media = getMediaByHash(testDb.adapter, 'abc123');
    expect(media!.referenceCount).toBe(1);
  });

  it('deletes orphan media files', () => {
    createMediaFile(testDb.adapter, 'm1', {
      hash: 'abc123',
      filename: 'photo.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      fileSizeBytes: 1024,
      localPath: '/path/to/photo.jpg',
    });
    decrementMediaRef(testDb.adapter, 'm1');
    const orphanPaths = deleteOrphanMedia(testDb.adapter);
    expect(orphanPaths).toContain('/path/to/photo.jpg');
    expect(getMediaByHash(testDb.adapter, 'abc123')).toBeNull();
  });

  it('does not delete media with references', () => {
    createMediaFile(testDb.adapter, 'm1', {
      hash: 'abc123',
      filename: 'photo.jpg',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      fileSizeBytes: 1024,
      localPath: '/path/to/photo.jpg',
    });
    const orphanPaths = deleteOrphanMedia(testDb.adapter);
    expect(orphanPaths).toHaveLength(0);
    expect(getMediaByHash(testDb.adapter, 'abc123')).toBeTruthy();
  });
});

describe('Media Validation', () => {
  it('accepts valid image', () => {
    expect(validateMediaFile('image', 'image/jpeg', 5_000_000)).toBeNull();
  });

  it('rejects oversized image', () => {
    expect(validateMediaFile('image', 'image/jpeg', 11_000_000)).toContain('10MB');
  });

  it('rejects unsupported image format', () => {
    expect(validateMediaFile('image', 'image/bmp', 1000)).toContain('not supported');
  });

  it('accepts valid audio', () => {
    expect(validateMediaFile('audio', 'audio/mpeg', 5_000_000)).toBeNull();
  });

  it('rejects oversized audio', () => {
    const result = validateMediaFile('audio', 'audio/mpeg', 55_000_000);
    expect(result).toBeTruthy();
    expect(result!).toContain('50MB');
  });

  it('rejects unsupported audio format', () => {
    expect(validateMediaFile('audio', 'audio/flac', 1000)).toContain('not supported');
  });
});

describe('Media Tags', () => {
  it('generates image tag', () => {
    expect(mediaTagForImage('abc123', 'jpg')).toBe('<img src="fl_media/abc123.jpg">');
  });

  it('generates audio tag', () => {
    expect(mediaTagForAudio('abc123', 'mp3')).toBe('[sound:abc123.mp3]');
  });

  it('removes image tag from content', () => {
    const content = 'Hello <img src="fl_media/abc123.jpg"> World';
    expect(removeMediaTag(content, 'abc123')).toBe('Hello  World');
  });

  it('removes audio tag from content', () => {
    const content = 'Listen [sound:abc123.mp3] here';
    expect(removeMediaTag(content, 'abc123')).toBe('Listen  here');
  });
});
