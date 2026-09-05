import { describe, expect, it } from 'vitest';
import { canonicalize, compareDigests, computeStoreDigest, identityKey } from '../digest';
import type { StateEnumerator, StateRecord, StateStoreId } from '../model';

function enumeratorOf(storeId: StateStoreId, records: StateRecord[]): StateEnumerator {
  return {
    storeId,
    completeness: 'complete',
    guarantee: 'test',
    enumerate: async function* () {
      for (const record of records) yield record;
    },
  };
}

const STORE: StateStoreId = 'community.publications';

describe('canonicalize', () => {
  it('sorts object keys so key order does not change the hash', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it('drops undefined values and normalizes nested structures', () => {
    expect(canonicalize({ a: undefined, b: [{ y: 1, x: 2 }] }))
      .toBe(canonicalize({ b: [{ x: 2, y: 1 }] }));
  });

  it('length-prefixes identity parts so tuples never collide', () => {
    expect(identityKey(['a', 'bc'])).not.toBe(identityKey(['ab', 'c']));
  });
});

describe('compareDigests verdicts', () => {
  const record = (id: string, payload: unknown): StateRecord => ({
    identity: [id],
    digestPayload: payload,
    record: {},
  });

  it('reports identical when both sides match', async () => {
    const source = await computeStoreDigest(enumeratorOf(STORE, [record('p1', { v: 1 })]), 'file');
    const target = await computeStoreDigest(enumeratorOf(STORE, [record('p1', { v: 1 })]), 'postgres');
    const verdict = compareDigests(STORE, source, target);
    expect(verdict.status).toBe('identical');
    expect(verdict.sourceCount).toBe(1);
    expect(verdict.targetCount).toBe(1);
  });

  it('reports missing_in_target when a source record is absent from target', async () => {
    const source = await computeStoreDigest(
      enumeratorOf(STORE, [record('p1', { v: 1 }), record('p2', { v: 1 })]), 'file');
    const target = await computeStoreDigest(enumeratorOf(STORE, [record('p1', { v: 1 })]), 'postgres');
    const verdict = compareDigests(STORE, source, target);
    expect(verdict.status).toBe('missing_in_target');
    expect(verdict.missingInTarget).toEqual([identityKey(['p2'])]);
  });

  it('reports extra_in_target when target has a record the source lacks', async () => {
    const source = await computeStoreDigest(enumeratorOf(STORE, [record('p1', { v: 1 })]), 'file');
    const target = await computeStoreDigest(
      enumeratorOf(STORE, [record('p1', { v: 1 }), record('p2', { v: 1 })]), 'postgres');
    const verdict = compareDigests(STORE, source, target);
    expect(verdict.status).toBe('extra_in_target');
    expect(verdict.extraInTarget).toEqual([identityKey(['p2'])]);
  });

  it('reports mismatched when payloads differ for the same identity', async () => {
    const source = await computeStoreDigest(enumeratorOf(STORE, [record('p1', { v: 1 })]), 'file');
    const target = await computeStoreDigest(enumeratorOf(STORE, [record('p1', { v: 2 })]), 'postgres');
    const verdict = compareDigests(STORE, source, target);
    expect(verdict.status).toBe('mismatched');
    expect(verdict.mismatched).toEqual([identityKey(['p1'])]);
  });

  it('bounds example lists and flags truncation on large drift', async () => {
    const many = Array.from({ length: 50 }, (_, i) => record(`p${i}`, { v: 1 }));
    const source = await computeStoreDigest(enumeratorOf(STORE, many), 'file');
    const target = await computeStoreDigest(enumeratorOf(STORE, []), 'postgres');
    const verdict = compareDigests(STORE, source, target);
    expect(verdict.status).toBe('missing_in_target');
    expect(verdict.missingInTarget.length).toBeLessThanOrEqual(20);
    expect(verdict.truncated).toBe(true);
  });

  it('rejects a duplicate identity from a broken enumerator', async () => {
    await expect(computeStoreDigest(
      enumeratorOf(STORE, [record('p1', { v: 1 }), record('p1', { v: 2 })]), 'file',
    )).rejects.toThrow(/duplicate identity/);
  });
});
