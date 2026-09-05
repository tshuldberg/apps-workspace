import { expect } from 'vitest';
import type { StoreConformanceScenario } from '../postgres/conformance/store-conformance';
import type { ObjectReferenceLedger } from '../object-reference-ledger';

const KEY_A = 'objects/aaaa';
const KEY_B = 'objects/bbbb';
const REF_1 = 'hosted:subject-1 content-1 0';
const REF_2 = 'archive:jobid-1 0';

/**
 * Behavioral contract every ObjectReferenceLedger adapter must satisfy. Run against a
 * fresh store per scenario so idempotency, refcount, and unreferenced-ordering defects
 * cannot hide behind scenario ordering.
 */
export const objectReferenceLedgerScenarios:
  readonly StoreConformanceScenario<ObjectReferenceLedger>[] = [
  {
    name: 'adds a first reference and reports the key referenced',
    async run(store) {
      await expect(store.addReference({ objectKey: KEY_A, referrer: REF_1 }))
        .resolves.toEqual({ status: 'added', referenceCount: 1 });
      await expect(store.isReferenced(KEY_A)).resolves.toBe(true);
      await expect(store.referenceCount(KEY_A)).resolves.toBe(1);
      await expect(store.listReferrers(KEY_A)).resolves.toEqual([REF_1]);
    },
  },
  {
    name: 'adding the same edge twice is idempotent (one reference)',
    async run(store) {
      await store.addReference({ objectKey: KEY_A, referrer: REF_1 });
      await expect(store.addReference({ objectKey: KEY_A, referrer: REF_1 }))
        .resolves.toEqual({ status: 'already_referenced', referenceCount: 1 });
      await expect(store.referenceCount(KEY_A)).resolves.toBe(1);
    },
  },
  {
    name: 'two distinct referrers make a key removable only at zero (N-referrer rule)',
    async run(store) {
      await store.addReference({ objectKey: KEY_A, referrer: REF_1 });
      await store.addReference({ objectKey: KEY_A, referrer: REF_2 });
      await expect(store.referenceCount(KEY_A)).resolves.toBe(2);
      await expect(store.removeReference({ objectKey: KEY_A, referrer: REF_1 }))
        .resolves.toEqual({ status: 'removed', referenceCount: 1 });
      await expect(store.isReferenced(KEY_A)).resolves.toBe(true);
      await expect(store.removeReference({ objectKey: KEY_A, referrer: REF_2 }))
        .resolves.toEqual({ status: 'removed', referenceCount: 0 });
      await expect(store.isReferenced(KEY_A)).resolves.toBe(false);
    },
  },
  {
    name: 'removing an absent edge is an idempotent no-op success',
    async run(store) {
      await expect(store.removeReference({ objectKey: KEY_A, referrer: REF_1 }))
        .resolves.toEqual({ status: 'not_referenced', referenceCount: 0 });
      await store.addReference({ objectKey: KEY_A, referrer: REF_1 });
      await store.removeReference({ objectKey: KEY_A, referrer: REF_1 });
      await expect(store.removeReference({ objectKey: KEY_A, referrer: REF_1 }))
        .resolves.toEqual({ status: 'not_referenced', referenceCount: 0 });
    },
  },
  {
    name: 'a key that dropped to zero appears in listUnreferenced; a returning reference clears it',
    async run(store) {
      await store.addReference({ objectKey: KEY_A, referrer: REF_1 });
      await store.removeReference({ objectKey: KEY_A, referrer: REF_1 });
      const page = await store.listUnreferenced({ limit: 10 });
      expect(page.entries.map((entry) => entry.objectKey)).toEqual([KEY_A]);
      expect(page.nextCursor).toBeNull();
      // A returning reference removes the key from the unreferenced set.
      await store.addReference({ objectKey: KEY_A, referrer: REF_2 });
      const after = await store.listUnreferenced({ limit: 10 });
      expect(after.entries).toEqual([]);
    },
  },
  {
    name: 'a never-zeroed key is not listed as unreferenced',
    async run(store) {
      await store.addReference({ objectKey: KEY_A, referrer: REF_1 });
      const page = await store.listUnreferenced({ limit: 10 });
      expect(page.entries).toEqual([]);
    },
  },
  {
    name: 'listUnreferenced pages by (unreferencedAt, key) without gaps or repeats',
    async run(store) {
      const keys = Array.from({ length: 5 }, (_, index) => `objects/z${index}`);
      for (const key of keys) {
        await store.addReference({ objectKey: key, referrer: REF_1 });
        await store.removeReference({ objectKey: key, referrer: REF_1 });
      }
      const seen: string[] = [];
      let cursor = (await store.listUnreferenced({ limit: 2 }));
      seen.push(...cursor.entries.map((entry) => entry.objectKey));
      while (cursor.nextCursor) {
        cursor = await store.listUnreferenced({ after: cursor.nextCursor, limit: 2 });
        seen.push(...cursor.entries.map((entry) => entry.objectKey));
      }
      expect(new Set(seen).size).toBe(keys.length);
      for (const key of keys) expect(seen).toContain(key);
    },
  },
  {
    name: 'validates object keys and referrers at the boundary',
    async run(store) {
      await expect(store.addReference({ objectKey: 'bad key with spaces', referrer: REF_1 }))
        .rejects.toThrow(/valid object key/);
      await expect(store.addReference({ objectKey: KEY_A, referrer: '' }))
        .rejects.toThrow(/referrer/);
      await expect(store.listUnreferenced({ limit: 0 })).rejects.toThrow(/limit/);
    },
  },
  {
    name: 'separate keys carry independent reference counts',
    async run(store) {
      await store.addReference({ objectKey: KEY_A, referrer: REF_1 });
      await store.addReference({ objectKey: KEY_B, referrer: REF_1 });
      await store.addReference({ objectKey: KEY_B, referrer: REF_2 });
      await expect(store.referenceCount(KEY_A)).resolves.toBe(1);
      await expect(store.referenceCount(KEY_B)).resolves.toBe(2);
    },
  },
];
