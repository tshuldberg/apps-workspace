import type { NotificationPayload, ReminderConfig } from './types';

export function buildNotificationContent(
  dueCount: number,
  currentStreak: number,
  includeStreak: boolean,
): NotificationPayload | null {
  if (dueCount <= 0) return null;

  let body: string;
  if (includeStreak && currentStreak > 0) {
    body = `Keep your ${currentStreak}-day streak alive! ${dueCount} card${dueCount === 1 ? '' : 's'} due.`;
  } else {
    body = `You have ${dueCount} card${dueCount === 1 ? '' : 's'} due for review.`;
  }

  return {
    title: 'MyFlash',
    body,
    data: { screen: 'flash/study' },
  };
}

export function parseReminderConfig(
  enabled: string | null,
  time: string | null,
  includeStreak: string | null,
  deckFilter: string | null,
): ReminderConfig {
  return {
    enabled: enabled === '1',
    time: time ?? '09:00',
    includeStreak: includeStreak !== '0',
    deckFilter: deckFilter ?? 'all',
  };
}

export function filterDueByDecks(
  allDue: Array<{ deckId: string }>,
  deckFilter: string,
): number {
  if (deckFilter === 'all') return allDue.length;
  const deckIds = new Set(deckFilter.split(',').map((id) => id.trim()));
  return allDue.filter((card) => deckIds.has(card.deckId)).length;
}
