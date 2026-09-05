import { describe, expect, it } from 'vitest';

import {
  canTransitionRequestStatus,
  canTransitionTransferStatus,
  resolveTransferEventType,
  transitionRequestStatus,
  transitionTransferStatus,
} from '../index';
import { PaymentsDomainError } from '../errors';

describe('payments transfer fsm', () => {
  it('allows the legal provider and dispute transitions', () => {
    expect(canTransitionTransferStatus('pending_provider', 'processing')).toBe(true);
    expect(canTransitionTransferStatus('completed', 'disputed')).toBe(true);
    expect(canTransitionTransferStatus('disputed', 'completed')).toBe(true);
    expect(canTransitionTransferStatus('pending_review', 'completed')).toBe(true);

    expect(
      transitionTransferStatus('pending_provider', 'processing'),
    ).toEqual({
      fromStatus: 'pending_provider',
      toStatus: 'processing',
      eventType: 'provider_update',
    });

    expect(
      transitionTransferStatus('completed', 'disputed'),
    ).toEqual({
      fromStatus: 'completed',
      toStatus: 'disputed',
      eventType: 'dispute_opened',
    });

    expect(
      transitionTransferStatus('pending_review', 'completed'),
    ).toEqual({
      fromStatus: 'pending_review',
      toStatus: 'completed',
      eventType: 'hold_released',
    });

    expect(
      transitionTransferStatus('disputed', 'completed'),
    ).toEqual({
      fromStatus: 'disputed',
      toStatus: 'completed',
      eventType: 'dispute_closed',
    });
  });

  it('uses hold event types when a review is applied before posting', () => {
    expect(resolveTransferEventType(null, 'pending_review')).toBe('hold_applied');
  });

  it('rejects illegal transfer transitions', () => {
    expect(canTransitionTransferStatus('completed', 'pending_provider')).toBe(false);

    expect(() =>
      transitionTransferStatus('completed', 'pending_provider'),
    ).toThrow(PaymentsDomainError);

    try {
      transitionTransferStatus('completed', 'pending_provider');
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentsDomainError);
      expect((error as PaymentsDomainError).code).toBe('invalid_transition');
    }
  });
});

describe('payments request fsm', () => {
  it('allows the legal payment-request transitions', () => {
    expect(canTransitionRequestStatus('open', 'paid')).toBe(true);
    expect(canTransitionRequestStatus('approved', 'paid')).toBe(true);

    expect(
      transitionRequestStatus('open', 'approved'),
    ).toEqual({
      fromStatus: 'open',
      toStatus: 'approved',
    });
  });

  it('rejects illegal payment-request transitions', () => {
    expect(canTransitionRequestStatus('paid', 'approved')).toBe(false);

    try {
      transitionRequestStatus('paid', 'approved');
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentsDomainError);
      expect((error as PaymentsDomainError).code).toBe('invalid_transition');
    }
  });
});
