import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';
import { getDataTransportAvailability } from '../transport-backends';

describe('getDataTransportAvailability function quality gate', () => {
  it('reports no native rungs in the node/Expo Go test build', () => {
    expect(getDataTransportAvailability()).toEqual({ webrtc: false, nearby: false, ble: false });
    expect(getDataTransportAvailability({ externalWebRTCSignaling: true }))
      .toEqual({ webrtc: false, nearby: false, ble: false });
  });

  it('passes deterministic signaling-option invariants', async () => {
    await runDeterministicFuzz({
      label: 'getDataTransportAvailability fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => ({ externalWebRTCSignaling: rng() >= 0.5 }),
      assertCase: (options) => {
        expect(getDataTransportAvailability(options))
          .toEqual({ webrtc: false, nearby: false, ble: false });
      },
    });
  });

  it('stays within constant complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'getDataTransportAvailability',
      sizes: [250, 500, 1000],
      expected: 'constant',
      setup: (size) => ({ externalWebRTCSignaling: size % 2 === 0 }),
      run: (input) => {
        getDataTransportAvailability(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getDataTransportAvailability',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => ({ externalWebRTCSignaling: true }),
      run: (input) => {
        getDataTransportAvailability(input);
      },
    });
  });
});
