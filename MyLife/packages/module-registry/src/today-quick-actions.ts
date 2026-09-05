/**
 * Today surface quick-actions map.
 *
 * Each workflow cluster exposes 3-5 high-frequency CTAs that the Today view
 * renders as an "add" row. Actions whose `requiresModule` is not enabled are
 * filtered at render time so the UI never links to a 404.
 *
 * Cluster taxonomy mirrors `docs/plans/consolidation/README.md`
 * (§ "The seven workflow clusters").
 */

import type { ModuleId } from './types';

export interface QuickAction {
  /** Short button label (`+ Mood`, `+ Receipt`, etc.). */
  label: string;
  /** Optional icon name; hosts may ignore if they use emoji or system icons. */
  icon?: string;
  /** Target route when the button is tapped. */
  route: string;
  /**
   * Optional module gate. When set, the action is hidden unless that module
   * id appears in the enabled-module set passed to `getQuickActionsForClusters`.
   */
  requiresModule?: ModuleId;
}

/** Default cap on visible quick actions when callers omit `maxActions`. */
const DEFAULT_MAX_ACTIONS = 5;

/**
 * Static map from cluster id to an ordered list of quick actions.
 *
 * Order within a cluster matters: it drives display priority when multiple
 * clusters are unioned. Deduping by `route` preserves first-seen order.
 */
export const CLUSTER_QUICK_ACTIONS: Record<string, readonly QuickAction[]> = {
  body: [
    { label: '+ Mood', route: '/mood/log', requiresModule: 'mood' },
    { label: '+ Weight', route: '/health/vitals/new', requiresModule: 'health' },
    { label: '+ Meal', route: '/nutrition/log', requiresModule: 'nutrition' },
    { label: '+ Med', route: '/meds/log', requiresModule: 'meds' },
    { label: '+ Workout', route: '/workouts/new', requiresModule: 'workouts' },
  ],
  mind: [
    { label: '+ Note', route: '/notes/new', requiresModule: 'notes' },
    { label: '+ Voice', route: '/voice/new', requiresModule: 'voice' },
    { label: '+ Journal', route: '/journal/new', requiresModule: 'journal' },
    { label: '+ Book', route: '/books/search', requiresModule: 'books' },
  ],
  home: [
    { label: '+ Maintenance', route: '/homes/maintenance/new', requiresModule: 'homes' },
    { label: '+ Receipt', route: '/budget/transaction/new', requiresModule: 'budget' },
    { label: '+ Plant log', route: '/garden/log', requiresModule: 'garden' },
    { label: '+ Pet', route: '/pets/log', requiresModule: 'pets' },
  ],
  money: [
    { label: '+ Expense', route: '/budget/transaction/new', requiresModule: 'budget' },
    { label: '+ Income', route: '/budget/transaction/new?direction=inflow', requiresModule: 'budget' },
    { label: '+ Sub', route: '/subs/new', requiresModule: 'subs' },
  ],
  social: [
    { label: '+ Event', route: '/rsvp/events/new', requiresModule: 'rsvp' },
    { label: '+ RSVP', route: '/rsvp/invites', requiresModule: 'rsvp' },
    { label: '+ Photo', route: '/rsvp/photo', requiresModule: 'rsvp' },
  ],
  outdoor: [
    { label: '+ Hike', route: '/trails/record', requiresModule: 'trails' },
    { label: '+ Surf session', route: '/surf/log', requiresModule: 'surf' },
    { label: '+ Sky check', route: '/stars/today', requiresModule: 'stars' },
  ],
  knowledge: [
    { label: '+ Note', route: '/notes/new', requiresModule: 'notes' },
    { label: '+ Word', route: '/words/new', requiresModule: 'words' },
    { label: '+ Card review', route: '/flash/review', requiresModule: 'flash' },
    { label: '+ Book', route: '/books/search', requiresModule: 'books' },
  ],
} as const;

/**
 * Resolve quick actions for the given user clusters.
 *
 * Unions the selected clusters' actions in declaration order, filters out any
 * whose `requiresModule` is not enabled, dedupes by route (first-seen wins),
 * and caps at `maxActions`.
 */
export function getQuickActionsForClusters(
  clusters: readonly string[],
  enabledModuleIds: ReadonlySet<string>,
  maxActions: number = DEFAULT_MAX_ACTIONS,
): QuickAction[] {
  const seenRoutes = new Set<string>();
  const result: QuickAction[] = [];

  for (const cluster of clusters) {
    const actions = CLUSTER_QUICK_ACTIONS[cluster];
    if (!actions) continue;
    for (const action of actions) {
      if (action.requiresModule && !enabledModuleIds.has(action.requiresModule)) continue;
      if (seenRoutes.has(action.route)) continue;
      seenRoutes.add(action.route);
      result.push(action);
      if (result.length >= maxActions) return result;
    }
  }

  return result;
}
