import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../definition';
import { createEvent, setEventSaved } from '../db/crud/events';
import { createPin } from '../db/crud/pins';
import { createPlan } from '../db/crud/plans';
import { addFacet } from '../db/crud/facets';
import {
  getTodayCards,
  getSearchableContent,
  getDataSummary,
  manhattanCrossModule,
} from '../cross-module';

function setup() {
  return createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
}

const NOW = new Date('2026-07-01T17:00:00.000Z');
const TODAY = '2026-07-01';

describe('manhattan cross-module getTodayCards', () => {
  it('surfaces a plan today, tonight saved events, and a next reminder', () => {
    const { adapter, close } = setup();

    // Saved event tonight
    const eventId = createEvent(adapter, {
      title: 'Blue Note Jazz',
      startAt: `${TODAY}T20:00:00.000Z`,
      venueName: 'Blue Note',
      neighborhood: 'Greenwich Village',
    });
    setEventSaved(adapter, eventId, true);

    // Plan scheduled today
    createPlan(adapter, {
      title: 'Dinner at Lilia',
      startAt: `${TODAY}T19:00:00.000Z`,
      hasReservation: true,
      partySize: 2,
    });

    // Future plan with reminder
    createPlan(adapter, {
      title: 'Yankees game',
      startAt: '2026-07-10T18:00:00.000Z',
      reminderMinutes: 60,
    });

    const cards = getTodayCards(adapter, { now: NOW });
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.length).toBeLessThanOrEqual(3);

    // Highest priority is the plan today (80)
    expect(cards[0].title).toBe('Dinner at Lilia');
    expect(cards[0].priority).toBe(80);
    expect(cards[0].kind).toBe('reminder');
    expect(cards[0].moduleId).toBe('manhattan');
    expect(cards[0].dismissible).toBe(true);

    const insight = cards.find((c) => c.kind === 'insight');
    expect(insight?.title).toBe('1 saved event tonight');
    expect(insight?.expiresAt).toBe(`${TODAY}T23:59:59.999Z`);

    const reminder = cards.find((c) => c.id.includes('plan.reminder'));
    expect(reminder?.title).toContain('Yankees game');
    expect(reminder?.kind).toBe('reminder');

    close();
  });

  it('returns no cards on an empty database', () => {
    const { adapter, close } = setup();
    expect(getTodayCards(adapter, { now: NOW })).toEqual([]);
    close();
  });
});

describe('manhattan cross-module getSearchableContent', () => {
  it('returns saved events (with facet tags), pins, and plans', () => {
    const { adapter, close } = setup();

    const savedId = createEvent(adapter, {
      title: 'Comedy Cellar',
      venueName: 'Comedy Cellar',
      neighborhood: 'West Village',
      description: 'Late show',
    });
    setEventSaved(adapter, savedId, true);
    addFacet(adapter, { eventId: savedId, axis: 'category', value: 'comedy' });
    addFacet(adapter, { eventId: savedId, axis: 'vibe', value: 'lively' });

    // Unsaved event should be excluded
    createEvent(adapter, { title: 'Random Feed Event' });

    createPin(adapter, { name: 'Joe Coffee', category: 'cafe', neighborhood: 'SoHo' });
    createPlan(adapter, { title: 'Brunch plan', startAt: `${TODAY}T11:00:00.000Z` });

    const items = getSearchableContent(adapter);

    const event = items.find((i) => i.type === 'event');
    expect(event?.title).toBe('Comedy Cellar');
    expect(event?.itemId).toBe(savedId);
    expect(event?.tags).toEqual(expect.arrayContaining(['comedy', 'lively']));
    expect(event?.body).toContain('Comedy Cellar');

    expect(items.some((i) => i.title === 'Random Feed Event')).toBe(false);

    const pin = items.find((i) => i.type === 'pin');
    expect(pin?.title).toBe('Joe Coffee');
    expect(pin?.body).toContain('cafe');

    const plan = items.find((i) => i.type === 'plan');
    expect(plan?.title).toBe('Brunch plan');

    for (const item of items) {
      expect(item.moduleId).toBe('manhattan');
      expect(typeof item.updatedAt).toBe('string');
      expect(item.updatedAt.length).toBeGreaterThan(0);
    }

    close();
  });
});

describe('manhattan cross-module getDataSummary', () => {
  it('counts saved events, pins, plans, and upcoming plans', () => {
    const { adapter, close } = setup();

    const e1 = createEvent(adapter, { title: 'Saved A', startAt: `${TODAY}T20:00:00.000Z` });
    setEventSaved(adapter, e1, true);
    createEvent(adapter, { title: 'Unsaved B' });

    createPin(adapter, { name: 'Pin One' });

    createPlan(adapter, { title: 'Future plan', startAt: '2099-01-01T00:00:00.000Z' });
    createPlan(adapter, { title: 'Past plan', startAt: '2000-01-01T00:00:00.000Z' });

    const summary = getDataSummary(adapter);
    expect(summary.moduleId).toBe('manhattan');
    expect(summary.totalItems).toBe(2 + 1 + 2);
    expect(summary.stats.savedEvents).toBe(1);
    expect(summary.stats.pins).toBe(1);
    expect(summary.stats.plans).toBe(2);
    expect(summary.stats.upcomingPlans).toBe(1);
    expect(typeof summary.lastActivity).toBe('string');

    close();
  });

  it('returns a zeroed summary on an empty database', () => {
    const { adapter, close } = setup();
    const summary = getDataSummary(adapter);
    expect(summary.totalItems).toBe(0);
    expect(summary.stats).toEqual({ savedEvents: 0, pins: 0, plans: 0, upcomingPlans: 0 });
    expect(summary.lastActivity).toBeUndefined();
    close();
  });
});

describe('manhattanCrossModule object', () => {
  it('exposes the three interface methods bound to the pure functions', () => {
    const { adapter, close } = setup();
    expect(typeof manhattanCrossModule.getTodayCards).toBe('function');
    expect(typeof manhattanCrossModule.getSearchableContent).toBe('function');
    expect(typeof manhattanCrossModule.getDataSummary).toBe('function');
    expect(manhattanCrossModule.getSearchableContent!(adapter)).toEqual([]);
    expect(manhattanCrossModule.getDataSummary!(adapter).moduleId).toBe('manhattan');
    expect(manhattanCrossModule.getTodayCards!(adapter, { now: NOW })).toEqual([]);
    close();
  });
});
