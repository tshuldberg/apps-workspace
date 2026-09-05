import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../test/vitest/function-quality';
import { handleReviewRequest } from '../index';
import type { MyNewsStore } from '../../_shared/mynews-store';

const deps = { store: {} as MyNewsStore };

function nonPostRequest(method: string): Request {
  return new Request('http://local/mynews-review', { method });
}

describe('handleReviewRequest function quality gate', () => {
  it('rejects a non-POST request before touching the store', async () => {
    const response = await handleReviewRequest(nonPostRequest('GET'), deps);
    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({ ok: false, error: 'bad-payload' });
  });

  it('passes deterministic fuzz invariants', async () => {
    const methods = ['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
    await runDeterministicFuzz({
      label: 'handleReviewRequest fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => methods[randomInt(rng, 0, methods.length - 1)],
      assertCase: async (method) => {
        const response = await handleReviewRequest(nonPostRequest(method), deps);
        expect(response.status).toBe(405);
      },
    });
  });

  it('keeps the method guard constant-time as unrelated header size grows', async () => {
    await assertComplexitySlope({
      label: 'handleReviewRequest',
      sizes: [250, 500, 1000],
      expected: 'constant',
      setup: (size) =>
        new Request('http://local/mynews-review', {
          method: 'GET',
          headers: { 'x-unrelated-padding': 'x'.repeat(size) },
        }),
      run: async (request) => {
        await handleReviewRequest(request, deps);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'handleReviewRequest',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => nonPostRequest('GET'),
      run: async (request) => {
        await handleReviewRequest(request, deps);
      },
    });
  });
});
