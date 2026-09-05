import { BILLING_EVENT_TYPES, BILLING_SKUS } from '@mylife/billing-config';
import { describe, expect, it } from 'vitest';
import type { Entitlements } from '@mylife/entitlements';
import {
  deriveEntitlementFromBillingEvent,
  issueSignedEntitlement,
  parseBillingWebhookPayload,
  parseIssueEntitlementInput,
} from '../entitlement-issuer';

describe('billing entitlement issuer', () => {
  it('validates entitlement issue payloads', () => {
    expect(parseIssueEntitlementInput(null)).toEqual({
      ok: false,
      error: 'Body must be an object.',
    });

    expect(
      parseIssueEntitlementInput({
        appId: 'mylife',
        mode: 'bad-mode',
        hostedActive: true,
        selfHostLicense: false,
      }),
    ).toEqual({
      ok: false,
      error: 'mode must be hosted, self_host, or local_only.',
    });

    const parsed = parseIssueEntitlementInput({
      appId: 'mylife',
      mode: 'hosted',
      hostedActive: true,
      selfHostLicense: false,
      updatePackYear: 2026,
      features: ['sync', 'sharing'],
      issuedAt: '2026-02-25T00:00:00.000Z',
      expiresAt: '2026-03-25T00:00:00.000Z',
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.mode).toBe('hosted');
      expect(parsed.data.updatePackYear).toBe(2026);
      expect(parsed.data.features).toEqual(['sync', 'sharing']);
    }
  });

  it('parses billing webhook payloads with metadata fallbacks', () => {
    const parsed = parseBillingWebhookPayload({
      eventId: 'evt_1',
      eventType: BILLING_EVENT_TYPES.purchaseCreated,
      sku: BILLING_SKUS.selfHostLifetime,
      features: ['sync', 'sync', 'sharing'],
      metadata: {
        email: 'alice@example.com',
        github: 'alice-dev',
        buyerId: 'cust_123',
        bundleId: 'self-host-v2',
      },
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.appId).toBe('mylife');
      expect(parsed.data.customerEmail).toBe('alice@example.com');
      expect(parsed.data.githubUsername).toBe('alice-dev');
      expect(parsed.data.customerId).toBe('cust_123');
      expect(parsed.data.bundleId).toBe('self-host-v2');
    }
  });

  it('derives entitlement state transitions from billing events', () => {
    const current: Entitlements = {
      appId: 'mylife',
      mode: 'hosted',
      hostedActive: true,
      selfHostLicense: false,
      updatePackYear: undefined,
      features: ['existing'],
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-02-01T00:00:00.000Z',
      signature: 'sig',
    };

    const activated = deriveEntitlementFromBillingEvent(
      {
        eventId: 'evt_activate',
        eventType: BILLING_EVENT_TYPES.purchaseCreated,
        sku: BILLING_SKUS.selfHostLifetime,
        appId: 'mylife',
        features: ['sharing'],
      },
      current,
    );

    expect(activated.mode).toBe('self_host');
    expect(activated.selfHostLicense).toBe(true);
    expect(activated.hostedActive).toBe(true);
    expect(activated.features.sort()).toEqual(['existing', 'sharing']);

    const refundedHosted = deriveEntitlementFromBillingEvent(
      {
        eventId: 'evt_refund',
        eventType: BILLING_EVENT_TYPES.purchaseRefunded,
        sku: BILLING_SKUS.hostedMonthly,
        appId: 'mylife',
      },
      {
        ...current,
        mode: 'hosted',
        hostedActive: true,
        selfHostLicense: false,
      },
    );

    expect(refundedHosted.hostedActive).toBe(false);
    expect(refundedHosted.mode).toBe('local_only');
  });

  it('derives Meerkat hosted monthly access with its default hosted features', () => {
    const activated = deriveEntitlementFromBillingEvent(
      {
        eventId: 'evt_meerkat',
        eventType: BILLING_EVENT_TYPES.purchaseCreated,
        sku: BILLING_SKUS.meerkatHostedMonthly,
        appId: 'meerkat',
      },
      null,
    );

    expect(activated.mode).toBe('hosted');
    expect(activated.hostedActive).toBe(true);
    expect(activated.selfHostLicense).toBe(false);
    expect(activated.features.sort()).toEqual([
      'meerkat:community-node',
      'meerkat:hosted-relay',
      'meerkat:hosted-storage',
    ]);
  });

  it('issues signed entitlement tokens with deduped features', async () => {
    const issued = await issueSignedEntitlement(
      {
        appId: 'mylife',
        mode: 'self_host',
        hostedActive: false,
        selfHostLicense: true,
        updatePackYear: 2026,
        features: ['sync', 'sharing', 'sync'],
        issuedAt: '2026-02-25T00:00:00.000Z',
      },
      'test-secret',
    );

    expect(issued.entitlements.mode).toBe('self_host');
    expect(issued.entitlements.features).toEqual(['sync', 'sharing']);
    expect(typeof issued.entitlements.signature).toBe('string');
    expect(issued.entitlements.signature.length).toBeGreaterThan(10);
    expect(JSON.parse(issued.token)).toEqual(issued.entitlements);
  });
});
