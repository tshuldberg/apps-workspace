import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../test/function-quality';
import {
  assertMultipartPartList,
  OBJECT_STORE_MIN_PART_BYTES,
  type ObjectMultipartPart,
} from '../object-store';
import { InMemoryObjectStore } from '../object-store-memory';

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function fillStore(size: number): Promise<InMemoryObjectStore> {
  const store = new InMemoryObjectStore();
  for (let index = 0; index < size; index += 1) {
    const bytes = new Uint8Array(Buffer.from(`payload-${index}`, 'utf8'));
    await store.put({ key: `quarantine/k-${index}`, checksumSha256: sha256Hex(bytes), bytes });
  }
  return store;
}

async function drainInventory(store: InMemoryObjectStore): Promise<number> {
  let seen = 0;
  let cursor: { key: string } | undefined;
  for (let guard = 0; guard < 100_000; guard += 1) {
    const page = await store.listInventory({ after: cursor, limit: 16 });
    seen += page.entries.length;
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return seen;
}

describe('object store function quality gate', () => {
  it('content-verifies and preserves version monotonicity under deterministic fuzz', async () => {
    await runDeterministicFuzz({
      label: 'object store put/promote fuzz',
      iterations: 120,
      seed: 44,
      makeCase: (rng) => ({
        payload: `payload-${randomInt(rng, 0, 1_000_000)}`,
        corrupt: randomInt(rng, 0, 1) === 1,
      }),
      assertCase: async ({ payload, corrupt }) => {
        const store = new InMemoryObjectStore();
        const bytes = new Uint8Array(Buffer.from(payload, 'utf8'));
        const declared = corrupt ? sha256Hex(new Uint8Array(Buffer.from(`${payload}!`, 'utf8'))) : sha256Hex(bytes);
        const result = await store.put({ key: 'quarantine/fuzz', checksumSha256: declared, bytes });
        if (corrupt) {
          expect(result.status).toBe('checksum_mismatch');
          expect((await store.observe('quarantine/fuzz'))?.state).toBe('rejected');
          return;
        }
        expect(result.status).toBe('stored');
        const promoted = await store.promote({
          quarantineKey: 'quarantine/fuzz',
          durableKey: 'durable/fuzz',
          expectedChecksumSha256: sha256Hex(bytes),
        });
        expect(promoted.status).toBe('promoted');
        expect((await store.observe('durable/fuzz'))?.state).toBe('durable');
      },
    });
  });

  it('validates multipart part lists at the boundary', () => {
    const finalOnly: ObjectMultipartPart[] = [
      { partNumber: 1, checksumSha256: sha256Hex(new Uint8Array([1])), sizeBytes: 1 },
    ];
    expect(assertMultipartPartList(finalOnly)).toBe(1);
    const twoParts: ObjectMultipartPart[] = [
      { partNumber: 1, checksumSha256: sha256Hex(new Uint8Array([2])), sizeBytes: OBJECT_STORE_MIN_PART_BYTES },
      { partNumber: 2, checksumSha256: sha256Hex(new Uint8Array([3])), sizeBytes: 4 },
    ];
    expect(assertMultipartPartList(twoParts)).toBe(OBJECT_STORE_MIN_PART_BYTES + 4);
    expect(() => assertMultipartPartList([
      { partNumber: 2, checksumSha256: sha256Hex(new Uint8Array([4])), sizeBytes: 1 },
    ])).toThrow(/dense and 1-based/);
    expect(() => assertMultipartPartList([
      { partNumber: 1, checksumSha256: sha256Hex(new Uint8Array([5])), sizeBytes: 4 },
      { partNumber: 2, checksumSha256: sha256Hex(new Uint8Array([6])), sizeBytes: 1 },
    ])).toThrow(/minimum part size/);
    expect(() => assertMultipartPartList([])).toThrow(/empty or exceeds/);
  });

  it('keeps cursor-paged inventory linear in the object count', async () => {
    await assertComplexitySlope({
      label: 'object store listInventory',
      sizes: [64, 128, 256],
      expected: 'quadratic',
      setup: (size) => size,
      run: async (size) => {
        const store = await fillStore(size);
        const seen = await drainInventory(store);
        expect(seen).toBe(size);
      },
    });
  });

  it('stays within a memory budget across repeated store lifecycles', async () => {
    await assertMemoryBudget({
      label: 'object store lifecycle',
      repeats: 20,
      maxHeapDeltaBytes: 16 * 1024 * 1024,
      setup: () => 64,
      run: async (size) => {
        const store = await fillStore(size);
        await drainInventory(store);
      },
    });
  });
});
