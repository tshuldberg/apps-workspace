// Edge mirror of modules/mynews/src/data/bounds.ts (plan 48 WP4). The edge
// runtime cannot import the TS package, so every canonical bound and every
// validator is duplicated here verbatim.
//
// Drift protection, same mechanism as mynews-terms.ts: the module test
// (modules/mynews/src/data/bounds.test.ts) and the edge test
// (supabase/functions/_shared/__tests__/mynews-bounds.test.ts) each parse the
// OTHER file's constant block and compare the parsed key/value map against
// their own. Change a number on one side and BOTH tests fail. Keep the key
// order and the numeric literals byte-identical across the two files.
//
// Full provenance for each value (which numbers were already the effective
// limit somewhere and which are new) lives in the module file's header. Do not
// edit a number here without editing it there in the same change.

/** Every canonical MyNews bound. Frozen: read it, never mutate it. */
export const EDGE_MYNEWS_BOUNDS = Object.freeze({
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

/** The diff op kinds engines/diff.ts emits. Anything else is not a diff. */
export const EDGE_DIFF_OP_KINDS = ['replace', 'insert', 'delete'] as const;

/** Typed error every bounded edge write path returns for an out-of-bounds field. */
export const EDGE_BOUNDS_ERROR = 'bounds';

export type BoundsReason =
  | 'not-a-string'
  | 'empty'
  | 'too-long'
  | 'too-many-items'
  | 'not-https'
  | 'too-deep'
  | 'malformed';

export interface BoundsFailure {
  field: string;
  reason: BoundsReason;
  detail: string;
}

export type BoundsResult = { ok: true } | { ok: false; failure: BoundsFailure };

const OK: BoundsResult = { ok: true };

function fail(field: string, reason: BoundsReason, detail: string): BoundsResult {
  return { ok: false, failure: { field, reason, detail } };
}

/** UTF-8 byte length without TextEncoder, matching Postgres octet_length. */
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
  trimmed?: boolean;
}

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
    minChars: EDGE_MYNEWS_BOUNDS.HEADLINE_MIN_CHARS,
    maxChars: EDGE_MYNEWS_BOUNDS.HEADLINE_MAX_CHARS,
  });
}

export function checkDek(value: unknown): BoundsResult {
  if (value === undefined || value === null) return OK;
  return checkBoundedText(value, 'dek', { maxChars: EDGE_MYNEWS_BOUNDS.DEK_MAX_CHARS });
}

export function checkBody(value: unknown): BoundsResult {
  return checkBoundedText(value, 'bodyMd', {
    minBytes: EDGE_MYNEWS_BOUNDS.BODY_MIN_BYTES,
    maxBytes: EDGE_MYNEWS_BOUNDS.BODY_MAX_BYTES,
  });
}

export function checkRationale(value: unknown): BoundsResult {
  return checkBoundedText(value, 'rationale', {
    minChars: EDGE_MYNEWS_BOUNDS.RATIONALE_MIN_CHARS,
    maxChars: EDGE_MYNEWS_BOUNDS.RATIONALE_MAX_CHARS,
  });
}

export function checkCommentBody(value: unknown): BoundsResult {
  return checkBoundedText(value, 'body', {
    minChars: EDGE_MYNEWS_BOUNDS.COMMENT_MIN_CHARS,
    maxChars: EDGE_MYNEWS_BOUNDS.COMMENT_MAX_CHARS,
  });
}

export function checkChangelogNote(value: unknown): BoundsResult {
  if (value === undefined || value === null) return OK;
  return checkBoundedText(value, 'note', {
    maxChars: EDGE_MYNEWS_BOUNDS.CHANGELOG_NOTE_MAX_CHARS,
  });
}

export function checkReportDetail(value: unknown): BoundsResult {
  if (value === undefined || value === null) return OK;
  return checkBoundedText(value, 'detail', {
    maxChars: EDGE_MYNEWS_BOUNDS.REPORT_DETAIL_MAX_CHARS,
  });
}

export function checkDisplayName(value: unknown): BoundsResult {
  return checkBoundedText(value, 'displayName', {
    maxChars: EDGE_MYNEWS_BOUNDS.DISPLAY_NAME_MAX_CHARS,
  });
}

export function checkProfileBio(value: unknown): BoundsResult {
  return checkBoundedText(value, 'bio', { maxChars: EDGE_MYNEWS_BOUNDS.PROFILE_BIO_MAX_CHARS });
}

export function checkChangelogEntryCount(value: unknown): BoundsResult {
  if (!Array.isArray(value)) return fail('changelog', 'malformed', 'changelog must be an array');
  if (value.length > EDGE_MYNEWS_BOUNDS.CHANGELOG_MAX_ENTRIES) {
    return fail(
      'changelog',
      'too-many-items',
      `changelog must credit at most ${EDGE_MYNEWS_BOUNDS.CHANGELOG_MAX_ENTRIES} suggestions`,
    );
  }
  return OK;
}

export function checkHttpsUrl(value: unknown, field = 'url'): BoundsResult {
  const bounded = checkBoundedText(value, field, {
    minChars: 1,
    maxChars: EDGE_MYNEWS_BOUNDS.URL_MAX_CHARS,
  });
  if (!bounded.ok) return bounded;
  if (!(value as string).startsWith('https://')) {
    return fail(field, 'not-https', `${field} must be an https:// URL`);
  }
  return OK;
}

export function checkCitations(value: unknown): BoundsResult {
  if (!Array.isArray(value)) return fail('citations', 'malformed', 'citations must be an array');
  if (value.length > EDGE_MYNEWS_BOUNDS.CITATIONS_MAX_ITEMS) {
    return fail(
      'citations',
      'too-many-items',
      `citations must contain at most ${EDGE_MYNEWS_BOUNDS.CITATIONS_MAX_ITEMS} URLs`,
    );
  }
  for (let i = 0; i < value.length; i++) {
    const result = checkHttpsUrl(value[i], `citations[${i}]`);
    if (!result.ok) return result;
  }
  return OK;
}

/** Iterative depth walk: a hostile payload cannot blow the call stack. */
export function jsonDepth(value: unknown): number {
  let deepest = 0;
  const stack: Array<{ node: unknown; depth: number }> = [{ node: value, depth: 1 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (depth > deepest) deepest = depth;
    if (depth > EDGE_MYNEWS_BOUNDS.JSON_MAX_DEPTH) return depth;
    if (Array.isArray(node)) {
      for (const child of node) stack.push({ node: child, depth: depth + 1 });
    } else if (typeof node === 'object' && node !== null) {
      for (const child of Object.values(node)) stack.push({ node: child, depth: depth + 1 });
    }
  }
  return deepest;
}

export function checkJsonDepth(value: unknown, field = 'payload'): BoundsResult {
  if (jsonDepth(value) > EDGE_MYNEWS_BOUNDS.JSON_MAX_DEPTH) {
    return fail(
      field,
      'too-deep',
      `${field} nests deeper than ${EDGE_MYNEWS_BOUNDS.JSON_MAX_DEPTH}`,
    );
  }
  return OK;
}

export function checkStructuredDiff(value: unknown, field = 'diff'): BoundsResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(field, 'malformed', `${field} must be a structured diff object`);
  }
  const diff = value as { baseHash?: unknown; ops?: unknown };
  const hash = checkBoundedText(diff.baseHash, `${field}.baseHash`, {
    minChars: 1,
    maxChars: EDGE_MYNEWS_BOUNDS.DIFF_BASE_HASH_MAX_CHARS,
  });
  if (!hash.ok) return hash;
  if (!Array.isArray(diff.ops)) {
    return fail(`${field}.ops`, 'malformed', `${field}.ops must be an array`);
  }
  if (diff.ops.length > EDGE_MYNEWS_BOUNDS.DIFF_MAX_OPS) {
    return fail(
      `${field}.ops`,
      'too-many-items',
      `${field} must contain at most ${EDGE_MYNEWS_BOUNDS.DIFF_MAX_OPS} ops`,
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
    !(EDGE_DIFF_OP_KINDS as readonly string[]).includes(op.kind)
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
      maxChars: EDGE_MYNEWS_BOUNDS.DIFF_MAX_BLOCK_CHARS,
      trimmed: false,
    });
    if (!result.ok) return result;
  }
  for (const blocks of ['baseBlocks', 'newBlocks'] as const) {
    const raw = op[blocks];
    if (!Array.isArray(raw)) {
      return fail(`${field}.${blocks}`, 'malformed', `${field}.${blocks} must be an array`);
    }
    if (raw.length > EDGE_MYNEWS_BOUNDS.DIFF_MAX_BLOCKS_PER_OP) {
      return fail(
        `${field}.${blocks}`,
        'too-many-items',
        `${field}.${blocks} must contain at most ${EDGE_MYNEWS_BOUNDS.DIFF_MAX_BLOCKS_PER_OP} blocks`,
      );
    }
    for (let i = 0; i < raw.length; i++) {
      const result = checkBoundedText(raw[i], `${field}.${blocks}[${i}]`, {
        maxChars: EDGE_MYNEWS_BOUNDS.DIFF_MAX_BLOCK_CHARS,
        trimmed: false,
      });
      if (!result.ok) return result;
    }
  }
  return OK;
}

/** Byte ceiling first, then parse, then the full structured check. */
export function checkStructuredDiffJson(
  raw: unknown,
  field = 'diffJson',
): { ok: true; diff: { baseHash: string; ops: unknown[] } } | { ok: false; failure: BoundsFailure } {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      failure: { field, reason: 'not-a-string', detail: `${field} must be a string` },
    };
  }
  if (utf8ByteLength(raw) > EDGE_MYNEWS_BOUNDS.DIFF_MAX_BYTES) {
    return {
      ok: false,
      failure: {
        field,
        reason: 'too-long',
        detail: `${field} must be at most ${EDGE_MYNEWS_BOUNDS.DIFF_MAX_BYTES} bytes`,
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
