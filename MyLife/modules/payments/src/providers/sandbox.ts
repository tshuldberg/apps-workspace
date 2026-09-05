import {
  createProviderId,
  normalizeWebhookSuccess,
  providerFailure,
  providerSuccess,
} from './helpers';
import type {
  PaymentsProviderBundle,
  PaymentsProviderContext,
  PaymentsProviderProfile,
} from './types';

interface CapabilityMatrix {
  domestic: boolean;
  bankLink: boolean;
  cards: boolean;
}

const CAPABILITIES: Record<Exclude<PaymentsProviderProfile, 'fake'>, CapabilityMatrix> = {
  unit: {
    domestic: true,
    bankLink: true,
    cards: false,
  },
  stripe_treasury: {
    domestic: true,
    bankLink: false,
    cards: true,
  },
  synctera: {
    domestic: true,
    bankLink: true,
    cards: true,
  },
};

function futureIso(context: PaymentsProviderContext, minutes: number): string {
  return new Date(context.now().getTime() + minutes * 60_000).toISOString();
}

function unsupported(profile: PaymentsProviderProfile, rail: string) {
  return providerFailure(
    profile,
    'not_supported',
    `${profile} sandbox does not support ${rail}`,
  );
}

export function createSandboxPaymentsProviderBundle(
  profile: Exclude<PaymentsProviderProfile, 'fake'>,
): PaymentsProviderBundle {
  const capabilities = CAPABILITIES[profile];

  return {
    kind: 'sandbox',
    profile,
    domesticWallets: {
      providerName: profile,
      async createTransfer(request, context) {
        if (!capabilities.domestic) {
          return unsupported(profile, 'domestic transfers');
        }

        return providerSuccess(profile, {
          providerReference: `${profile}_sandbox_transfer_${request.ledgerTransactionId}`,
          state: request.amountCents >= 250_000 ? 'pending_review' : 'processing',
          submittedAt: context.now().toISOString(),
          estimatedCompletionAt: futureIso(context, 20),
        });
      },
      async createPayout(request, context) {
        if (!capabilities.domestic) {
          return unsupported(profile, 'payouts');
        }

        return providerSuccess(profile, {
          providerPayoutId: `${profile}_sandbox_payout_${request.payoutId}`,
          state: request.speed === 'instant' ? 'processing' : 'pending_provider',
          submittedAt: context.now().toISOString(),
          estimatedArrivalAt: futureIso(
            context,
            request.speed === 'instant' ? 30 : 24 * 60,
          ),
        });
      },
    },
    bankLinkFunding: {
      providerName: profile,
      async createLinkSession(request, context) {
        if (!capabilities.bankLink) {
          return unsupported(profile, 'bank linking');
        }

        return providerSuccess(profile, {
          linkSessionId: createProviderId(`${profile}_sandbox_link_session`),
          linkToken: `${profile}_sandbox_link_${request.ownerUserId}`,
          expiresAt: futureIso(context, 45),
        });
      },
      async createFundingIntent(request, context) {
        if (!capabilities.bankLink) {
          return unsupported(profile, 'funding intents');
        }

        return providerSuccess(profile, {
          providerFundingId: `${profile}_sandbox_funding_${request.walletId}`,
          state: 'pending_provider',
          submittedAt: context.now().toISOString(),
          expectedPostAt: futureIso(context, 120),
        });
      },
    },
    cardIssuing: {
      providerName: profile,
      async issueCard(request, context) {
        if (!capabilities.cards) {
          return unsupported(profile, 'card issuing');
        }

        return providerSuccess(profile, {
          providerCardId: createProviderId(`${profile}_sandbox_card`),
          status: request.cardType === 'virtual' ? 'active' : 'pending',
          network: profile === 'stripe_treasury' ? 'visa' : 'mastercard',
          last4: profile === 'synctera' ? '5274' : '4021',
          issuedAt: context.now().toISOString(),
        });
      },
      async openDispute(request, context) {
        if (!capabilities.cards) {
          return unsupported(profile, 'card disputes');
        }

        return providerSuccess(profile, {
          disputeReference: `${profile}_sandbox_dispute_${request.ledgerTransactionId}`,
          status: request.reason.toLowerCase().includes('fraud')
            ? 'review'
            : 'submitted',
          createdAt: context.now().toISOString(),
        });
      },
    },
    remittances: {
      providerName: 'future_remittance_partner',
      async quote(request, context) {
        const feeCents = Math.max(149, Math.round(request.sourceAmountCents * 0.01));
        return providerSuccess('future_remittance_partner', {
          quoteId: createProviderId('sandbox_remittance_quote'),
          exchangeRate:
            request.destinationCurrency === request.sourceCurrency
              ? '1.0000'
              : '0.9350',
          feeCents,
          destinationAmountCents: Math.max(
            0,
            Math.round((request.sourceAmountCents - feeCents) * 0.935),
          ),
          expiresAt: futureIso(context, 20),
        });
      },
      async settle(request, context) {
        return providerSuccess('future_remittance_partner', {
          providerRemittanceId: `sandbox_remit_${request.remittanceId}`,
          state: 'processing',
          submittedAt: context.now().toISOString(),
          expectedPayoutAt: futureIso(context, 180),
        });
      },
    },
    webhooks: {
      providerName: profile,
      async verifyAndNormalize(request, context) {
        if (
          request.providerName !== profile &&
          request.providerName !== 'future_remittance_partner'
        ) {
          return providerFailure(
            profile,
            'not_supported',
            `Sandbox bundle for ${profile} cannot verify ${request.providerName} events`,
          );
        }

        if (request.signature?.startsWith('bad')) {
          return providerFailure(
            request.providerName,
            'webhook_signature_invalid',
            `${request.providerName} sandbox webhook signature failed verification`,
          );
        }

        return normalizeWebhookSuccess(
          request.providerName,
          request.rawBody,
          context,
        );
      },
    },
    notifications: {
      providerName: 'sandbox',
      async deliver(request, context) {
        return providerSuccess('sandbox', {
          deliveryId: createProviderId('sandbox_delivery'),
          status: request.channel === 'email' ? 'queued' : 'sent',
          providerReference: `${profile}_sandbox_notify_${request.recipientUserId}`,
          deliveredAt:
            request.channel === 'email' ? null : context.now().toISOString(),
        });
      },
    },
  };
}

