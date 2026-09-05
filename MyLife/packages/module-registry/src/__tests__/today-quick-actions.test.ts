import { describe, expect, it } from 'vitest';
import {
  CLUSTER_QUICK_ACTIONS,
  getQuickActionsForClusters,
} from '../today-quick-actions';

describe('CLUSTER_QUICK_ACTIONS map', () => {
  it('defines all seven clusters', () => {
    const keys = Object.keys(CLUSTER_QUICK_ACTIONS).sort();
    expect(keys).toEqual(
      ['body', 'home', 'knowledge', 'mind', 'money', 'outdoor', 'social'].sort(),
    );
  });

  it('each action has a label and a route', () => {
    for (const actions of Object.values(CLUSTER_QUICK_ACTIONS)) {
      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) {
        expect(action.label.length).toBeGreaterThan(0);
        expect(action.route.startsWith('/')).toBe(true);
      }
    }
  });
});

describe('getQuickActionsForClusters', () => {
  it('returns [] when clusters list is empty', () => {
    const enabled = new Set(['mood', 'journal']);
    expect(getQuickActionsForClusters([], enabled)).toEqual([]);
  });

  it('returns only actions whose requiresModule is in the enabled set', () => {
    const enabled = new Set(['mood', 'health']);
    const actions = getQuickActionsForClusters(['body'], enabled);
    const routes = actions.map((a) => a.route);
    expect(routes).toContain('/mood/log');
    expect(routes).toContain('/health/vitals/new');
    expect(routes).not.toContain('/nutrition/log');
    expect(routes).not.toContain('/meds/log');
    expect(routes).not.toContain('/workouts/new');
  });

  it('omits actions with no requiresModule gate only when nothing is enabled', () => {
    // Sanity: none of the built-in actions are gate-free, so enabling nothing
    // returns nothing. This test locks in that invariant.
    const actions = getQuickActionsForClusters(['body'], new Set<string>());
    expect(actions).toEqual([]);
  });

  it('dedupes by route across overlapping clusters', () => {
    // mind includes `+ Note` (/notes/new). knowledge also includes `+ Note`.
    // mind also has `+ Book` (/books/search); knowledge has `+ Book` too.
    const enabled = new Set(['notes', 'books', 'journal', 'voice', 'words', 'flash']);
    const actions = getQuickActionsForClusters(['mind', 'knowledge'], enabled, 20);
    const routes = actions.map((a) => a.route);
    // No duplicates.
    expect(new Set(routes).size).toBe(routes.length);
    // Both `/notes/new` and `/books/search` appear exactly once.
    expect(routes.filter((r) => r === '/notes/new')).toHaveLength(1);
    expect(routes.filter((r) => r === '/books/search')).toHaveLength(1);
  });

  it('respects the maxActions cap', () => {
    const enabled = new Set([
      'mood',
      'health',
      'nutrition',
      'meds',
      'workouts',
    ]);
    const actions = getQuickActionsForClusters(['body'], enabled, 3);
    expect(actions).toHaveLength(3);
    // Declaration order: mood, health, nutrition come first.
    expect(actions.map((a) => a.route)).toEqual([
      '/mood/log',
      '/health/vitals/new',
      '/nutrition/log',
    ]);
  });

  it('uses a default cap of 5 when maxActions is omitted', () => {
    const enabled = new Set([
      'mood',
      'health',
      'nutrition',
      'meds',
      'workouts',
    ]);
    const actions = getQuickActionsForClusters(['body'], enabled);
    expect(actions).toHaveLength(5);
  });

  it('silently skips unknown cluster names', () => {
    const enabled = new Set(['mood']);
    const actions = getQuickActionsForClusters(
      ['body', 'does-not-exist'],
      enabled,
    );
    expect(actions.map((a) => a.route)).toContain('/mood/log');
  });

  it('preserves first-seen declaration order when deduping', () => {
    // money then home: both expose /budget/transaction/new.
    // money lists it first (as `+ Expense`), home lists it second (as `+ Receipt`).
    // The label from whichever cluster is iterated first should win.
    const enabled = new Set(['budget', 'homes', 'garden', 'pets', 'subs']);
    const actions = getQuickActionsForClusters(['money', 'home'], enabled, 20);
    const expense = actions.find((a) => a.route === '/budget/transaction/new');
    expect(expense?.label).toBe('+ Expense');
  });
});
