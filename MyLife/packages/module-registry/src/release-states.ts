import type { ModuleId } from './types';

export type ModuleReleaseState = 'ga' | 'public_beta' | 'hidden' | 'merged';

export const GA_MODULE_IDS: readonly ModuleId[] = [
  'budget',
  'habits',
  'health',
  'meds',
  'recipes',
] as const;

export const PUBLIC_BETA_MODULE_IDS: readonly ModuleId[] = [
  'books',
  'classes',
  'cycle',
  'forums',
  'garden',
  'market',
  'mood',
  'nutrition',
  'presence',
  'stars',
  'trails',
  'travel',
  'workouts',
] as const;

/**
 * Modules intentionally hidden from the deployed build.
 *
 * A module is visible only after a UIUX mission control doc exists for it
 * under docs/plans/my<module>-uiux-mission-control.html. Everything listed
 * here either has no mission control yet or has not finished its redesign,
 * so it is excluded from the test build. To bring a module back, remove it
 * from this array, move it into GA_MODULE_IDS or PUBLIC_BETA_MODULE_IDS,
 * and flip its entry in MODULE_RELEASE_STATES below. No call sites,
 * schemas, migrations, or registry wiring need to change.
 */
export const HIDDEN_MODULE_IDS: readonly ModuleId[] = [
  'car',
  'closet',
  'create',
  'dining',
  'fast',
  'flash',
  'friends',
  'homes',
  'journal',
  'mail',
  'manhattan',
  'mynews',
  'notes',
  'payments',
  'pets',
  'rsvp',
  'shop',
  'sleep',
  'sports',
  'subs',
  'surf',
  'voice',
  'words',
] as const;

export const MERGED_MODULE_IDS: readonly ModuleId[] = [] as const;

export const USER_VISIBLE_MODULE_IDS: readonly ModuleId[] = [
  ...GA_MODULE_IDS,
  ...PUBLIC_BETA_MODULE_IDS,
] as const;

/**
 * Derived release-state lookup. The four tier arrays above are the single
 * source of truth; this object is built from them so adding a module to a
 * tier array automatically updates the lookup, and forgetting to categorize
 * a module is caught by the release-states tests (which verify every
 * ModuleId is represented exactly once across the tier arrays).
 */
function buildReleaseStates(): Record<ModuleId, ModuleReleaseState> {
  const states: Partial<Record<ModuleId, ModuleReleaseState>> = {};
  for (const id of GA_MODULE_IDS) states[id] = 'ga';
  for (const id of PUBLIC_BETA_MODULE_IDS) states[id] = 'public_beta';
  for (const id of HIDDEN_MODULE_IDS) states[id] = 'hidden';
  for (const id of MERGED_MODULE_IDS) states[id] = 'merged';
  return states as Record<ModuleId, ModuleReleaseState>;
}

export const MODULE_RELEASE_STATES: Record<ModuleId, ModuleReleaseState> =
  buildReleaseStates();

export function getModuleReleaseState(moduleId: ModuleId): ModuleReleaseState {
  return MODULE_RELEASE_STATES[moduleId];
}

export function isGeneralAvailabilityModule(moduleId: ModuleId): boolean {
  return getModuleReleaseState(moduleId) === 'ga';
}

export function isPublicBetaModule(moduleId: ModuleId): boolean {
  return getModuleReleaseState(moduleId) === 'public_beta';
}

export function isHiddenModule(moduleId: ModuleId): boolean {
  return getModuleReleaseState(moduleId) === 'hidden';
}

export function isMergedModule(moduleId: ModuleId): boolean {
  return getModuleReleaseState(moduleId) === 'merged';
}

export function isUserVisibleModule(moduleId: ModuleId): boolean {
  const state = getModuleReleaseState(moduleId);
  return state !== 'hidden' && state !== 'merged';
}

export function getModuleReleaseLabel(moduleId: ModuleId): string {
  const releaseState = getModuleReleaseState(moduleId);
  switch (releaseState) {
    case 'ga':
      return 'GA';
    case 'public_beta':
      return 'BETA';
    case 'hidden':
      return 'HIDDEN';
    case 'merged':
      return 'MERGED';
  }
}

export function getModuleReleaseDescription(moduleId: ModuleId): string {
  const releaseState = getModuleReleaseState(moduleId);
  switch (releaseState) {
    case 'ga':
      return 'Included in the production launch promise.';
    case 'public_beta':
      return 'Included at launch as a public beta.';
    case 'hidden':
      return 'Not yet available for users.';
    case 'merged':
      return 'Folded into another module and not surfaced independently.';
  }
}
