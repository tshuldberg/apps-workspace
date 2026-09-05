import { describe, expect, it } from 'vitest';
import { applyDiff, combineDiffs, computeDiff, hashText, rebaseDiff, splitBlocks } from './diff';

const BASE = [
  'The valley faces a hard season.',
  'County filings from March 2025 show a 40% drop in allocations.',
  'Growers south of Big Pine are hit hardest.',
].join('\n\n');

const PROPOSED = [
  'The valley faces a hard season.',
  'County filings from March 2026 show a 34% drop in allocations.',
  'Growers south of Big Pine are hit hardest.',
].join('\n\n');

describe('splitBlocks', () => {
  it('splits on blank lines and rejoins losslessly', () => {
    expect(splitBlocks(BASE)).toHaveLength(3);
    expect(splitBlocks(BASE).join('\n\n')).toBe(BASE);
  });
});

describe('computeDiff + applyDiff round trip', () => {
  it('round-trips a replacement', () => {
    const diff = computeDiff(BASE, PROPOSED);
    expect(diff.ops).toHaveLength(1);
    expect(diff.ops[0]?.kind).toBe('replace');
    const applied = applyDiff(BASE, diff);
    expect(applied).toEqual({ ok: true, text: PROPOSED });
  });

  it('round-trips insert at end and delete at start', () => {
    const insert = `${BASE}\n\nA new closing paragraph.`;
    expect(applyDiff(BASE, computeDiff(BASE, insert))).toEqual({ ok: true, text: insert });
    const blocks = splitBlocks(BASE);
    const del = blocks.slice(1).join('\n\n');
    expect(applyDiff(BASE, computeDiff(BASE, del))).toEqual({ ok: true, text: del });
  });

  it('round-trips inserts next to duplicate blocks', () => {
    const dupBase = ['A', 'X', 'B', 'X', 'C'].join('\n\n');
    const dupProposed = ['A', 'X', 'B', 'X', 'Y', 'C'].join('\n\n');
    expect(applyDiff(dupBase, computeDiff(dupBase, dupProposed))).toEqual({
      ok: true,
      text: dupProposed,
    });
  });

  it('round-trips randomized block edits (seeded)', () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + Math.floor(rnd() * 8);
      const base = Array.from({ length: n }, (_, i) => `block ${i} ${Math.floor(rnd() * 1000)}`);
      const proposed = base
        .filter(() => rnd() > 0.25)
        .flatMap((b) => (rnd() > 0.8 ? [b, `inserted ${Math.floor(rnd() * 1000)}`] : [b]))
        .map((b) => (rnd() > 0.85 ? `${b} edited` : b));
      const baseText = base.join('\n\n');
      const propText = proposed.join('\n\n');
      const applied = applyDiff(baseText, computeDiff(baseText, propText));
      expect(applied).toEqual({ ok: true, text: propText });
    }
  });
});

describe('fail-closed apply', () => {
  it('rejects a hash mismatch', () => {
    const diff = computeDiff(BASE, PROPOSED);
    const other = 'Entirely different document.';
    expect(applyDiff(other, diff)).toEqual({ ok: false, reason: 'base-mismatch' });
  });

  it('rejects tampered ops even when the hash matches', () => {
    const diff = computeDiff(BASE, PROPOSED);
    const tampered = {
      ...diff,
      ops: diff.ops.map((op) => ({ ...op, baseBlocks: ['not the real base block'] })),
    };
    expect(applyDiff(BASE, tampered)).toEqual({ ok: false, reason: 'anchor-missing' });
  });
});

describe('combineDiffs', () => {
  const BLOCKS = [
    'The valley faces a hard season.',
    'County filings from March 2025 show a 40% drop in allocations.',
    'Growers south of Big Pine are hit hardest.',
    'Wells in the north basin are holding steady.',
    'Officials expect a decision on releases by August.',
  ];
  const BASE5 = BLOCKS.join('\n\n');
  const withBlock = (index: number, text: string) =>
    BLOCKS.map((b, i) => (i === index ? text : b)).join('\n\n');
  const withoutBlock = (index: number) => BLOCKS.filter((_, i) => i !== index).join('\n\n');
  const withInsertBefore = (index: number, text: string) =>
    [...BLOCKS.slice(0, index), text, ...BLOCKS.slice(index)].join('\n\n');

  it('returns ok with empty ops for empty input', () => {
    expect(combineDiffs([])).toEqual({ ok: true, diff: { baseHash: '', ops: [] } });
  });

  it('throws on mixed baseHash inputs', () => {
    const a = computeDiff(BASE5, withBlock(1, 'Edited.'));
    const b = computeDiff(BASE, PROPOSED);
    expect(() => combineDiffs([a, b])).toThrow(/baseHash/);
  });

  it('merges disjoint diffs, sorted, and applies as the sequential intent', () => {
    const a = computeDiff(BASE5, withBlock(4, 'Officials expect a decision by July.'));
    const b = computeDiff(BASE5, withBlock(1, 'County filings show a 34% drop.'));
    const combined = combineDiffs([a, b]);
    expect(combined.ok).toBe(true);
    if (!combined.ok) return;
    expect(combined.diff.ops.map((op) => op.baseIndex)).toEqual([1, 4]);
    const expected = BLOCKS.map((block, i) =>
      i === 1 ? 'County filings show a 34% drop.' : i === 4 ? 'Officials expect a decision by July.' : block,
    ).join('\n\n');
    expect(applyDiff(BASE5, combined.diff)).toEqual({ ok: true, text: expected });
  });

  it('is order-independent over its inputs', () => {
    const a = computeDiff(BASE5, withBlock(0, 'The valley faces its hardest season yet.'));
    const b = computeDiff(BASE5, withoutBlock(3));
    expect(combineDiffs([a, b])).toEqual(combineDiffs([b, a]));
  });

  it('merges an insert at the start index of a replace', () => {
    const a = computeDiff(BASE5, withBlock(1, 'County filings show a 34% drop.'));
    const b = computeDiff(BASE5, withInsertBefore(1, 'A new context paragraph.'));
    const combined = combineDiffs([a, b]);
    expect(combined.ok).toBe(true);
    if (!combined.ok) return;
    const applied = applyDiff(BASE5, combined.diff);
    const expected = [
      BLOCKS[0],
      'A new context paragraph.',
      'County filings show a 34% drop.',
      ...BLOCKS.slice(2),
    ].join('\n\n');
    expect(applied).toEqual({ ok: true, text: expected });
  });

  it('detects a replace/replace collision', () => {
    const a = computeDiff(BASE5, withBlock(1, 'County filings show a 34% drop.'));
    const b = computeDiff(BASE5, withBlock(1, 'County filings show a 38% drop.'));
    expect(combineDiffs([a, b])).toEqual({
      ok: false,
      conflicts: [{ baseIndex: 1, diffIndexes: [0, 1] }],
    });
  });

  it('detects a replace/delete collision', () => {
    const a = computeDiff(BASE5, withBlock(2, 'Growers north of Big Pine are hit hardest.'));
    const b = computeDiff(BASE5, withoutBlock(2));
    expect(combineDiffs([a, b])).toEqual({
      ok: false,
      conflicts: [{ baseIndex: 2, diffIndexes: [0, 1] }],
    });
  });

  it('detects an insert strictly inside a consumed range', () => {
    const merged = [BLOCKS[0], `${BLOCKS[1]} ${BLOCKS[2]}`, ...BLOCKS.slice(3)].join('\n\n');
    const a = computeDiff(BASE5, merged);
    expect(a.ops).toEqual([expect.objectContaining({ kind: 'replace', baseIndex: 1 })]);
    expect(a.ops[0]?.baseBlocks).toHaveLength(2);
    const b = computeDiff(BASE5, withInsertBefore(2, 'An interior paragraph.'));
    expect(combineDiffs([a, b])).toEqual({
      ok: false,
      conflicts: [{ baseIndex: 2, diffIndexes: [0, 1] }],
    });
  });

  it('detects overlapping multi-block deletes', () => {
    const withoutBlocks = (...indexes: number[]) =>
      BLOCKS.filter((_, i) => !indexes.includes(i)).join('\n\n');
    const a = computeDiff(BASE5, withoutBlocks(1, 2));
    const b = computeDiff(BASE5, withoutBlocks(2, 3));
    expect(combineDiffs([a, b])).toEqual({
      ok: false,
      conflicts: [{ baseIndex: 2, diffIndexes: [0, 1] }],
    });
  });

  it('detects an insert/insert collision at the same baseIndex', () => {
    const a = computeDiff(BASE5, withInsertBefore(2, 'One added paragraph.'));
    const b = computeDiff(BASE5, withInsertBefore(2, 'Another added paragraph.'));
    expect(combineDiffs([a, b])).toEqual({
      ok: false,
      conflicts: [{ baseIndex: 2, diffIndexes: [0, 1] }],
    });
  });

  it('lists every colliding pair across three diffs', () => {
    const a = computeDiff(BASE5, withBlock(1, 'Version one.'));
    const b = computeDiff(BASE5, withBlock(1, 'Version two.'));
    const c = computeDiff(BASE5, withBlock(1, 'Version three.'));
    expect(combineDiffs([a, b, c])).toEqual({
      ok: false,
      conflicts: [
        { baseIndex: 1, diffIndexes: [0, 1] },
        { baseIndex: 1, diffIndexes: [0, 2] },
        { baseIndex: 1, diffIndexes: [1, 2] },
      ],
    });
  });
});

describe('rebaseDiff', () => {
  it('is clean on identical base', () => {
    const diff = computeDiff(BASE, PROPOSED);
    expect(rebaseDiff(diff, BASE, BASE).status).toBe('clean');
  });

  it('rebases when untouched paragraphs change elsewhere', () => {
    const diff = computeDiff(BASE, PROPOSED);
    const newBase = BASE.replace('hit hardest.', 'hit hardest, officials say.');
    const res = rebaseDiff(diff, BASE, newBase);
    expect(res.status).toBe('rebased');
    if (res.status === 'rebased') {
      const applied = applyDiff(newBase, res.diff);
      expect(applied.ok).toBe(true);
      if (applied.ok) expect(applied.text).toContain('March 2026');
    }
  });

  it('is stale when the edited paragraph itself changed', () => {
    const newBase = BASE.replace('40% drop', '38% drop');
    const diff = computeDiff(BASE, PROPOSED);
    expect(rebaseDiff(diff, BASE, newBase).status).toBe('stale');
  });

  it('hashText is stable', () => {
    expect(hashText(BASE)).toBe(hashText(BASE));
    expect(hashText(BASE)).not.toBe(hashText(PROPOSED));
  });
});
