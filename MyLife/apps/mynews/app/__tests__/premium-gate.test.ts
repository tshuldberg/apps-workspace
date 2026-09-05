import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ENTITLEMENT_EXEMPT_ROOT_SEGMENTS,
  isEntitlementExemptRoute,
} from '../(root)/lib/entitlement-routes';
import { premiumGateView } from '../(root)/lib/premium-gate';

const GATED_ROUTES: readonly string[][] = [
  ['(root)', '(tabs)'],
  ['(root)', '(tabs)', 'support'],
  ['(root)', 'article', '[slug]'],
  ['(root)', 'compose'],
  ['(root)', 'earnings'],
  ['(root)', 'register'],
  ['(root)', 'suggest', '[slug]'],
  ['(root)', 'newsrooms'],
  ['(root)', 'blocked'],
];

const EXEMPT_ROUTES: readonly string[][] = [
  ['(root)', 'legal'],
  ['(root)', 'legal', 'terms'],
  ['(root)', 'legal', 'privacy'],
  ['(root)', 'legal', 'guidelines'],
  ['(root)', 'legal', 'dmca'],
  ['(root)', 'legal', 'dmca-counter'],
  ['(root)', 'notices'],
  ['(root)', 'account-delete'],
  ['(root)', 'account-export'],
];

describe('isEntitlementExemptRoute', () => {
  it('exempts every legal document, notices, and account route', () => {
    for (const segments of EXEMPT_ROUTES) {
      expect(isEntitlementExemptRoute(segments), segments.join('/')).toBe(true);
    }
  });

  it('keeps every product route gated', () => {
    for (const segments of GATED_ROUTES) {
      expect(isEntitlementExemptRoute(segments), segments.join('/')).toBe(false);
    }
  });

  it('skips group segments wherever they appear', () => {
    expect(isEntitlementExemptRoute(['(root)', '(tabs)', 'legal'])).toBe(true);
    expect(isEntitlementExemptRoute(['legal', 'terms'])).toBe(true);
  });

  it('does not exempt the index route or an empty segment list', () => {
    expect(isEntitlementExemptRoute([])).toBe(false);
    expect(isEntitlementExemptRoute(['(root)'])).toBe(false);
    expect(isEntitlementExemptRoute(['(root)', ''])).toBe(false);
  });

  it('matches whole segments only, never a prefix', () => {
    expect(isEntitlementExemptRoute(['(root)', 'legalese'])).toBe(false);
    expect(isEntitlementExemptRoute(['(root)', 'account-delete-all'])).toBe(false);
    expect(isEntitlementExemptRoute(['(root)', 'noticesx'])).toBe(false);
    expect(isEntitlementExemptRoute(['(root)', 'account'])).toBe(false);
  });

  it('pins the exempt list to the routes registered in the (root) layout', () => {
    expect([...ENTITLEMENT_EXEMPT_ROOT_SEGMENTS].sort()).toEqual([
      'account-delete',
      'account-export',
      'legal',
      'notices',
    ]);
    // Every exempt name must be a real registered screen; a stale entry would
    // silently widen the exemption.
    const layout = readFileSync(join(__dirname, '../(root)/_layout.tsx'), 'utf8');
    for (const segment of ENTITLEMENT_EXEMPT_ROOT_SEGMENTS) {
      expect(layout, segment).toContain(`name="${segment}"`);
    }
  });
});

describe('premiumGateView', () => {
  it('renders the app for an entitled user on any route', () => {
    for (const segments of [...GATED_ROUTES, ...EXEMPT_ROUTES]) {
      expect(
        premiumGateView({
          isEntitled: true,
          isConfigured: true,
          status: 'entitled',
          segments,
        }),
      ).toBe('children');
    }
  });

  it('never renders purchase controls in an unconfigured build', () => {
    for (const status of ['locked', 'unavailable', 'error'] as const) {
      expect(
        premiumGateView({
          isEntitled: false,
          isConfigured: false,
          status,
          segments: ['(root)', '(tabs)'],
        }),
      ).toBe('unavailable');
    }
  });

  it('shows the paywall only for a configured, unentitled, resolved build', () => {
    expect(
      premiumGateView({
        isEntitled: false,
        isConfigured: true,
        status: 'locked',
        segments: ['(root)', '(tabs)'],
      }),
    ).toBe('paywall');
    expect(
      premiumGateView({
        isEntitled: false,
        isConfigured: true,
        status: 'error',
        segments: ['(root)', '(tabs)'],
      }),
    ).toBe('paywall');
  });

  it('waits while entitlement is still resolving', () => {
    expect(
      premiumGateView({
        isEntitled: false,
        isConfigured: true,
        status: 'loading',
        segments: ['(root)', '(tabs)'],
      }),
    ).toBe('loading');
  });

  it('reaches legal and notices in an unconfigured, unentitled build', () => {
    for (const segments of EXEMPT_ROUTES) {
      expect(
        premiumGateView({
          isEntitled: false,
          isConfigured: false,
          status: 'unavailable',
          segments,
        }),
        segments.join('/'),
      ).toBe('children');
    }
  });

  it('reaches legal and notices while entitlement is still loading', () => {
    expect(
      premiumGateView({
        isEntitled: false,
        isConfigured: true,
        status: 'loading',
        segments: ['(root)', 'legal', 'dmca'],
      }),
    ).toBe('children');
  });
});
