import { describe, expect, it } from 'vitest';

import {
  createFakePaymentsProviderBundle,
  createPaymentsProviderBundle,
  createSandboxPaymentsProviderBundle,
  createUnitPaymentsProviderBundle,
} from '../index';
import { isProviderSuccess, providerSuccess } from '../helpers';

const context = {
  actorUserId: 'user_123',
  requestId: 'req_123',
  now: () => new Date('2026-04-20T12:00:00.000Z'),
};

describe('payments provider bundles', () => {
  it('fake bundle supports transfers, remittance quoting, webhook normalization, and notifications', async () => {
    const bundle = createFakePaymentsProviderBundle();

    const transfer = await bundle.domesticWallets.createTransfer(
      {
        ledgerTransactionId: 'transfer_1',
        transferType: 'wallet_to_wallet',
        amountCents: 1_500,
        currency: 'USD',
        sourceAccountId: 'wallet_a',
        destinationAccountId: 'wallet_b',
        idempotencyKey: 'idem_1',
      },
      context,
    );
    const quote = await bundle.remittances.quote(
      {
        sourceAmountCents: 20_000,
        sourceCurrency: 'USD',
        destinationCurrency: 'MXN',
        corridor: 'US-MX',
        recipientCountryCode: 'MX',
      },
      context,
    );
    const webhook = await bundle.webhooks.verifyAndNormalize(
      {
        providerName: 'fake',
        signature: 'good_sig',
        rawBody: JSON.stringify({
          id: 'evt_fake_1',
          type: 'transfer.completed',
          object_reference: 'transfer_1',
        }),
      },
      context,
    );
    const notification = await bundle.notifications.deliver(
      {
        channel: 'in_app',
        template: 'transfer_completed',
        recipientUserId: 'user_456',
      },
      context,
    );

    expect(bundle.kind).toBe('fake');
    expect(bundle.profile).toBe('fake');
    expect(isProviderSuccess(transfer)).toBe(true);
    expect(isProviderSuccess(quote)).toBe(true);
    expect(isProviderSuccess(webhook)).toBe(true);
    expect(isProviderSuccess(notification)).toBe(true);
    if (!transfer.ok || !quote.ok || !webhook.ok || !notification.ok) {
      throw new Error('Expected fake provider calls to succeed');
    }
    expect(transfer.data.state).toBe('pending_provider');
    expect(quote.data.destinationAmountCents).toBeGreaterThan(0);
    expect(webhook.data.normalizedEvent.providerEventId).toBe('evt_fake_1');
    expect(notification.data.status).toBe('sent');
  });

  it('sandbox bundle exposes capability differences without changing the interface', async () => {
    const unitBundle = createSandboxPaymentsProviderBundle('unit');
    const syncteraBundle = createSandboxPaymentsProviderBundle('synctera');

    const bankLink = await unitBundle.bankLinkFunding.createLinkSession(
      {
        ownerUserId: 'user_123',
      },
      context,
    );
    const unitCard = await unitBundle.cardIssuing.issueCard(
      {
        walletId: 'wallet_1',
        ownerUserId: 'user_123',
        cardholderName: 'Unit User',
        cardType: 'virtual',
        currency: 'USD',
      },
      context,
    );
    const syncteraCard = await syncteraBundle.cardIssuing.issueCard(
      {
        walletId: 'wallet_2',
        ownerUserId: 'user_123',
        cardholderName: 'Synctera User',
        cardType: 'virtual',
        currency: 'USD',
      },
      context,
    );

    expect(unitBundle.kind).toBe('sandbox');
    expect(unitBundle.profile).toBe('unit');
    expect(isProviderSuccess(bankLink)).toBe(true);
    expect(unitCard.ok).toBe(false);
    if (unitCard.ok) {
      throw new Error('Expected Unit sandbox card issue to be unsupported');
    }
    expect(unitCard.code).toBe('not_supported');
    expect(syncteraCard.ok).toBe(true);
  });

  it('factory selects fake, sandbox, and live bundles from runtime config', () => {
    const fakeBundle = createPaymentsProviderBundle({
      boundary: 'split',
      providerMode: 'fake',
      environment: 'sandbox',
      supabaseUrl: 'https://example.supabase.co',
      supabaseServiceRoleKey: 'service-role',
      stripeSecretKey: null,
      stripeWebhookSecret: null,
      operatorApprovalRequired: false,
      featureFlags: {
        wallet: true,
        cards: true,
        remittances: false,
        disputes: true,
        fakeFunding: true,
      },
    });
    const sandboxBundle = createPaymentsProviderBundle({
      boundary: 'split',
      providerMode: 'unit',
      environment: 'sandbox',
      supabaseUrl: 'https://example.supabase.co',
      supabaseServiceRoleKey: 'service-role',
      stripeSecretKey: null,
      stripeWebhookSecret: null,
      operatorApprovalRequired: false,
      featureFlags: {
        wallet: true,
        cards: true,
        remittances: false,
        disputes: true,
        fakeFunding: false,
      },
    });
    const liveBundle = createPaymentsProviderBundle({
      boundary: 'split',
      providerMode: 'synctera',
      environment: 'production',
      supabaseUrl: 'https://example.supabase.co',
      supabaseServiceRoleKey: 'service-role',
      stripeSecretKey: null,
      stripeWebhookSecret: null,
      operatorApprovalRequired: true,
      featureFlags: {
        wallet: true,
        cards: true,
        remittances: true,
        disputes: true,
        fakeFunding: false,
      },
    });

    expect(fakeBundle.kind).toBe('fake');
    expect(sandboxBundle.kind).toBe('sandbox');
    expect(sandboxBundle.profile).toBe('unit');
    expect(liveBundle.kind).toBe('live');
    expect(liveBundle.profile).toBe('synctera');
  });

  it('live bundle allows remittance partner swapping without interface changes', async () => {
    const bundle = createUnitPaymentsProviderBundle({
      remittances: {
        providerName: 'future_remittance_partner',
        async quote(request, currentContext) {
          return providerSuccess('future_remittance_partner', {
            quoteId: `future_partner_${request.corridor}`,
            exchangeRate: '0.9450',
            feeCents: 250,
            destinationAmountCents: request.sourceAmountCents - 250,
            expiresAt: currentContext.now().toISOString(),
          });
        },
        async settle(request, currentContext) {
          return providerSuccess('future_remittance_partner', {
            providerRemittanceId: `future_remit_${request.remittanceId}`,
            state: 'processing',
            submittedAt: currentContext.now().toISOString(),
            expectedPayoutAt: currentContext.now().toISOString(),
          });
        },
      },
    });

    const quote = await bundle.remittances.quote(
      {
        sourceAmountCents: 5_000,
        sourceCurrency: 'USD',
        destinationCurrency: 'MXN',
        corridor: 'US-MX',
        recipientCountryCode: 'MX',
      },
      context,
    );

    expect(bundle.kind).toBe('live');
    expect(bundle.profile).toBe('unit');
    expect(isProviderSuccess(quote)).toBe(true);
    if (!quote.ok) {
      throw new Error('Expected injected remittance rail to succeed');
    }
    expect(quote.providerName).toBe('future_remittance_partner');
    expect(quote.data.quoteId).toContain('future_partner');
  });
});

