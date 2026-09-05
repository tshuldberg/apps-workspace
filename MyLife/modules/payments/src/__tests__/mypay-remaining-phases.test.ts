import { describe, expect, it } from 'vitest';

import {
  buildDiningBillSplitRequests,
  buildMarketMyPayCheckoutState,
  buildPaymentsActivityFeedViewModel,
  buildPaymentsAvailabilityViewModel,
  buildPaymentsCardActivityRows,
  buildPaymentsCardManagementViewModel,
  buildPaymentsFundingFlowViewModel,
  buildPaymentsFxConversionPreview,
  buildPaymentsInternationalQuoteViewModel,
  buildPaymentsMerchantQrPayload,
  buildPaymentsOpsConsoleViewModel,
  buildPaymentsProfile,
  buildPaymentsRemittanceTrackingViewModel,
  buildPaymentsSettingsViewModel,
  buildRsvpSplitRequests,
  projectMyPayEventToBudget,
} from '..';
import type {
  PaymentsFundingFlowSnapshot,
  PaymentsSettingsSnapshot,
} from '..';

function wallet() {
  return {
    walletId: 'wallet_1',
    ownerUserId: 'user_1',
    status: 'active' as const,
    defaultCurrency: 'USD',
    balances: {
      available: 12_500,
      pending: 2_500,
      reserved: 0,
      escrow: 0,
    },
    complianceHold: 'none' as const,
    sendLimitRemainingCents: 50_000,
    receiveLimitRemainingCents: 75_000,
  };
}

function fundingSnapshot(flow: 'add_money' | 'withdraw'): PaymentsFundingFlowSnapshot {
  return {
    wallet: wallet(),
    linkedAccounts: [
      {
        id: 'bank_1',
        institutionName: 'Thread Bank',
        displayName: 'Checking',
        last4: '6789',
        verificationState: 'verified',
        supportsInstantFunding: true,
        supportsInstantPayout: true,
        removable: false,
      },
    ],
    intents: [],
    serverNow: '2026-04-24T16:00:00.000Z',
    draft: {
      flow,
      selectedLinkedAccountId: 'bank_1',
      amountText: '25.00',
      speed: 'instant',
      clientSubmissionId: `test-${flow}`,
    },
  };
}

function settingsSnapshot(): PaymentsSettingsSnapshot {
  return {
    profile: buildPaymentsProfile({
      ownerUserId: 'user_1',
      primaryWalletId: 'wallet_1',
      handle: '@trey',
      displayName: 'Trey',
      identityStatus: 'verified',
      verificationState: 'verified',
      approvedTier: 'basic',
      fields: {
        legalName: 'Trey Example',
        email: 'trey@example.com',
        phoneE164: '+15555550123',
      },
    }),
    wallet: wallet(),
    discoverability: 'contacts_only',
    identifiers: [],
    preferredContactMethod: 'handle',
    contacts: [],
    favoriteCounterpartyIds: [],
    notifications: [],
    selfImposedLimits: [
      {
        id: 'daily',
        label: 'Daily send',
        amountCents: 20_000,
        complianceLimitCents: 50_000,
        currency: 'USD',
      },
    ],
    feeSchedule: [],
    walletClose: {
      exportReady: true,
    },
    generatedAt: '2026-04-24T16:00:00.000Z',
  };
}

describe('MyPay remaining mission-control phases', () => {
  it('keeps P3-D activity detail report entry tied to a transaction', () => {
    const feed = buildPaymentsActivityFeedViewModel({
      ownerUserId: 'user_1',
      walletId: 'wallet_1',
      now: '2026-04-24T16:00:00.000Z',
      selectedActivityId: 'transfer_1',
      items: [
        {
          source: 'transfer',
          occurredAt: '2026-04-24T15:00:00.000Z',
          transfer: {
            transferId: 'transfer_1',
            idempotencyKey: 'transfer_1',
            kind: 'p2p',
            status: 'completed',
            sourceWalletId: 'wallet_1',
            destinationWalletId: 'wallet_2',
            sourceBalanceBucket: 'available',
            destinationBalanceBucket: 'available',
            sourceAmountCents: 1000,
            sourceCurrency: 'USD',
            destinationAmountCents: 1000,
            destinationCurrency: 'USD',
            feeAmountCents: 0,
            feeWalletId: null,
            sourceRail: 'wallet',
            destinationRail: 'wallet',
            metadata: {},
          },
        },
      ],
    });

    expect(feed.selectedDetail?.issueEntryPoint.label).toBe('Report an issue');
    expect(feed.selectedDetail?.issueEntryPoint.draft?.transferId).toBe('transfer_1');
  });

  it('uses explicit P3-E funding and payout intent commands', () => {
    const add = buildPaymentsFundingFlowViewModel(fundingSnapshot('add_money'));
    const withdraw = buildPaymentsFundingFlowViewModel(fundingSnapshot('withdraw'));

    expect(add.commandPreview?.command.type).toBe('fund');
    expect(add.commandPreview?.command.metadata?.intentTable).toBe('pay_funding_intents');
    expect(withdraw.commandPreview?.command.type).toBe('withdraw');
    expect(withdraw.commandPreview?.command.metadata?.intentTable).toBe('pay_payout_intents');
    expect(add.previewLines.find((line) => line.id === 'pending')?.value).toBe('$25.00');
  });

  it('separates P3-F product limits from compliance ceilings', () => {
    const settings = buildPaymentsSettingsViewModel(settingsSnapshot());

    expect(settings.limits.product[0]?.value).toBe('$200.00');
    expect(settings.limits.compliance[0]?.value).toBe('$500.00');
    expect(settings.limits.disclosure.body).toContain('never raise compliance');
  });

  it('projects P4 module integrations without making other modules authoritative', () => {
    const budget = projectMyPayEventToBudget({
      eventId: 'evt_1',
      transferId: 'transfer_card',
      eventType: 'completed',
      transferKind: 'card_capture',
      status: 'completed',
      amountCents: 3280,
      feeCents: 0,
      currency: 'USD',
      occurredAt: '2026-04-24T15:00:00.000Z',
      direction: 'outgoing',
      counterpartyLabel: 'Westside Market',
      deepLink: '/payments/transfer_card',
    });
    const market = buildMarketMyPayCheckoutState({
      orderId: 'order_1',
      listingId: 'listing_1',
      buyerWalletId: 'wallet_1',
      sellerWalletId: 'wallet_2',
      amountCents: 5000,
      currency: 'USD',
      escrowTransferId: 'transfer_escrow',
      deepLink: '/payments/transfer_escrow',
    });
    const rsvp = buildRsvpSplitRequests({
      eventId: 'event_1',
      requesterWalletId: 'wallet_1',
      totalCents: 3000,
      currency: 'USD',
      method: 'equal',
      memo: 'Event split',
      attendees: [
        { attendeeId: 'a', displayName: 'A', walletId: 'wallet_a' },
        { attendeeId: 'b', displayName: 'B', walletId: 'wallet_b' },
      ],
    });
    const dining = buildDiningBillSplitRequests({
      diningSessionId: 'dining_1',
      requesterWalletId: 'wallet_1',
      currency: 'USD',
      rawReceiptImageLocalOnly: true,
      taxCents: 200,
      tipCents: 300,
      participants: [
        { participantId: 'a', displayName: 'A', walletId: 'wallet_a' },
      ],
      lineItems: [
        { itemId: 'burger', label: 'Burger', amountCents: 1000, assignedParticipantIds: ['a'] },
      ],
    });

    expect(budget?.category).toBe('card_purchase');
    expect(budget?.recategorizationOwner).toBe('budget');
    expect(market.marketOwnsFinancialTruth).toBe(false);
    expect(rsvp.requests).toHaveLength(2);
    expect(dining.rawReceiptStoredByMyPay).toBe(false);
  });

  it('models P5 cards, card activity, and QR payloads with safe boundaries', () => {
    const card = buildPaymentsCardManagementViewModel({
      card: {
        cardId: 'card_1',
        form: 'virtual',
        status: 'active',
        maskedLabel: 'Virtual card ending 4242',
        holderName: 'Trey',
        spendLimitCents: 50000,
        currency: 'USD',
        physicalOrderStatus: 'not_ordered',
        provisioningProviders: ['apple_pay'],
      },
    });
    const rows = buildPaymentsCardActivityRows({
      transactions: [
        {
          transactionId: 'txn_1',
          cardId: 'card_1',
          merchantName: 'Market',
          merchantCategoryCode: '5411',
          amountCents: 1000,
          currency: 'USD',
          status: 'completed',
          authorizedAt: '2026-04-24T15:00:00.000Z',
          transferId: 'transfer_card',
        },
      ],
    });
    const qr = buildPaymentsMerchantQrPayload({
      mode: 'merchant',
      payeeWalletId: 'merchant_1',
      amountCents: 1000,
      currency: 'USD',
      expiresAt: '2026-04-24T16:00:00.000Z',
      nonce: 'nonce',
    });

    expect(card.sensitiveDataStoredByMyLife).toBe(false);
    expect(rows[0]?.budgetCategory).toBe('Groceries and dining');
    expect(qr.fingerprint).toContain('merchant_1');
  });

  it('supports P6 remittance quote, tracking, and FX helpers without crypto language', () => {
    const quote = buildPaymentsInternationalQuoteViewModel({
      recipient: {
        recipientId: 'recipient_1',
        displayName: 'Sam',
        countryCode: 'MX',
        payoutMethod: 'bank',
        favorite: true,
        sanctionsScreenedAt: '2026-04-24T15:00:00.000Z',
      },
      quote: {
        providerName: 'Provider',
        corridor: 'US-MX',
        sourceAmountCents: 10000,
        sourceCurrency: 'USD',
        destinationAmountCents: 171200,
        destinationCurrency: 'MXN',
        exchangeRate: '17.120000',
        feeCents: 300,
        expiresAt: '2026-04-24T16:00:00.000Z',
      },
    });
    const tracking = buildPaymentsRemittanceTrackingViewModel({
      remittanceId: 'remit_1',
      recipient: {
        recipientId: 'recipient_1',
        displayName: 'Sam',
        countryCode: 'MX',
        payoutMethod: 'bank',
        favorite: true,
        sanctionsScreenedAt: null,
      },
      status: 'sent',
      createdAt: '2026-04-24T15:00:00.000Z',
    });
    const fx = buildPaymentsFxConversionPreview({
      sourceAmountCents: 1000,
      sourceCurrency: 'USD',
      destinationCurrency: 'MXN',
      rate: '17.12',
      expiresAt: '2026-04-24T16:00:00.000Z',
    });

    expect(quote.recipientAmountLabel).toContain('MX');
    expect(JSON.stringify(quote).toLowerCase()).not.toContain('crypto');
    expect(tracking.reusedTransactionShell).toBe(true);
    expect(fx.spendableImmediately).toBe(false);
  });

  it('adds P7 degraded-mode and ops queue readiness', () => {
    const availability = buildPaymentsAvailabilityViewModel({
      checks: [
        { capability: 'send', health: 'disabled', reason: 'Provider outage' },
        { capability: 'funding', health: 'operational', reason: null },
      ],
    });
    const ops = buildPaymentsOpsConsoleViewModel({
      breaks: [],
      disputes: [],
      providerEvents: [],
      remittanceExceptionIds: ['remit_1'],
      complianceHoldWalletIds: ['wallet_1'],
    });

    expect(availability.actions.send.enabled).toBe(false);
    expect(availability.banner?.title).toContain('Payments actions');
    expect(ops.queues.find((queue) => queue.id === 'remittance_exceptions')?.count).toBe(1);
  });
});
