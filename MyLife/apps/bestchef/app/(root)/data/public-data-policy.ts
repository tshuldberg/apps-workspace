import {
  hasApprovedBestChefSeedContent,
  type BestChefSeedContentApprovalEnv,
} from '@mylife/bestchef';

export interface BestChefPublicDataPolicyEnv {
  NODE_ENV?: string;
  EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES?: string;
  EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH?: string;
}

export type BestChefPublicDataPolicyInput =
  BestChefPublicDataPolicyEnv & BestChefSeedContentApprovalEnv;

export interface BestChefPublicDataPolicy {
  isPublicLaunch: boolean;
  allowDemoCloudAliases: boolean;
  demoCloudAliasReason:
    | 'explicit_allow'
    | 'explicit_block'
    | 'internal_beta'
    | 'public_launch'
    | 'missing_seed_approval';
}

export function getBestChefPublicDataPolicy(
  env: BestChefPublicDataPolicyInput = process.env,
): BestChefPublicDataPolicy {
  const explicitDemoAliasPolicy = env.EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES;
  const explicitlyAllowed = explicitDemoAliasPolicy === '1';
  const explicitlyBlocked = explicitDemoAliasPolicy === '0';
  const isPublicLaunch =
    env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH === '1' || env.NODE_ENV === 'production';

  if (explicitlyAllowed) {
    if (isPublicLaunch && !hasApprovedBestChefSeedContent(env)) {
      return {
        isPublicLaunch,
        allowDemoCloudAliases: false,
        demoCloudAliasReason: 'missing_seed_approval',
      };
    }

    return {
      isPublicLaunch,
      allowDemoCloudAliases: true,
      demoCloudAliasReason: 'explicit_allow',
    };
  }

  if (explicitlyBlocked) {
    return {
      isPublicLaunch,
      allowDemoCloudAliases: false,
      demoCloudAliasReason: 'explicit_block',
    };
  }

  return {
    isPublicLaunch,
    allowDemoCloudAliases: !isPublicLaunch,
    demoCloudAliasReason: isPublicLaunch ? 'public_launch' : 'internal_beta',
  };
}

export function canCreateDemoCloudAlias(env: BestChefPublicDataPolicyInput = process.env): boolean {
  return getBestChefPublicDataPolicy(env).allowDemoCloudAliases;
}
