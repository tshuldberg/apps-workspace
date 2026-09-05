// DoWork public render policy.
//
// Mirrors apps/bestchef/.../data/public-render-policy.ts but swaps the
// BESTCHEF env names for DOWORK and uses isDoWorkPublicLaunchBuild() as
// the public-launch gate. Protects the social feed from leaking demo
// workouts to real public-launch users.

import { isDoWorkPublicLaunchBuild } from './launch-environment';

export interface DoWorkPublicRenderPolicyEnv {
  NODE_ENV?: string;
  EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH?: string;
  EXPO_PUBLIC_DOWORK_SHOW_DEMO_CONTENT?: string;
  EXPO_PUBLIC_DOWORK_SEED_CONTENT_APPROVAL_STATUS?: string;
  EXPO_PUBLIC_DOWORK_APPROVED_SEED_CONTENT_REVISION?: string;
  /**
   * Dev-only escape hatch. Only honored when __DEV__ is true. Lets a
   * developer turn DEMO_* fixture rendering back on for local UI work
   * without affecting production builds.
   */
  EXPO_PUBLIC_USE_DEMO_FIXTURES?: string;
}

export type DemoRenderReason =
  | 'explicit_show'
  | 'explicit_hide'
  | 'internal_beta'
  | 'public_launch'
  | 'missing_seed_approval';

export interface DoWorkPublicRenderPolicy {
  isPublicLaunch: boolean;
  showDemoContent: boolean;
  demoRenderReason: DemoRenderReason;
}

function hasApprovedDoWorkSeedContent(env: DoWorkPublicRenderPolicyEnv): boolean {
  const status = env.EXPO_PUBLIC_DOWORK_SEED_CONTENT_APPROVAL_STATUS?.trim().toLowerCase();
  const revision = env.EXPO_PUBLIC_DOWORK_APPROVED_SEED_CONTENT_REVISION?.trim();
  return status === 'approved' && Boolean(revision);
}

export function getDoWorkPublicRenderPolicy(
  env: DoWorkPublicRenderPolicyEnv = process.env,
): DoWorkPublicRenderPolicy {
  const explicit = env.EXPO_PUBLIC_DOWORK_SHOW_DEMO_CONTENT;
  const explicitShow = explicit === '1';
  const explicitHide = explicit === '0';

  const isPublicLaunch = isDoWorkPublicLaunchBuild(env);

  if (explicitShow) {
    if (isPublicLaunch && !hasApprovedDoWorkSeedContent(env)) {
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
  env: DoWorkPublicRenderPolicyEnv = process.env,
): boolean {
  return getDoWorkPublicRenderPolicy(env).showDemoContent;
}

/**
 * Dev-only escape hatch: re-enables fixture rendering in local
 * development builds. Returns true ONLY when __DEV__ is on AND
 * EXPO_PUBLIC_USE_DEMO_FIXTURES === 'true'. Always false in production
 * regardless of any other flag combination.
 */
export function shouldUseDemoFixturesInDev(
  env: DoWorkPublicRenderPolicyEnv = process.env,
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDev = typeof (globalThis as any).__DEV__ !== 'undefined'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? Boolean((globalThis as any).__DEV__)
    : env.NODE_ENV !== 'production';
  if (!isDev) return false;
  return env.EXPO_PUBLIC_USE_DEMO_FIXTURES === 'true';
}
