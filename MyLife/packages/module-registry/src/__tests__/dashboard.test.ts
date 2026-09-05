import { describe, it, expect } from 'vitest';
import { aggregateDashboardData, aggregateActivityFeed } from '../dashboard';
import type { ModuleDefinition } from '../types';
import type { ModuleSummary, ActivityItem } from '../cross-module-types';

function makeModule(
  id: string,
  opts?: {
    summary?: ModuleSummary;
    summaryThrows?: boolean;
    feed?: ActivityItem[];
    feedThrows?: boolean;
  },
): ModuleDefinition {
  const crossModule: ModuleDefinition['crossModule'] = {};

  if (opts?.summary || opts?.summaryThrows) {
    crossModule.getDataSummary = (_db: unknown) => {
      if (opts.summaryThrows) throw new Error('boom');
      return opts.summary!;
    };
  }

  if (opts?.feed || opts?.feedThrows) {
    crossModule.getActivityFeed = (_db: unknown, _since: Date) => {
      if (opts.feedThrows) throw new Error('boom');
      return opts.feed!;
    };
  }

  return {
    id,
    name: `My${id.charAt(0).toUpperCase() + id.slice(1)}`,
    tagline: 'test',
    icon: 'test',
    accentColor: '#000',
    tier: 'premium',
    storageType: 'sqlite',
    navigation: { tabs: [], screens: [] },
    requiresAuth: false,
    requiresNetwork: false,
    version: '0.1.0',
    crossModule,
  } as ModuleDefinition;
}

describe('aggregateDashboardData', () => {
  it('returns summaries for modules with getDataSummary', () => {
    const summary: ModuleSummary = {
      moduleId: 'books',
      totalItems: 42,
      stats: { booksRead: 42 },
      lastActivity: '2026-03-22T00:00:00Z',
    };

    const modules = [
      makeModule('books', { summary }),
      makeModule('budget'), // no crossModule.getDataSummary
    ];

    const result = aggregateDashboardData(modules, {});
    expect(result.size).toBe(1);
    expect(result.get('books')).toEqual(summary);
    expect(result.has('budget')).toBe(false);
  });

  it('skips modules that throw during aggregation', () => {
    const goodSummary: ModuleSummary = {
      moduleId: 'budget',
      totalItems: 10,
      stats: { envelopes: 5 },
    };

    const modules = [
      makeModule('books', { summaryThrows: true }),
      makeModule('budget', { summary: goodSummary }),
    ];

    const result = aggregateDashboardData(modules, {});
    expect(result.size).toBe(1);
    expect(result.has('books')).toBe(false);
    expect(result.get('budget')).toEqual(goodSummary);
  });

  it('returns empty map when no modules implement getDataSummary', () => {
    const modules = [makeModule('books'), makeModule('budget')];
    const result = aggregateDashboardData(modules, {});
    expect(result.size).toBe(0);
  });
});

describe('aggregateActivityFeed', () => {
  it('collects and sorts activities from multiple modules', () => {
    const booksItems: ActivityItem[] = [
      { moduleId: 'books', action: 'finished', description: 'Finished reading', timestamp: '2026-03-20T10:00:00Z' },
    ];
    const budgetItems: ActivityItem[] = [
      { moduleId: 'budget', action: 'spent', description: 'Spent $42', timestamp: '2026-03-21T10:00:00Z' },
      { moduleId: 'budget', action: 'received', description: 'Got paid', timestamp: '2026-03-19T10:00:00Z' },
    ];

    const modules = [
      makeModule('books', { feed: booksItems }),
      makeModule('budget', { feed: budgetItems }),
    ];

    const result = aggregateActivityFeed(modules, {}, new Date('2026-03-18'));
    expect(result).toHaveLength(3);
    // Sorted descending by timestamp
    expect(result[0].timestamp).toBe('2026-03-21T10:00:00Z');
    expect(result[1].timestamp).toBe('2026-03-20T10:00:00Z');
    expect(result[2].timestamp).toBe('2026-03-19T10:00:00Z');
  });

  it('skips modules that throw', () => {
    const goodItems: ActivityItem[] = [
      { moduleId: 'budget', action: 'spent', description: 'test', timestamp: '2026-03-20T10:00:00Z' },
    ];

    const modules = [
      makeModule('books', { feedThrows: true }),
      makeModule('budget', { feed: goodItems }),
    ];

    const result = aggregateActivityFeed(modules, {}, new Date('2026-03-18'));
    expect(result).toHaveLength(1);
    expect(result[0].moduleId).toBe('budget');
  });

  it('returns empty array when no modules implement getActivityFeed', () => {
    const modules = [makeModule('books')];
    const result = aggregateActivityFeed(modules, {}, new Date());
    expect(result).toHaveLength(0);
  });
});
