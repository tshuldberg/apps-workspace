// Verify-to-view honest state + copy (Plan 39 P9). The public tier requires a verified session
// to VIEW first-party gated surfaces. This module is the honest state + the verbatim locked-feed
// copy the Public surface renders, plus the self-hosted boundary notice (NC-P4: we never claim a
// gate a third-party node does not enforce). Twin of apps/meerkat-web/src/lib/verify-to-view.ts.

import type { DatabaseAdapter } from '@mylife/db';
import { MEERKAT_APP_UNLOCK_PRODUCT } from '@mylife/billing-config';
import { getStoredPersona, hasValidStoredSession, isPersonaServiceConfigured, type PersonaServiceConfig } from './persona-core';

// Price label comes from @mylife/billing-config directly (pure, no react-native), never a hardcoded literal (NC-P5).
const UNLOCK_PRICE_LABEL = `$${MEERKAT_APP_UNLOCK_PRODUCT.price.toFixed(2)}`;

export type VerifyToViewState = 'not_configured' | 'locked' | 'needs_session' | 'verified';

/**
 * The honest verify-to-view state for a first-party gated surface:
 *  - not_configured: no account server in this build, so public accounts are off.
 *  - locked: an account server exists but this device has no public persona yet -> the locked feed.
 *  - needs_session: a persona exists but there is no valid session bearer yet -> the surface must
 *    acquire one (ensurePersonaSession) BEFORE reading; it must NOT issue unauthenticated reads.
 *  - verified: a persona AND a valid cached session exist -> the feed is actually viewable now.
 * Only `verified` means the gated reads will succeed; the surface never treats the feed as open
 * without a real session.
 */
export function verifyToViewState(db: DatabaseAdapter, config: PersonaServiceConfig, nowMs: number = Date.now()): VerifyToViewState {
  if (!isPersonaServiceConfigured(config)) return 'not_configured';
  if (!getStoredPersona(db)) return 'locked';
  return hasValidStoredSession(db, nowMs) ? 'verified' : 'needs_session';
}

// Verbatim locked-feed copy (Plan 39 mockup S1) + the honesty-page boundary (S14).
export const VERIFY_TO_VIEW_LOCKED_TITLE = 'The public side of Meerkat is people-only';
export const VERIFY_TO_VIEW_LOCKED_BODY = 'Every account here belongs to a verified human. Verify once on this device to browse the public feed. It takes about a minute and costs nothing.';
export const VERIFY_TO_VIEW_PRICE_LINE = `Viewing is free. Posting needs the one-time ${UNLOCK_PRICE_LABEL} unlock.`;
export const VERIFY_TO_VIEW_NOT_CONFIGURED = 'The public feed needs a connection to a Meerkat account server, and this build has none configured. Your private Meerkat works fully without it.';
/** NC-P4 honesty boundary: self-hosted third-party nodes may serve openly; we label them. */
export const SELF_HOSTED_BOUNDARY_NOTICE = "Communities hosted on their owners' own hardware may be reachable without verification. We label them.";

/** One honest line describing the current verify-to-view state (for a banner/empty state). */
export function describeVerifyToView(state: VerifyToViewState): string {
  switch (state) {
    case 'not_configured':
      return VERIFY_TO_VIEW_NOT_CONFIGURED;
    case 'locked':
      return VERIFY_TO_VIEW_LOCKED_BODY;
    case 'needs_session':
      return 'Reconnecting your public session...';
    case 'verified':
      return 'You are verified. The public feed is open to you.';
  }
}
