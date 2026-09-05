import { describe, expect, it } from 'vitest';
import {
  canCreateDemoCloudAlias,
  getBestChefPublicDataPolicy,
  type BestChefPublicDataPolicyInput,
} from '../public-data-policy';

function env(overrides: BestChefPublicDataPolicyInput): BestChefPublicDataPolicyInput {
  return overrides;
}

describe('BestChef public data policy', () => {
  it('allows demo cloud aliases for internal beta builds by default', () => {
    expect(canCreateDemoCloudAlias(env({ NODE_ENV: 'development' }))).toBe(true);
    expect(getBestChefPublicDataPolicy(env({ NODE_ENV: 'test' }))).toMatchObject({
      isPublicLaunch: false,
      allowDemoCloudAliases: true,
      demoCloudAliasReason: 'internal_beta',
    });
  });

  it('blocks demo cloud aliases for public launch builds by default', () => {
    expect(canCreateDemoCloudAlias(env({ NODE_ENV: 'production' }))).toBe(false);
    expect(
      getBestChefPublicDataPolicy(
        env({ EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1', NODE_ENV: 'development' }),
      ),
    ).toMatchObject({
      isPublicLaunch: true,
      allowDemoCloudAliases: false,
      demoCloudAliasReason: 'public_launch',
    });
  });

  it('requires an explicit allow flag for approved editorial demo cloud aliases', () => {
    expect(
      getBestChefPublicDataPolicy(
        env({
          NODE_ENV: 'production',
          EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES: '1',
          EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_APPROVAL_STATUS: 'approved',
          EXPO_PUBLIC_BESTCHEF_APPROVED_SEED_CONTENT_REVISION: 'seed-r1',
        }),
      ),
    ).toMatchObject({
      isPublicLaunch: true,
      allowDemoCloudAliases: true,
      demoCloudAliasReason: 'explicit_allow',
    });
  });

  it('honors an explicit block flag in non-production builds', () => {
    expect(
      getBestChefPublicDataPolicy(
        env({
          NODE_ENV: 'development',
          EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES: '0',
        }),
      ),
    ).toMatchObject({
      isPublicLaunch: false,
      allowDemoCloudAliases: false,
      demoCloudAliasReason: 'explicit_block',
    });
  });

  it('blocks explicit demo alias writes in public launch without seed approval', () => {
    expect(
      getBestChefPublicDataPolicy(
        env({
          NODE_ENV: 'production',
          EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES: '1',
        }),
      ),
    ).toMatchObject({
      isPublicLaunch: true,
      allowDemoCloudAliases: false,
      demoCloudAliasReason: 'missing_seed_approval',
    });
  });
});
