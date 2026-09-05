import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { credentialBase64ToBytes, credentialBytesToBase64 } from '../blind-credential';

describe('credentialBase64ToBytes function quality gate', () => {
  it('round-trips canonical input and rejects non-canonical padding bits', () => {
    expect(credentialBase64ToBytes('AAECAw==')).toEqual(new Uint8Array([0, 1, 2, 3]));
    expect(credentialBase64ToBytes('/x==')).toBeNull();
    expect(credentialBase64ToBytes('not base64')).toBeNull();
  });

  it('passes deterministic byte round-trip fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'credentialBase64ToBytes fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => new Uint8Array(Array.from(
        { length: randomInt(rng, 1, 500) },
        () => randomInt(rng, 0, 255),
      )),
      assertCase: (input) => {
        expect(credentialBase64ToBytes(credentialBytesToBase64(input))).toEqual(input);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'credentialBase64ToBytes',
      sizes: [300, 600, 1200],
      expected: 'linear',
      setup: (size) => credentialBytesToBase64(new Uint8Array(size)),
      run: (input) => {
        credentialBase64ToBytes(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'credentialBase64ToBytes',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => credentialBytesToBase64(new Uint8Array(1000)),
      run: (input) => {
        credentialBase64ToBytes(input);
      },
    });
  });
});
