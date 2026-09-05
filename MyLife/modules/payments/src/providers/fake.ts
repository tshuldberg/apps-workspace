import {
  createNormalizedEventId,
  createProviderId,
  normalizeWebhookSuccess,
  providerFailure,
  providerSuccess,
} from './helpers';
import type {
  PaymentsProviderBundle,
  PaymentsProviderContext,
} from './types';

function futureIso(context: PaymentsProviderContext, minutes: number): string {
  return new Date(context.now().getTime() + minutes * 60_000).toISOString();
}

export function createFakePaymentsProviderBundle(): PaymentsProviderBundle {
  return {
    kind: 'fake',
    profile: 'fake',
    domesticWallets: {
      providerName: 'fake',
      async createTransfer(request, context) {
        const state =
          request.amountCents >= 100_000 ? 'pending_review' : 'pending_provider';
        return providerSuccess('fake', {
          providerReference: `fake_transfer_${request.ledgerTransactionId}`,
          state,
          submittedAt: context.now().toISOString(),
          estimatedCompletionAt:
            state === 'pending_review' ? null : futureIso(context, 10),
        });
      },
      async createPayout(request, context) {
        return providerSuccess('fake', {
          providerPayoutId: `fake_payout_${request.payoutId}`,
          state: request.speed === 'instant' ? 'processing' : 'pending_provider',
          submittedAt: context.now().toISOString(),
          estimatedArrivalAt: futureIso(
            context,
            request.speed === 'instant' ? 15 : 24 * 60,
          ),
        });
      },
    },
    bankLinkFunding: {
      providerName: 'fake',
      async createLinkSession(request, context) {
        return providerSuccess('fake', {
          linkSessionId: createProviderId('fake_link_session'),
          linkToken: `fake_link_${request.ownerUserId}`,
          expiresAt: futureIso(context, 30),
        });
      },
      async createFundingIntent(request, context) {
        return providerSuccess('fake', {
          providerFundingId: `fake_funding_${request.walletId}`,
          state: 'pending_provider',
          submittedAt: context.now().toISOString(),
          expectedPostAt: futureIso(context, 60),
        });
      },
    },
    cardIssuing: {
      providerName: 'fake',
      async issueCard(request, context) {
        return providerSuccess('fake', {
          providerCardId: createProviderId('fake_card'),
          status: request.cardType === 'virtual' ? 'active' : 'pending',
          network: 'visa',
          last4: '4242',
          issuedAt: context.now().toISOString(),
        });
      },
      async openDispute(request, context) {
        return providerSuccess('fake', {
          disputeReference: `fake_dispute_${request.ledgerTransactionId}`,
          status: request.reason.toLowerCase().includes('fraud')
            ? 'review'
            : 'submitted',
          createdAt: context.now().toISOString(),
        });
      },
    },
    remittances: {
      providerName: 'fake',
      async quote(request, context) {
        const feeCents = Math.max(199, Math.round(request.sourceAmountCents * 0.0125));
        const netCents = Math.max(0, request.sourceAmountCents - feeCents);
        return providerSuccess('fake', {
          quoteId: createProviderId('fake_quote'),
          exchangeRate:
            request.destinationCurrency === request.sourceCurrency
              ? '1.0000'
              : '0.9200',
          feeCents,
          destinationAmountCents:
            request.destinationCurrency === request.sourceCurrency
              ? netCents
              : Math.round(netCents * 0.92),
          expiresAt: futureIso(context, 15),
        });
      },
      async settle(request, context) {
        return providerSuccess('fake', {
          providerRemittanceId: `fake_remit_${request.remittanceId}`,
          state: 'processing',
          submittedAt: context.now().toISOString(),
          expectedPayoutAt: futureIso(context, 90),
        });
      },
    },
    webhooks: {
      providerName: 'fake',
      async verifyAndNormalize(request, context) {
        if (request.signature?.startsWith('bad')) {
          return providerFailure(
            request.providerName,
            'webhook_signature_invalid',
            'Fake webhook signature failed verification',
          );
        }

        const normalized = normalizeWebhookSuccess(
          request.providerName,
          request.rawBody,
          context,
        );
        if (!normalized.ok) {
          return normalized;
        }

        const payload = normalized.data.normalizedEvent.payload;
        return providerSuccess(request.providerName, {
          ...normalized.data,
          normalizedEvent: {
            ...normalized.data.normalizedEvent,
            providerEventId: createNormalizedEventId(
              payload,
              `${request.providerName}_event`,
            ),
          },
        });
      },
    },
    notifications: {
      providerName: 'fake',
      async deliver(request, context) {
        return providerSuccess('fake', {
          deliveryId: createProviderId('fake_delivery'),
          status: request.channel === 'in_app' ? 'sent' : 'queued',
          providerReference: `fake_notify_${request.recipientUserId}`,
          deliveredAt:
            request.channel === 'in_app' ? context.now().toISOString() : null,
        });
      },
    },
  };
}

