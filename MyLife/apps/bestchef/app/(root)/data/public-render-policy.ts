import {
  hasApprovedBestChefSeedContent,
  type BestChefSeedContentApprovalEnv,
} from '@mylife/bestchef';

export interface BestChefPublicRenderPolicyEnv {
  NODE_ENV?: string;
  EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH?: string;
  EXPO_PUBLIC_BESTCHEF_SHOW_DEMO_CONTENT?: string;
  /**
   * Dev-only escape hatch. Only honored when __DEV__ is true. Lets a
   * developer turn DEMO_* fixture rendering back on for local UI work
   * without affecting production builds. F-044.
   */
  EXPO_PUBLIC_USE_DEMO_FIXTURES?: string;
}

export type BestChefPublicRenderPolicyInput =
  BestChefPublicRenderPolicyEnv & BestChefSeedContentApprovalEnv;

export type DemoRenderReason =
  | 'explicit_show'
  | 'explicit_hide'
  | 'internal_beta'
  | 'public_launch'
  | 'missing_seed_approval';

export interface BestChefPublicRenderPolicy {
  isPublicLaunch: boolean;
  showDemoContent: boolean;
  demoRenderReason: DemoRenderReason;
}

export function getBestChefPublicRenderPolicy(
  env: BestChefPublicRenderPolicyInput = process.env,
): BestChefPublicRenderPolicy {
  const explicit = env.EXPO_PUBLIC_BESTCHEF_SHOW_DEMO_CONTENT;
  const explicitShow = explicit === '1';
  const explicitHide = explicit === '0';

  const isPublicLaunch =
    env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH === '1' ||
    env.NODE_ENV === 'production';

  if (explicitShow) {
    if (isPublicLaunch && !hasApprovedBestChefSeedContent(env)) {
      return {
        isPublicLaunch,
        showDemoContent: false,
        demoRenderReason: 'missing_seed_approval',
      };
    }

    return {
      isPublicLaunch,
      showDemoContent: true,
      demoRenderReason: 'explicit_show',
    };
  }

  if (explicitHide) {
    return {
      isPublicLaunch,
      showDemoContent: false,
      demoRenderReason: 'explicit_hide',
    };
  }

  return {
    isPublicLaunch,
    showDemoContent: !isPublicLaunch,
    demoRenderReason: isPublicLaunch ? 'public_launch' : 'internal_beta',
  };
}

export function shouldShowDemoContent(
  env: BestChefPublicRenderPolicyInput = process.env,
): boolean {
  return getBestChefPublicRenderPolicy(env).showDemoContent;
}

/**
 * Dev-only escape hatch (F-044): re-enables fixture rendering in local
 * development builds. Returns true ONLY when __DEV__ is on AND
 * EXPO_PUBLIC_USE_DEMO_FIXTURES === 'true'. Always false in production
 * regardless of any other flag combination.
 */
export function shouldUseDemoFixturesInDev(
  env: BestChefPublicRenderPolicyInput = process.env,
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDev = typeof (globalThis as any).__DEV__ !== 'undefined'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? Boolean((globalThis as any).__DEV__)
    : env.NODE_ENV !== 'production';
  if (!isDev) return false;
  return env.EXPO_PUBLIC_USE_DEMO_FIXTURES === 'true';
}
