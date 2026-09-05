// add-friend-core.ts: pure relay resolution for the Add-friend flow (Plan 31
// Phase 0, T0.4 / TC-2). The flow shows ZERO transport configuration: it resolves
// a dialable relay ONLY through effectiveRelayUrl(db) (the health-gated,
// opt-out-aware choke point), never the raw relay setting. When nothing resolves
// the screen falls back to the real ConnectionStatusCard probe state under a
// single honest line -- never a roadmap promise (NC-3).

import type { DatabaseAdapter } from '@mylife/db';
import { isValidCustomFriendCode, isValidFriendCode, parseExtendedFriendCode } from '@mylife/sync';
import { effectiveRelayUrl, ensureEffectiveRelayUrl } from './effective-relay';

/**
 * The one static line shown above ConnectionStatusCard when no relay resolves.
 * Deliberately says nothing about a free default arriving: that claim turns false
 * on opt-out, on a failed probe, and if founder-ops never deploys.
 */
export const ADD_FRIEND_NEEDS_SERVER_LINE = 'Adding a friend needs a connection server.';

export interface AddFriendRelayState {
  /** The dialable relay URL, or '' when nothing resolves. */
  relayUrl: string;
  /** True when effectiveRelayUrl resolved a dialable ws/wss address. */
  canResolve: boolean;
}

/** Resolve the effective relay for publishing / adding a friend (display gate). */
export function resolveAddFriendRelay(db: DatabaseAdapter): AddFriendRelayState {
  const relayUrl = effectiveRelayUrl(db);
  return { relayUrl, canResolve: relayUrl.startsWith('ws') };
}

/**
 * The DIAL-path resolver (rc13 defect 2): same result shape, but re-probes a
 * stale free-default /healthz cache on demand through ensureEffectiveRelayUrl
 * before concluding no relay exists. Every publish/add action awaits this; the
 * sync resolveAddFriendRelay remains for render-time display gating only.
 */
export async function ensureAddFriendRelay(db: DatabaseAdapter): Promise<AddFriendRelayState> {
  const relayUrl = await ensureEffectiveRelayUrl(db);
  return { relayUrl, canResolve: relayUrl.startsWith('ws') };
}

/**
 * True when a scanned / typed value is a plausibly well-formed friend code: a
 * standard checksummed code OR a custom vanity code. This is a cheap front gate
 * so the scanner can reject obvious garbage instantly with an honest error,
 * before any relay round-trip. It is NOT a trust decision: real resolution and
 * signature verification still happen in pairWithFriendCode.
 */
export function isPlausibleFriendCode(code: string): boolean {
  const trimmed = code.trim();
  // D.5: an extended (sealed) code is `<public code>~<secret half>`; validate it
  // by parsing off the secret half. A bare public code is still accepted.
  if (parseExtendedFriendCode(trimmed)) return true;
  return isValidFriendCode(trimmed) || isValidCustomFriendCode(trimmed);
}
