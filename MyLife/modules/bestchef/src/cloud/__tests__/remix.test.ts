import { describe, it, expect } from 'vitest';
import { buildLineageTree, getLineageDepth, type LineageNode } from '../remix';
import type { RecipeFork } from '../types';

// ── Test helpers ─────────────────────────────────────────────────────

function makeFork(
  source: string,
  forked: string,
  id?: string,
): RecipeFork {
  return {
    id: id ?? `fork-${source}-${forked}`,
    sourceSnapshotId: source,
    forkedByProfileId: 'chef-1',
    forkedSnapshotId: forked,
    createdAt: new Date('2026-01-01'),
  };
}

function collectIds(node: LineageNode): string[] {
  const result: string[] = [node.snapshotId];
  for (const child of node.children) {
    result.push(...collectIds(child));
  }
  return result;
}

// ── buildLineageTree ─────────────────────────────────────────────────

describe('buildLineageTree', () => {
  it('returns empty array for no forks', () => {
    expect(buildLineageTree([])).toEqual([]);
  });

  it('builds a single-level tree', () => {
    const forks = [
      makeFork('root', 'child-1'),
      makeFork('root', 'child-2'),
    ];
    const tree = buildLineageTree(forks);
    expect(tree).toHaveLength(1);
    expect(tree[0].snapshotId).toBe('root');
    expect(tree[0].children).toHaveLength(2);
    const childIds = tree[0].children.map((c) => c.snapshotId);
    expect(childIds).toContain('child-1');
    expect(childIds).toContain('child-2');
  });

  it('builds a multi-level chain', () => {
    // root -> A -> B -> C
    const forks = [
      makeFork('root', 'A'),
      makeFork('A', 'B'),
      makeFork('B', 'C'),
    ];
    const tree = buildLineageTree(forks);
    expect(tree).toHaveLength(1);
    expect(tree[0].snapshotId).toBe('root');
    expect(tree[0].children[0].snapshotId).toBe('A');
    expect(tree[0].children[0].children[0].snapshotId).toBe('B');
    expect(tree[0].children[0].children[0].children[0].snapshotId).toBe('C');
    expect(tree[0].children[0].children[0].children[0].children).toHaveLength(0);
  });

  it('handles branching (one source, multiple forks)', () => {
    // root -> A, root -> B, A -> C
    const forks = [
      makeFork('root', 'A'),
      makeFork('root', 'B'),
      makeFork('A', 'C'),
    ];
    const tree = buildLineageTree(forks);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    const allIds = collectIds(tree[0]);
    expect(allIds).toContain('root');
    expect(allIds).toContain('A');
    expect(allIds).toContain('B');
    expect(allIds).toContain('C');
  });

  it('handles multiple disconnected roots', () => {
    const forks = [
      makeFork('root-1', 'child-1'),
      makeFork('root-2', 'child-2'),
    ];
    const tree = buildLineageTree(forks);
    expect(tree).toHaveLength(2);
    const rootIds = tree.map((n) => n.snapshotId).sort();
    expect(rootIds).toEqual(['root-1', 'root-2']);
  });

  it('does not infinite loop on circular references', () => {
    // A -> B -> C -> A (cycle)
    const forks = [
      makeFork('A', 'B'),
      makeFork('B', 'C'),
      makeFork('C', 'A'),
    ];
    // Should not throw or hang
    const tree = buildLineageTree(forks);
    // All nodes are both sources and forks, so no "root" in the strict sense.
    // The implementation finds roots as sources not in allForkedIds.
    // Here all sources (A, B, C) are also forked, so no roots. Empty tree.
    expect(tree).toHaveLength(0);
  });
});

// ── getLineageDepth ──────────────────────────────────────────────────

describe('getLineageDepth', () => {
  it('returns 0 for a root node (not a fork)', () => {
    const forks = [makeFork('root', 'child')];
    expect(getLineageDepth(forks, 'root')).toBe(0);
  });

  it('returns 0 for an unknown snapshot', () => {
    expect(getLineageDepth([], 'unknown')).toBe(0);
  });

  it('returns 1 for a direct fork', () => {
    const forks = [makeFork('root', 'child')];
    expect(getLineageDepth(forks, 'child')).toBe(1);
  });

  it('returns correct depth for a chain', () => {
    // root -> A -> B -> C
    const forks = [
      makeFork('root', 'A'),
      makeFork('A', 'B'),
      makeFork('B', 'C'),
    ];
    expect(getLineageDepth(forks, 'A')).toBe(1);
    expect(getLineageDepth(forks, 'B')).toBe(2);
    expect(getLineageDepth(forks, 'C')).toBe(3);
  });

  it('does not infinite loop on circular references', () => {
    // A -> B -> C -> A
    const forks = [
      makeFork('A', 'B'),
      makeFork('B', 'C'),
      makeFork('C', 'A'),
    ];
    // Should terminate. Depth is bounded by cycle guard.
    const depth = getLineageDepth(forks, 'A');
    expect(depth).toBeLessThanOrEqual(3);
  });

  it('handles single node with no forks', () => {
    expect(getLineageDepth([], 'solo')).toBe(0);
  });

  it('handles forked snapshot not in chain', () => {
    const forks = [makeFork('root', 'child')];
    expect(getLineageDepth(forks, 'other')).toBe(0);
  });
});
