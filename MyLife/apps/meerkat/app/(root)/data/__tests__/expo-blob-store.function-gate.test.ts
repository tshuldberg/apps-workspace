import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';

const state = vi.hoisted(() => ({ exists: true }));
const deleteAsync = vi.hoisted(() => vi.fn(async () => { state.exists = false; }));
vi.mock('../private-storage', () => ({ getPrivateStorageRoot: () => 'file:///private/' }));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/', cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8', Base64: 'base64' },
  deleteAsync,
  getInfoAsync: vi.fn(async () => ({ exists: state.exists })),
  makeDirectoryAsync: vi.fn(async () => { state.exists = true; }),
  writeAsStringAsync: vi.fn(), readAsStringAsync: vi.fn(),
}));

import { ExpoBlobStore } from '../expo-blob-store';

function store(): ExpoBlobStore {
  state.exists = true;
  return new ExpoBlobStore({} as never);
}

describe('ExpoBlobStore.clearAll function quality gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes and verifies the entire blob directory', async () => {
    await expect(store().clearAll()).resolves.toBeUndefined();
    expect(state.exists).toBe(false);
  });

  it('passes deterministic repeated-delete fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'ExpoBlobStore.clearAll fuzz', iterations: 100, seed: 42,
      makeCase: (rng) => randomInt(rng, 1, 4),
      assertCase: async (repeats) => {
        const subject = store();
        for (let index = 0; index < repeats; index += 1) await subject.clearAll();
        expect(state.exists).toBe(false);
      },
    });
  });

  it('stays within constant complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'ExpoBlobStore.clearAll', sizes: [250, 500, 1000], expected: 'constant',
      setup: store, run: (subject) => subject.clearAll(),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'ExpoBlobStore.clearAll', repeats: 40, maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: store, run: (subject) => subject.clearAll(),
    });
  });
});
