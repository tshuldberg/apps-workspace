// onboarding-core.ts (web twin of apps/meerkat/app/(root)/data/onboarding-core.ts).
// Pure onboarding v2 copy + suggested-name helpers (Plan 31 P5 / design decision
// 7). Step 2 is ONE list of four choices; the browse path completes onboarding
// with NO identity/community side effects. Kept native-free + lockstep with the
// mobile row copy (parity guard). The web has no DB-signal singletons (its
// onboarding is a single always-mounted overlay, not two sibling gates), so only
// the choice list + suggested name are twinned here.

export type OnboardingStartOption = 'create' | 'join' | 'add_friend' | 'browse';

export interface OnboardingStartRow {
  option: OnboardingStartOption;
  title: string;
  detail: string;
}

/** The four Step-2 choices (design decision 7), in order. Byte-lockstep with mobile. */
export const ONBOARDING_START_ROWS: readonly OnboardingStartRow[] = [
  { option: 'create', title: 'Create a community', detail: 'Make a private space with a general channel.' },
  { option: 'join', title: 'Join with an invite', detail: 'Scan a QR or paste a link, then preview before joining.' },
  { option: 'add_friend', title: 'Add a friend', detail: 'Share your code, or add someone by theirs.' },
  { option: 'browse', title: 'Just look around', detail: 'Explore first. You can create or join anytime.' },
];

/** A one-tap suggested display name (the current default; no network). */
export function suggestedDisplayName(current: string): string {
  const trimmed = current.trim();
  return trimmed.length > 0 ? trimmed : 'My Meerkat';
}
