import type { ConsentRecord, ConsentStatus } from './types';

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'end', 'quit'];
const OPT_IN_KEYWORDS = ['start', 'yes', 'unstop', 'subscribe'];

export type ConsentAction = 'opt_in' | 'opt_out' | 'none';

/**
 * Detect consent action from message body.
 */
export function detectConsentAction(body: string): ConsentAction {
  const normalized = body.trim().toLowerCase();
  if (OPT_OUT_KEYWORDS.includes(normalized)) return 'opt_out';
  if (OPT_IN_KEYWORDS.includes(normalized)) return 'opt_in';
  return 'none';
}

/**
 * State machine for consent transitions.
 * Returns the new status after applying an action.
 */
export function transitionConsent(
  current: ConsentStatus,
  action: ConsentAction
): ConsentStatus {
  if (action === 'opt_out') return 'opted_out';
  if (action === 'opt_in') return 'opted_in';
  return current;
}

/**
 * Build a consent record from a transition.
 */
export function buildConsentRecord(
  phone: string,
  restaurantId: string,
  currentStatus: ConsentStatus,
  action: ConsentAction
): ConsentRecord {
  const newStatus = transitionConsent(currentStatus, action);
  const now = new Date();

  return {
    phone,
    restaurantId,
    status: newStatus,
    optedInAt: action === 'opt_in' ? now : undefined,
    optedOutAt: action === 'opt_out' ? now : undefined,
    method: 'sms_keyword',
  };
}

/**
 * Handle inbound consent keywords. Returns a response message if
 * a consent keyword was detected, or null otherwise.
 */
export function handleInboundConsent(
  body: string,
  phone: string,
  restaurantId: string
): string | null {
  const action = detectConsentAction(body);

  if (action === 'opt_out') {
    // In production: persist the consent record
    void buildConsentRecord(phone, restaurantId, 'opted_in', action);
    return 'You have been unsubscribed. Reply START to re-subscribe.';
  }

  if (action === 'opt_in') {
    void buildConsentRecord(phone, restaurantId, 'opted_out', action);
    return 'You have been re-subscribed to messages from this restaurant. Reply STOP to unsubscribe.';
  }

  return null;
}

/**
 * Check if a phone number has active consent for a restaurant.
 */
export function hasConsent(record: ConsentRecord | null): boolean {
  if (!record) return false;
  return record.status === 'opted_in';
}
