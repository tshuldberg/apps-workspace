import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';
import {
  saveBytesToDestination,
  type FileSaveAdapter,
  type FileInfo,
  type SaveBytesInput,
} from '../file-save';

function fakeAdapter(): FileSaveAdapter {
  const sizes = new Map<string, number>();
  return {
    platformOS: 'android',
    cacheDirectory: 'file:///cache/',
    documentDirectory: 'file:///docs/',
    getInfoAsync: async (uri: string): Promise<FileInfo> =>
      sizes.has(uri) ? { exists: true, size: sizes.get(uri) } : { exists: false },
    writeAsStringAsync: async (uri, contents) => {
      // Approximate decoded size for verification without a full decode.
      sizes.set(uri, Math.max(1, Math.floor((contents.length * 3) / 4)));
    },
    makeDirectoryAsync: async () => {},
    safRequestDirectory: async () => ({ granted: true, directoryUri: 'content://tree/primary' }),
    safCreateFile: async (parentUri, fileName) => `${parentUri}/${fileName}`,
    share: async () => {},
  };
}

function saveCase(size: number): SaveBytesInput {
  return {
    adapter: fakeAdapter(),
    bytes: new Uint8Array(size).fill(7),
    name: `payload-${size}.bin`,
    mimeType: 'application/octet-stream',
    destination: { androidTreeUri: 'content://tree/primary' },
  };
}

const decoder = new TextDecoder();

describe('saveBytesToDestination function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    // No destination on Android -> no-destination, no write.
    const noDest = await saveBytesToDestination({
      adapter: fakeAdapter(),
      bytes: new Uint8Array([1, 2, 3]),
      name: 'x.bin',
      mimeType: 'application/octet-stream',
      destination: { androidTreeUri: null },
    });
    expect(noDest).toEqual({ kind: 'no-destination' });

    // Verified write -> saved with the produced uri.
    const saved = await saveBytesToDestination(saveCase(8));
    expect(saved.kind).toBe('saved');
    if (saved.kind === 'saved') {
      expect(saved.location).toBe('saf-folder');
      expect(saved.uri).toContain('content://tree/primary');
    }
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'saveBytesToDestination fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        const input = saveCase(randomInt(rng, 0, 64));
        // Half the cases have no destination to exercise both branches.
        if (randomInt(rng, 0, 1) === 0) input.destination = { androidTreeUri: null };
        return input;
      },
      assertCase: async (input) => {
        const result = await saveBytesToDestination(input);
        if (input.destination.androidTreeUri) {
          expect(result.kind).toBe('saved');
        } else {
          expect(result).toEqual({ kind: 'no-destination' });
        }
      },
    });
    // sanity: decoder import stays used so the test file mirrors siblings.
    expect(decoder.decode(new Uint8Array([72, 105]))).toBe('Hi');
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'saveBytesToDestination',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: saveCase,
      run: async (input) => {
        await saveBytesToDestination(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'saveBytesToDestination',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => saveCase(250),
      run: async (input) => {
        await saveBytesToDestination(input);
      },
    });
  });
});
