// Deno-compatible twin of modules/mynews/src/engines/dupes.ts (plus the
// FNV-1a hash from engines/diff.ts it depends on). Parity-asserted by
// mynews-suggest/__tests__/dupes-parity.test.ts over the shared fixture
// modules/mynews/src/engines/__fixtures__/dupe-vectors.json. Do not import
// from the module at runtime; this is a twin like mynews-signing.

export interface DiffOp {
  kind: 'replace' | 'insert' | 'delete';
  /** Start position of this op in the base block array. Inserts apply before this index. */
  baseIndex: number;
  anchorBefore: string | null;
  anchorAfter: string | null;
  baseBlocks: string[];
  newBlocks: string[];
}

export interface StructuredDiff {
  baseHash: string;
  ops: DiffOp[];
}

/** FNV-1a over UTF-16 code units, twin of engines/diff.ts hashText. */
function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function normalizedAddedText(diff: StructuredDiff): string {
  return diff.ops
    .flatMap((op) => op.newBlocks)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function suggestionContentHash(diff: StructuredDiff): string {
  const footprint = diff.ops.map((op) => `${op.kind}@${op.baseIndex}`).sort();
  return hashText(`${normalizedAddedText(diff)}|${footprint.join(',')}`);
}

function wordTokens(diff: StructuredDiff): Set<string> {
  const text = normalizedAddedText(diff);
  return new Set(text === '' ? [] : text.split(' '));
}

export function suggestionSimilarity(a: StructuredDiff, b: StructuredDiff): number {
  const ta = wordTokens(a);
  const tb = wordTokens(b);
  // Two empty added-text sets (pure deletes) count as identical, not undefined.
  if (ta.size === 0 && tb.size === 0) return 1;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared++;
  return shared / (ta.size + tb.size - shared);
}

export const NEAR_DUPE_THRESHOLD = 0.85;

function touchedIndexes(diff: StructuredDiff): Set<number> {
  const touched = new Set<number>();
  for (const op of diff.ops) {
    if (op.baseBlocks.length === 0) touched.add(op.baseIndex);
    for (let k = 0; k < op.baseBlocks.length; k++) touched.add(op.baseIndex + k);
  }
  return touched;
}

export function isNearDupe(a: StructuredDiff, b: StructuredDiff): boolean {
  const ta = touchedIndexes(a);
  const tb = touchedIndexes(b);
  // Footprint guard: similar wording aimed at different blocks is not a dupe.
  // Two no-op diffs touch nothing yet are trivially identical.
  const overlaps =
    (ta.size === 0 && tb.size === 0) || [...ta].some((index) => tb.has(index));
  if (!overlaps) return false;
  return (
    suggestionContentHash(a) === suggestionContentHash(b) ||
    suggestionSimilarity(a, b) >= NEAR_DUPE_THRESHOLD
  );
}
