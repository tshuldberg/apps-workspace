import { describe, it, expect } from 'vitest';
import { buildNotificationContent, parseReminderConfig, filterDueByDecks } from '../reminders';

describe('Daily Reminders', () => {
  it('builds notification with streak info', () => {
    const result = buildNotificationContent(42, 5, true);
    expect(result).toBeTruthy();
    expect(result!.body).toBe('Keep your 5-day streak alive! 42 cards due.');
  });

  it('builds notification without streak info', () => {
    const result = buildNotificationContent(42, 5, false);
    expect(result!.body).toBe('You have 42 cards due for review.');
  });

  it('builds notification without streak when streak is 0', () => {
    const result = buildNotificationContent(10, 0, true);
    expect(result!.body).toBe('You have 10 cards due for review.');
  });

  it('returns null for 0 due cards', () => {
    expect(buildNotificationContent(0, 5, true)).toBeNull();
  });

  it('handles singular card count', () => {
    const result = buildNotificationContent(1, 0, false);
    expect(result!.body).toBe('You have 1 card due for review.');
  });

  it('parses reminder config from settings', () => {
    const config = parseReminderConfig('1', '08:30', '0', 'deck1,deck2');
    expect(config.enabled).toBe(true);
    expect(config.time).toBe('08:30');
    expect(config.includeStreak).toBe(false);
    expect(config.deckFilter).toBe('deck1,deck2');
  });

  it('parses defaults for null settings', () => {
    const config = parseReminderConfig(null, null, null, null);
    expect(config.enabled).toBe(false);
    expect(config.time).toBe('09:00');
    expect(config.includeStreak).toBe(true);
    expect(config.deckFilter).toBe('all');
  });

  it('filters due by all decks', () => {
    const due = [{ deckId: 'd1' }, { deckId: 'd2' }, { deckId: 'd3' }];
    expect(filterDueByDecks(due, 'all')).toBe(3);
  });

  it('filters due by specific decks', () => {
    const due = [{ deckId: 'd1' }, { deckId: 'd2' }, { deckId: 'd3' }];
    expect(filterDueByDecks(due, 'd1,d3')).toBe(2);
  });
});
