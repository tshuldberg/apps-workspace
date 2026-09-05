/**
 * Dashboard aggregation service.
 *
 * Collects data summaries from all modules that implement the crossModule
 * interface. Used by the hub dashboard to render personalized module cards.
 */

import type { ModuleDefinition, ModuleId } from './types';
import type {
  ModuleSummary,
  TodayCard,
  TodayCardContext,
} from './cross-module-types';

/**
 * Aggregate dashboard data by calling getDataSummary() on each module
 * that implements the crossModule interface.
 *
 * Returns a Map keyed by module ID. Modules that throw during aggregation
 * are silently skipped (dashboard must never crash due to a single module).
 */
export function aggregateDashboardData(
  modules: ModuleDefinition[],
  db: unknown,
): Map<string, ModuleSummary> {
  const results = new Map<string, ModuleSummary>();

  for (const mod of modules) {
    if (!mod.crossModule?.getDataSummary) continue;
    try {
      const summary = mod.crossModule.getDataSummary(db);
      results.set(mod.id, summary);
    } catch {
      // Skip modules that fail -- the dashboard must remain functional
      // even if individual modules have data issues.
    }
  }

  return results;
}

/**
 * Collect activity feeds from all modules since a given date.
 * Returns a flat array sorted by timestamp descending.
 */
export function aggregateActivityFeed(
  modules: ModuleDefinition[],
  db: unknown,
  since: Date,
): import('./cross-module-types').ActivityItem[] {
  const items: import('./cross-module-types').ActivityItem[] = [];

  for (const mod of modules) {
    if (!mod.crossModule?.getActivityFeed) continue;
    try {
      const feed = mod.crossModule.getActivityFeed(db, since);
      items.push(...feed);
    } catch {
      // Skip failing modules
    }
  }

  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return items;
}

// ---------------------------------------------------------------------------
// Today surface aggregation
// ---------------------------------------------------------------------------

/** Options for `aggregateTodayCards`. */
export interface AggregateTodayCardsOptions {
  /** Current wall-clock time (tests pass a fixed clock). */
  now: Date;
  /**
   * User's primary workflow clusters. Cards whose module is in any of these
   * clusters receive a ranking boost via `CLUSTER_MODULES`.
   */
  primaryClusters?: string[];
  /** Card ids the user has dismissed for today; filtered before ranking. */
  dismissedIds?: Set<string>;
  /** Hard cap on returned cards. Defaults to 7. */
  maxCards?: number;
}

/**
 * Cluster -> modules mapping, sourced from
 * `docs/plans/consolidation/README.md` (§ "The seven workflow clusters").
 * Some modules intentionally appear in multiple clusters (e.g. `notes` is
 * in both mind + knowledge).
 */
const CLUSTER_MODULES: Record<string, readonly ModuleId[]> = {
  body: ['health', 'workouts', 'nutrition', 'fast', 'cycle', 'meds', 'mood'],
  mind: ['journal', 'notes', 'mood', 'voice', 'books', 'flash', 'words'],
  home: ['homes', 'car', 'garden', 'pets', 'closet'],
  money: ['budget', 'subs', 'market'],
  social: ['rsvp', 'forums', 'presence', 'mail'],
  outdoor: ['surf', 'trails', 'stars', 'garden'],
  knowledge: ['books', 'classes', 'flash', 'words', 'notes', 'habits'],
};

/** Cluster priority boost applied when a card's module matches a user's primary cluster. */
const CLUSTER_PRIORITY_BOOST = 15;

/** Priority is clamped into [0, 100] after the cluster boost. */
const MAX_PRIORITY = 100;

/** Default maximum number of visible cards on the Today surface. */
const DEFAULT_MAX_CARDS = 7;

/** SQLite adapter shape used by dismissal helpers. Kept local to avoid a `@mylife/db` dependency. */
interface TodayDbLike {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  execute(sql: string, params?: unknown[]): void;
}

const DISMISSED_KEY_PREFIX = 'today.dismissed.';

/**
 * Build the set of module ids whose cards should receive the cluster boost,
 * based on the user's primary clusters.
 */
function buildBoostedModuleSet(primaryClusters: readonly string[] | undefined): Set<string> {
  const boosted = new Set<string>();
  if (!primaryClusters || primaryClusters.length === 0) return boosted;
  for (const cluster of primaryClusters) {
    const modules = CLUSTER_MODULES[cluster];
    if (!modules) continue;
    for (const moduleId of modules) {
      boosted.add(moduleId);
    }
  }
  return boosted;
}

/**
 * Aggregate Today cards from every enabled module's `getTodayCards`
 * contribution, apply cluster-weighted ranking, filter expired/dismissed
 * cards, and return the top N.
 *
 * Pure with respect to storage: this function never writes. Dismissals
 * must be persisted separately via `dismissCardToday`.
 *
 * Resilience: per-module invocations are wrapped in try/catch so one broken
 * contributor cannot blank the whole Today surface. This is the one legitimate
 * catch-and-swallow point in the Today pipeline -- errors elsewhere throw.
 */
export function aggregateTodayCards(
  db: unknown,
  enabledModules: readonly ModuleDefinition[],
  options: AggregateTodayCardsOptions,
): TodayCard[] {
  const nowIso = options.now.toISOString();
  const dismissed = options.dismissedIds ?? new Set<string>();
  const boostedModules = buildBoostedModuleSet(options.primaryClusters);
  const maxCards = options.maxCards ?? DEFAULT_MAX_CARDS;

  const context: TodayCardContext = {
    now: options.now,
    primaryClusters: options.primaryClusters,
  };

  const collected: TodayCard[] = [];
  for (const mod of enabledModules) {
    const getCards = mod.crossModule?.getTodayCards;
    if (!getCards) continue;
    try {
      // Legitimate catch-and-swallow boundary: one broken module contributor
      // must not blank the entire Today surface. Log and skip that module.
      const cards = getCards(db, context);
      if (Array.isArray(cards)) {
        collected.push(...cards);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[aggregateTodayCards] module '${mod.id}' getTodayCards threw; skipping`, err);
    }
  }

  // Filter expired cards + user-dismissed cards.
  const filtered: { card: TodayCard; originalIndex: number; adjustedPriority: number }[] = [];
  for (let i = 0; i < collected.length; i++) {
    const card = collected[i]!;
    if (card.expiresAt && card.expiresAt <= nowIso) continue;
    if (dismissed.has(card.id)) continue;

    const boost = boostedModules.has(card.moduleId) ? CLUSTER_PRIORITY_BOOST : 0;
    const adjustedPriority = Math.min(card.priority + boost, MAX_PRIORITY);
    filtered.push({ card, originalIndex: i, adjustedPriority });
  }

  // Stable sort by adjusted priority desc; ties preserve original order.
  filtered.sort((a, b) => {
    if (b.adjustedPriority !== a.adjustedPriority) {
      return b.adjustedPriority - a.adjustedPriority;
    }
    return a.originalIndex - b.originalIndex;
  });

  return filtered.slice(0, maxCards).map((entry) => entry.card);
}

// ---------------------------------------------------------------------------
// Dismissal helpers (persist to hub_preferences)
// ---------------------------------------------------------------------------

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function endOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/**
 * Read all "today-scoped" card dismissals from `hub_preferences` and return
 * the set of card ids still within today's UTC window.
 *
 * Dismissals auto-expire at UTC midnight: a row written yesterday is ignored
 * today, so cards reappear the next day unless re-dismissed.
 */
export function getDismissedCardIds(db: unknown, now: Date): Set<string> {
  const adapter = db as TodayDbLike;
  const rows = adapter.query<{ key: string; value: string }>(
    `SELECT key, value FROM hub_preferences WHERE key LIKE ?`,
    [`${DISMISSED_KEY_PREFIX}%`],
  );

  const windowStart = startOfUtcDay(now).getTime();
  const windowEnd = endOfUtcDay(now).getTime();

  const result = new Set<string>();
  for (const row of rows) {
    const parsed = Date.parse(row.value);
    if (Number.isNaN(parsed)) continue;
    if (parsed < windowStart || parsed >= windowEnd) continue;
    const cardId = row.key.slice(DISMISSED_KEY_PREFIX.length);
    if (cardId.length === 0) continue;
    result.add(cardId);
  }
  return result;
}

/**
 * Dismiss a card for the rest of today. Writes
 * `hub_preferences['today.dismissed.<cardId>'] = now.toISOString()`.
 *
 * Uses `INSERT OR REPLACE` so repeat dismissals (e.g. user toggles) just
 * refresh the timestamp without raising a unique-constraint error.
 */
export function dismissCardToday(db: unknown, cardId: string, now: Date): void {
  const adapter = db as TodayDbLike;
  adapter.execute(
    `INSERT OR REPLACE INTO hub_preferences (key, value) VALUES (?, ?)`,
    [`${DISMISSED_KEY_PREFIX}${cardId}`, now.toISOString()],
  );
}
