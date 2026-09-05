import type { MailMessage, NotificationPreferences, MailContact } from '../types';

export interface NotificationPayload {
  title: string;
  body: string;
  messageId: string;
  accountId: string;
}

/**
 * Build a notification payload from a new message.
 */
export function buildNotification(
  message: MailMessage,
  prefs: NotificationPreferences,
  senderContact?: MailContact | null,
): NotificationPayload {
  const senderName = senderContact?.displayName ?? message.from;
  const body = prefs.showPreview ? message.subject : 'New message';

  return {
    title: senderName,
    body,
    messageId: message.id,
    accountId: message.accountId,
  };
}

/**
 * Check if the current time is within quiet hours.
 * Handles midnight wrap-around (e.g., 22:00 to 07:00).
 * Times are in HH:MM format.
 */
export function isQuietHours(
  quietStart: string | null,
  quietEnd: string | null,
  currentTime?: string,
): boolean {
  if (!quietStart || !quietEnd) return false;

  const now = currentTime ?? new Date().toTimeString().slice(0, 5);

  if (quietStart <= quietEnd) {
    // Simple range: 09:00 to 17:00
    return now >= quietStart && now < quietEnd;
  } else {
    // Wraps midnight: 22:00 to 07:00
    return now >= quietStart || now < quietEnd;
  }
}

/**
 * Check if a message should trigger a notification based on preferences.
 */
export function shouldNotify(
  message: MailMessage,
  prefs: NotificationPreferences,
  contacts: MailContact[],
  currentTime?: string,
): boolean {
  if (!prefs.enabled) return false;

  if (isQuietHours(prefs.quietStart, prefs.quietEnd, currentTime)) return false;

  if (prefs.vipOnly) {
    const isVip = contacts.some(
      (c) => c.email.toLowerCase() === message.from.toLowerCase() && c.isVip,
    );
    if (!isVip) return false;
  }

  return true;
}

/**
 * Batch multiple messages into a single notification summary.
 */
export function batchNotification(
  messages: MailMessage[],
  accountEmail: string,
): NotificationPayload {
  if (messages.length === 1) {
    return {
      title: messages[0].from,
      body: messages[0].subject,
      messageId: messages[0].id,
      accountId: messages[0].accountId,
    };
  }

  return {
    title: `${messages.length} new messages`,
    body: `New mail for ${accountEmail}`,
    messageId: messages[0].id,
    accountId: messages[0].accountId,
  };
}
