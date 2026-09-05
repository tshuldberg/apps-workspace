import {
  createStableFingerprint,
} from './engine/idempotency';
import type {
  PaymentsTransferStatus,
} from './engine/types';
import type {
  CurrencyCode,
  PaymentDisclosure,
} from './types';
import {
  createPaymentsDisclosureCallout,
  formatPaymentsMoney,
} from './compliance/disclosures/content';

export type PaymentsCardForm = 'virtual' | 'physical';
export type PaymentsCardStatus = 'not_issued' | 'active' | 'frozen' | 'replaced' | 'closed';
export type PaymentsCardProvisioningProvider = 'apple_pay' | 'google_pay';

export interface PaymentsCardRecord {
  cardId: string;
  form: PaymentsCardForm;
  status: PaymentsCardStatus;
  maskedLabel: string;
  holderName: string;
  spendLimitCents: number;
  currency: CurrencyCode;
  physicalOrderStatus?: 'not_ordered' | 'ordered' | 'shipped' | 'delivered' | 'replaced';
  provisioningProviders: PaymentsCardProvisioningProvider[];
}

export interface PaymentsCardTransaction {
  transactionId: string;
  cardId: string;
  merchantName: string;
  merchantCategoryCode: string;
  amountCents: number;
  currency: CurrencyCode;
  status: Extract<PaymentsTransferStatus, 'pending_provider' | 'completed' | 'failed' | 'reversed' | 'disputed'>;
  authorizedAt: string;
  postedAt?: string | null;
  transferId: string | null;
}

export interface PaymentsCardManagementViewModel {
  title: 'Card';
  card: PaymentsCardRecord | null;
  maskedDisplay: string;
  revealRequiresBiometric: boolean;
  sensitiveDataStoredByMyLife: false;
  actions: Array<{
    id: 'issue_virtual' | 'order_physical' | 'freeze' | 'unfreeze' | 'replace';
    label: string;
    enabled: boolean;
  }>;
  provisioning: Array<{
    provider: PaymentsCardProvisioningProvider;
    label: string;
    enabled: boolean;
  }>;
  disclosure: PaymentDisclosure;
}

export interface PaymentsCardActivityRow {
  id: string;
  merchantName: string;
  amountLabel: string;
  settlementLabel: string;
  budgetCategory: string;
  myPayDetailLink: string;
  disputeEntryEnabled: boolean;
}

export interface PaymentsMerchantQrPayload {
  version: 1;
  mode: 'merchant' | 'peer_receive';
  payeeWalletId: string;
  amountCents: number | null;
  currency: CurrencyCode;
  expiresAt: string;
  nonce: string;
  fingerprint: string;
}

export function buildPaymentsCardManagementViewModel(input: {
  card: PaymentsCardRecord | null;
}): PaymentsCardManagementViewModel {
  const card = input.card;
  const frozen = card?.status === 'frozen';

  return {
    title: 'Card',
    card,
    maskedDisplay: card?.maskedLabel ?? 'No card issued',
    revealRequiresBiometric: true,
    sensitiveDataStoredByMyLife: false,
    actions: [
      {
        id: 'issue_virtual',
        label: 'Issue virtual card',
        enabled: card === null,
      },
      {
        id: 'order_physical',
        label: 'Order physical card',
        enabled: card !== null && card.physicalOrderStatus === 'not_ordered',
      },
      {
        id: frozen ? 'unfreeze' : 'freeze',
        label: frozen ? 'Unfreeze card' : 'Freeze card',
        enabled: card !== null && (card.status === 'active' || card.status === 'frozen'),
      },
      {
        id: 'replace',
        label: 'Replace card',
        enabled: card !== null && card.status !== 'closed',
      },
    ],
    provisioning: (['apple_pay', 'google_pay'] as const).map((provider) => ({
      provider,
      label: provider === 'apple_pay' ? 'Add to Apple Pay' : 'Add to Google Pay',
      enabled: card?.status === 'active' && card.provisioningProviders.includes(provider),
    })),
    disclosure: createPaymentsDisclosureCallout({
      id: 'card_token_first',
      tone: 'info',
      title: 'Token-first card boundary',
      body: 'PAN and sensitive authentication data stay with the issuing provider wherever possible.',
    }),
  };
}

export function mapMccToBudgetCategory(mcc: string): string {
  if (mcc.startsWith('54') || mcc === '5812') {
    return 'Groceries and dining';
  }
  if (mcc.startsWith('59')) {
    return 'Shopping';
  }
  if (mcc.startsWith('41') || mcc.startsWith('47')) {
    return 'Travel and transit';
  }
  return 'Card purchase';
}

export function buildPaymentsCardActivityRows(input: {
  transactions: PaymentsCardTransaction[];
  locale?: string;
}): PaymentsCardActivityRow[] {
  return input.transactions.map((transaction) => ({
    id: transaction.transactionId,
    merchantName: transaction.merchantName,
    amountLabel: formatPaymentsMoney(transaction.amountCents, transaction.currency, input.locale),
    settlementLabel:
      transaction.status === 'pending_provider'
        ? 'Pending authorization'
        : transaction.status === 'completed'
          ? 'Posted settlement'
          : transaction.status,
    budgetCategory: mapMccToBudgetCategory(transaction.merchantCategoryCode),
    myPayDetailLink: transaction.transferId
      ? `/(payments)/${transaction.transferId}`
      : `/(payments)/card-transactions?cardTransactionId=${transaction.transactionId}`,
    disputeEntryEnabled: transaction.status === 'completed' || transaction.status === 'disputed',
  }));
}

export function buildPaymentsMerchantQrPayload(input: {
  mode: PaymentsMerchantQrPayload['mode'];
  payeeWalletId: string;
  amountCents?: number | null;
  currency: CurrencyCode;
  expiresAt: string;
  nonce: string;
}): PaymentsMerchantQrPayload {
  const unsigned = {
    version: 1,
    mode: input.mode,
    payeeWalletId: input.payeeWalletId,
    amountCents: input.amountCents ?? null,
    currency: input.currency,
    expiresAt: input.expiresAt,
    nonce: input.nonce,
  };

  return {
    ...unsigned,
    version: 1,
    fingerprint: createStableFingerprint(unsigned),
  };
}
