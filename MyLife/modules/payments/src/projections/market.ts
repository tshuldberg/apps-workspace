import type {
  CurrencyCode,
} from '../types';
import type {
  PaymentsProjectionSourceBadge,
} from './types';

export type PaymentsMarketEscrowState =
  | 'not_started'
  | 'held'
  | 'released'
  | 'disputed'
  | 'refunded'
  | 'payout_pending'
  | 'payout_settled';

export interface PaymentsMarketCheckoutInput {
  orderId: string;
  listingId: string;
  buyerWalletId: string;
  sellerWalletId: string;
  amountCents: number;
  currency: CurrencyCode;
  escrowTransferId?: string | null;
  payoutIntentId?: string | null;
  disputeCaseId?: string | null;
  deepLink: string;
}

export interface PaymentsMarketCheckoutState {
  orderId: string;
  listingId: string;
  entryPointLabel: 'Buy with MyPay';
  escrowState: PaymentsMarketEscrowState;
  releaseAllowed: boolean;
  sellerPayoutState: 'not_ready' | 'pending' | 'settled';
  sourceBadge: PaymentsProjectionSourceBadge;
  marketOwnsFinancialTruth: false;
}

export function buildMarketMyPayCheckoutState(
  input: PaymentsMarketCheckoutInput,
): PaymentsMarketCheckoutState {
  const escrowState: PaymentsMarketEscrowState = input.disputeCaseId
    ? 'disputed'
    : input.payoutIntentId
      ? 'payout_pending'
      : input.escrowTransferId
        ? 'held'
        : 'not_started';

  return {
    orderId: input.orderId,
    listingId: input.listingId,
    entryPointLabel: 'Buy with MyPay',
    escrowState,
    releaseAllowed: escrowState === 'held',
    sellerPayoutState: input.payoutIntentId ? 'pending' : 'not_ready',
    sourceBadge: {
      label: 'MyPay',
      detail: input.escrowTransferId ?? 'Escrow not created',
      deepLink: input.deepLink,
    },
    marketOwnsFinancialTruth: false,
  };
}
