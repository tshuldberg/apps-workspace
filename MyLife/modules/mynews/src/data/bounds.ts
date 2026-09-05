// MyNews canonical size bounds (plan 48 WP4, review finding H05).
//
// Before this file, most user-supplied MyNews text crossed the server boundary
// with no maximum at all: a headline, a dek, an article body, a suggestion
// rationale, a citation list, a structured diff, and a suggestion comment could
// each be arbitrarily large. This module is the ONE place a bound is decided.
// Every other layer (Zod models, the edge functions, the SQL CHECK constraints)
// derives from these numbers.
//
// Mirror: supabase/functions/_shared/mynews-bounds.ts duplicates every constant
// verbatim because the edge runtime cannot import this TS package. Both sides
// carry a drift-pin test that parses the OTHER file and compares the parsed
// key/value map, so a change on either side fails a test on both. Same
// mechanism as CURRENT_TERMS_VERSION / EDGE_CURRENT_TERMS_VERSION.
//
// Provenance of each value. "existing" means the number was already the
// effective limit somewhere in the codebase and is reproduced here unchanged;
// canonical values never loosen an existing limit and never tighten below data
// the current rules already accept.
//
//   HANDLE_MIN_CHARS / HANDLE_MAX_CHARS   existing: nw_profiles.handle CHECK
//                                         `handle ~ '^[a-z0-9_]{3,30}$'`
//                                         (20260703000001_mynews_bootstrap.sql).
//   SLUG_MIN_CHARS / SLUG_MAX_CHARS       existing: nw_articles.slug CHECK
//                                         `^[a-z0-9-]{3,120}$` (bootstrap) and
//                                         SLUG_RE in mynews-publish/index.ts.
//   DISPLAY_NAME_MAX_CHARS                new. 80 is the repo's precedent for a
//                                         short display string: nw_newsrooms.name
//                                         CHECK `char_length(name) between 1 and
//                                         80` (20260703000003_mynews_editing_desk).
//   PROFILE_BIO_MAX_CHARS                 new. Matches the 2000-char precedent
//                                         the repo already uses for long free
//                                         text (report detail, review note).
//   HEADLINE_MIN_CHARS                    existing: ArticleRevisionSchema
//                                         `headline: z.string().min(1)` (models.ts)
//                                         and the non-blank headline guard in
//                                         mynews-publish parseBody.
//   HEADLINE_MAX_CHARS                    new.
//   DEK_MAX_CHARS                         new. Two headlines' worth of standfirst.
//   BODY_MIN_BYTES                        existing: the non-blank bodyMd guard in
//                                         mynews-publish parseBody plus
//                                         `body_md text not null` (bootstrap).
//   BODY_MAX_BYTES                        new. Bytes, not characters, so the
//                                         limit is a real storage bound and is
//                                         script-neutral rather than penalising
//                                         non-Latin text with a char count.
//   RATIONALE_MIN_CHARS                   existing: EditSuggestionSchema
//                                         `rationale: z.string().min(1)` and the
//                                         non-blank guard in mynews-suggest.
//   RATIONALE_MAX_CHARS                   new.
//   COMMENT_MIN_CHARS / COMMENT_MAX_CHARS new. Comments had no bound anywhere:
//                                         they were inserted straight into
//                                         nw_suggestion_events.payload under an
//                                         RLS policy. Sized to the rationale,
//                                         the closest existing analogue.
//   CHANGELOG_NOTE_MAX_CHARS              existing: MAX_NOTE_CHARS = 2000 in
//                                         mynews-review/index.ts.
//   CHANGELOG_MAX_ENTRIES                 new. One entry per suggestion credited
//                                         by a revision; a batch accept of 100
//                                         suggestions in one revision is already
//                                         far beyond any real review session.
//   REPORT_DETAIL_MAX_CHARS               existing: ReportSubmissionSchema
//                                         `detail: z.string().max(2000)` and the
//                                         `detail.length > 2000` guard in
//                                         mynews-report parseBody.
//   URL_MAX_CHARS                         existing: DmcaTakedownSchema
//                                         `infringingUrl: HttpsUrlSchema.max(2000)`
//                                         and the SQL `length(v_url) > 2000`
//                                         guard in 20260712000002.
//   CITATIONS_MAX_ITEMS                   new. The https-only scheme and the
//                                         >= 1 floor for correction/context are
//                                         existing (models.ts + the bootstrap
//                                         nw_edit_suggestions_citation_floor
//                                         CHECK); only the ceiling is new.
//   DIFF_*                                new. The structured diff was stored as
//                                         unvalidated jsonb: any JSON parsed.
//                                         Shapes come from engines/diff.ts
//                                         (StructuredDiff / DiffOp) and the
//                                         8-hex-char hashText output.
//   JSON_MAX_DEPTH                        new. Nesting ceiling for any client
//                                         JSON the server stores. A valid
//                                         structured diff nests 4 deep
//                                         (object > ops > op > blocks > string).

/** Every canonical MyNews bound. Frozen: read it, never mutate it. */
export const MYNEWS_BOUNDS = Object.freeze({
  HANDLE_MIN_CHARS: 3,
  HANDLE_MAX_CHARS: 30,
  SLUG_MIN_CHARS: 3,
  SLUG_MAX_CHARS: 120,
  DISPLAY_NAME_MAX_CHARS: 80,
  PROFILE_BIO_MAX_CHARS: 2000,
  HEADLINE_MIN_CHARS: 1,
  HEADLINE_MAX_CHARS: 300,
  DEK_MAX_CHARS: 600,
  BODY_MIN_BYTES: 1,
  BODY_MAX_BYTES: 400000,
  RATIONALE_MIN_CHARS: 1,
  RATIONALE_MAX_CHARS: 4000,
  COMMENT_MIN_CHARS: 1,
  COMMENT_MAX_CHARS: 4000,
  CHANGELOG_NOTE_MAX_CHARS: 2000,
  CHANGELOG_MAX_ENTRIES: 100,
  REPORT_DETAIL_MAX_CHARS: 2000,
  URL_MAX_CHARS: 2000,
  CITATIONS_MAX_ITEMS: 20,
  DIFF_MAX_OPS: 200,
  DIFF_MAX_BLOCKS_PER_OP: 200,
  DIFF_MAX_BLOCK_CHARS: 20000,
  DIFF_BASE_HASH_MAX_CHARS: 64,
  DIFF_MAX_BYTES: 400000,
  JSON_MAX_DEPTH: 8,
});

export type MyNewsBoundKey = keyof typeof MYNEWS_BOUNDS;

/** The diff op kinds engines/diff.ts emits. Anything else is not a diff. */
export const DIFF_OP_KINDS = ['replace', 'insert', 'delete'] as const;
export type DiffOpKind = (typeof DIFF_OP_KINDS)[number];

/** Typed error a bounded write path returns when a field is out of bounds. */
export const BOUNDS_ERROR = 'bounds';

export type BoundsReason =
  | 'not-a-string'
  | 'empty'
  | 'too-long'
  | 'too-many-items'
  | 'not-https'
  | 'too-deep'
  | 'malformed';

export interface BoundsFailure {
  /** Dotted path of the offending field, e.g. 'diff.ops[3].newBlocks[0]'. */
  field: string;
  reason: BoundsReason;
  /** Human-readable detail safe to return in an error envelope. */
  detail: string;
}

export type BoundsResult = { ok: true } | { ok: false; failure: BoundsFailure };

const OK: BoundsResult = { ok: true };

function fail(field: string, reason: BoundsReason, detail: string): BoundsResult {
  return { ok: false, failure: { field, reason, detail } };
}

/**
 * UTF-8 byte length, computed without TextEncoder so the same code runs in
 * Node, Deno, Hermes, and the browser. Surrogate pairs count as one 4-byte
 * code point, matching Postgres octet_length on the stored text.
 */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
        continue;
      }
      bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

export interface TextBounds {
  minChars?: number;
  maxChars?: number;
  minBytes?: number;
  maxBytes?: number;
  /** When true, a value that is only whitespace counts as empty. */
  trimmed?: boolean;
}

/** The one text check every named checker below delegates to. */
export function checkBoundedText(
  value: unknown,
  field: string,
  bounds: TextBounds,
): BoundsResult {
  if (typeof value !== 'string') return fail(field, 'not-a-string', `${field} must be a string`);
  const measured = bounds.trimmed === false ? value : value.trim();
  if (bounds.minChars !== undefined && measured.length < bounds.minChars) {
    return bounds.minChars === 1
      ? fail(field, 'empty', `${field} must not be empty`)
      : fail(field, 'empty', `${field} must be at least ${bounds.minChars} characters`);
  }
  if (bounds.maxChars !== undefined && value.length > bounds.maxChars) {
    return fail(field, 'too-long', `${field} must be at most ${bounds.maxChars} characters`);
  }
  if (bounds.minBytes !== undefined && utf8ByteLength(measured) < bounds.minBytes) {
    return fail(field, 'empty', `${field} must not be empty`);
  }
  if (bounds.maxBytes !== undefined && utf8ByteLength(value) > bounds.maxBytes) {
    return fail(field, 'too-long', `${field} must be at most ${bounds.maxBytes} bytes`);
  }
  return OK;
}

export function checkHeadline(value: unknown): BoundsResult {
  return checkBoundedText(value, 'headline', {
    minChars: MYNEWS_BOUNDS.HEADLINE_MIN_CHARS,
    maxChars: MYNEWS_BOUNDS.HEADLINE_MAX_CHARS,
  });
}

/** A dek is optional: null and undefined pass, a present dek is bounded. */
export function checkDek(value: unknown): BoundsResult {
  if (value === undefined || value === null) return OK;
  return checkBoundedText(value, 'dek', { maxChars: MYNEWS_BOUNDS.DEK_MAX_CHARS });
}

export function checkBody(value: unknown): BoundsResult {
  return checkBoundedText(value, 'bodyMd', {
    minBytes: MYNEWS_BOUNDS.BODY_MIN_BYTES,
    maxBytes: MYNEWS_BOUNDS.BODY_MAX_BYTES,
  });
}

export function checkRationale(value: unknown): BoundsResult {
  return checkBoundedText(value, 'rationale', {
    minChars: MYNEWS_BOUNDS.RATIONALE_MIN_CHARS,
    maxChars: MYNEWS_BOUNDS.RATIONALE_MAX_CHARS,
  });
}

export function checkCommentBody(value: unknown): BoundsResult {
  return checkBoundedText(value, 'body', {
    minChars: MYNEWS_BOUNDS.COMMENT_MIN_CHARS,
    maxChars: MYNEWS_BOUNDS.COMMENT_MAX_CHARS,
  });
}

export function checkChangelogNote(value: unknown): BoundsResult {
  if (value === undefined || value === null) return OK;
  return checkBoundedText(value, 'note', { maxChars: MYNEWS_BOUNDS.CHANGELOG_NOTE_MAX_CHARS });
}

export function checkReportDetail(value: unknown): BoundsResult {
  if (value === undefined || value === null) return OK;
  return checkBoundedText(value, 'detail', { maxChars: MYNEWS_BOUNDS.REPORT_DETAIL_MAX_CHARS });
}

export function checkDisplayName(value: unknown): BoundsResult {
  return checkBoundedText(value, 'displayName', {
    maxChars: MYNEWS_BOUNDS.DISPLAY_NAME_MAX_CHARS,
  });
}

export function checkProfileBio(value: unknown): BoundsResult {
  return checkBoundedText(value, 'bio', { maxChars: MYNEWS_BOUNDS.PROFILE_BIO_MAX_CHARS });
}

/** Changelog credit list: an array bounded by entry count, not by shape. */
export function checkChangelogEntryCount(value: unknown): BoundsResult {
  if (!Array.isArray(value)) return fail('changelog', 'malformed', 'changelog must be an array');
  if (value.length > MYNEWS_BOUNDS.CHANGELOG_MAX_ENTRIES) {
    return fail(
      'changelog',
      'too-many-items',
      `changelog must credit at most ${MYNEWS_BOUNDS.CHANGELOG_MAX_ENTRIES} suggestions`,
    );
  }
  return OK;
}

/** https-only and length-bounded. The scheme rule is the existing contract. */
export function checkHttpsUrl(value: unknown, field = 'url'): BoundsResult {
  const bounded = checkBoundedText(value, field, {
    minChars: 1,
    maxChars: MYNEWS_BOUNDS.URL_MAX_CHARS,
  });
  if (!bounded.ok) return bounded;
  if (!(value as string).startsWith('https://')) {
    return fail(field, 'not-https', `${field} must be an https:// URL`);
  }
  return OK;
}

export function checkCitations(value: unknown): BoundsResult {
  if (!Array.isArray(value)) return fail('citations', 'malformed', 'citations must be an array');
  if (value.length > MYNEWS_BOUNDS.CITATIONS_MAX_ITEMS) {
    return fail(
      'citations',
      'too-many-items',
      `citations must contain at most ${MYNEWS_BOUNDS.CITATIONS_MAX_ITEMS} URLs`,
    );
  }
  for (let i = 0; i < value.length; i++) {
    const result = checkHttpsUrl(value[i], `citations[${i}]`);
    if (!result.ok) return result;
  }
  return OK;
}

/**
 * Nesting depth of a parsed JSON value. A scalar is depth 1; `{a:[1]}` is 3.
 * Iterative with an explicit stack so a hostile payload cannot blow the call
 * stack before the depth bound rejects it.
 */
export function jsonDepth(value: unknown): number {
  let deepest = 0;
  const stack: Array<{ node: unknown; depth: number }> = [{ node: value, depth: 1 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (depth > deepest) deepest = depth;
    // Beyond the ceiling the exact depth stops mattering; stop descending.
    if (depth > MYNEWS_BOUNDS.JSON_MAX_DEPTH) return depth;
    if (Array.isArray(node)) {
      for (const child of node) stack.push({ node: child, depth: depth + 1 });
    } else if (typeof node === 'object' && node !== null) {
      for (const child of Object.values(node)) stack.push({ node: child, depth: depth + 1 });
    }
  }
  return deepest;
}

export function checkJsonDepth(value: unknown, field = 'payload'): BoundsResult {
  if (jsonDepth(value) > MYNEWS_BOUNDS.JSON_MAX_DEPTH) {
    return fail(field, 'too-deep', `${field} nests deeper than ${MYNEWS_BOUNDS.JSON_MAX_DEPTH}`);
  }
  return OK;
}

/**
 * Full structured-diff validation: exact op shape (engines/diff.ts DiffOp),
 * bounded op count, bounded block counts, bounded block strings, bounded
 * baseHash, bounded nesting. Callers that hold the serialized form should use
 * checkStructuredDiffJson so the byte ceiling is checked too.
 */
export function checkStructuredDiff(value: unknown, field = 'diff'): BoundsResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(field, 'malformed', `${field} must be a structured diff object`);
  }
  const diff = value as { baseHash?: unknown; ops?: unknown };
  const hash = checkBoundedText(diff.baseHash, `${field}.baseHash`, {
    minChars: 1,
    maxChars: MYNEWS_BOUNDS.DIFF_BASE_HASH_MAX_CHARS,
  });
  if (!hash.ok) return hash;
  if (!Array.isArray(diff.ops)) {
    return fail(`${field}.ops`, 'malformed', `${field}.ops must be an array`);
  }
  if (diff.ops.length > MYNEWS_BOUNDS.DIFF_MAX_OPS) {
    return fail(
      `${field}.ops`,
      'too-many-items',
      `${field} must contain at most ${MYNEWS_BOUNDS.DIFF_MAX_OPS} ops`,
    );
  }
  for (let i = 0; i < diff.ops.length; i++) {
    const result = checkDiffOp(diff.ops[i], `${field}.ops[${i}]`);
    if (!result.ok) return result;
  }
  return checkJsonDepth(value, field);
}

function checkDiffOp(value: unknown, field: string): BoundsResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(field, 'malformed', `${field} must be a diff op object`);
  }
  const op = value as {
    kind?: unknown;
    baseIndex?: unknown;
    anchorBefore?: unknown;
    anchorAfter?: unknown;
    baseBlocks?: unknown;
    newBlocks?: unknown;
  };
  if (
    typeof op.kind !== 'string' ||
    !(DIFF_OP_KINDS as readonly string[]).includes(op.kind)
  ) {
    return fail(`${field}.kind`, 'malformed', `${field}.kind must be replace, insert, or delete`);
  }
  if (
    typeof op.baseIndex !== 'number' ||
    !Number.isInteger(op.baseIndex) ||
    op.baseIndex < 0
  ) {
    return fail(
      `${field}.baseIndex`,
      'malformed',
      `${field}.baseIndex must be a non-negative integer`,
    );
  }
  for (const anchor of ['anchorBefore', 'anchorAfter'] as const) {
    const raw = op[anchor];
    if (raw === null || raw === undefined) continue;
    const result = checkBoundedText(raw, `${field}.${anchor}`, {
      maxChars: MYNEWS_BOUNDS.DIFF_MAX_BLOCK_CHARS,
      trimmed: false,
    });
    if (!result.ok) return result;
  }
  for (const blocks of ['baseBlocks', 'newBlocks'] as const) {
    const raw = op[blocks];
    if (!Array.isArray(raw)) {
      return fail(`${field}.${blocks}`, 'malformed', `${field}.${blocks} must be an array`);
    }
    if (raw.length > MYNEWS_BOUNDS.DIFF_MAX_BLOCKS_PER_OP) {
      return fail(
        `${field}.${blocks}`,
        'too-many-items',
        `${field}.${blocks} must contain at most ${MYNEWS_BOUNDS.DIFF_MAX_BLOCKS_PER_OP} blocks`,
      );
    }
    for (let i = 0; i < raw.length; i++) {
      const result = checkBoundedText(raw[i], `${field}.${blocks}[${i}]`, {
        maxChars: MYNEWS_BOUNDS.DIFF_MAX_BLOCK_CHARS,
        trimmed: false,
      });
      if (!result.ok) return result;
    }
  }
  return OK;
}

/**
 * Serialized-diff gate for the wire: byte ceiling first (so a hostile payload
 * is rejected before it is parsed into memory), then JSON parse, then the full
 * structured check. Returns the parsed diff so callers do not parse twice.
 */
export function checkStructuredDiffJson(
  raw: unknown,
  field = 'diffJson',
): { ok: true; diff: { baseHash: string; ops: unknown[] } } | { ok: false; failure: BoundsFailure } {
  if (typeof raw !== 'string') {
    return { ok: false, failure: { field, reason: 'not-a-string', detail: `${field} must be a string` } };
  }
  if (utf8ByteLength(raw) > MYNEWS_BOUNDS.DIFF_MAX_BYTES) {
    return {
      ok: false,
      failure: {
        field,
        reason: 'too-long',
        detail: `${field} must be at most ${MYNEWS_BOUNDS.DIFF_MAX_BYTES} bytes`,
      },
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, failure: { field, reason: 'malformed', detail: `${field} is not JSON` } };
  }
  const result = checkStructuredDiff(parsed, field);
  if (!result.ok) return { ok: false, failure: result.failure };
  return { ok: true, diff: parsed as { baseHash: string; ops: unknown[] } };
}
