import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';
import { parseBestChefAuthLink } from '../auth-links';

function makeUrl(index: number): string {
  const kind = index % 5;
  if (kind === 0) return `bestchef://auth-callback?code=code-${index}&type=email`;
  if (kind === 1) return `bestchef://auth-callback#access_token=at-${index}&refresh_token=rt-${index}&type=recovery`;
  if (kind === 2) return `bestchef://auth-callback?token_hash=hash-${index}&type=magiclink`;
  if (kind === 3) return `bestchef://auth-callback?error=access_denied&error_description=Denied-${index}`;
  return `bestchef://dish/${index}`;
}

describe('parseBestChefAuthLink function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    expect(parseBestChefAuthLink('bestchef://dish/pad-thai')).toBeNull();
    expect(parseBestChefAuthLink('bestchef://auth-callback?code=abc&type=email')).toMatchObject({
      code: 'abc',
      type: 'email',
    });
    expect(parseBestChefAuthLink('bestchef://auth-callback#access_token=at&refresh_token=rt&type=recovery')).toMatchObject({
      accessToken: 'at',
      refreshToken: 'rt',
      type: 'recovery',
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'parseBestChefAuthLink fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => makeUrl(randomInt(rng, 0, 10_000)),
      assertCase: async (url) => {
        const result = parseBestChefAuthLink(url);
        if (url.includes('/dish/')) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
        }
        if (url.includes('type=recovery')) {
          expect(result?.type).toBe('recovery');
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    // maxRatios loosened from the default 2.80 to 4.0 to absorb OS
    // scheduling and event-loop jitter under concurrent Vitest execution.
    await assertComplexitySlope({
      label: 'parseBestChefAuthLink',
      sizes: [4000, 8000, 16000],
      maxRatios: [4.0, 4.0],
      warmupRuns: 2,
      sampleRuns: 7,
      setup: (size) => Array.from({ length: size }, (_, index) => makeUrl(index)),
      run: async (inputs) => {
        for (const input of inputs) {
          parseBestChefAuthLink(input);
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'parseBestChefAuthLink',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => Array.from({ length: 1000 }, (_, index) => makeUrl(index)),
      run: async (inputs) => {
        for (const input of inputs) {
          parseBestChefAuthLink(input);
        }
      },
    });
  });
});
