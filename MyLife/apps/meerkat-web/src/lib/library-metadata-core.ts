// Plan 38 Phase 0 (amendment A.2): the WEB twin of
// apps/meerkat/app/(root)/data/library-metadata-core.ts -- the media-type
// registry + pure library validators. Byte-identical to the mobile source below
// the header (only this comment differs), parity-locked by
// scripts/check-meerkat-parity.mjs.
//
// A media type resolves through an in-code registry map keyed by media_type
// (zod schema + sort fields + card shape per entry). Adding a type is a one-file
// entry -- NOT schema-as-data, NOT a plugin framework, no dynamic code loading.
// An UNKNOWN media_type on an older client fails SAFE: validateLibraryItemMetadata
// returns an unknown-type marker (never throws) so the browse UI can render a
// generic read-only list with a notice. A metadata_json over the byte cap or a
// malformed payload is rejected (invalid), and an unknown smart-rule type
// evaluates to null so its collection renders empty with a notice.

import { z } from 'zod';

/** Hard cap on a single item's metadata_json (raw UTF-8 bytes). */
export const LIBRARY_METADATA_MAX_BYTES = 16 * 1024;

/** The media types the registry knows about. */
export type KnownMediaType = 'movie' | 'show' | 'music' | 'photo' | 'book' | 'document' | 'custom';

/** How a media type's items are laid out in the browse grid (Phase 5). */
export type LibraryCardShape = 'poster' | 'list' | 'album' | 'masonry';

export interface MediaTypeEntry {
  /** Zod schema for this type's metadata_json (non-strict: unknown keys are dropped). */
  readonly schema: z.ZodType<Record<string, unknown>>;
  /** Sort keys this type offers in the browse UI. */
  readonly sortFields: readonly string[];
  /** The default sort key (must be a member of sortFields). */
  readonly defaultSort: string;
  /** The card layout for this type. */
  readonly cardShape: LibraryCardShape;
}

const movieSchema = z.object({
  genres: z.array(z.string()).optional(),
  plot: z.string().optional(),
  runtimeMs: z.number().optional(),
  tmdbId: z.string().optional(),
});

const showSchema = z.object({
  series: z.string(),
  season: z.number().int().optional(),
  episode: z.number().int().optional(),
  genres: z.array(z.string()).optional(),
  plot: z.string().optional(),
});

const musicSchema = z.object({
  artist: z.string(),
  album: z.string().optional(),
  trackNumber: z.number().int().optional(),
  genres: z.array(z.string()).optional(),
});

const photoSchema = z.object({
  capturedAt: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const bookSchema = z.object({
  authors: z.array(z.string()).optional(),
  isbn: z.string().optional(),
  series: z.string().optional(),
  plot: z.string().optional(),
});

const documentSchema = z.object({
  pages: z.number().int().optional(),
});

const customSchema = z.record(z.unknown());

/**
 * The media-type registry. Keyed by media_type; each entry is a one-line contract
 * (schema + sort fields + card shape). An entry NOT present here is unknown and
 * fails safe at validate time.
 */
export const MEDIA_TYPE_REGISTRY: Record<KnownMediaType, MediaTypeEntry> = {
  movie: { schema: movieSchema, sortFields: ['title', 'year', 'added', 'duration'], defaultSort: 'title', cardShape: 'poster' },
  show: { schema: showSchema, sortFields: ['title', 'year', 'added'], defaultSort: 'title', cardShape: 'poster' },
  music: { schema: musicSchema, sortFields: ['title', 'artist', 'album', 'added'], defaultSort: 'artist', cardShape: 'album' },
  photo: { schema: photoSchema, sortFields: ['capturedAt', 'added', 'title'], defaultSort: 'capturedAt', cardShape: 'masonry' },
  book: { schema: bookSchema, sortFields: ['title', 'author', 'year', 'added'], defaultSort: 'title', cardShape: 'poster' },
  document: { schema: documentSchema, sortFields: ['title', 'added'], defaultSort: 'added', cardShape: 'list' },
  custom: { schema: customSchema, sortFields: ['title', 'added'], defaultSort: 'added', cardShape: 'list' },
};

export function isKnownMediaType(mediaType: string): mediaType is KnownMediaType {
  return Object.prototype.hasOwnProperty.call(MEDIA_TYPE_REGISTRY, mediaType);
}

export type LibraryMetadataParse =
  | { status: 'ok'; mediaType: KnownMediaType; value: Record<string, unknown> }
  | { status: 'unknown_type' }
  | { status: 'invalid' };

/** UTF-8 byte length of a string (the on-wire size the cap governs). */
function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Validate an item's metadata_json against its media type. Never throws:
 *   - over the byte cap or unparseable JSON  -> { status: 'invalid' }
 *   - media_type not in the registry         -> { status: 'unknown_type' } (fail-safe)
 *   - schema mismatch                         -> { status: 'invalid' }
 *   - valid                                   -> { status: 'ok', mediaType, value }
 * An unknown type is a MARKER, not an error, so an older client renders a generic
 * read-only list instead of crashing.
 */
export function validateLibraryItemMetadata(mediaType: string, json: string): LibraryMetadataParse {
  if (utf8ByteLength(json) > LIBRARY_METADATA_MAX_BYTES) return { status: 'invalid' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { status: 'invalid' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { status: 'invalid' };
  }
  if (!isKnownMediaType(mediaType)) return { status: 'unknown_type' };
  const result = MEDIA_TYPE_REGISTRY[mediaType].schema.safeParse(parsed);
  if (!result.success) return { status: 'invalid' };
  return { status: 'ok', mediaType, value: result.data };
}

/** The smart-rule types the engine can evaluate locally (Phase 5). */
export type SmartRuleType = 'unwatched' | 'genre' | 'year' | 'tag';

export type SmartRule =
  | { type: 'unwatched' }
  | { type: 'genre'; genre: string }
  | { type: 'year'; year: number }
  | { type: 'tag'; tag: string };

const smartRuleSchemas = {
  unwatched: z.object({}),
  genre: z.object({ genre: z.string() }),
  year: z.object({ year: z.number().int() }),
  tag: z.object({ tag: z.string() }),
} as const;

export function isKnownSmartRuleType(ruleType: string): ruleType is SmartRuleType {
  return Object.prototype.hasOwnProperty.call(smartRuleSchemas, ruleType);
}

/**
 * Parse a smart-collection rule fail-safe. Returns null for an unknown rule_type
 * (its collection renders empty with a notice, never throws) and for a malformed
 * rule_json. The evaluation SQL itself lands in Phase 5; this is only the parse +
 * fail-safe seam.
 */
export function evaluateSmartRuleSafe(ruleType: string, ruleJson: string): SmartRule | null {
  if (!isKnownSmartRuleType(ruleType)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(ruleJson);
  } catch {
    return null;
  }
  if (ruleType === 'unwatched') {
    if (!smartRuleSchemas.unwatched.safeParse(parsed).success) return null;
    return { type: 'unwatched' };
  }
  if (ruleType === 'genre') {
    const r = smartRuleSchemas.genre.safeParse(parsed);
    return r.success ? { type: 'genre', genre: r.data.genre } : null;
  }
  if (ruleType === 'year') {
    const r = smartRuleSchemas.year.safeParse(parsed);
    return r.success ? { type: 'year', year: r.data.year } : null;
  }
  const r = smartRuleSchemas.tag.safeParse(parsed);
  return r.success ? { type: 'tag', tag: r.data.tag } : null;
}

/** An item's size contribution to a library's quota (null size counts as 0). */
export interface LibraryQuotaItem {
  sizeBytes: number | null;
}

/** Sum the on-disk logical bytes of a set of library items for quota accounting. */
export function libraryBytesForQuota(items: readonly LibraryQuotaItem[]): number {
  let total = 0;
  for (const item of items) {
    if (typeof item.sizeBytes === 'number' && Number.isFinite(item.sizeBytes) && item.sizeBytes > 0) {
      total += item.sizeBytes;
    }
  }
  return total;
}

export interface LibraryQuotaStatus {
  usedBytes: number;
  maxStorageBytes: number;
  remainingBytes: number;
  overBudget: boolean;
}

/**
 * Compare used library bytes against a community descriptor's maxStorageBytes
 * (descriptor.quotas.maxStorageBytes). Pure; the UI decides how to surface it.
 */
export function libraryQuotaStatus(usedBytes: number, maxStorageBytes: number): LibraryQuotaStatus {
  const remainingBytes = maxStorageBytes - usedBytes;
  return {
    usedBytes,
    maxStorageBytes,
    remainingBytes,
    overBudget: usedBytes > maxStorageBytes,
  };
}
