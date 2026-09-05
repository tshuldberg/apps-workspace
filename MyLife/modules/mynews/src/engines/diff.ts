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

export type ApplyResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'base-mismatch' | 'anchor-missing' };

export type RebaseResult =
  | { status: 'clean' }
  | { status: 'rebased'; diff: StructuredDiff }
  | { status: 'stale' };

export type CombineResult =
  | { ok: true; diff: StructuredDiff }
  | { ok: false; conflicts: Array<{ baseIndex: number; diffIndexes: number[] }> };

export function splitBlocks(text: string): string[] {
  return text.split('\n\n');
}

export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function lcsTable(a: string[], b: string[]): number[][] {
  const t: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i]![j] = a[i] === b[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
    }
  }
  return t;
}

export function computeDiff(base: string, proposed: string): StructuredDiff {
  const a = splitBlocks(base);
  const b = splitBlocks(proposed);
  const t = lcsTable(a, b);
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  let pendingBase: string[] = [];
  let pendingNew: string[] = [];

  const flush = (baseEnd: number) => {
    if (pendingBase.length === 0 && pendingNew.length === 0) return;
    const baseIndex = baseEnd - pendingBase.length;
    ops.push({
      kind: pendingBase.length === 0 ? 'insert' : pendingNew.length === 0 ? 'delete' : 'replace',
      baseIndex,
      anchorBefore: baseIndex > 0 ? a[baseIndex - 1]! : null,
      anchorAfter: baseEnd < a.length ? a[baseEnd]! : null,
      baseBlocks: pendingBase,
      newBlocks: pendingNew,
    });
    pendingBase = [];
    pendingNew = [];
  };

  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush(i);
      i++;
      j++;
    } else if (j < b.length && (i === a.length || t[i]![j + 1]! >= t[i + 1]![j]!)) {
      pendingNew.push(b[j]!);
      j++;
    } else {
      pendingBase.push(a[i]!);
      i++;
    }
  }
  flush(a.length);
  return { baseHash: hashText(base), ops };
}

function blocksMatchAt(haystack: string[], run: string[], at: number): boolean {
  if (at < 0 || at + run.length > haystack.length) return false;
  for (let k = 0; k < run.length; k++) {
    if (haystack[at + k] !== run[k]) return false;
  }
  return true;
}

function findRun(haystack: string[], run: string[], from: number): number {
  if (run.length === 0) return -1;
  for (let s = from; s <= haystack.length - run.length; s++) {
    if (blocksMatchAt(haystack, run, s)) return s;
  }
  return -1;
}

/**
 * Apply is positional: the baseHash guarantees the exact base document, so
 * every op lands at its recorded baseIndex. Anchors exist for rebase only.
 * Fails closed if the op's recorded base blocks do not match the document.
 */
export function applyDiff(base: string, diff: StructuredDiff): ApplyResult {
  if (hashText(base) !== diff.baseHash) return { ok: false, reason: 'base-mismatch' };
  const blocks = splitBlocks(base);
  const out: string[] = [];
  let cursor = 0;
  for (const op of diff.ops) {
    if (op.baseIndex < cursor || op.baseIndex > blocks.length) {
      return { ok: false, reason: 'anchor-missing' };
    }
    if (op.baseBlocks.length > 0 && !blocksMatchAt(blocks, op.baseBlocks, op.baseIndex)) {
      return { ok: false, reason: 'anchor-missing' };
    }
    out.push(...blocks.slice(cursor, op.baseIndex), ...op.newBlocks);
    cursor = op.baseIndex + op.baseBlocks.length;
  }
  out.push(...blocks.slice(cursor));
  return { ok: true, text: out.join('\n\n') };
}

/** First colliding base index between two ops, or null when they compose. */
function collisionIndex(a: DiffOp, b: DiffOp): number | null {
  const aLen = a.baseBlocks.length;
  const bLen = b.baseBlocks.length;
  if (aLen > 0 && bLen > 0) {
    const start = Math.max(a.baseIndex, b.baseIndex);
    const end = Math.min(a.baseIndex + aLen, b.baseIndex + bLen);
    return start < end ? start : null;
  }
  if (aLen === 0 && bLen === 0) return a.baseIndex === b.baseIndex ? a.baseIndex : null;
  // An insert strictly inside the consumed range of a replace/delete cannot be
  // ordered positionally; at the range start it composes (insert lands before).
  const ins = aLen === 0 ? a : b;
  const span = aLen === 0 ? b : a;
  return span.baseIndex < ins.baseIndex && ins.baseIndex < span.baseIndex + span.baseBlocks.length
    ? ins.baseIndex
    : null;
}

/**
 * Merge N diffs that share the same baseHash into one diff. Two ops conflict
 * when they touch the same baseIndex (replace/delete) or insert at the same
 * baseIndex. Ops are concatenated sorted by baseIndex; conflict -> ok:false
 * listing every collision so the UI can exclude one side.
 * Inputs are assumed internally consistent: ops within one diff never overlap
 * (real inputs come from computeDiff or validated suggestions).
 */
export function combineDiffs(diffs: StructuredDiff[]): CombineResult {
  if (diffs.length === 0) return { ok: true, diff: { baseHash: '', ops: [] } };
  const baseHash = diffs[0]!.baseHash;
  if (diffs.some((d) => d.baseHash !== baseHash)) {
    throw new Error('combineDiffs: diffs target different baseHash values');
  }
  const conflicts: Array<{ baseIndex: number; diffIndexes: number[] }> = [];
  for (let i = 0; i < diffs.length; i++) {
    for (let j = i + 1; j < diffs.length; j++) {
      for (const opA of diffs[i]!.ops) {
        for (const opB of diffs[j]!.ops) {
          const at = collisionIndex(opA, opB);
          if (at !== null) conflicts.push({ baseIndex: at, diffIndexes: [i, j] });
        }
      }
    }
  }
  if (conflicts.length > 0) {
    conflicts.sort(
      (a, b) =>
        a.baseIndex - b.baseIndex ||
        a.diffIndexes[0]! - b.diffIndexes[0]! ||
        a.diffIndexes[1]! - b.diffIndexes[1]!,
    );
    return { ok: false, conflicts };
  }
  const ops = diffs
    .flatMap((d) => d.ops)
    .sort(
      // Inserts sort before a replace/delete starting at the same index so the
      // combined diff stays appliable (applyDiff's cursor never runs backwards).
      (a, b) =>
        a.baseIndex - b.baseIndex ||
        Number(a.kind !== 'insert') - Number(b.kind !== 'insert'),
    );
  return { ok: true, diff: { baseHash, ops } };
}

/**
 * Rebase relocates each op in a new base revision. Removed/replaced blocks must
 * reappear exactly once; inserts relocate by their anchor block, also required
 * to be unique. Any ambiguity or absence reports stale (the editor refreshes).
 */
export function rebaseDiff(diff: StructuredDiff, _oldBase: string, newBase: string): RebaseResult {
  if (hashText(newBase) === diff.baseHash) return { status: 'clean' };
  const newBlocks = splitBlocks(newBase);
  const rebasedOps: DiffOp[] = [];
  let minIndex = 0;

  for (const op of diff.ops) {
    let at: number;
    if (op.baseBlocks.length > 0) {
      at = findRun(newBlocks, op.baseBlocks, 0);
      if (at < 0 || findRun(newBlocks, op.baseBlocks, at + 1) >= 0) return { status: 'stale' };
    } else if (op.anchorBefore !== null) {
      const anchorAt = findRun(newBlocks, [op.anchorBefore], 0);
      if (anchorAt < 0 || findRun(newBlocks, [op.anchorBefore], anchorAt + 1) >= 0) {
        return { status: 'stale' };
      }
      at = anchorAt + 1;
    } else if (op.anchorAfter !== null) {
      const anchorAt = findRun(newBlocks, [op.anchorAfter], 0);
      if (anchorAt < 0 || findRun(newBlocks, [op.anchorAfter], anchorAt + 1) >= 0) {
        return { status: 'stale' };
      }
      at = anchorAt;
    } else {
      at = 0;
    }
    if (at < minIndex) return { status: 'stale' };
    rebasedOps.push({ ...op, baseIndex: at });
    minIndex = at + op.baseBlocks.length;
  }
  return {
    status: 'rebased',
    diff: { baseHash: hashText(newBase), ops: rebasedOps },
  };
}
