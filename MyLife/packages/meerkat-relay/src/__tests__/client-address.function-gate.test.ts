import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../test/function-quality';
import { deriveClientAddress } from '../client-address';

function request(direct: string, forwarded: string[] = []): IncomingMessage {
  return {
    headers: forwarded.length > 0 ? { 'x-forwarded-for': forwarded.join(', ') } : {},
    socket: { remoteAddress: direct },
  } as unknown as IncomingMessage;
}

describe('deriveClientAddress function quality gate', () => {
  it('ignores forwarding by default and selects only a declared trusted chain', () => {
    const req = request('proxy-2', ['client', 'proxy-1']);
    expect(deriveClientAddress(req)).toBe('proxy-2');
    expect(deriveClientAddress(req, 1)).toBe('proxy-1');
    expect(deriveClientAddress(req, 2)).toBe('client');
    expect(deriveClientAddress(request('direct', ['untrusted']), 2)).toBe('direct');
  });

  it('passes deterministic proxy-chain fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'deriveClientAddress fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        const count = randomInt(rng, 0, 200);
        return {
          forwarded: Array.from({ length: count }, (_, index) => `hop-${index}`),
          hops: randomInt(rng, 0, count + 2),
        };
      },
      assertCase: ({ forwarded, hops }) => {
        const expected = hops === 0 || forwarded.length < hops
          ? 'direct'
          : forwarded[forwarded.length - hops];
        expect(deriveClientAddress(request('direct', forwarded), hops)).toBe(expected);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'deriveClientAddress',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => request('direct', Array.from({ length: size }, (_, index) => `hop-${index}`)),
      run: (input) => {
        deriveClientAddress(input, 1);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'deriveClientAddress',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => request('direct', Array.from({ length: 1000 }, (_, index) => `hop-${index}`)),
      run: (input) => {
        deriveClientAddress(input, 1);
      },
    });
  });
});
