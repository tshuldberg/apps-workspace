// onboarding-core.ts: pure, native-free onboarding v2 helpers (Plan 31 Phase 3,
// design decision 7). Step 2 is ONE list of four choices; the browse path writes
// ONLY the completion flag (no identity/community side effects). Kept native-free
// so the choice list, completion, and suggested-name logic are testable in Node.

import type { DatabaseAdapter } from '@mylife/db';
import { ONBOARDING_COMPLETE_KEY, getSetting, setSetting } from './db';

export type OnboardingStartOption = 'create' | 'join' | 'add_friend' | 'browse';

export interface OnboardingStartRow {
  option: OnboardingStartOption;
  title: string;
  detail: string;
}

/** The four Step-2 choices (design decision 7), in order. */
export const ONBOARDING_START_ROWS: readonly OnboardingStartRow[] = [
  { option: 'create', title: 'Create a community', detail: 'Make a private space with a general channel.' },
  { option: 'join', title: 'Join with an invite', detail: 'Scan a QR or paste a link, then preview before joining.' },
  { option: 'add_friend', title: 'Add a friend', detail: 'Share your code, or add someone by theirs.' },
  { option: 'browse', title: 'Just look around', detail: 'Explore first. You can create or join anytime.' },
];

/** Whether onboarding is already complete on this device. */
export function isOnboardingComplete(db: DatabaseAdapter): boolean {
  return getSetting(db, ONBOARDING_COMPLETE_KEY) === '1';
}

// --- Runtime signals so OnboardingGate and CommunityInviteLinkListener (both
// always-on siblings in (root)/_layout.tsx) coordinate without stacking modals
// (M1). Module-level singletons: the app mounts one of each.

const completeListeners = new Set<() => void>();

/** Subscribe to onboarding-completion events (returns an unsubscribe fn). */
export function subscribeOnboardingComplete(listener: () => void): () => void {
  completeListeners.add(listener);
  return () => {
    completeListeners.delete(listener);
  };
}

/**
 * Persist the completion flag WITHOUT notifying gate listeners. Used at community
 * CREATION (m2) so a kill at the first-message step never restarts onboarding
 * (which would let a duplicate default-named community be created), while the
 * gate stays visible for the first-message step until the user finishes it.
 */
export function persistOnboardingComplete(db: DatabaseAdapter): void {
  setSetting(db, ONBOARDING_COMPLETE_KEY, '1');
}

/**
 * Mark onboarding complete AND notify subscribers so the gate dismisses at
 * runtime (e.g. a deep-link invite join that completes onboarding externally).
 * Idempotent; the browse path writes ONLY this flag, no identity-adjacent state.
 */
export function markOnboardingComplete(db: DatabaseAdapter): void {
  persistOnboardingComplete(db);
  for (const listener of completeListeners) listener();
}

// A deep-link community invite sheet is pending: the gate suppresses its own
// modal while true, so the InvitePreviewSheet is the ONLY visible modal (M1).
let invitePending = false;
const invitePendingListeners = new Set<() => void>();

export function setDeepLinkInvitePending(pending: boolean): void {
  if (invitePending === pending) return;
  invitePending = pending;
  for (const listener of invitePendingListeners) listener();
}

export function getDeepLinkInvitePending(): boolean {
  return invitePending;
}

export function subscribeDeepLinkInvitePending(listener: () => void): () => void {
  invitePendingListeners.add(listener);
  return () => {
    invitePendingListeners.delete(listener);
  };
}

/** A one-tap suggested display name (the current default; no network). */
export function suggestedDisplayName(current: string): string {
  const trimmed = current.trim();
  return trimmed.length > 0 ? trimmed : 'My Meerkat';
}
