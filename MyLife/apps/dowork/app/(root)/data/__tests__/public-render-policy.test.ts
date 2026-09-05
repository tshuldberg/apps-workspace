// DoWork public-render-policy contract tests.

import { describe, expect, it } from 'vitest';
import {
  getDoWorkPublicRenderPolicy,
  shouldShowDemoContent,
  shouldUseDemoFixturesInDev,
  type DoWorkPublicRenderPolicyEnv,
} from '../public-render-policy';

describe('getDoWorkPublicRenderPolicy', () => {
  it('shows demo content by default on an internal (non-public-launch) build', () => {
    const policy = getDoWorkPublicRenderPolicy({});
    expect(policy).toEqual({
      isPublicLaunch: false,
      showDemoContent: true,
      demoRenderReason: 'internal_beta',
    });
  });

  it('hides demo content by default on a public-launch build', () => {
    const policy = getDoWorkPublicRenderPolicy({ EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH: '1' });
    expect(policy).toEqual({
      isPublicLaunch: true,
      showDemoContent: false,
      demoRenderReason: 'public_launch',
    });
  });

  it('honors an explicit hide flag on an internal build', () => {
    const policy = getDoWorkPublicRenderPolicy({ EXPO_PUBLIC_DOWORK_SHOW_DEMO_CONTENT: '0' });
    expect(policy).toEqual({
      isPublicLaunch: false,
      showDemoContent: false,
      demoRenderReason: 'explicit_hide',
    });
  });

  it('honors an explicit show flag on an internal build', () => {
    const policy = getDoWorkPublicRenderPolicy({ EXPO_PUBLIC_DOWORK_SHOW_DEMO_CONTENT: '1' });
    expect(policy).toEqual({
      isPublicLaunch: false,
      showDemoContent: true,
      demoRenderReason: 'explicit_show',
    });
  });

  it('blocks an explicit show flag on a public-launch build without approved seed content', () => {
    const policy = getDoWorkPublicRenderPolicy({
      EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH: '1',
      EXPO_PUBLIC_DOWORK_SHOW_DEMO_CONTENT: '1',
    });
    expect(policy).toEqual({
      isPublicLaunch: true,
      showDemoContent: false,
      demoRenderReason: 'missing_seed_approval',
    });
  });

  it('allows an explicit show flag on a public-launch build with approved seed content', () => {
    const policy = getDoWorkPublicRenderPolicy({
      EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH: '1',
      EXPO_PUBLIC_DOWORK_SHOW_DEMO_CONTENT: '1',
      EXPO_PUBLIC_DOWORK_SEED_CONTENT_APPROVAL_STATUS: 'approved',
      EXPO_PUBLIC_DOWORK_APPROVED_SEED_CONTENT_REVISION: 'rev-1',
    });
    expect(policy).toEqual({
      isPublicLaunch: true,
      showDemoContent: true,
      demoRenderReason: 'explicit_show',
    });
  });

  it('requires both approval status and a revision for approved seed content', () => {
    const policy = getDoWorkPublicRenderPolicy({
      EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH: '1',
      EXPO_PUBLIC_DOWORK_SHOW_DEMO_CONTENT: '1',
      EXPO_PUBLIC_DOWORK_SEED_CONTENT_APPROVAL_STATUS: 'approved',
      // revision missing
    });
    expect(policy.showDemoContent).toBe(false);
    expect(policy.demoRenderReason).toBe('missing_seed_approval');
  });
});

describe('shouldShowDemoContent', () => {
  it('mirrors getDoWorkPublicRenderPolicy().showDemoContent', () => {
    expect(shouldShowDemoContent({})).toBe(true);
    expect(shouldShowDemoContent({ EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH: '1' })).toBe(false);
  });
});

describe('shouldUseDemoFixturesInDev', () => {
  const withDev = <T,>(value: boolean, fn: () => T): T => {
    const globalWithDev = globalThis as { __DEV__?: boolean };
    const prior = globalWithDev.__DEV__;
    globalWithDev.__DEV__ = value;
    try {
      return fn();
    } finally {
      globalWithDev.__DEV__ = prior;
    }
  };

  it('is false in production regardless of the fixtures flag', () => {
    withDev(false, () => {
      const env: DoWorkPublicRenderPolicyEnv = { EXPO_PUBLIC_USE_DEMO_FIXTURES: 'true' };
      expect(shouldUseDemoFixturesInDev(env)).toBe(false);
    });
  });

  it('is true in dev only when the fixtures flag is exactly "true"', () => {
    withDev(true, () => {
      expect(shouldUseDemoFixturesInDev({ EXPO_PUBLIC_USE_DEMO_FIXTURES: 'true' })).toBe(true);
      expect(shouldUseDemoFixturesInDev({ EXPO_PUBLIC_USE_DEMO_FIXTURES: '1' })).toBe(false);
      expect(shouldUseDemoFixturesInDev({})).toBe(false);
    });
  });

  it('falls back to NODE_ENV when __DEV__ is undefined', () => {
    const globalWithDev = globalThis as { __DEV__?: boolean };
    const prior = globalWithDev.__DEV__;
    delete globalWithDev.__DEV__;
    try {
      expect(
        shouldUseDemoFixturesInDev({ NODE_ENV: 'production', EXPO_PUBLIC_USE_DEMO_FIXTURES: 'true' }),
      ).toBe(false);
      expect(
        shouldUseDemoFixturesInDev({ NODE_ENV: 'development', EXPO_PUBLIC_USE_DEMO_FIXTURES: 'true' }),
      ).toBe(true);
    } finally {
      globalWithDev.__DEV__ = prior;
    }
  });
});
