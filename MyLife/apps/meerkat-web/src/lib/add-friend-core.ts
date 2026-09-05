// add-friend-core.ts (web twin of apps/meerkat/app/(root)/data/add-friend-core.ts).
// Pure relay resolution for the Add-friend flow (Plan 31 Phase 5 / TC-2). The flow
// shows ZERO transport configuration: it resolves a dialable relay ONLY through
// effectiveRelayUrl(db) (the health-gated, opt-out-aware choke point), never the
// raw relay setting. When nothing resolves, the surface falls back to the real
// ConnectionStatusCard probe state under a single honest line -- never a roadmap
// promise (NC-3). Kept native-free + lockstep with the mobile source.

import type { DatabaseAdapter } from '@mylife/db';
import { isValidCustomFriendCode, isValidFriendCode, parseExtendedFriendCode } from '@mylife/sync';
import { effectiveRelayUrl, ensureEffectiveRelayUrl } from './effective-relay';

/**
 * Web-only honesty line (Plan 53 P2): the in-person proximity ceremony runs
 * over the phones' nearby radios (Multipeer / Wi-Fi Direct), which no web
 * browser can use. This surface states that plainly and keeps QR + friend
 * codes; it must never imply proximity adding is possible here (AC-6).
 * Platform preamble: lives above the CORE_TWINS anchor (sanctioned web-only).
 */
export const ADD_FRIEND_IN_PERSON_WEB_LINE =
  'Adding a friend in person, by holding two phones near each other, is a Meerkat mobile app feature. A web browser cannot use the nearby radio, so on this device share the QR code or a friend code instead.';

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
 * so obvious garbage is rejected instantly with an honest error, before any relay
 * round-trip. It is NOT a trust decision: real resolution and signature
 * verification still happen in pairWithFriendCode.
 */
export function isPlausibleFriendCode(code: string): boolean {
  const trimmed = code.trim();
  // D.5: an extended (sealed) code is `<public code>~<secret half>`; validate it
  // by parsing off the secret half. A bare public code is still accepted.
  if (parseExtendedFriendCode(trimmed)) return true;
  return isValidFriendCode(trimmed) || isValidCustomFriendCode(trimmed);
}
