import {
  createPaymentsDomainError,
} from './errors';
import type {
  PaymentsRequestStatus,
  PaymentsTransferEventType,
  PaymentsTransferStatus,
} from './types';

const VALID_TRANSFER_TRANSITIONS: Record<
  PaymentsTransferStatus,
  readonly PaymentsTransferStatus[]
> = {
  pending_review: ['pending_provider', 'processing', 'completed', 'failed', 'canceled'],
  pending_provider: ['processing', 'completed', 'failed', 'canceled'],
  processing: ['completed', 'failed', 'canceled', 'reversed'],
  completed: ['reversed', 'disputed'],
  failed: [],
  reversed: [],
  canceled: [],
  disputed: ['completed', 'reversed'],
};

const VALID_REQUEST_TRANSITIONS: Record<
  PaymentsRequestStatus,
  readonly PaymentsRequestStatus[]
> = {
  open: ['approved', 'declined', 'expired', 'canceled', 'paid'],
  approved: ['paid', 'expired', 'canceled'],
  declined: [],
  expired: [],
  canceled: [],
  paid: [],
};

export function canTransitionTransferStatus(
  from: PaymentsTransferStatus,
  to: PaymentsTransferStatus,
): boolean {
  return VALID_TRANSFER_TRANSITIONS[from].includes(to);
}

export function resolveTransferEventType(
  from: PaymentsTransferStatus | null,
  to: PaymentsTransferStatus,
): PaymentsTransferEventType {
  if (from === null) {
    if (to === 'pending_review') {
      return 'hold_applied';
    }
    return 'posted';
  }
  if (
    from === 'pending_review' &&
    (to === 'pending_provider' || to === 'processing' || to === 'completed')
  ) {
    return 'hold_released';
  }
  if (to === 'failed') {
    return 'failed';
  }
  if (to === 'canceled') {
    return 'canceled';
  }
  if (to === 'reversed') {
    return 'reversed';
  }
  if (from !== 'disputed' && to === 'disputed') {
    return 'dispute_opened';
  }
  if (from === 'disputed' && to !== 'disputed') {
    return 'dispute_closed';
  }
  return 'provider_update';
}

export function transitionTransferStatus(
  from: PaymentsTransferStatus,
  to: PaymentsTransferStatus,
): {
  fromStatus: PaymentsTransferStatus;
  toStatus: PaymentsTransferStatus;
  eventType: PaymentsTransferEventType;
} {
  if (!canTransitionTransferStatus(from, to)) {
    throw createPaymentsDomainError(
      'invalid_transition',
      `Illegal transfer transition: ${from} -> ${to}`,
      { from, to },
    );
  }

  return {
    fromStatus: from,
    toStatus: to,
    eventType: resolveTransferEventType(from, to),
  };
}

export function canTransitionRequestStatus(
  from: PaymentsRequestStatus,
  to: PaymentsRequestStatus,
): boolean {
  return VALID_REQUEST_TRANSITIONS[from].includes(to);
}

export function transitionRequestStatus(
  from: PaymentsRequestStatus,
  to: PaymentsRequestStatus,
): {
  fromStatus: PaymentsRequestStatus;
  toStatus: PaymentsRequestStatus;
} {
  if (!canTransitionRequestStatus(from, to)) {
    throw createPaymentsDomainError(
      'invalid_transition',
      `Illegal payment-request transition: ${from} -> ${to}`,
      { from, to },
    );
  }

  return {
    fromStatus: from,
    toStatus: to,
  };
}
