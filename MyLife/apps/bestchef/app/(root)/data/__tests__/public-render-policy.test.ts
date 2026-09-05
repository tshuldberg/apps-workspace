import { describe, expect, it } from 'vitest';
import {
  getBestChefPublicRenderPolicy,
  shouldShowDemoContent,
} from '../public-render-policy';

describe('getBestChefPublicRenderPolicy', () => {
  it('shows demo content for internal beta builds by default', () => {
    const policy = getBestChefPublicRenderPolicy({});
    expect(policy.isPublicLaunch).toBe(false);
    expect(policy.showDemoContent).toBe(true);
    expect(policy.demoRenderReason).toBe('internal_beta');
  });

  it('hides demo content when public launch flag is set', () => {
    const policy = getBestChefPublicRenderPolicy({
      EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1',
    });
    expect(policy.isPublicLaunch).toBe(true);
    expect(policy.showDemoContent).toBe(false);
    expect(policy.demoRenderReason).toBe('public_launch');
  });

  it('hides demo content when NODE_ENV is production', () => {
    const policy = getBestChefPublicRenderPolicy({ NODE_ENV: 'production' });
    expect(policy.isPublicLaunch).toBe(true);
    expect(policy.showDemoContent).toBe(false);
    expect(policy.demoRenderReason).toBe('public_launch');
  });

  it('blocks explicit_show in public launch without seed approval', () => {
    const policy = getBestChefPublicRenderPolicy({
      EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1',
      EXPO_PUBLIC_BESTCHEF_SHOW_DEMO_CONTENT: '1',
    });
    expect(policy.showDemoContent).toBe(false);
    expect(policy.demoRenderReason).toBe('missing_seed_approval');
  });

  it('respects explicit_show override for approved editorial seed content', () => {
    const policy = getBestChefPublicRenderPolicy({
      EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1',
      EXPO_PUBLIC_BESTCHEF_SHOW_DEMO_CONTENT: '1',
      EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_APPROVAL_STATUS: 'approved',
      EXPO_PUBLIC_BESTCHEF_APPROVED_SEED_CONTENT_REVISION: 'seed-r1',
    });
    expect(policy.showDemoContent).toBe(true);
    expect(policy.demoRenderReason).toBe('explicit_show');
  });

  it('respects explicit_hide override even in internal beta', () => {
    const policy = getBestChefPublicRenderPolicy({
      EXPO_PUBLIC_BESTCHEF_SHOW_DEMO_CONTENT: '0',
    });
    expect(policy.isPublicLaunch).toBe(false);
    expect(policy.showDemoContent).toBe(false);
    expect(policy.demoRenderReason).toBe('explicit_hide');
  });
});

describe('shouldShowDemoContent', () => {
  it('hides demo content under public launch', () => {
    expect(
      shouldShowDemoContent({ EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1' }),
    ).toBe(false);
  });

  it('shows demo content for internal beta', () => {
    expect(shouldShowDemoContent({})).toBe(true);
  });
});
