import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';
import { BrowserBlobStore } from '../browser-blob-store';

function store(): BrowserBlobStore {
  return new BrowserBlobStore({} as never);
}

describe('BrowserBlobStore.clearAll function quality gate', () => {
  it('clears an empty raw-byte store idempotently', async () => {
    const subject = store();
    await expect(subject.clearAll()).resolves.toBeUndefined();
    await expect(subject.clearAll()).resolves.toBeUndefined();
  });

  it('passes deterministic repeated-clear fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'BrowserBlobStore.clearAll fuzz', iterations: 100, seed: 42,
      makeCase: (rng) => randomInt(rng, 1, 4),
      assertCase: async (repeats) => {
        const subject = store();
        for (let index = 0; index < repeats; index += 1) await subject.clearAll();
      },
    });
  });

  it('stays within constant complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'BrowserBlobStore.clearAll', sizes: [250, 500, 1000], expected: 'constant',
      setup: store, run: (subject) => subject.clearAll(),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'BrowserBlobStore.clearAll', repeats: 40, maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: store, run: (subject) => subject.clearAll(),
    });
  });
});
