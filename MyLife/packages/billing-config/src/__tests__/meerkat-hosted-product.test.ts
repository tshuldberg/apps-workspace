import { describe, expect, it } from 'vitest';
import {
  BILLING_SKUS,
  MEERKAT_APP_UNLOCK_PRODUCT,
  MEERKAT_HOSTED_MONTHLY_PRODUCT,
  SKU_ENTITLEMENT_DEFAULTS,
} from '../index';

// Founder-locked pricing (2026-07-05): the Meerkat app is $4.99 one-time and the
// hosted subscription is $4.99/month WITH storage included. This test exists so
// nobody "reconciles" the hosted price to some other figure again.
describe('MEERKAT_HOSTED_MONTHLY_PRODUCT (founder-locked)', () => {
  it('is $4.99/month', () => {
    expect(MEERKAT_HOSTED_MONTHLY_PRODUCT).toEqual({
      id: BILLING_SKUS.meerkatHostedMonthly,
      price: 4.99,
      type: 'monthly',
    });
  });

  it('includes hosted storage in the subscription (not a separate paid tier)', () => {
    const defaults = SKU_ENTITLEMENT_DEFAULTS[BILLING_SKUS.meerkatHostedMonthly];
    expect(defaults.modeDefault).toBe('hosted');
    expect(defaults.featuresDefault).toEqual([
      'meerkat:hosted-relay',
      'meerkat:community-node',
      'meerkat:hosted-storage',
    ]);
  });
});

describe('MEERKAT_APP_UNLOCK_PRODUCT (founder-locked)', () => {
  it('is a $4.99 ONE-TIME app unlock (never a subscription, metered, or yearly SKU)', () => {
    expect(MEERKAT_APP_UNLOCK_PRODUCT).toEqual({
      id: 'meerkat_app_unlock',
      price: 4.99,
      type: 'one_time',
    });
  });
});
