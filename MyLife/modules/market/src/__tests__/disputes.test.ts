import { describe, expect, it } from 'vitest';
import {
  isValidTransition,
  isWithinFilingWindow,
  calculateRefundAmount,
  calculateResponseDeadline,
  FILING_WINDOW_DAYS,
  SELLER_RESPONSE_DAYS,
} from '../disputes/engine';

describe('isValidTransition', () => {
  it('allows open -> seller_response', () => {
    expect(isValidTransition('open', 'seller_response')).toBe(true);
  });

  it('allows open -> resolved_buyer (auto-resolve)', () => {
    expect(isValidTransition('open', 'resolved_buyer')).toBe(true);
  });

  it('allows seller_response -> resolved_buyer', () => {
    expect(isValidTransition('seller_response', 'resolved_buyer')).toBe(true);
  });

  it('allows seller_response -> evidence_review', () => {
    expect(isValidTransition('seller_response', 'evidence_review')).toBe(true);
  });

  it('rejects resolved_buyer -> open (terminal state)', () => {
    expect(isValidTransition('resolved_buyer', 'open')).toBe(false);
  });

  it('rejects closed -> open (terminal state)', () => {
    expect(isValidTransition('closed', 'open')).toBe(false);
  });

  it('rejects open -> evidence_review (must go through seller_response)', () => {
    expect(isValidTransition('open', 'evidence_review')).toBe(false);
  });
});

describe('isWithinFilingWindow', () => {
  it('returns true for recent payment', () => {
    const recent = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(); // 5 days ago
    expect(isWithinFilingWindow(recent)).toBe(true);
  });

  it('returns false for old payment', () => {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(); // 20 days ago
    expect(isWithinFilingWindow(old)).toBe(false);
  });

  it('returns true at exactly 14 days', () => {
    const exact = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString();
    expect(isWithinFilingWindow(exact)).toBe(true);
  });
});

describe('calculateRefundAmount', () => {
  it('returns full amount for full_refund', () => {
    expect(calculateRefundAmount('full_refund', 5000)).toBe(5000);
  });

  it('returns full amount for return_and_refund', () => {
    expect(calculateRefundAmount('return_and_refund', 5000)).toBe(5000);
  });

  it('returns partial amount for partial_refund', () => {
    expect(calculateRefundAmount('partial_refund', 5000, 2500)).toBe(2500);
  });

  it('returns 0 for no_refund without proposal', () => {
    expect(calculateRefundAmount('no_refund', 5000)).toBe(0);
  });

  it('returns proposed amount for mutual_agreement', () => {
    expect(calculateRefundAmount('mutual_agreement', 5000, 3000)).toBe(3000);
  });
});

describe('calculateResponseDeadline', () => {
  it('adds SELLER_RESPONSE_DAYS to filed date', () => {
    const filed = '2026-03-20T12:00:00.000Z';
    const deadline = new Date(calculateResponseDeadline(filed));
    const expected = new Date(filed);
    expected.setDate(expected.getDate() + SELLER_RESPONSE_DAYS);
    expect(deadline.toISOString()).toBe(expected.toISOString());
  });
});

describe('constants', () => {
  it('has correct filing window', () => {
    expect(FILING_WINDOW_DAYS).toBe(14);
  });

  it('has correct seller response days', () => {
    expect(SELLER_RESPONSE_DAYS).toBe(3);
  });
});
