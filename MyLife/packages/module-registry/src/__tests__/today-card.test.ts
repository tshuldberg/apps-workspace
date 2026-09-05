import { describe, expect, it } from 'vitest';
import type {
  CrossModuleInterface,
  TodayCard,
  TodayCardContext,
} from '../cross-module-types';

describe('TodayCard contract', () => {
  it('accepts a minimal card with all required fields', () => {
    const card: TodayCard = {
      id: 'bk-currently-reading',
      moduleId: 'books',
      kind: 'progress',
      priority: 50,
      title: 'Currently reading',
      dismissible: true,
    };

    expect(card.id).toBe('bk-currently-reading');
    expect(card.moduleId).toBe('books');
    expect(card.kind).toBe('progress');
    expect(card.priority).toBe(50);
    expect(card.dismissible).toBe(true);
  });

  it('accepts a fully populated card with optional cta and expiresAt', () => {
    const card: TodayCard = {
      id: 'rv-event-today',
      moduleId: 'rsvp',
      kind: 'event',
      priority: 80,
      title: 'Dinner with Alex',
      subtitle: 'Tonight at 7pm',
      cta: { label: 'View', route: '/rsvp/events/123' },
      dismissible: false,
      expiresAt: '2026-04-19T05:00:00.000Z',
    };

    expect(card.cta?.label).toBe('View');
    expect(card.cta?.route).toBe('/rsvp/events/123');
    expect(card.expiresAt).toBe('2026-04-19T05:00:00.000Z');
    expect(card.subtitle).toBe('Tonight at 7pm');
  });

  it('compiles a CrossModuleInterface implementation with getTodayCards', () => {
    const ctx: TodayCardContext = {
      now: new Date('2026-04-18T12:00:00.000Z'),
      primaryClusters: ['body', 'mind'],
    };

    const impl: CrossModuleInterface = {
      getTodayCards: (_db, context) => {
        expect(context.now).toBeInstanceOf(Date);
        return [
          {
            id: 'jr-today-entry',
            moduleId: 'journal',
            kind: 'action',
            priority: 60,
            title: 'Reflect on today',
            cta: { label: 'Write', route: '/journal/new' },
            dismissible: true,
          },
        ];
      },
    };

    const cards = impl.getTodayCards?.(null, ctx) ?? [];
    expect(cards).toHaveLength(1);
    expect(cards[0]?.moduleId).toBe('journal');
    expect(cards[0]?.kind).toBe('action');
  });

  it('supports all five card kinds', () => {
    const kinds: Array<TodayCard['kind']> = [
      'action',
      'progress',
      'insight',
      'reminder',
      'event',
    ];

    for (const kind of kinds) {
      const card: TodayCard = {
        id: `test-${kind}`,
        moduleId: 'health',
        kind,
        priority: 40,
        title: `Test ${kind}`,
        dismissible: true,
      };
      expect(card.kind).toBe(kind);
    }
  });

  it('accepts a TodayCardContext without optional primaryClusters', () => {
    const ctx: TodayCardContext = {
      now: new Date('2026-04-18T08:00:00.000Z'),
    };

    expect(ctx.now).toBeInstanceOf(Date);
    expect(ctx.primaryClusters).toBeUndefined();
  });
});
