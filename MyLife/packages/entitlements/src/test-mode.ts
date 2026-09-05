/**
 * Test mode flag -- bypasses all purchase/subscription gating.
 *
 * When true:
 * - All modules are treated as unlocked (no paywall, no lock overlays)
 * - Premium module enable is not gated on the Discover screen
 * - EntitlementsProvider defaults to hubUnlocked: true
 *
 * Set to `false` when ready for production release with billing.
 */
let _testMode = true;

export function isTestMode(): boolean {
  return _testMode;
}

/** For unit tests only. Resets at end of test. */
export function setTestMode(value: boolean): void {
  _testMode = value;
}
