import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RSVP_MODULE } from '../definition';
import { getTodayCards } from '../cross-module';
import {
  createEvent,
  createInvite,
  createExpense,
  createExpenseSplit,
} from '../db/crud';

let adapter: DatabaseAdapter;
let closeDb: () => void;

const FIXED_NOW = new Date('2026-04-18T15:00:00.000Z');

beforeEach(() => {
  const testDb = createModuleTestDatabase('rsvp', RSVP_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('rsvp.getTodayCards', () => {
  it('returns empty array on an empty database', () => {
    const cards = getTodayCards(adapter, { now: FIXED_NOW });
    expect(cards).toEqual([]);
  });

  it('surfaces an event scheduled for today as an event card', () => {
    createEvent(adapter, 'event-today', {
      title: 'Rooftop Birthday',
      startAt: '2026-04-18T22:00:00.000Z',
      locationName: 'Skyline Roof',
    });

    const cards = getTodayCards(adapter, { now: FIXED_NOW });
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(card.moduleId).toBe('rsvp');
    expect(card.kind).toBe('event');
    expect(card.priority).toBe(80);
    expect(card.title).toBe('Rooftop Birthday');
    expect(card.cta?.route).toBe('/rsvp/events/event-today');
    expect(card.subtitle).toContain('Skyline Roof');
  });

  it('surfaces a pending invite within 3 days as an action card', () => {
    createEvent(adapter, 'event-soon', {
      title: 'Team Offsite',
      startAt: '2026-04-20T17:00:00.000Z',
    });
    createInvite(adapter, 'invite-1', 'event-soon', {
      inviteeName: 'Trey',
      status: 'invited',
    });

    const cards = getTodayCards(adapter, { now: FIXED_NOW });
    const action = cards.find((c) => c.kind === 'action');
    expect(action).toBeDefined();
    expect(action!.priority).toBe(60);
    expect(action!.cta?.route).toBe('/rsvp/invites/invite-1');
    expect(action!.title).toContain('Team Offsite');
  });

  it('surfaces an unsettled expense split as an action card', () => {
    createEvent(adapter, 'event-with-bill', {
      title: 'Dinner Club',
      startAt: '2026-04-15T20:00:00.000Z',
    });
    createExpense(adapter, 'exp-1', 'event-with-bill', {
      description: 'Pizza',
      amountCents: 4800,
      paidByName: 'Alex',
    });
    createExpenseSplit(adapter, 'split-1', 'exp-1', {
      participantName: 'Trey',
      amountCents: 1200,
    });

    const cards = getTodayCards(adapter, { now: FIXED_NOW });
    const owed = cards.find((c) => c.id.startsWith('rsvp.expense.owed.'));
    expect(owed).toBeDefined();
    expect(owed!.kind).toBe('action');
    expect(owed!.cta?.route).toBe('/rsvp/events/event-with-bill/expenses');
    expect(owed!.title).toContain('$12.00');
  });

  it('caps at 3 cards and keeps every priority within 0-100', () => {
    createEvent(adapter, 'event-a', {
      title: 'Today A',
      startAt: '2026-04-18T19:00:00.000Z',
    });
    createEvent(adapter, 'event-b', {
      title: 'Soon B',
      startAt: '2026-04-19T19:00:00.000Z',
    });
    createInvite(adapter, 'invite-b', 'event-b', {
      inviteeName: 'Trey',
      status: 'invited',
    });
    createExpense(adapter, 'exp-b', 'event-a', {
      description: 'Cake',
      amountCents: 2500,
      paidByName: 'Alex',
    });
    createExpenseSplit(adapter, 'split-b', 'exp-b', {
      participantName: 'Trey',
      amountCents: 800,
    });

    const cards = getTodayCards(adapter, { now: FIXED_NOW });
    expect(cards.length).toBeLessThanOrEqual(3);
    for (const card of cards) {
      expect(card.priority).toBeGreaterThanOrEqual(0);
      expect(card.priority).toBeLessThanOrEqual(100);
      expect(card.moduleId).toBe('rsvp');
    }
    // Ensure ordering by priority desc
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1].priority).toBeGreaterThanOrEqual(cards[i].priority);
    }
  });
});
