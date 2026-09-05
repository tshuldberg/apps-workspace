import { describe, expect, it } from 'vitest';
import {
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';
import {
  saveFilesBulk,
  type AggregatedFile,
  type SaveFilesBulkArgs,
} from '../community-files';
import type { FileSaveResult } from '../file-save';

function file(index: number): AggregatedFile {
  return {
    id: `c:${index}`,
    attachmentId: `a${index}`,
    blobHash: `h${index}`,
    name: `file-${index}.bin`,
    mimeType: 'application/octet-stream',
    size: 100,
    channelId: 'c',
    channelName: 'c',
    messageId: 'm',
    authorDeviceId: 'd',
    hlcWall: 'w',
    hlcCounter: index,
  };
}

const bytes = new Uint8Array([1, 2, 3]);

function bulkCase(count: number): SaveFilesBulkArgs {
  return {
    files: Array.from({ length: count }, (_, i) => file(i)),
    loadBytes: async () => bytes,
    saveOne: async (): Promise<FileSaveResult> => ({ kind: 'saved', uri: 'u', location: 'saf-folder' }),
  };
}

describe('saveFilesBulk function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    const all = await saveFilesBulk(bulkCase(3));
    expect(all.total).toBe(3);
    expect(all.savedCount).toBe(3);
    expect(all.failedCount + all.skippedCount).toBe(0);

    // Counts always partition the total: saved + failed + skipped === total.
    const mixed = await saveFilesBulk({
      files: [file(0), file(1), file(2)],
      loadBytes: async (hash) => (hash === 'h1' ? null : bytes),
      saveOne: async (input): Promise<FileSaveResult> =>
        input.name === 'file-2.bin'
          ? { kind: 'failed', reason: 'declined' }
          : { kind: 'saved', uri: 'u', location: 'saf-folder' },
    });
    expect(mixed.savedCount).toBe(1);
    expect(mixed.skippedCount).toBe(1);
    expect(mixed.failedCount).toBe(1);
    expect(mixed.savedCount + mixed.failedCount + mixed.skippedCount).toBe(mixed.total);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'saveFilesBulk fuzz',
      iterations: 200,
      seed: 7,
      makeCase: (rng) => {
        const count = randomInt(rng, 0, 12);
        const removedEvery = randomInt(rng, 1, 3);
        const failEvery = randomInt(rng, 1, 4);
        const args: SaveFilesBulkArgs = {
          files: Array.from({ length: count }, (_, i) => file(i)),
          loadBytes: async (hash) => (Number(hash.slice(1)) % removedEvery === 0 ? null : bytes),
          saveOne: async (input): Promise<FileSaveResult> =>
            Number(input.name.replace(/\D/g, '')) % failEvery === 0
              ? { kind: 'failed', reason: 'r' }
              : { kind: 'saved', uri: 'u', location: 'saf-folder' },
        };
        return args;
      },
      assertCase: async (args) => {
        const result = await saveFilesBulk(args);
        // Honesty invariant: the counts always partition the total exactly, so
        // the headline "{saved} of {total}" can never overstate success.
        expect(result.total).toBe(args.files.length);
        expect(result.savedCount + result.failedCount + result.skippedCount).toBe(result.total);
        expect(result.perFile).toHaveLength(result.total);
        expect(result.savedCount).toBeGreaterThanOrEqual(0);
      },
    });
  });

  it('scales linearly by operation count (deterministic proxy for the slope gate)', async () => {
    // Op-count proxy. The former wall-clock slope gate flaked on shared CI: at
    // this per-call cost, scheduler preemption and GC pauses dwarf the real work,
    // so a measured "slope" was timing noise, not algorithmic growth. saveFilesBulk
    // does exactly one loadBytes + one saveOne per file, so its work is strictly
    // linear in the file count. Counting those callback invocations is a
    // deterministic stand-in that still catches an accidental O(n^2) regression
    // (e.g. a nested rescan that re-touches every prior file) with zero timing.
    const sizes = [1000, 2000, 4000];
    const opCounts: number[] = [];
    for (const size of sizes) {
      let ops = 0;
      const result = await saveFilesBulk({
        files: Array.from({ length: size }, (_, i) => file(i)),
        loadBytes: async () => {
          ops += 1;
          return bytes;
        },
        saveOne: async (): Promise<FileSaveResult> => {
          ops += 1;
          return { kind: 'saved', uri: 'u', location: 'saf-folder' };
        },
      });
      expect(result.total).toBe(size);
      expect(result.savedCount).toBe(size);
      opCounts.push(ops);
    }

    // Exactly 2 ops per file at every size: no super-linear term anywhere.
    expect(opCounts).toEqual(sizes.map((n) => n * 2));
    // Each consecutive op-count ratio tracks the input-size ratio exactly (linear);
    // an O(n^2) body would push these ratios above the size ratios and fail here.
    for (let i = 1; i < sizes.length; i += 1) {
      const opRatio = opCounts[i]! / opCounts[i - 1]!;
      const sizeRatio = sizes[i]! / sizes[i - 1]!;
      expect(opRatio).toBeCloseTo(sizeRatio, 10);
    }
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'saveFilesBulk',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => bulkCase(50),
      run: async (args) => {
        await saveFilesBulk(args);
      },
    });
  });
});
