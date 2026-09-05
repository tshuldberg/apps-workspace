import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../test/function-quality';
import { applyHttpCors } from '../http-cors';

function harness(origin: string | undefined): {
  request: never;
  response: never;
  headers: Map<string, string>;
} {
  const headers = new Map<string, string>();
  return {
    request: { headers: origin ? { origin } : {} } as never,
    response: { setHeader: (name: string, value: string) => headers.set(name, value) } as never,
    headers,
  };
}

describe('applyHttpCors function quality gate', () => {
  it('reflects only an exact allowed origin', () => {
    const allowed = harness('https://app.example');
    expect(applyHttpCors(allowed.request, allowed.response, {
      allowedOrigins: ['https://app.example'], methods: ['GET'], headers: ['Authorization'],
    })).toBe(true);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');

    const blocked = harness('https://attacker.example');
    expect(applyHttpCors(blocked.request, blocked.response, {
      allowedOrigins: ['https://app.example'], methods: ['GET'], headers: ['Authorization'],
    })).toBe(false);
    expect(blocked.headers.size).toBe(0);
  });

  it('passes deterministic origin fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'applyHttpCors fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => randomInt(rng, 0, 1_000_000),
      assertCase: (suffix) => {
        const origin = `https://site-${suffix}.example`;
        const { request, response, headers } = harness(origin);
        expect(applyHttpCors(request, response, {
          allowedOrigins: [origin], methods: ['GET'], headers: ['Content-Type'],
        })).toBe(true);
        expect(headers.get('Access-Control-Allow-Origin')).toBe(origin);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'applyHttpCors',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => {
        const origin = 'https://match.example';
        const h = harness(origin);
        return { ...h, origins: Array.from({ length: size }, (_, index) => `https://${index}.example`).concat(origin) };
      },
      run: ({ request, response, origins }) => applyHttpCors(request, response, {
        allowedOrigins: origins, methods: ['GET'], headers: ['Content-Type'],
      }),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'applyHttpCors',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => {
        const h = harness('https://match.example');
        return { ...h, origins: ['https://one.example', 'https://match.example'] };
      },
      run: ({ request, response, origins }) => applyHttpCors(request, response, {
        allowedOrigins: origins, methods: ['GET'], headers: ['Content-Type'],
      }),
    });
  });
});
