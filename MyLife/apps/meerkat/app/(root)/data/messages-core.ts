// messages-core.ts: pure, native-free model for the Messages shell (Plan 31
// Phase 0, T0.3). The Messages screen shows two sections: "Chats" (real private
// 1:1 + group DMs, Plan 21 Phase 5) and "People" (real paired friends). This
// module owns the person-sheet action model so the decisions are testable under
// Node and cannot drift into a fake-chat / fake-presence state (NC-2). Message is
// enabled once Plan 21 flipped DM_MESSAGES_SURFACE_AVAILABLE; the live Chats empty
// state now lives in dm-view-core (DM_NO_CONVERSATIONS_EMPTY_STATE).

import type { FriendRow } from './friends-core';
import { DM_MESSAGES_SURFACE_AVAILABLE } from './share-route';

/**
 * The honest empty state for the Chats section. Private messages are live, so an
 * empty store means no conversations yet (never a fake row, never a schedule
 * promise). The Messages screen renders DM_NO_CONVERSATIONS_EMPTY_STATE from
 * dm-view-core; this constant is kept for reference and NEVER claims DMs are
 * unavailable.
 */
export const NO_PRIVATE_CHATS_EMPTY_STATE =
  'No conversations yet. Add a friend, then tap New to start a private chat.';

export interface PersonSheetModel {
  deviceId: string;
  displayName: string;
  shortDeviceId: string;
  trustState: FriendRow['trustState'];
  safetyLabel: FriendRow['safetyLabel'];
  /** Offer "mark safety code checked" only for an unverified, unblocked peer. */
  canMarkSafetyChecked: boolean;
  /** Offer Block for any peer that is not already blocked (reuses revokePeer). */
  canBlock: boolean;
  /** Message tracks the DM surface flag (DM_MESSAGES_SURFACE_AVAILABLE, now live). */
  messageEnabled: boolean;
}

/** Derive the person action-sheet model for a friend row. */
export function buildPersonSheetModel(row: FriendRow): PersonSheetModel {
  return {
    deviceId: row.deviceId,
    displayName: row.displayName,
    shortDeviceId: row.shortDeviceId,
    trustState: row.trustState,
    safetyLabel: row.safetyLabel,
    canMarkSafetyChecked: row.trustState === 'unknown',
    canBlock: row.trustState !== 'blocked',
    messageEnabled: DM_MESSAGES_SURFACE_AVAILABLE,
  };
}
