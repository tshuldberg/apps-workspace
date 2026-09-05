// Plan 38 Phase 4: BYO-key curator enrichment (amendment D.8) and the
// curator-fetch-only invariant (design decision 5). Enrichment reaches a provider
// ONLY through an injected fetch; the verified read path and every ingest/apply
// path NEVER fetch. This is the MOBILE copy; apps/meerkat-web/src/lib/__tests__/
// library-enrich.test.ts is the web twin.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  InMemoryNodeStore,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  ensureShareIntakeTables,
  ensureSyncBootstrap,
  type DeviceIdentity,
} from '@mylife/sync';
import { ensureCommunityTables } from '../(root)/data/community-core';
import { ensureMeerkatTables } from '../(root)/data/db';
import {
  enrichMetadata,
  providerMetadataSource,
  testProviderKey,
  type EnrichFetchFn,
} from '../(root)/data/library-enrich-core';
import {
  createLibrary,
  getEnrichmentProviderConfig,
  getEnrichmentProviderKey,
  ingestFromFilePicker,
  listLibraryItems,
  openLibraryItemContent,
  setEnrichmentProviderKey,
} from '../(root)/data/library-store-core';

function jsonFetch(payload: unknown, ok = true, status = 200): EnrichFetchFn {
  return async () => ({ ok, status, json: async () => payload });
}

describe('enrichment provider config round trip (curator-side, device-local)', () => {
  let db: InMemoryTestDatabase;
  beforeEach(() => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    db = createInMemoryTestDatabase();
    ensureSyncBootstrap(db.adapter);
    ensureMeerkatTables(db.adapter);
  });
  afterEach(() => db.close());

  it('stores and reads a provider key, and reports config', () => {
    expect(getEnrichmentProviderKey(db.adapter, 'tmdb')).toBeNull();
    setEnrichmentProviderKey(db.adapter, 'tmdb', 'my-key');
    expect(getEnrichmentProviderKey(db.adapter, 'tmdb')).toBe('my-key');
    const config = getEnrichmentProviderConfig(db.adapter);
    expect(config.find((c) => c.provider === 'tmdb')!.hasKey).toBe(true);
    expect(config.find((c) => c.provider === 'musicbrainz')!.hasKey).toBe(false);
    setEnrichmentProviderKey(db.adapter, 'tmdb', '');
    expect(getEnrichmentProviderKey(db.adapter, 'tmdb')).toBeNull();
  });
});

describe('enrichMetadata (injected fetch, editable candidates, never auto-applies)', () => {
  it('parses TMDB results into candidates', async () => {
    const res = await enrichMetadata(
      jsonFetch({ results: [{ title: 'Arrival', release_date: '2016-11-11', overview: 'Aliens.', poster_path: '/x.jpg', id: 329865 }] }),
      'tmdb', 'key', 'arrival',
    );
    expect(res.metadataSource).toBe('curator_fetched:tmdb');
    expect(res.candidates[0]!.title).toBe('Arrival');
    expect(res.candidates[0]!.year).toBe(2016);
    expect(res.candidates[0]!.posterUrl).toContain('/x.jpg');
  });
  it('parses MusicBrainz and Open Library results', async () => {
    const mb = await enrichMetadata(
      jsonFetch({ releases: [{ id: 'r1', title: 'OK Computer', date: '1997-05-21', 'artist-credit': [{ name: 'Radiohead' }] }] }),
      'musicbrainz', '', 'ok computer',
    );
    expect(mb.candidates[0]!.extra.artist).toBe('Radiohead');
    const ol = await enrichMetadata(
      jsonFetch({ docs: [{ key: '/works/OL1W', title: 'The Dispossessed', first_publish_year: 1974, author_name: ['Ursula K. Le Guin'], cover_i: 42 }] }),
      'openlibrary', '', 'dispossessed',
    );
    expect(ol.candidates[0]!.year).toBe(1974);
    expect((ol.candidates[0]!.extra.authors as string[])[0]).toContain('Le Guin');
  });
  it('returns [] and never calls fetch for a key-requiring provider with a blank key', async () => {
    const fetchFn = vi.fn(jsonFetch({ results: [] }));
    const res = await enrichMetadata(fetchFn, 'tmdb', '   ', 'arrival');
    expect(res.candidates).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('never throws when the injected fetch throws (returns empty)', async () => {
    const throwing: EnrichFetchFn = async () => { throw new Error('network down'); };
    const res = await enrichMetadata(throwing, 'openlibrary', '', 'anything');
    expect(res.candidates).toEqual([]);
  });
});

describe('testProviderKey', () => {
  it('reports ok on a successful probe and not-ok on failure', async () => {
    expect(await testProviderKey(jsonFetch({}, true, 200), 'tmdb', 'k')).toEqual({ ok: true, status: 200 });
    expect(await testProviderKey(jsonFetch({}, false, 401), 'tmdb', 'k')).toEqual({ ok: false, status: 401 });
    expect(await testProviderKey(jsonFetch({}, true, 200), 'tmdb', '')).toEqual({ ok: false, status: 0 });
  });
  it('records the right metadata_source per provider', () => {
    expect(providerMetadataSource('tmdb')).toBe('curator_fetched:tmdb');
    expect(providerMetadataSource('musicbrainz')).toBe('curator_fetched:musicbrainz');
  });
});

describe('curator-fetch-only: the read + ingest paths NEVER fetch (design decision 5)', () => {
  let db: InMemoryTestDatabase;
  let identity: DeviceIdentity;
  let personalId: string;
  let originalFetch: typeof globalThis.fetch | undefined;

  beforeEach(() => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    db = createInMemoryTestDatabase();
    const boot = ensureSyncBootstrap(db.adapter);
    ensureMeerkatTables(db.adapter);
    ensureCommunityTables(db.adapter);
    ensureShareIntakeTables(db.adapter);
    identity = boot.identity;
    personalId = boot.personalWorkspace.id;
    originalFetch = globalThis.fetch;
    // A land mine: any ambient network call in the read/ingest path detonates.
    (globalThis as { fetch: unknown }).fetch = () => { throw new Error('read/ingest path must never fetch'); };
  });
  afterEach(() => {
    (globalThis as { fetch: unknown }).fetch = originalFetch;
    db.close();
  });

  it('ingests locally and lists/opens verified items with no network access', async () => {
    const store = new InMemoryNodeStore();
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Movies', mediaType: 'movie' });
    const { item } = await ingestFromFilePicker(db.adapter, store, identity, {
      channelId: lib.id, workspaceId: personalId, bytes: new Uint8Array([5, 6, 7, 8]),
      title: '', fileName: 'Blade Runner (1982).mkv',
    });
    expect(item.metadataSource).toBe('local');
    const listed = listLibraryItems(db.adapter, lib.id);
    expect(listed).toHaveLength(1);
    const opened = await openLibraryItemContent(db.adapter, store, identity, item);
    expect(Array.from(opened!)).toEqual([5, 6, 7, 8]);
  });
});
