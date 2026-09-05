import { isUserVisibleModule, type ModuleId } from '@mylife/module-registry';

export const WEB_SUPPORTED_MODULE_IDS: readonly ModuleId[] = [
  'books',
  'budget',
  'closet',
  'classes',
  'cycle',
  'create',
  'dining',
  'fast',
  'flash',
  'garden',
  'health',
  'manhattan',
  'recipes',
  'rsvp',
  'shop',
  'sleep',
  'sports',
  'stars',
  'surf',
  'workouts',
  'homes',
  'car',
  'habits',
  'journal',
  'mail',
  'meds',
  'mood',
  'notes',
  'nutrition',
  'payments',
  'pets',
  'trails',
  'travel',
  'voice',
  'words',
];

/**
 * Web-only visibility promotions.
 *
 * These modules are flagged `hidden` in the shared release-state arrays
 * (packages/module-registry/src/release-states.ts), which mobile still
 * honours through `isUserVisibleModule`, `USER_VISIBLE_MODULE_IDS`, and the
 * mobile DatabaseProvider bootstrap. The web build, however, already ships
 * fully built routes for each of these and wants them surfaced now, so we
 * override visibility for the web surface only instead of mutating the shared
 * hidden set (which would also flip them on for mobile and break the
 * release-state property tests).
 *
 * To promote a module on web only, add its id here. To promote it everywhere,
 * move it out of HIDDEN_MODULE_IDS into a real tier in release-states.ts.
 */
export const WEB_VISIBILITY_OVERRIDE_IDS: readonly ModuleId[] = [
  'dining',
  'manhattan',
  'rsvp',
  'sleep',
  'sports',
];

const WEB_VISIBILITY_OVERRIDE_SET = new Set<string>(WEB_VISIBILITY_OVERRIDE_IDS);

/**
 * Web visibility predicate. A module is visible on web when the shared
 * release-state says it is visible, OR when it is a web-only promotion listed
 * in {@link WEB_VISIBILITY_OVERRIDE_IDS}.
 */
export function isWebVisibleModuleId(moduleId: ModuleId): boolean {
  return isUserVisibleModule(moduleId) || WEB_VISIBILITY_OVERRIDE_SET.has(moduleId);
}

export const WEB_VISIBLE_MODULE_IDS: readonly ModuleId[] = WEB_SUPPORTED_MODULE_IDS.filter(
  isWebVisibleModuleId,
);

const SUPPORTED_MODULE_ID_SET = new Set<string>(WEB_SUPPORTED_MODULE_IDS);

export function isWebSupportedModuleId(moduleId: string): moduleId is ModuleId {
  return SUPPORTED_MODULE_ID_SET.has(moduleId);
}
