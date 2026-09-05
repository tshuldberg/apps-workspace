import {
  providerFailure,
} from './helpers';
import type {
  BankLinkFundingRail,
  CardIssuingRail,
  DomesticWalletRail,
  NotificationDeliveryHook,
  PaymentsProviderBundle,
  PaymentsProviderProfile,
  PaymentsRemittanceProviderName,
  RemittanceSettlementRail,
  WebhookVerificationRail,
} from './types';

export interface PaymentsProviderOverrides {
  domesticWallets?: DomesticWalletRail;
  bankLinkFunding?: BankLinkFundingRail;
  cardIssuing?: CardIssuingRail;
  remittances?: RemittanceSettlementRail;
  webhooks?: WebhookVerificationRail;
  notifications?: NotificationDeliveryHook;
}

function createUnavailableDomesticRail(
  profile: Exclude<PaymentsProviderProfile, 'fake'>,
): DomesticWalletRail {
  return {
    providerName: profile,
    async createTransfer() {
      return providerFailure(
        profile,
        'not_configured',
        `${profile} domestic transfer adapter must be injected from server-only code`,
      );
    },
    async createPayout() {
      return providerFailure(
        profile,
        'not_configured',
        `${profile} payout adapter must be injected from server-only code`,
      );
    },
  };
}

function createUnavailableBankRail(
  profile: Exclude<PaymentsProviderProfile, 'fake'>,
): BankLinkFundingRail {
  return {
    providerName: profile,
    async createLinkSession() {
      return providerFailure(
        profile,
        'not_configured',
        `${profile} bank-link adapter must be injected from server-only code`,
      );
    },
    async createFundingIntent() {
      return providerFailure(
        profile,
        'not_configured',
        `${profile} funding adapter must be injected from server-only code`,
      );
    },
  };
}

function createUnavailableCardRail(
  profile: Exclude<PaymentsProviderProfile, 'fake'>,
): CardIssuingRail {
  return {
    providerName: profile,
    async issueCard() {
      return providerFailure(
        profile,
        'not_configured',
        `${profile} card-issuing adapter must be injected from server-only code`,
      );
    },
    async openDispute() {
      return providerFailure(
        profile,
        'not_configured',
        `${profile} dispute adapter must be injected from server-only code`,
      );
    },
  };
}

function createUnavailableRemittanceRail(
  providerName: PaymentsRemittanceProviderName,
): RemittanceSettlementRail {
  return {
    providerName,
    async quote() {
      return providerFailure(
        providerName,
        'not_configured',
        `${providerName} remittance adapter must be injected from server-only code`,
      );
    },
    async settle() {
      return providerFailure(
        providerName,
        'not_configured',
        `${providerName} remittance adapter must be injected from server-only code`,
      );
    },
  };
}

function createUnavailableWebhookRail(
  profile: Exclude<PaymentsProviderProfile, 'fake'>,
): WebhookVerificationRail {
  return {
    providerName: profile,
    async verifyAndNormalize() {
      return providerFailure(
        profile,
        'not_configured',
        `${profile} webhook verifier must be injected from server-only code`,
      );
    },
  };
}

function createNoopNotificationHook(): NotificationDeliveryHook {
  return {
    providerName: 'noop',
    async deliver() {
      return providerFailure(
        'noop',
        'not_configured',
        'Notification delivery hook must be injected from server-only code',
      );
    },
  };
}

export function createLivePaymentsProviderBundle(options: {
  profile: Exclude<PaymentsProviderProfile, 'fake'>;
  remittanceProviderName?: PaymentsRemittanceProviderName;
  overrides?: PaymentsProviderOverrides;
}): PaymentsProviderBundle {
  return {
    kind: 'live',
    profile: options.profile,
    domesticWallets:
      options.overrides?.domesticWallets ??
      createUnavailableDomesticRail(options.profile),
    bankLinkFunding:
      options.overrides?.bankLinkFunding ??
      createUnavailableBankRail(options.profile),
    cardIssuing:
      options.overrides?.cardIssuing ??
      createUnavailableCardRail(options.profile),
    remittances:
      options.overrides?.remittances ??
      createUnavailableRemittanceRail(
        options.remittanceProviderName ?? 'future_remittance_partner',
      ),
    webhooks:
      options.overrides?.webhooks ??
      createUnavailableWebhookRail(options.profile),
    notifications:
      options.overrides?.notifications ??
      createNoopNotificationHook(),
  };
}

export function createUnitPaymentsProviderBundle(
  overrides?: PaymentsProviderOverrides,
): PaymentsProviderBundle {
  return createLivePaymentsProviderBundle({
    profile: 'unit',
    overrides,
  });
}

export function createStripeTreasuryPaymentsProviderBundle(
  overrides?: PaymentsProviderOverrides,
): PaymentsProviderBundle {
  return createLivePaymentsProviderBundle({
    profile: 'stripe_treasury',
    overrides,
  });
}

export function createSyncteraPaymentsProviderBundle(
  overrides?: PaymentsProviderOverrides,
): PaymentsProviderBundle {
  return createLivePaymentsProviderBundle({
    profile: 'synctera',
    overrides,
  });
}

