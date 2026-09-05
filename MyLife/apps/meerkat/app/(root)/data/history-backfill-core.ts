// history-backfill-core.ts: the member-to-member feed backfill serve + apply
// handlers (community feed Phase 3).
//
// With NO community node, member B reconstructs the channel feed from member A
// over the EXACT pair-private mailbox path (sealed FILE-style envelopes parked
// on the relay). This file builds the two halves of that exchange as drain
// handlers, wired into buildDrainHandlers so foreground AND background drains
// serve + apply backfill the same way (one dispatcher, no drift).
//
// VERIFY ON BOTH SIDES (Critical):
//   - SERVE (historyRequest): gate the requester FIRST (fail-closed: not
//     revoked, an ACTIVE non-removed member, descriptor exists). Then take the
//     local events strictly after the requested cursor, re-verify EACH
//     (verifyChannelMessage) AND role-gate EACH (evaluateChannelPost against the
//     descriptor) so a non-member/role-denied author's event is never served,
//     cap the batch, seal a HISTORY_GRANT, and park it on the requester's
//     mailbox token via an injected parkEnvelope. Return true iff a grant was
//     really parked.
//   - APPLY (historyGrant): re-verify EVERY event again
//     (mergeChannelMessageEvents verifies) AND role-gate EACH against OUR
//     descriptor, merge the valid ones, then advance the feed cursor (row-only)
//     to the highest merged HLC. Return true iff inserted > 0.
//
// No new crypto: this reuses @mylife/sync mailbox seal/open, verifyChannelMessage,
// evaluateChannelPost, and the app's mergeChannelMessageEvents + cursor helpers.
//
// Pure: takes a DatabaseAdapter + injected deps, no native modules. Tested with
// an in-memory db over a real relay.

import type { DatabaseAdapter } from '@mylife/db';
import {
  evaluateChannelPost,
  getCommunity,
  isAfterCursor,
  isDeviceRevoked,
  isServableEvent,
  sealHistoryGrantMailbox,
  verifyChannelMessage,
  HISTORY_GRANT_MAX_EVENTS,
  type ChannelMessageEvent,
  type DeviceIdentity,
  type Hlc,
  type HistoryGrantMailboxPayload,
  type HistoryRequestMailboxPayload,
  type MailboxEnvelope,
  type MailboxEnvelopeHandlers,
} from '@mylife/sync';
import {
  getFeedCursor,
  listChannelMessageEvents,
  mergeChannelMessageEvents,
  setFeedCursor,
} from './community-core';
import { isActiveCommunityMember } from './file-request-core';

/** Highest HLC across a set of events (the cursor advance target on apply). */
function highestEventHlc(events: readonly ChannelMessageEvent[]): Hlc | null {
  let highest: Hlc | null = null;
  for (const event of events) {
    if (
      !highest
      || event.hlc.wall > highest.wall
      || (event.hlc.wall === highest.wall && event.hlc.counter > highest.counter)
    ) {
      highest = event.hlc;
    }
  }
  return highest;
}

export interface BuildHistoryBackfillHandlersDeps {
  db: DatabaseAdapter;
  /** This device's identity (signs the served grant). */
  identity: DeviceIdentity;
  /**
   * Resolve the pairing shared secret + the peer's DH public key for a device.
   * Null when the peer is not a usable pairing (revoked / not paired / no
   * secret), so the serve side cannot address them and drops fail-closed.
   */
  resolvePeer: (deviceId: string) => { dhPublicKey: string; sharedSecretHex: string } | null;
  /**
   * Park an already-sealed envelope on a mailbox token (the relay store-and-
   * forward). Injected so this file stays testable (no relay backend here).
   * Returns true iff the park really happened.
   */
  parkEnvelope: (token: string, envelope: MailboxEnvelope) => boolean | Promise<boolean>;
  /** Clock for the sealed grant timestamp (test injection). */
  now?: () => string;
}

/**
 * Build the per-kind history-backfill drain handlers (serve + apply). Returns a
 * PARTIAL MailboxEnvelopeHandlers so it composes with the channel/file handlers.
 */
export function buildHistoryBackfillHandlers(
  deps: BuildHistoryBackfillHandlersDeps,
): Pick<MailboxEnvelopeHandlers, 'historyRequest' | 'historyGrant'> {
  const { db, identity, resolvePeer, parkEnvelope } = deps;
  const nowFn = deps.now ?? (() => new Date().toISOString());

  return {
    // SERVE side -----------------------------------------------------------
    historyRequest: async (
      senderDeviceId: string,
      payload: HistoryRequestMailboxPayload,
    ): Promise<boolean> => {
      // Gate the requester FIRST, fail-closed. A revoked, removed, or non-member
      // requester is served NOTHING (no grant parked).
      if (isDeviceRevoked(db, senderDeviceId)) return false;
      if (!isActiveCommunityMember(db, payload.communityId, senderDeviceId)) return false;

      const community = getCommunity(db, payload.communityId);
      if (!community) return false;
      const descriptor = community.descriptor;

      // The requester must also be entitled to READ this channel. evaluateChannelPost
      // is the post-rights gate; for read entitlement we require channel existence
      // + active membership, which membership already covers. A role-restricted
      // channel still serves history to any member who can post or read it; the
      // descriptor has no separate read-role today, so membership is the gate.
      const channelExists = descriptor.channels.some((c) => c.id === payload.channelId);
      if (!channelExists) return false;

      // Take the local events strictly after the requested cursor, re-verify and
      // role-gate EACH author so a non-member / role-denied author's event is
      // never served (drop garbage, never seal it).
      const all = listChannelMessageEvents(db, payload.communityId, payload.channelId);
      const servable: ChannelMessageEvent[] = [];
      for (const event of all) {
        if (!isAfterCursor(event, payload.sinceWall, payload.sinceCounter)) continue;
        if (!isServableEvent(event)) continue; // shape + signature re-check
        if (!evaluateChannelPost(descriptor, event.authorDeviceId, payload.channelId).allowed) {
          continue;
        }
        servable.push(event);
        if (servable.length >= HISTORY_GRANT_MAX_EVENTS) {
          // Cap reached: serve this bounded batch. The requester re-asks with an
          // advanced cursor to page the rest. (Honest: the grant is partial.)
          break;
        }
      }

      // Nothing to serve: do NOT park an empty grant (no real backfill moved).
      if (servable.length === 0) return false;

      const peer = resolvePeer(senderDeviceId);
      if (!peer) return false;

      const grantPayload: HistoryGrantMailboxPayload = {
        kind: 'meerkat.history-grant-v1',
        version: 1,
        communityId: payload.communityId,
        channelId: payload.channelId,
        requestId: payload.requestId,
        events: servable,
      };
      const sealed = sealHistoryGrantMailbox({
        sender: identity,
        recipient: { deviceId: senderDeviceId, dhPublicKey: peer.dhPublicKey },
        pairSharedSecretHex: peer.sharedSecretHex,
        payload: grantPayload,
        now: nowFn(),
      });

      const parked = await parkEnvelope(sealed.token, sealed.envelope);
      return parked === true;
    },

    // APPLY side -----------------------------------------------------------
    historyGrant: (
      _senderDeviceId: string,
      payload: HistoryGrantMailboxPayload,
    ): boolean => {
      const community = getCommunity(db, payload.communityId);
      // Without OUR descriptor we cannot role-gate the served events; fail-closed.
      if (!community) return false;
      const descriptor = community.descriptor;

      // Re-verify + role-gate every event against OUR descriptor before merge. A
      // tampered or non-member-authored event is dropped here (defense in depth;
      // mergeChannelMessageEvents re-verifies signatures too).
      const valid: ChannelMessageEvent[] = [];
      for (const event of payload.events) {
        if (event.communityId !== payload.communityId) continue;
        if (event.channelId !== payload.channelId) continue;
        if (!verifyChannelMessage(event)) continue;
        if (!evaluateChannelPost(descriptor, event.authorDeviceId, payload.channelId).allowed) {
          continue;
        }
        valid.push(event);
      }

      if (valid.length === 0) return false;

      const merge = mergeChannelMessageEvents(db, valid);
      if (merge.inserted <= 0) return false;

      // Advance the feed cursor (row-only) to the highest merged HLC. Only the
      // events that actually inserted matter, but the highest of the verified
      // batch is a safe floor; recompute against what is now stored.
      const stored = listChannelMessageEvents(db, payload.communityId, payload.channelId);
      const highest = highestEventHlc(stored);
      if (highest) {
        const cursor = getFeedCursor(db, payload.communityId, payload.channelId);
        if (
          !cursor
          || highest.wall > cursor.wall
          || (highest.wall === cursor.wall && highest.counter > cursor.counter)
        ) {
          setFeedCursor(db, payload.communityId, payload.channelId, highest);
        }
      }
      return true;
    },
  };
}
