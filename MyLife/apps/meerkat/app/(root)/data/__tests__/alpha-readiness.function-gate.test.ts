import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';
import {
  buildAlphaDiagnostics,
  buildAlphaReadinessItems,
  type AlphaReadinessInput,
} from '../alpha-readiness';

function readinessCase(size: number): AlphaReadinessInput {
  return {
    relayUrl: size % 2 === 0 ? 'wss://relay.example.test' : null,
    pairedDeviceCount: size % 5,
    verifiedPeerCount: size % 3,
    completedSessionCount: size % 7,
    pendingChanges: size % 11,
    fileSaveDestinationConfigured: size % 13 === 0,
    platformOS: size % 4 === 0 ? 'ios' : 'android',
  };
}

describe('buildAlphaReadinessItems function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const items = buildAlphaReadinessItems({
      relayUrl: 'wss://relay.example.test',
      pairedDeviceCount: 1,
      verifiedPeerCount: 1,
      completedSessionCount: 1,
      pendingChanges: 0,
      fileSaveDestinationConfigured: true,
      platformOS: 'android',
    });

    expect(items).toHaveLength(6);
    expect(items.map((item) => item.state)).toEqual([
      'ready',
      'ready',
      'ready',
      'ready',
      'ready',
      'ready',
    ]);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildAlphaReadinessItems fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        return readinessCase(randomInt(rng, 0, 500));
      },
      assertCase: async (input) => {
        const result = buildAlphaReadinessItems(input);
        expect(result.map((item) => item.id)).toEqual([
          'relay',
          'pairing',
          'sas',
          'session',
          'pending',
          'files',
        ]);
        expect(result.every((item) => item.detail.length > 0)).toBe(true);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildAlphaReadinessItems',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: readinessCase,
      run: async (input) => {
        buildAlphaReadinessItems(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'buildAlphaReadinessItems',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => readinessCase(1000),
      run: async (input) => {
        buildAlphaReadinessItems(input);
      },
    });
  });
});

describe('buildAlphaDiagnostics function quality gate', () => {
  it('redacts relay URL while preserving useful local counts', () => {
    const output = buildAlphaDiagnostics({
      ...readinessCase(12),
      generatedAt: '2026-06-14T12:00:00.000Z',
      deviceName: 'Phone',
      deviceShortId: 'abcd1234',
      engineState: 'idle',
      recentSessionCount: 2,
      rungSummaries: ['relay 1/1'],
      pinnedCount: 4,
      blockCount: 8,
      storedBytes: '16 KB',
    });

    expect(output).toContain('Device: Phone (abcd1234)');
    expect(output).toContain('Pinned content: 4 manifests, 8 blocks, 16 KB');
    expect(output).not.toContain('wss://relay.example.test');
  });
});
