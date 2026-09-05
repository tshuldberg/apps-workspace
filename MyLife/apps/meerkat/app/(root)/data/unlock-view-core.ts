// Pure affordance mapping for the Unlock screen (upgrade.tsx). RN-free so the
// fail-closed rules are unit-testable: a buy button may only render when the
// store is actually reachable for this build, never alongside an
// "unavailable in this build" notice.

export type UnlockPhase = 'loading' | 'ready' | 'unavailable' | 'error' | 'unlocked' | 'restoring' | 'purchasing';

/** A store action is in flight; both buy and restore must be held. */
export function isStoreActionBusy(phase: UnlockPhase): boolean {
  return phase === 'purchasing' || phase === 'restoring';
}

/**
 * Where a failed purchase/restore lands. A configured store failing is a
 * transient error (buy stays offered); an unconfigured store means this build
 * cannot sell at all, so the screen returns to the fail-closed unavailable
 * state instead of an error state that re-renders the buy button.
 */
export function phaseAfterStoreFailure(purchasesConfigured: boolean): UnlockPhase {
  return purchasesConfigured ? 'error' : 'unavailable';
}

/** The primary buy button renders only where a purchase can actually start. */
export function showsBuyAction(phase: UnlockPhase): boolean {
  return phase === 'ready' || phase === 'error';
}

/**
 * Restore renders in the buy states, and in the unavailable state only when the
 * purchases SDK is configured (store reachable problems, e.g. no product yet).
 * With no SDK key in the build, restore can only fail: hide it, fail closed.
 */
export function showsRestoreAction(phase: UnlockPhase, purchasesConfigured: boolean): boolean {
  return showsBuyAction(phase) || (phase === 'unavailable' && purchasesConfigured);
}
