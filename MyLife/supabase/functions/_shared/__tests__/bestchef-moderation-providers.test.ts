import { describe, expect, it } from 'vitest';
import {
  ModerationConfigError,
  createTestStubProviders,
  isNonProductionEnvironment,
  resolveModerationProviders,
  type ProviderEnv,
} from '../bestchef-moderation-providers.ts';

function envOf(map: Record<string, string | undefined>): ProviderEnv {
  return (key) => map[key];
}

describe('bestchef moderation provider seam registry', () => {
  it('resolves to NO provider when nothing is configured (fail closed)', () => {
    const resolved = resolveModerationProviders(envOf({}));
    expect(resolved.nsfw).toBeNull();
    expect(resolved.food).toBeNull();
    expect(resolved.childSafety).toBeNull();
    expect(resolved.usingTestStubs).toBe(false);
  });

  it('treats an unset environment as production (stubs refuse)', () => {
    expect(isNonProductionEnvironment(envOf({}))).toBe(false);
  });

  it('recognizes non-production markers', () => {
    expect(isNonProductionEnvironment(envOf({ NODE_ENV: 'development' }))).toBe(true);
    expect(isNonProductionEnvironment(envOf({ BESTCHEF_ENV: 'staging' }))).toBe(true);
    expect(isNonProductionEnvironment(envOf({ NODE_ENV: 'production' }))).toBe(false);
  });

  it("'noop' provider name resolves to null, not a provider", () => {
    const resolved = resolveModerationProviders(
      envOf({
        BESTCHEF_NSFW_PROVIDER: 'noop',
        BESTCHEF_CHILD_SAFETY_PROVIDER: 'noop',
      }),
    );
    expect(resolved.nsfw).toBeNull();
    expect(resolved.childSafety).toBeNull();
  });

  it('throws a config error for an unknown provider name (fail closed, not silent)', () => {
    expect(() =>
      resolveModerationProviders(envOf({ BESTCHEF_NSFW_PROVIDER: 'totally-made-up' })),
    ).toThrow(ModerationConfigError);
  });

  it('enables test stubs only under the env gate in a non-production environment', () => {
    const resolved = resolveModerationProviders(
      envOf({ BESTCHEF_MODERATION_TEST_STUBS: '1', NODE_ENV: 'test' }),
    );
    expect(resolved.usingTestStubs).toBe(true);
    expect(resolved.nsfw).not.toBeNull();
    expect(resolved.food).not.toBeNull();
    expect(resolved.childSafety).not.toBeNull();
  });

  it('refuses test stubs in production (a config error, never silent auto-approve)', () => {
    expect(() =>
      resolveModerationProviders(
        envOf({ BESTCHEF_MODERATION_TEST_STUBS: '1', NODE_ENV: 'production' }),
      ),
    ).toThrow(/non-production/i);
  });

  it('refuses test stubs when the environment marker is unset (fail closed)', () => {
    expect(() =>
      resolveModerationProviders(envOf({ BESTCHEF_MODERATION_TEST_STUBS: '1' })),
    ).toThrow(ModerationConfigError);
  });

  it('test stubs return clear/food/no_match only (never a real decision surface)', async () => {
    const stubs = createTestStubProviders();
    const asset = { assetId: 'a1', mediaKind: 'image' };
    await expect(stubs.nsfw.screen(asset)).resolves.toMatchObject({ verdict: 'clear' });
    await expect(stubs.food.screen(asset)).resolves.toMatchObject({ verdict: 'clear' });
    await expect(stubs.childSafety.screen(asset)).resolves.toMatchObject({ verdict: 'no_match' });
    expect(stubs.nsfw.capability.productionReady).toBe(false);
  });
});
