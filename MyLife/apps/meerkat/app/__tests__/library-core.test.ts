/**
 * Plan 38 Phase 0: the community data-hub (Plex-style libraries) foundation.
 *
 * Asserts:
 *   - every new cm_library_* / cm_community_identity table is created;
 *   - every created cm_ table has an EXPLICIT sync rule (fail-closed guard,
 *     mirroring the web community-sync-policy guard) and the new shared tables
 *     replicate at shared_workspace;
 *   - cm_library_progress is PERSONAL: personal_replica default AND cap, and can
 *     never reach shared_workspace (Codex amendment 5);
 *   - the media-type registry validates each type, rejects oversized metadata,
 *     and fails SAFE (no throw) on an unknown media type;
 *   - the smart-rule seam parses known types and fails SAFE (null) on unknown;
 *   - the quota accounting seam sums sizes and compares against maxStorageBytes.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createInMemorySyncSecretStore,
  configureSyncSecretStore,
} from '@mylife/sync';
import {
  COMMUNITY_DDL,
  COMMUNITY_SYNC_POLICY,
  CM_COMMUNITY_IDENTITY_TABLE,
  CM_LIBRARIES_TABLE,
  CM_LIBRARY_ITEMS_TABLE,
  CM_LIBRARY_COLLECTIONS_TABLE,
  CM_LIBRARY_COLLECTION_ITEMS_TABLE,
  CM_LIBRARY_SMART_RULES_TABLE,
  CM_LIBRARY_TAGS_TABLE,
  CM_LIBRARY_PROGRESS_TABLE,
} from '../(root)/data/community-core';
import { ensureSyncSchema } from '../(root)/data/sync-core';
import { ensureMeerkatTables } from '../(root)/data/db';
import {
  MEDIA_TYPE_REGISTRY,
  LIBRARY_METADATA_MAX_BYTES,
  validateLibraryItemMetadata,
  evaluateSmartRuleSafe,
  libraryBytesForQuota,
  libraryQuotaStatus,
  type KnownMediaType,
} from '../(root)/data/library-metadata-core';

let testDb: InMemoryTestDatabase | null = null;
afterEach(() => {
  testDb?.close();
  testDb = null;
});

function freshDb(): InMemoryTestDatabase['adapter'] {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  testDb = createInMemoryTestDatabase();
  const db = testDb.adapter;
  ensureMeerkatTables(db);
  ensureSyncSchema(db);
  return db;
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

describe('Plan 38 library DDL', () => {
  it('creates every new community data-hub table', () => {
    const db = freshDb();
    const tables = new Set(
      db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name),
    );
    for (const table of NEW_LIBRARY_TABLES) {
      expect(tables.has(table)).toBe(true);
    }
  });

  it('cm_library_items carries the signed enforcement + DEK columns', () => {
    const db = freshDb();
    const columns = new Set(
      db.query<{ name: string }>(`PRAGMA table_info(${CM_LIBRARY_ITEMS_TABLE})`).map((c) => c.name),
    );
    for (const column of ['community_id', 'channel_id', 'content_cid', 'key_epoch', 'wrapped_key', 'manifest_json', 'metadata_json', 'signature']) {
      expect(columns.has(column)).toBe(true);
    }
  });
});

describe('Plan 38 COMMUNITY_SYNC_POLICY rules', () => {
  it('Wave-1 audit guard: every created cm_ table has an explicit rule + fail-closed default', () => {
    const created = COMMUNITY_DDL
      .map((ddl) => ddl.match(/CREATE TABLE IF NOT EXISTS (cm_[a-z_]+)/)?.[1])
      .filter((t): t is string => Boolean(t));
    const ruled = new Set(COMMUNITY_SYNC_POLICY.entityRules.map((r) => r.tableName));
    const omitted = created.filter((t) => !ruled.has(t));
    expect(omitted).toEqual([]);
    expect(COMMUNITY_SYNC_POLICY.defaultScope).toBe('device_local');
  });

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

describe('media-type registry validation', () => {
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
      const parse = validateLibraryItemMetadata(mediaType, JSON.stringify(validByType[mediaType]));
      expect(parse.status).toBe('ok');
    }
  });

  it('rejects a payload missing a required field', () => {
    // show.series and music.artist are required.
    expect(validateLibraryItemMetadata('show', JSON.stringify({ season: 1 })).status).toBe('invalid');
    expect(validateLibraryItemMetadata('music', JSON.stringify({ album: 'x' })).status).toBe('invalid');
  });

  it('rejects metadata over the 16 KB byte cap', () => {
    const huge = JSON.stringify({ plot: 'x'.repeat(LIBRARY_METADATA_MAX_BYTES + 100) });
    expect(validateLibraryItemMetadata('movie', huge).status).toBe('invalid');
  });

  it('rejects unparseable JSON and non-object payloads', () => {
    expect(validateLibraryItemMetadata('movie', 'not json').status).toBe('invalid');
    expect(validateLibraryItemMetadata('movie', '[1,2,3]').status).toBe('invalid');
    expect(validateLibraryItemMetadata('movie', 'null').status).toBe('invalid');
  });

  it('fails SAFE (never throws) on an unknown media type', () => {
    let parse: ReturnType<typeof validateLibraryItemMetadata> | null = null;
    expect(() => {
      parse = validateLibraryItemMetadata('audiobook', JSON.stringify({ narrator: 'x' }));
    }).not.toThrow();
    expect(parse!.status).toBe('unknown_type');
  });
});

describe('smart-rule fail-safe seam', () => {
  it('parses each known rule type', () => {
    expect(evaluateSmartRuleSafe('unwatched', '{}')).toEqual({ type: 'unwatched' });
    expect(evaluateSmartRuleSafe('genre', JSON.stringify({ genre: 'drama' }))).toEqual({ type: 'genre', genre: 'drama' });
    expect(evaluateSmartRuleSafe('year', JSON.stringify({ year: 1999 }))).toEqual({ type: 'year', year: 1999 });
    expect(evaluateSmartRuleSafe('tag', JSON.stringify({ tag: 'fav' }))).toEqual({ type: 'tag', tag: 'fav' });
  });

  it('returns null (never throws) on an unknown rule type', () => {
    let result: ReturnType<typeof evaluateSmartRuleSafe> | undefined;
    expect(() => {
      result = evaluateSmartRuleSafe('watched-twice', '{}');
    }).not.toThrow();
    expect(result).toBeNull();
  });

  it('returns null on a malformed or mismatched rule payload', () => {
    expect(evaluateSmartRuleSafe('genre', 'not json')).toBeNull();
    expect(evaluateSmartRuleSafe('genre', JSON.stringify({ year: 2000 }))).toBeNull();
    expect(evaluateSmartRuleSafe('year', JSON.stringify({ year: 'nope' }))).toBeNull();
  });
});

describe('library quota accounting', () => {
  it('sums item sizes, treating null/invalid sizes as zero', () => {
    expect(libraryBytesForQuota([{ sizeBytes: 100 }, { sizeBytes: null }, { sizeBytes: 250 }])).toBe(350);
    expect(libraryBytesForQuota([])).toBe(0);
  });

  it('flags over-budget against maxStorageBytes', () => {
    const under = libraryQuotaStatus(400, 1000);
    expect(under.overBudget).toBe(false);
    expect(under.remainingBytes).toBe(600);
    const over = libraryQuotaStatus(1200, 1000);
    expect(over.overBudget).toBe(true);
    expect(over.remainingBytes).toBe(-200);
  });
});
