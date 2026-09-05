/**
 * Plan 38 Phase 0 (web twin): the community data-hub (Plex-style libraries)
 * foundation on the web surface.
 *
 * Asserts the same invariants the mobile library-core suite pins, against the
 * REAL shipped web copies (schema.ts DDL + meerkat-data.ts policy): every new
 * table is created, the shared library tables replicate at shared_workspace,
 * cm_library_progress stays PERSONAL and can never reach shared_workspace, and
 * the pure media-type registry / smart-rule / quota seams behave identically.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { createInMemorySyncSecretStore, configureSyncSecretStore } from '@mylife/sync';
import { ensureSyncSchema } from '../schema';
import {
  COMMUNITY_SYNC_POLICY,
  CM_COMMUNITY_IDENTITY_TABLE,
  CM_LIBRARIES_TABLE,
  CM_LIBRARY_ITEMS_TABLE,
  CM_LIBRARY_COLLECTIONS_TABLE,
  CM_LIBRARY_COLLECTION_ITEMS_TABLE,
  CM_LIBRARY_SMART_RULES_TABLE,
  CM_LIBRARY_TAGS_TABLE,
  CM_LIBRARY_PROGRESS_TABLE,
} from '../meerkat-data';
import {
  MEDIA_TYPE_REGISTRY,
  LIBRARY_METADATA_MAX_BYTES,
  validateLibraryItemMetadata,
  evaluateSmartRuleSafe,
  libraryBytesForQuota,
  libraryQuotaStatus,
  type KnownMediaType,
} from '../library-metadata-core';

let testDb: InMemoryTestDatabase | null = null;
afterEach(() => {
  testDb?.close();
  testDb = null;
});

function freshDb(): InMemoryTestDatabase['adapter'] {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  testDb = createInMemoryTestDatabase();
  ensureSyncSchema(testDb.adapter);
  return testDb.adapter;
}

const NEW_LIBRARY_TABLES = [
  CM_COMMUNITY_IDENTITY_TABLE,
  CM_LIBRARIES_TABLE,
  CM_LIBRARY_ITEMS_TABLE,
  CM_LIBRARY_COLLECTIONS_TABLE,
  CM_LIBRARY_COLLECTION_ITEMS_TABLE,
  CM_LIBRARY_SMART_RULES_TABLE,
  CM_LIBRARY_TAGS_TABLE,
  CM_LIBRARY_PROGRESS_TABLE,
];

describe('Plan 38 library DDL (web)', () => {
  it('creates every new community data-hub table', () => {
    const db = freshDb();
    const tables = new Set(
      db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name),
    );
    for (const table of NEW_LIBRARY_TABLES) {
      expect(tables.has(table)).toBe(true);
    }
  });
});

describe('Plan 38 web COMMUNITY_SYNC_POLICY rules', () => {
  it('the shared library tables replicate at shared_workspace', () => {
    for (const table of [
      CM_COMMUNITY_IDENTITY_TABLE,
      CM_LIBRARIES_TABLE,
      CM_LIBRARY_ITEMS_TABLE,
      CM_LIBRARY_COLLECTIONS_TABLE,
      CM_LIBRARY_COLLECTION_ITEMS_TABLE,
      CM_LIBRARY_SMART_RULES_TABLE,
      CM_LIBRARY_TAGS_TABLE,
    ]) {
      const rule = COMMUNITY_SYNC_POLICY.entityRules.find((r) => r.tableName === table);
      expect(rule?.defaultScope).toBe('shared_workspace');
      expect(rule?.maxScope).toBe('shared_workspace');
    }
  });

  it('cm_library_progress is PERSONAL and can never reach shared_workspace', () => {
    const rule = COMMUNITY_SYNC_POLICY.entityRules.find((r) => r.tableName === CM_LIBRARY_PROGRESS_TABLE);
    expect(rule).toBeDefined();
    expect(rule?.defaultScope).toBe('personal_replica');
    expect(rule?.maxScope).toBe('personal_replica');
    expect(rule?.maxScope).not.toBe('shared_workspace');
  });
});

describe('media-type registry validation (web)', () => {
  const validByType: Record<KnownMediaType, Record<string, unknown>> = {
    movie: { genres: ['drama'], plot: 'a plot', runtimeMs: 5400000, tmdbId: '603' },
    show: { series: 'The Show', season: 2, episode: 5 },
    music: { artist: 'Someone', album: 'An Album', trackNumber: 3 },
    photo: { capturedAt: '2026-07-04T00:00:00.000Z', width: 4000, height: 3000, latitude: 40.7, longitude: -74 },
    book: { authors: ['An Author'], isbn: '9780000000001', series: 'A Series' },
    document: { pages: 12 },
    custom: { anything: true, nested: { count: 3 } },
  };

  it('validates a well-formed payload for every registered media type', () => {
    for (const mediaType of Object.keys(MEDIA_TYPE_REGISTRY) as KnownMediaType[]) {
      expect(validateLibraryItemMetadata(mediaType, JSON.stringify(validByType[mediaType])).status).toBe('ok');
    }
  });

  it('rejects oversized metadata and fails safe on an unknown type', () => {
    const huge = JSON.stringify({ plot: 'x'.repeat(LIBRARY_METADATA_MAX_BYTES + 100) });
    expect(validateLibraryItemMetadata('movie', huge).status).toBe('invalid');
    let parse: ReturnType<typeof validateLibraryItemMetadata> | null = null;
    expect(() => {
      parse = validateLibraryItemMetadata('audiobook', JSON.stringify({ narrator: 'x' }));
    }).not.toThrow();
    expect(parse!.status).toBe('unknown_type');
  });
});

describe('smart-rule + quota seams (web)', () => {
  it('parses known rule types and fails safe (null) on unknown', () => {
    expect(evaluateSmartRuleSafe('unwatched', '{}')).toEqual({ type: 'unwatched' });
    expect(evaluateSmartRuleSafe('genre', JSON.stringify({ genre: 'drama' }))).toEqual({ type: 'genre', genre: 'drama' });
    let result: ReturnType<typeof evaluateSmartRuleSafe> | undefined;
    expect(() => {
      result = evaluateSmartRuleSafe('watched-twice', '{}');
    }).not.toThrow();
    expect(result).toBeNull();
  });

  it('sums sizes and flags over-budget', () => {
    expect(libraryBytesForQuota([{ sizeBytes: 100 }, { sizeBytes: null }, { sizeBytes: 250 }])).toBe(350);
    expect(libraryQuotaStatus(1200, 1000).overBudget).toBe(true);
    expect(libraryQuotaStatus(400, 1000).overBudget).toBe(false);
  });
});
