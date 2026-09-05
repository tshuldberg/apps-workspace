// Plan 38 Phase 4 (Track B, amendment D.8): pure, BYO-key metadata enrichment on
// the CURATOR device only. This is the MOBILE source of truth; apps/meerkat-web/
// src/lib/library-enrich-core.ts is a byte-identical twin (only this header
// differs), parity-locked by scripts/check-meerkat-parity.mjs.
//
// Design decision 5 (curator-fetch-only): enrichment is the ONLY code path in the
// library layer that may reach a third party, and it does so ONLY through an
// injected fetch function the caller supplies with explicit per-action consent.
// A verified-only READ path and every receive/apply path NEVER call anything
// here -- they never fetch. This module has NO ambient network access: it never
// references global fetch, only the fetchFn argument. Keys are curator-side only
// (device-local mk_settings, read/written by the per-surface store glue); there
// is no founder proxy. enrichMetadata returns EDITABLE candidates and NEVER
// auto-applies; applying (and recording metadata_source 'curator_fetched:<p>') is
// the caller's explicit act.

// ---------------------------------------------------------------------------
// Providers.
// ---------------------------------------------------------------------------

export type EnrichmentProvider = 'tmdb' | 'musicbrainz' | 'openlibrary';

export const ENRICHMENT_PROVIDERS: readonly EnrichmentProvider[] = ['tmdb', 'musicbrainz', 'openlibrary'];

export interface ProviderInfo {
  id: EnrichmentProvider;
  label: string;
  /** Whether the provider requires a curator-supplied API key. */
  requiresKey: boolean;
  /** Where a free key is obtained (shown in the guided setup sheet). */
  keyHelpUrl: string;
  /** Which library media types this provider can enrich. */
  mediaTypes: readonly string[];
}

export const ENRICHMENT_PROVIDER_INFO: Record<EnrichmentProvider, ProviderInfo> = {
  tmdb: {
    id: 'tmdb',
    label: 'TMDB',
    requiresKey: true,
    keyHelpUrl: 'https://www.themoviedb.org/settings/api',
    mediaTypes: ['movie', 'show'],
  },
  musicbrainz: {
    id: 'musicbrainz',
    label: 'MusicBrainz',
    requiresKey: false,
    keyHelpUrl: 'https://musicbrainz.org/doc/MusicBrainz_API',
    mediaTypes: ['music'],
  },
  openlibrary: {
    id: 'openlibrary',
    label: 'Open Library',
    requiresKey: false,
    keyHelpUrl: 'https://openlibrary.org/developers/api',
    mediaTypes: ['book'],
  },
};

export function isEnrichmentProvider(value: string): value is EnrichmentProvider {
  return (ENRICHMENT_PROVIDERS as readonly string[]).includes(value);
}

/** The mk_settings key that stores a provider's curator-side API key (device-local). */
export function enrichmentProviderKeySettingKey(provider: EnrichmentProvider): string {
  return `library_enrichment_key_${provider}`;
}

/** The metadata_source string an APPLIED provider result records. */
export function providerMetadataSource(provider: EnrichmentProvider): string {
  return `curator_fetched:${provider}`;
}

// ---------------------------------------------------------------------------
// The injected fetch seam. We define a minimal shape so this pure module never
// depends on the DOM lib or a native fetch; the caller passes the real one.
// ---------------------------------------------------------------------------

export interface EnrichFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type EnrichFetchFn = (url: string, init?: { headers?: Record<string, string> }) => Promise<EnrichFetchResponse>;

/** An editable enrichment candidate. Applying is always the caller's explicit act. */
export interface EnrichmentCandidate {
  title: string | null;
  year: number | null;
  plot: string | null;
  genres: string[];
  /** Provider-native id, useful for a follow-up poster fetch. */
  providerId: string | null;
  /** A poster/cover URL the caller MAY fetch (still curator-side, still consented). */
  posterUrl: string | null;
  /** Type-specific extras (artist/album, authors, ...). */
  extra: Record<string, unknown>;
}

export interface EnrichmentResult {
  provider: EnrichmentProvider;
  metadataSource: string;
  candidates: EnrichmentCandidate[];
}

function clampStr(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, maxChars) : null;
}

function yearFromDate(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/(\d{4})/);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return Number.isInteger(n) && n >= 1870 && n <= 3000 ? n : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ---------------------------------------------------------------------------
// Request builders (pure; the caller runs fetchFn).
// ---------------------------------------------------------------------------

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

function tmdbUrl(query: string, key: string): string {
  return `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}`;
}

function musicBrainzUrl(query: string): string {
  return `https://musicbrainz.org/ws/2/release/?fmt=json&limit=5&query=${encodeURIComponent(query)}`;
}

function openLibraryUrl(query: string): string {
  return `https://openlibrary.org/search.json?limit=5&q=${encodeURIComponent(query)}`;
}

function parseTmdb(payload: unknown): EnrichmentCandidate[] {
  const results = asArray((payload as { results?: unknown })?.results);
  const out: EnrichmentCandidate[] = [];
  for (const r of results.slice(0, 8)) {
    const row = r as Record<string, unknown>;
    const title = clampStr(row.title, 512) ?? clampStr(row.name, 512);
    if (!title) continue;
    const poster = clampStr(row.poster_path, 256);
    out.push({
      title,
      year: yearFromDate(row.release_date) ?? yearFromDate(row.first_air_date),
      plot: clampStr(row.overview, 4000),
      genres: [],
      providerId: row.id !== undefined && row.id !== null ? String(row.id) : null,
      posterUrl: poster ? `${TMDB_IMAGE_BASE}${poster.startsWith('/') ? '' : '/'}${poster}` : null,
      extra: {},
    });
  }
  return out;
}

function parseMusicBrainz(payload: unknown): EnrichmentCandidate[] {
  const releases = asArray((payload as { releases?: unknown })?.releases);
  const out: EnrichmentCandidate[] = [];
  for (const r of releases.slice(0, 8)) {
    const row = r as Record<string, unknown>;
    const title = clampStr(row.title, 512);
    if (!title) continue;
    const artistCredit = asArray(row['artist-credit']);
    const artist = artistCredit.length > 0 ? clampStr((artistCredit[0] as Record<string, unknown>)?.name, 512) : null;
    out.push({
      title,
      year: yearFromDate(row.date),
      plot: null,
      genres: [],
      providerId: clampStr(row.id, 128),
      posterUrl: null,
      extra: artist ? { artist, album: title } : { album: title },
    });
  }
  return out;
}

function parseOpenLibrary(payload: unknown): EnrichmentCandidate[] {
  const docs = asArray((payload as { docs?: unknown })?.docs);
  const out: EnrichmentCandidate[] = [];
  for (const r of docs.slice(0, 8)) {
    const row = r as Record<string, unknown>;
    const title = clampStr(row.title, 512);
    if (!title) continue;
    const authors = asArray(row.author_name).map((a) => clampStr(a, 256)).filter((a): a is string => a !== null).slice(0, 12);
    const coverId = typeof row.cover_i === 'number' ? row.cover_i : null;
    out.push({
      title,
      year: typeof row.first_publish_year === 'number' && row.first_publish_year >= 1870 && row.first_publish_year <= 3000
        ? row.first_publish_year : null,
      plot: null,
      genres: [],
      providerId: clampStr(row.key, 128),
      posterUrl: coverId !== null ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
      extra: authors.length > 0 ? { authors } : {},
    });
  }
  return out;
}

/**
 * Query one provider through the injected fetch and return EDITABLE candidates.
 * Never auto-applies, never throws (a network / parse failure yields an empty
 * candidate list), and never touches ambient network state -- only fetchFn. The
 * key is passed by the caller (read from curator-side config); a key-requiring
 * provider called with a blank key returns [] rather than an unauthenticated call.
 */
export async function enrichMetadata(
  fetchFn: EnrichFetchFn,
  provider: EnrichmentProvider,
  key: string,
  query: string,
): Promise<EnrichmentResult> {
  const empty: EnrichmentResult = { provider, metadataSource: providerMetadataSource(provider), candidates: [] };
  const info = ENRICHMENT_PROVIDER_INFO[provider];
  const trimmedQuery = (query ?? '').trim();
  if (!info || !trimmedQuery) return empty;
  if (info.requiresKey && !key.trim()) return empty;
  let url: string;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (provider === 'tmdb') url = tmdbUrl(trimmedQuery, key.trim());
  else if (provider === 'musicbrainz') { url = musicBrainzUrl(trimmedQuery); headers['User-Agent'] = 'Meerkat/1.0 (library enrichment)'; }
  else url = openLibraryUrl(trimmedQuery);
  try {
    const res = await fetchFn(url, { headers });
    if (!res.ok) return empty;
    const payload = await res.json();
    const candidates = provider === 'tmdb'
      ? parseTmdb(payload)
      : provider === 'musicbrainz'
        ? parseMusicBrainz(payload)
        : parseOpenLibrary(payload);
    return { ...empty, candidates };
  } catch {
    return empty;
  }
}

/**
 * A live key check for the guided setup sheet: runs a minimal real query through
 * fetchFn and reports whether the key is accepted. For a keyless provider this
 * confirms reachability. Never throws.
 */
export async function testProviderKey(
  fetchFn: EnrichFetchFn,
  provider: EnrichmentProvider,
  key: string,
): Promise<{ ok: boolean; status: number }> {
  const info = ENRICHMENT_PROVIDER_INFO[provider];
  if (!info) return { ok: false, status: 0 };
  if (info.requiresKey && !key.trim()) return { ok: false, status: 0 };
  let url: string;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (provider === 'tmdb') url = tmdbUrl('test', key.trim());
  else if (provider === 'musicbrainz') { url = musicBrainzUrl('test'); headers['User-Agent'] = 'Meerkat/1.0 (library enrichment)'; }
  else url = openLibraryUrl('test');
  try {
    const res = await fetchFn(url, { headers });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
