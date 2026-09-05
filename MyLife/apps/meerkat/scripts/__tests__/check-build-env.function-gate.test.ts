import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../test/vitest/function-quality';
import { checkBuildEnv } from '../check-build-env.mjs';

function validEnv(topicCount = 1): Record<string, string> {
  return {
    EAS_BUILD_PROFILE: 'production', EAS_BUILD_PLATFORM: 'ios',
    EXPO_PUBLIC_MEERKAT_RC_KEY_IOS: 'appl_public',
    MEERKAT_HOSTED_API_URL: 'https://api.example',
    MEERKAT_HUMANITY_SERVICE_URL: 'https://humanity.example',
    MEERKAT_HUMANITY_SERVICE_PUBLIC_KEY: 'ab'.repeat(32),
    MEERKAT_PERSONA_SERVICE_URL: 'https://persona.example',
    MEERKAT_COMMONS_NODE_URL: 'https://commons.example',
    MEERKAT_COMMONS_TOPICS: JSON.stringify(Array.from({ length: topicCount }, (_, index) => ({
      channelId: `channel-${index}`, publicationId: `publication-${index}`, nodeKeyHex: 'cd'.repeat(32),
    }))),
    MEERKAT_DEFAULT_RELAY_URL: 'wss://relay.example',
    MEERKAT_TURN_URL: 'turns://turn.example', MEERKAT_TURN_USERNAME: 'user', MEERKAT_TURN_CREDENTIAL: 'secret',
    MEERKAT_PRIVACY_POLICY_URL: 'https://meerkat.example/privacy',
    MEERKAT_TERMS_URL: 'https://meerkat.example/terms',
    MEERKAT_COMMUNITY_STANDARDS_URL: 'https://meerkat.example/standards',
    MEERKAT_SUPPORT_URL: 'https://meerkat.example/support',
  };
}

describe('checkBuildEnv function quality gate', () => {
  it('accepts complete production values and rejects an empty production build', () => {
    expect(checkBuildEnv(validEnv())).toMatchObject({ ok: true, skipped: false });
    expect(checkBuildEnv({ EAS_BUILD_PROFILE: 'production' }).ok).toBe(false);
  });

  it('passes deterministic platform fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'checkBuildEnv fuzz', iterations: 200, seed: 42,
      makeCase: (rng) => randomInt(rng, 0, 1) === 0 ? 'ios' : 'android',
      assertCase: (platform) => {
        const env = validEnv();
        env.EAS_BUILD_PLATFORM = platform;
        if (platform === 'android') env.EXPO_PUBLIC_MEERKAT_RC_KEY_ANDROID = 'goog_public';
        expect(checkBuildEnv(env).ok).toBe(true);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'checkBuildEnv', sizes: [25, 50, 100], expected: 'linear',
      setup: validEnv, run: checkBuildEnv,
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'checkBuildEnv', repeats: 40, maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => validEnv(25), run: checkBuildEnv,
    });
  });
});
