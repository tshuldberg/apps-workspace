/**
 * Dispute resolution state machine and helpers.
 *
 * State transitions:
 *   open -> seller_response (seller responds)
 *   open -> resolved_buyer  (auto-resolve after 3-day seller timeout)
 *   seller_response -> resolved_buyer  (seller accepts)
 *   seller_response -> resolved_seller (buyer accepts seller's counter)
 *   seller_response -> evidence_review (seller rejects with evidence)
 *   evidence_review -> resolved_buyer | resolved_seller | escalated
 *   escalated -> resolved_buyer | resolved_seller | closed
 */

import type { DisputeStatus, DisputeResolutionType } from '../types';

const VALID_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open: ['seller_response', 'resolved_buyer'],
  seller_response: ['resolved_buyer', 'resolved_seller', 'evidence_review'],
  evidence_review: ['resolved_buyer', 'resolved_seller', 'escalated'],
  escalated: ['resolved_buyer', 'resolved_seller', 'closed'],
  resolved_buyer: [],
  resolved_seller: [],
  closed: [],
};

/** Check whether a status transition is valid. */
export function isValidTransition(
  from: DisputeStatus,
  to: DisputeStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Filing window in days from payment date. */
export const FILING_WINDOW_DAYS = 14;

/** Seller response deadline in days from filing. */
export const SELLER_RESPONSE_DAYS = 3;

/** Auto-release countdown in days after delivery confirmation. */
export const AUTO_RELEASE_DAYS = 3;

/** Check if a dispute can still be filed for a payment. */
export function isWithinFilingWindow(paymentCreatedAt: string): boolean {
  const paymentDate = new Date(paymentCreatedAt);
  const now = new Date();
  const diffMs = now.getTime() - paymentDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= FILING_WINDOW_DAYS;
}

/** Check if seller response deadline has passed. */
export function isSellerResponseExpired(deadline: string): boolean {
  return new Date() > new Date(deadline);
}

/** Calculate the refund amount based on resolution type. */
export function calculateRefundAmount(
  resolutionType: DisputeResolutionType,
  paymentAmountCents: number,
  proposedPartialCents?: number,
): number {
  switch (resolutionType) {
    case 'full_refund':
    case 'return_and_refund':
      return paymentAmountCents;
    case 'partial_refund':
      return proposedPartialCents ?? 0;
    case 'no_refund':
    case 'mutual_agreement':
      return proposedPartialCents ?? 0;
  }
}

/** Calculate the seller response deadline from filing time. */
export function calculateResponseDeadline(filedAt: string): string {
  const date = new Date(filedAt);
  date.setDate(date.getDate() + SELLER_RESPONSE_DAYS);
  return date.toISOString();
}
