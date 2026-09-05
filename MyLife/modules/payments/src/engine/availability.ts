import {
  assertPaymentsInvariant,
  createPaymentsDomainError,
} from './errors';
import type {
  PaymentsPostableTransferStatus,
  PaymentsWalletSnapshot,
} from './types';
import type { PaymentsBalanceBucket } from '../cloud/rpc';

export type PaymentsTransferFlow = 'internal' | 'fund' | 'withdraw';

export interface PaymentsBalanceBucketPlan {
  sourceBalanceBucket: PaymentsBalanceBucket;
  destinationBalanceBucket: PaymentsBalanceBucket;
}

export function getWalletBalance(
  wallet: PaymentsWalletSnapshot,
  bucket: PaymentsBalanceBucket,
): number {
  return wallet.balances[bucket] ?? 0;
}

export function resolveTransferBalanceBuckets(input: {
  flow: PaymentsTransferFlow;
  status: PaymentsPostableTransferStatus;
}): PaymentsBalanceBucketPlan {
  if (input.status === 'completed') {
    return {
      sourceBalanceBucket: 'available',
      destinationBalanceBucket: 'available',
    };
  }

  switch (input.flow) {
    case 'internal':
      return {
        sourceBalanceBucket: 'available',
        destinationBalanceBucket: 'pending',
      };
    case 'fund':
      return {
        sourceBalanceBucket: 'pending',
        destinationBalanceBucket: 'pending',
      };
    case 'withdraw':
      return {
        sourceBalanceBucket: 'available',
        destinationBalanceBucket: 'reserved',
      };
  }
}

export function assertWalletCanSend(options: {
  wallet: PaymentsWalletSnapshot;
  amountCents: number;
  feeCents?: number;
  balanceBucket?: PaymentsBalanceBucket;
}): void {
  const { wallet, amountCents, feeCents = 0, balanceBucket = 'available' } = options;
  const debitRequirement = amountCents + feeCents;
  const availableCents = getWalletBalance(wallet, balanceBucket);

  assertPaymentsInvariant(
    wallet.status === 'active' || wallet.status === 'restricted',
    'wallet_unavailable',
    'Source wallet is unavailable',
    { walletId: wallet.walletId, status: wallet.status },
  );

  if (wallet.complianceHold === 'send_only' || wallet.complianceHold === 'freeze') {
    throw createPaymentsDomainError(
      'compliance_hold',
      'Source wallet is on a send-blocking compliance hold',
      { walletId: wallet.walletId, hold: wallet.complianceHold },
    );
  }

  if (
    wallet.sendLimitRemainingCents !== null &&
    wallet.sendLimitRemainingCents !== undefined &&
    debitRequirement > wallet.sendLimitRemainingCents
  ) {
    throw createPaymentsDomainError(
      'limit_blocked',
      'Source wallet exceeds its send limit',
      {
        walletId: wallet.walletId,
        sendLimitRemainingCents: wallet.sendLimitRemainingCents,
        debitRequirement,
      },
    );
  }

  if (availableCents < debitRequirement) {
    throw createPaymentsDomainError(
      'insufficient_funds',
      'Source wallet does not have enough funds',
      {
        walletId: wallet.walletId,
        balanceBucket,
        availableCents,
        debitRequirement,
      },
    );
  }
}

export function assertWalletCanReceive(options: {
  wallet: PaymentsWalletSnapshot;
  amountCents: number;
}): void {
  const { wallet, amountCents } = options;

  assertPaymentsInvariant(
    wallet.status !== 'frozen' && wallet.status !== 'closed',
    'wallet_unavailable',
    'Destination wallet is unavailable',
    { walletId: wallet.walletId, status: wallet.status },
  );

  if (wallet.complianceHold === 'receive_only' || wallet.complianceHold === 'freeze') {
    throw createPaymentsDomainError(
      'compliance_hold',
      'Destination wallet is on a receive-blocking compliance hold',
      { walletId: wallet.walletId, hold: wallet.complianceHold },
    );
  }

  if (
    wallet.receiveLimitRemainingCents !== null &&
    wallet.receiveLimitRemainingCents !== undefined &&
    amountCents > wallet.receiveLimitRemainingCents
  ) {
    throw createPaymentsDomainError(
      'limit_blocked',
      'Destination wallet exceeds its receive limit',
      {
        walletId: wallet.walletId,
        receiveLimitRemainingCents: wallet.receiveLimitRemainingCents,
        amountCents,
      },
    );
  }
}

