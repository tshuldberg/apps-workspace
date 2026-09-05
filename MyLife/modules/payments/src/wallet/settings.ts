import {
  createPaymentsDisclosureCallout,
  formatPaymentsMoney,
} from '../compliance/disclosures/content';
import {
  buildPaymentsLegalCopyBlocks,
} from '../compliance/disclosures/legal';
import type {
  PaymentsLegalCopyBlock,
} from '../compliance/disclosures/types';
import type {
  PaymentsPaymentProfile,
} from '../compliance/types';
import type {
  PaymentsWalletSnapshot,
} from '../engine/types';
import type {
  CurrencyCode,
  PaymentCounterparty,
  PaymentDisclosure,
  PaymentVerificationState,
} from '../types';

export type PaymentsDiscoverability = 'public_handle' | 'contacts_only' | 'private';
export type PaymentsPreferredContactMethod = 'handle' | 'phone' | 'email';
export type PaymentsNotificationChannel = 'push' | 'email' | 'sms';
export type PaymentsNotificationTopic =
  | 'payments'
  | 'requests'
  | 'disputes'
  | 'funding'
  | 'marketing';

export interface PaymentsVerifiedIdentifier {
  id: string;
  kind: PaymentsPreferredContactMethod;
  label: string;
  value: string;
  verificationState: PaymentVerificationState;
  preferred: boolean;
}

export interface PaymentsNotificationPreference {
  topic: PaymentsNotificationTopic;
  channel: PaymentsNotificationChannel;
  enabled: boolean;
}

export interface PaymentsSelfImposedLimit {
  id: string;
  label: string;
  amountCents: number;
  currency: CurrencyCode;
  complianceLimitCents: number | null;
}

export interface PaymentsFeeScheduleLine {
  id: string;
  label: string;
  value: string;
  disclosure: string;
}

export interface PaymentsWalletCloseState {
  exportReady: boolean;
  availableBalanceCents: number;
  pendingBalanceCents: number;
  canClose: boolean;
  reason: string | null;
}

export interface PaymentsSettingsSnapshot {
  profile: PaymentsPaymentProfile | null;
  wallet: PaymentsWalletSnapshot | null;
  discoverability: PaymentsDiscoverability;
  identifiers: PaymentsVerifiedIdentifier[];
  preferredContactMethod: PaymentsPreferredContactMethod;
  contacts: PaymentCounterparty[];
  favoriteCounterpartyIds: string[];
  notifications: PaymentsNotificationPreference[];
  selfImposedLimits: PaymentsSelfImposedLimit[];
  feeSchedule: PaymentsFeeScheduleLine[];
  walletClose: Pick<PaymentsWalletCloseState, 'exportReady'>;
  locale?: string;
  generatedAt: string;
  productName?: string | null;
  partnerBankName?: string | null;
  custodialEntityName?: string | null;
  supportContact?: string | null;
}

export interface PaymentsSettingsSectionLine {
  id: string;
  label: string;
  value: string;
  helper: string | null;
}

export interface PaymentsSettingsViewModel {
  title: 'Settings';
  profileHeader: {
    handle: string;
    displayName: string;
    tierLabel: string;
    restrictionDisclosure: PaymentDisclosure | null;
  };
  discoverability: {
    selected: PaymentsDiscoverability;
    label: string;
    helper: string;
  };
  identifiers: PaymentsSettingsSectionLine[];
  contacts: Array<PaymentCounterparty & { favorite: boolean }>;
  notifications: PaymentsSettingsSectionLine[];
  limits: {
    product: PaymentsSettingsSectionLine[];
    compliance: PaymentsSettingsSectionLine[];
    disclosure: PaymentDisclosure;
  };
  feeSchedule: PaymentsFeeScheduleLine[];
  walletClose: PaymentsWalletCloseState;
  legalCopyBlocks: PaymentsLegalCopyBlock[];
}

function discoverabilityLabel(value: PaymentsDiscoverability): {
  label: string;
  helper: string;
} {
  switch (value) {
    case 'public_handle':
      return {
        label: 'Public handle',
        helper: 'People can find you by handle, but private identifiers stay hidden.',
      };
    case 'contacts_only':
      return {
        label: 'Contacts only',
        helper: 'People already in your contacts can find your MyPay profile.',
      };
    case 'private':
      return {
        label: 'Private',
        helper: 'New counterparties need a direct request, link, or QR handoff.',
      };
  }
}

function tierLabel(profile: PaymentsPaymentProfile | null): string {
  if (!profile) {
    return 'No profile';
  }
  return `${profile.tierAssessment.approvedTier} tier`;
}

function walletRestrictionDisclosure(
  wallet: PaymentsWalletSnapshot | null,
): PaymentDisclosure | null {
  if (!wallet || wallet.status === 'active') {
    return null;
  }
  return createPaymentsDisclosureCallout({
    id: 'settings_wallet_restricted',
    tone: wallet.status === 'closed' ? 'danger' : 'warning',
    title: 'Wallet restriction',
    body: 'Some settings and money movement actions are read-only until this wallet state clears.',
  });
}

function notificationLabel(topic: PaymentsNotificationTopic): string {
  switch (topic) {
    case 'payments':
      return 'Payments';
    case 'requests':
      return 'Requests';
    case 'disputes':
      return 'Disputes';
    case 'funding':
      return 'Funding and withdrawals';
    case 'marketing':
      return 'Product updates';
  }
}

function channelLabel(channel: PaymentsNotificationChannel): string {
  switch (channel) {
    case 'push':
      return 'Push';
    case 'email':
      return 'Email';
    case 'sms':
      return 'SMS';
  }
}

function closeState(input: PaymentsSettingsSnapshot): PaymentsWalletCloseState {
  const available = input.wallet?.balances.available ?? 0;
  const pending = input.wallet?.balances.pending ?? 0;
  const canClose = input.walletClose.exportReady && available === 0 && pending === 0;
  return {
    exportReady: input.walletClose.exportReady,
    availableBalanceCents: available,
    pendingBalanceCents: pending,
    canClose,
    reason: canClose
      ? null
      : !input.walletClose.exportReady
        ? 'Export transaction history before closing the wallet.'
        : available > 0
          ? 'Withdraw available balance before closing the wallet.'
          : 'Wait for pending funds to settle or return before closing the wallet.',
  };
}

function legalCopy(snapshot: PaymentsSettingsSnapshot): PaymentsLegalCopyBlock[] {
  return buildPaymentsLegalCopyBlocks({
    blockIds: [
      'stored_balance',
      'partner_bank',
      'custodial_account',
      'error_resolution',
    ],
    locale: snapshot.locale,
    generatedAt: snapshot.generatedAt,
    surfaces: ['mobile'],
    productName: snapshot.productName,
    partnerBankName: snapshot.partnerBankName,
    custodialEntityName: snapshot.custodialEntityName,
    supportContact: snapshot.supportContact,
  });
}

export function buildPaymentsSettingsViewModel(
  snapshot: PaymentsSettingsSnapshot,
): PaymentsSettingsViewModel {
  const discoverability = discoverabilityLabel(snapshot.discoverability);
  const contactFavorites = new Set(snapshot.favoriteCounterpartyIds);
  const close = closeState(snapshot);

  return {
    title: 'Settings',
    profileHeader: {
      handle: snapshot.profile?.handle ?? 'Handle not set',
      displayName: snapshot.profile?.displayName ?? 'MyPay profile',
      tierLabel: tierLabel(snapshot.profile),
      restrictionDisclosure: walletRestrictionDisclosure(snapshot.wallet),
    },
    discoverability: {
      selected: snapshot.discoverability,
      label: discoverability.label,
      helper: discoverability.helper,
    },
    identifiers: snapshot.identifiers.map((identifier) => ({
      id: identifier.id,
      label: identifier.label,
      value: identifier.value,
      helper: `${identifier.verificationState}${identifier.preferred ? ' · preferred' : ''}`,
    })),
    contacts: snapshot.contacts.map((contact) => ({
      ...contact,
      favorite: contactFavorites.has(contact.id),
    })),
    notifications: snapshot.notifications.map((preference) => ({
      id: `${preference.topic}:${preference.channel}`,
      label: notificationLabel(preference.topic),
      value: `${channelLabel(preference.channel)} ${preference.enabled ? 'on' : 'off'}`,
      helper: null,
    })),
    limits: {
      product: snapshot.selfImposedLimits.map((limit) => ({
        id: limit.id,
        label: limit.label,
        value: formatPaymentsMoney(limit.amountCents, limit.currency, snapshot.locale),
        helper: 'Self-imposed product limit',
      })),
      compliance: snapshot.selfImposedLimits.map((limit) => ({
        id: `${limit.id}:compliance`,
        label: limit.label,
        value:
          limit.complianceLimitCents === null
            ? 'Not disclosed'
            : formatPaymentsMoney(limit.complianceLimitCents, limit.currency, snapshot.locale),
        helper: 'Compliance ceiling',
      })),
      disclosure: createPaymentsDisclosureCallout({
        id: 'settings_limits_split',
        tone: 'info',
        title: 'Product and compliance limits are separate',
        body: 'Self-imposed limits can be stricter than compliance limits, but they never raise compliance ceilings.',
      }),
    },
    feeSchedule: snapshot.feeSchedule,
    walletClose: close,
    legalCopyBlocks: legalCopy(snapshot),
  };
}
