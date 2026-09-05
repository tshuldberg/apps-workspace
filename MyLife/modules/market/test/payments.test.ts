import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StripeClient, StripeWebhookEvent } from '../src/payments/stripe-connect';
import {
  createConnectedAccount,
  getAccountStatus,
  createPaymentIntent,
  capturePaymentIntent,
  cancelPaymentIntent,
  createRefund,
  calculateFeeSplit,
} from '../src/payments/stripe-connect';
import {
  initiatePayment,
  evaluateEscrowState,
  calculateAutoReleaseDate,
  handleDisputeRefund,
  estimateFees,
  mapStripeStatusToPaymentStatus,
} from '../src/payments/orchestrator';
import {
  verifyWebhookEvent,
  processWebhookEvent,
  handleWebhook,
} from '../src/payments/webhooks';
import { calculateProcessingFee } from '../src/shipping/tracking';

// ── Mock Stripe Client ──────────────────────────────────────────────

function createMockStripe(): StripeClient {
  return {
    accounts: {
      create: vi.fn().mockResolvedValue({ id: 'acct_test123', charges_enabled: false, payouts_enabled: false }),
      retrieve: vi.fn().mockResolvedValue({ id: 'acct_test123', charges_enabled: true, payouts_enabled: true, requirements: { currently_due: [] } }),
      createLoginLink: vi.fn().mockResolvedValue({ url: 'https://connect.stripe.com/login/test' }),
    },
    accountLinks: {
      create: vi.fn().mockResolvedValue({ url: 'https://connect.stripe.com/setup/test' }),
    },
    paymentIntents: {
      create: vi.fn().mockResolvedValue({ id: 'pi_test123', client_secret: 'pi_test123_secret', status: 'requires_capture' }),
      retrieve: vi.fn().mockResolvedValue({ id: 'pi_test123', status: 'succeeded', amount: 5000 }),
      capture: vi.fn().mockResolvedValue({ id: 'pi_test123', status: 'succeeded' }),
      cancel: vi.fn().mockResolvedValue({ id: 'pi_test123', status: 'canceled' }),
    },
    refunds: {
      create: vi.fn().mockResolvedValue({ id: 're_test123', status: 'succeeded', amount: 5000 }),
    },
    transfers: {
      create: vi.fn().mockResolvedValue({ id: 'tr_test123', amount: 4500 }),
    },
    webhooks: {
      constructEvent: vi.fn().mockReturnValue({
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test123' } },
        created: Date.now() / 1000,
      }),
    },
  };
}

// ── Fee Calculation Tests ───────────────────────────────────────────

describe('calculateFeeSplit', () => {
  it('calculates fees with 0% platform fee (seller pays processing)', () => {
    const result = calculateFeeSplit(10000, 'seller', 0);
    const expectedProcessing = calculateProcessingFee(10000); // ceil(10000 * 0.029 + 30) = 320
    expect(result.processingFeeCents).toBe(expectedProcessing);
    expect(result.platformFeeCents).toBe(0);
    expect(result.applicationFeeCents).toBe(expectedProcessing); // seller pays processing
    expect(result.sellerReceivesCents).toBe(10000 - expectedProcessing);
  });

  it('calculates fees with 0% platform fee (buyer pays processing)', () => {
    const result = calculateFeeSplit(10000, 'buyer', 0);
    const expectedProcessing = calculateProcessingFee(10000);
    expect(result.processingFeeCents).toBe(expectedProcessing);
    expect(result.platformFeeCents).toBe(0);
    expect(result.applicationFeeCents).toBe(0); // buyer pays, not deducted from seller
    expect(result.sellerReceivesCents).toBe(10000);
  });

  it('calculates fees with platform fee', () => {
    const result = calculateFeeSplit(10000, 'seller', 5);
    expect(result.platformFeeCents).toBe(500); // 5% of 10000
    const expectedProcessing = calculateProcessingFee(10000);
    expect(result.applicationFeeCents).toBe(500 + expectedProcessing);
    expect(result.sellerReceivesCents).toBe(10000 - 500 - expectedProcessing);
  });

  it('handles small amounts without going negative', () => {
    const result = calculateFeeSplit(100, 'seller', 0); // $1.00
    expect(result.sellerReceivesCents).toBeGreaterThan(0);
  });
});

describe('calculateProcessingFee', () => {
  it('calculates Stripe rate: 2.9% + $0.30', () => {
    expect(calculateProcessingFee(10000)).toBe(320); // ceil(290 + 30)
    expect(calculateProcessingFee(5000)).toBe(175);  // ceil(145 + 30)
    expect(calculateProcessingFee(100)).toBe(33);     // ceil(2.9 + 30)
  });
});

// ── Stripe Connect Adapter Tests ────────────────────────────────────

describe('createConnectedAccount', () => {
  let stripe: StripeClient;
  beforeEach(() => { stripe = createMockStripe(); });

  it('creates an Express account and returns onboarding URL', async () => {
    const result = await createConnectedAccount(stripe, {
      userId: 'user-1',
      email: 'seller@test.com',
      returnUrl: 'https://app.mylife.com/market/onboarding/return',
      refreshUrl: 'https://app.mylife.com/market/onboarding/refresh',
    });

    expect(result.stripeAccountId).toBe('acct_test123');
    expect(result.onboardingUrl).toBe('https://connect.stripe.com/setup/test');
    expect(stripe.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'express',
        country: 'US',
        email: 'seller@test.com',
        metadata: { mylife_user_id: 'user-1' },
      }),
    );
  });

  it('passes custom country', async () => {
    await createConnectedAccount(stripe, {
      userId: 'user-1',
      email: 'seller@test.com',
      country: 'CA',
      returnUrl: 'https://example.com/return',
      refreshUrl: 'https://example.com/refresh',
    });

    expect(stripe.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'CA' }),
    );
  });
});

describe('getAccountStatus', () => {
  let stripe: StripeClient;
  beforeEach(() => { stripe = createMockStripe(); });

  it('returns active account status', async () => {
    const status = await getAccountStatus(stripe, 'acct_test123');
    expect(status.chargesEnabled).toBe(true);
    expect(status.payoutsEnabled).toBe(true);
    expect(status.requiresAction).toBe(false);
    expect(status.pendingRequirements).toEqual([]);
  });

  it('detects pending requirements', async () => {
    (stripe.accounts.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'acct_test123',
      charges_enabled: false,
      payouts_enabled: false,
      requirements: { currently_due: ['individual.verification.document'] },
    });

    const status = await getAccountStatus(stripe, 'acct_test123');
    expect(status.requiresAction).toBe(true);
    expect(status.pendingRequirements).toContain('individual.verification.document');
  });
});

describe('createPaymentIntent', () => {
  let stripe: StripeClient;
  beforeEach(() => { stripe = createMockStripe(); });

  it('creates intent with destination charge and application fee', async () => {
    const result = await createPaymentIntent(stripe, {
      amountCents: 5000,
      sellerStripeAccountId: 'acct_seller1',
      feePayer: 'seller',
      listingId: 'listing-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
    });

    expect(result.paymentIntentId).toBe('pi_test123');
    expect(result.clientSecret).toBe('pi_test123_secret');
    expect(result.processingFeeCents).toBe(calculateProcessingFee(5000));
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        transfer_data: { destination: 'acct_seller1' },
        capture_method: 'manual',
      }),
    );
  });

  it('includes offer ID in metadata when provided', async () => {
    await createPaymentIntent(stripe, {
      amountCents: 3000,
      sellerStripeAccountId: 'acct_seller1',
      feePayer: 'buyer',
      listingId: 'listing-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      offerId: 'offer-99',
    });

    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ mylife_offer_id: 'offer-99' }),
      }),
    );
  });
});

describe('capturePaymentIntent', () => {
  it('captures a held payment', async () => {
    const stripe = createMockStripe();
    const result = await capturePaymentIntent(stripe, 'pi_test123');
    expect(result.status).toBe('succeeded');
    expect(stripe.paymentIntents.capture).toHaveBeenCalledWith('pi_test123');
  });
});

describe('cancelPaymentIntent', () => {
  it('cancels an uncaptured payment', async () => {
    const stripe = createMockStripe();
    const result = await cancelPaymentIntent(stripe, 'pi_test123');
    expect(result.status).toBe('canceled');
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_test123');
  });
});

describe('createRefund', () => {
  it('creates a full refund with reverse transfer', async () => {
    const stripe = createMockStripe();
    const result = await createRefund(stripe, {
      paymentIntentId: 'pi_test123',
      reason: 'requested_by_customer',
      reverseTransfer: true,
      refundApplicationFee: true,
    });

    expect(result.refundId).toBe('re_test123');
    expect(result.status).toBe('succeeded');
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: 'pi_test123',
        reverse_transfer: true,
        refund_application_fee: true,
      }),
    );
  });

  it('creates a partial refund', async () => {
    const stripe = createMockStripe();
    (stripe.refunds.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 're_partial', status: 'succeeded', amount: 2500,
    });

    const result = await createRefund(stripe, {
      paymentIntentId: 'pi_test123',
      amountCents: 2500,
    });

    expect(result.amountCents).toBe(2500);
  });
});

// ── Orchestrator Tests ──────────────────────────────────────────────

describe('initiatePayment', () => {
  it('creates payment intent and returns escrow info', async () => {
    const stripe = createMockStripe();
    const result = await initiatePayment(stripe, {
      listingId: 'listing-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      sellerStripeAccountId: 'acct_seller1',
      amountCents: 8000,
      feePayer: 'seller',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.paymentIntentId).toBe('pi_test123');
      expect(result.data.clientSecret).toBe('pi_test123_secret');
      expect(result.data.escrowHoldUntil).toBeDefined();
    }
  });

  it('returns error on Stripe failure', async () => {
    const stripe = createMockStripe();
    (stripe.paymentIntents.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Card declined'));

    const result = await initiatePayment(stripe, {
      listingId: 'listing-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      sellerStripeAccountId: 'acct_seller1',
      amountCents: 8000,
      feePayer: 'seller',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Card declined');
    }
  });
});

describe('evaluateEscrowState', () => {
  const pastDate = new Date(Date.now() - 86400000 * 5).toISOString();
  const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();

  it('allows release when delivered and past hold date', () => {
    const state = evaluateEscrowState('holding', pastDate, pastDate, false);
    expect(state.canRelease).toBe(true);
    expect(state.canRefund).toBe(true);
  });

  it('blocks release when there is an active dispute', () => {
    const state = evaluateEscrowState('holding', pastDate, pastDate, true);
    expect(state.status).toBe('disputed');
    expect(state.canRelease).toBe(false);
  });

  it('blocks release before hold date even when delivered', () => {
    const state = evaluateEscrowState('holding', futureDate, pastDate, false);
    expect(state.canRelease).toBe(false);
  });

  it('blocks release when not yet delivered', () => {
    const state = evaluateEscrowState('holding', pastDate, null, false);
    expect(state.canRelease).toBe(false);
  });

  it('returns terminal state for already released escrow', () => {
    const state = evaluateEscrowState('released', pastDate, pastDate, false);
    expect(state.canRelease).toBe(false);
    expect(state.canRefund).toBe(false);
  });
});

describe('calculateAutoReleaseDate', () => {
  it('adds 3 days to delivery date', () => {
    const delivered = '2026-03-20T12:00:00.000Z';
    const release = calculateAutoReleaseDate(delivered);
    expect(new Date(release).getDate()).toBe(new Date(delivered).getDate() + 3);
  });
});

describe('handleDisputeRefund', () => {
  let stripe: StripeClient;
  beforeEach(() => { stripe = createMockStripe(); });

  it('issues full refund for full_refund resolution', async () => {
    (stripe.refunds.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 're_dispute', status: 'succeeded', amount: 5000,
    });

    const result = await handleDisputeRefund(stripe, {
      paymentIntentId: 'pi_test123',
      paymentAmountCents: 5000,
      resolutionType: 'full_refund',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.refundAmountCents).toBe(5000);
      expect(result.data.isFullRefund).toBe(true);
    }
  });

  it('issues partial refund for partial_refund resolution', async () => {
    (stripe.refunds.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 're_partial', status: 'succeeded', amount: 2500,
    });

    const result = await handleDisputeRefund(stripe, {
      paymentIntentId: 'pi_test123',
      paymentAmountCents: 5000,
      resolutionType: 'partial_refund',
      proposedPartialCents: 2500,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.refundAmountCents).toBe(2500);
      expect(result.data.isFullRefund).toBe(false);
    }
  });

  it('returns zero refund for no_refund resolution without partial amount', async () => {
    const result = await handleDisputeRefund(stripe, {
      paymentIntentId: 'pi_test123',
      paymentAmountCents: 5000,
      resolutionType: 'no_refund',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.refundAmountCents).toBe(0);
      expect(result.data.refundId).toBe('');
    }
  });
});

describe('estimateFees', () => {
  it('estimates fees for seller-pays model', () => {
    const est = estimateFees(10000, 'seller');
    expect(est.amountCents).toBe(10000);
    expect(est.processingFeeCents).toBe(320);
    expect(est.sellerReceivesCents).toBe(10000 - 320);
    expect(est.buyerPaysCents).toBe(10000);
  });

  it('estimates fees for buyer-pays model', () => {
    const est = estimateFees(10000, 'buyer');
    expect(est.processingFeeCents).toBe(320);
    expect(est.sellerReceivesCents).toBe(10000);
    expect(est.buyerPaysCents).toBe(10320);
  });
});

describe('mapStripeStatusToPaymentStatus', () => {
  it('maps Stripe statuses to internal statuses', () => {
    expect(mapStripeStatusToPaymentStatus('requires_payment_method')).toBe('pending');
    expect(mapStripeStatusToPaymentStatus('requires_confirmation')).toBe('pending');
    expect(mapStripeStatusToPaymentStatus('processing')).toBe('processing');
    expect(mapStripeStatusToPaymentStatus('requires_capture')).toBe('processing');
    expect(mapStripeStatusToPaymentStatus('succeeded')).toBe('succeeded');
    expect(mapStripeStatusToPaymentStatus('canceled')).toBe('failed');
    expect(mapStripeStatusToPaymentStatus('unknown_status')).toBe('pending');
  });
});

// ── Webhook Tests ───────────────────────────────────────────────────

describe('verifyWebhookEvent', () => {
  it('returns event on valid signature', () => {
    const stripe = createMockStripe();
    const event = verifyWebhookEvent(stripe, '{}', 'sig_test', 'whsec_test');
    expect(event).not.toBeNull();
    expect(event?.id).toBe('evt_test123');
  });

  it('returns null on invalid signature', () => {
    const stripe = createMockStripe();
    (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const event = verifyWebhookEvent(stripe, '{}', 'bad_sig', 'whsec_test');
    expect(event).toBeNull();
  });
});

describe('processWebhookEvent', () => {
  it('handles payment_intent.succeeded', () => {
    const event: StripeWebhookEvent = {
      id: 'evt_1', type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_abc' } }, created: Date.now() / 1000,
    };
    const action = processWebhookEvent(event);
    expect(action.type).toBe('payment_status_update');
    if (action.type === 'payment_status_update') {
      expect(action.paymentIntentId).toBe('pi_abc');
      expect(action.status).toBe('succeeded');
    }
  });

  it('handles payment_intent.payment_failed', () => {
    const event: StripeWebhookEvent = {
      id: 'evt_2', type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_fail' } }, created: Date.now() / 1000,
    };
    const action = processWebhookEvent(event);
    expect(action.type).toBe('payment_status_update');
    if (action.type === 'payment_status_update') {
      expect(action.status).toBe('failed');
    }
  });

  it('handles charge.dispute.created', () => {
    const event: StripeWebhookEvent = {
      id: 'evt_3', type: 'charge.dispute.created',
      data: { object: { id: 'dp_1', payment_intent: 'pi_disputed', reason: 'fraudulent' } },
      created: Date.now() / 1000,
    };
    const action = processWebhookEvent(event);
    expect(action.type).toBe('dispute_opened');
    if (action.type === 'dispute_opened') {
      expect(action.stripeDisputeId).toBe('dp_1');
      expect(action.reason).toBe('fraudulent');
    }
  });

  it('handles charge.refunded', () => {
    const event: StripeWebhookEvent = {
      id: 'evt_4', type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_refunded', refunds: { data: [{ id: 're_1', amount: 3000 }] } } },
      created: Date.now() / 1000,
    };
    const action = processWebhookEvent(event);
    expect(action.type).toBe('refund_completed');
    if (action.type === 'refund_completed') {
      expect(action.amountCents).toBe(3000);
    }
  });

  it('handles account.updated', () => {
    const event: StripeWebhookEvent = {
      id: 'evt_5', type: 'account.updated',
      data: { object: { id: 'acct_1', charges_enabled: true, payouts_enabled: true, requirements: { currently_due: [] } } },
      created: Date.now() / 1000,
    };
    const action = processWebhookEvent(event);
    expect(action.type).toBe('account_updated');
    if (action.type === 'account_updated') {
      expect(action.status).toBe('active');
      expect(action.chargesEnabled).toBe(true);
    }
  });

  it('returns unhandled for unknown events', () => {
    const event: StripeWebhookEvent = {
      id: 'evt_6', type: 'some.unknown.event',
      data: { object: {} }, created: Date.now() / 1000,
    };
    const action = processWebhookEvent(event);
    expect(action.type).toBe('unhandled');
  });
});

describe('handleWebhook (end-to-end)', () => {
  it('verifies and processes a webhook event', () => {
    const stripe = createMockStripe();
    const action = handleWebhook(stripe, '{}', 'sig_test', 'whsec_test');
    expect(action).not.toBeNull();
    expect(action?.type).toBe('payment_status_update');
  });

  it('returns null for invalid signature', () => {
    const stripe = createMockStripe();
    (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const action = handleWebhook(stripe, '{}', 'bad_sig', 'whsec_test');
    expect(action).toBeNull();
  });
});
