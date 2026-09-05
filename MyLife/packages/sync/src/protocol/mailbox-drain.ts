/**
 * Mailbox drain (Task 3, background sync RECEIVE side).
 *
 * The honest, asymmetric half of "background sync". When this device was
 * offline, paired peers parked SEALED channel-message deltas in this device's
 * pair-private mailbox on the relay (the SEND side is
 * SyncProvider.queueChannelMessageMailbox, MK-057). On wake -- foreground or a
 * best-effort background run -- this job joins each mailbox token, collects the
 * ciphertext the relay drains on join, opens+verifies it with THIS device's
 * identity, and applies the verified events. Because the recipient mailbox is
 * addressed by a token derived from the pairing secret and this device's id,
 * the drain genuinely works with no peer online: the relay buffered the deltas.
 *
 * Fail-closed: any envelope that fails signature, names a different recipient,
 * or will not decrypt is dropped and counted as `rejected`; NOTHING is written.
 * Revoked peers and peers with no shared secret are skipped entirely -- no
 * token is derived and no relay join is attempted for them, so a revoked device
 * cannot even be addressed.
 *
 * The drain reuses deriveMailboxToken + decodeMailboxEnvelope +
 * openChannelMessageMailboxDelta VERBATIM. It adds NO new wire fields; the
 * relay still sees only a 64-hex token and ciphertext sizes.
 *
 * RN-safe: zero expo/native imports. The relay backend, the clock, the wait
 * primitive, and the cm_ apply function are all injected.
 */

import type { DeviceIdentity, PairedDevice } from '../types';
import type { RelayBackend } from '../transport/relay-transport';
import type { ChannelMessageEvent } from './channel-message';
import { verifyChannelMessage } from './channel-message';
import { deriveMailboxDrainTokens, decodeMailboxEnvelope } from './mailbox';
import { openChannelMessageMailboxDelta } from './channel-mailbox';
import { applyMailboxEnvelope, type MailboxEnvelopeHandlers } from './mailbox-dispatch';

/** Result of merging verified events into local storage (matches mergeChannelMessageEvents). */
export interface ApplyChannelEventsResult {
  inserted: number;
  skipped: number;
  invalid: number;
}

/** Apply verified channel events into local cm_ storage (injected by the app). */
export type ApplyChannelEvents = (events: ChannelMessageEvent[]) => ApplyChannelEventsResult;

export interface MailboxDrainPeer {
  deviceId: string;
  /** Pairing shared secret (hex), or null when unavailable. */
  pairSharedSecretHex: string | null;
  /** Whether this peer has been revoked locally. */
  revoked: boolean;
  /** Whether this peer is still active. */
  isActive: boolean;
}

export interface RunMailboxDrainJobOptions {
  /** This device's identity (opens envelopes sealed to its DH key). */
  identity: DeviceIdentity;
  /** Relay backend (real WebSocket backend in app, simulated in tests). */
  backend: RelayBackend;
  /** Relay WebSocket URL. */
  relayUrl: string;
  /** Signed hosted entitlement token for first-party hosted relays. */
  entitlementToken?: string;
  /** The peers whose mailboxes to drain. */
  peers: readonly MailboxDrainPeer[];
  /**
   * Apply verified channel events into local storage (cm_messages merge). Legacy
   * single-kind shape: equivalent to handlers: { channelMessage: applyEvents }.
   * Provide either applyEvents OR handlers (handlers wins if both are present).
   */
  applyEvents?: ApplyChannelEvents;
  /**
   * Per-kind handlers (Phase 3). When present, every drained envelope is routed
   * through applyMailboxEnvelope so the channel-message, file-request, and
   * file-grant kinds are handled by the ONE dispatcher (foreground + background
   * drains cannot drift). An unknown kind is dropped fail-closed and counted as
   * rejected, preserving the rejected-count contract.
   */
  handlers?: MailboxEnvelopeHandlers;
  /**
   * Extra community-derived tokens to drain AFTER the peer loop, each labeled.
   * Unlike a peer mailbox (a pair-private token addressed by a pairing secret),
   * these are COMMUNITY-scoped tokens (deriveCommunityJoinToken / a notify token)
   * addressed to THIS device by id: an owner drains its community join-request
   * token, a joiner drains its join-grant token. Each is connected + drained with
   * the SAME dispatcher (applyMailboxEnvelope), and the counts fold into the job
   * result as a perPeer-style entry labeled by `label`.
   */
  extraTokens?: readonly { token: string; label: string }[];
  /**
   * Wait for the relay to drain its buffered envelopes after join, before
   * closing. Defaults to a short real delay; injected as an instant resolve in
   * tests after the simulated backend has delivered.
   */
  waitForDrain?: () => Promise<void>;
  /**
   * Wall-clock ms used to derive the day-bucketed mailbox token window
   * (current + previous UTC day). Defaults to the real clock; tests inject it.
   */
  nowMs?: number;
}

export interface MailboxDrainPeerResult {
  deviceId: string;
  /** Envelopes the relay delivered on join. */
  drained: number;
  /** Verified channel events actually applied into local storage. */
  applied: number;
  /** Envelopes dropped fail-closed (bad signature / wrong recipient / undecryptable / unknown kind). */
  rejected: number;
  /** Incoming file-request envelopes applied (a real cm_file_requests row written). */
  fileRequests: number;
  /** Incoming file-grant envelopes applied (a restore or a recorded decline). */
  fileGrants: number;
  /** Incoming history-request envelopes served (a real backfill grant parked). */
  historyRequests: number;
  /** Incoming history-grant envelopes applied (verified events merged). */
  historyGrants: number;
  /** Incoming join-request envelopes served (a real join grant parked). */
  joinRequests: number;
  /** Incoming join-grant envelopes applied (the joiner now holds an epoch key). */
  joinGrants: number;
  /** Incoming PUBLIC-join request envelopes recorded into the owner's review queue (NO key handed off). */
  publicJoinRequests: number;
  /** Incoming 1:1 DM message envelopes applied (Plan 21 Phase 2). */
  dmMessages: number;
  /** Incoming DM delivery/read receipt envelopes applied (Plan 21 Phase 2). */
  dmReceipts: number;
  /** Incoming GROUP DM epoch commit handoffs applied (Plan 21 Phase 6). */
  dmGroupCommits: number;
  /** Incoming DM shreds applied (local rows deleted, Plan 21 Phase 8). */
  dmShreds: number;
  /** Incoming community member-removals applied (Plan 28 P2). */
  memberRemovals: number;
  /** Incoming opt-in presence beacons stored device-local (Plan 29 P6). */
  presenceBeacons: number;
  /** Incoming person-group attestation proposals handled (Plan 52 P1). */
  personGroupProposals: number;
  /** Incoming person-group attestation accepts handled (Plan 52 P1). */
  personGroupAccepts: number;
  /** Incoming DM-peer person announces applied (Plan 52 P2). */
  personAnnounces: number;
  /** A connection error for this peer's mailbox, when one occurred. */
  error?: string;
}

export interface MailboxDrainJobResult {
  /** Peers attempted (a token derived and a relay join made). */
  attempted: number;
  /** Peers skipped (revoked, inactive, or no shared secret). */
  skipped: number;
  drained: number;
  applied: number;
  rejected: number;
  /** Incoming file-request envelopes applied across all peers. */
  fileRequests: number;
  /** Incoming file-grant envelopes applied across all peers. */
  fileGrants: number;
  /** Incoming history-request envelopes served across all peers (backfill grants parked). */
  historyRequests: number;
  /** Incoming history-grant envelopes applied across all peers (events merged). */
  historyGrants: number;
  /** Incoming join-request envelopes served across all peers + extra tokens. */
  joinRequests: number;
  /** Incoming join-grant envelopes applied across all peers + extra tokens. */
  joinGrants: number;
  /** Incoming PUBLIC-join request envelopes recorded across all peers + extra tokens. */
  publicJoinRequests: number;
  /** Incoming 1:1 DM message envelopes applied across all peers (Plan 21 Phase 2). */
  dmMessages: number;
  /** Incoming DM delivery/read receipt envelopes applied across all peers (Plan 21 Phase 2). */
  dmReceipts: number;
  /** Incoming GROUP DM epoch commit handoffs applied across all peers (Plan 21 Phase 6). */
  dmGroupCommits: number;
  /** Incoming DM shreds applied across all peers (Plan 21 Phase 8). */
  dmShreds: number;
  /** Incoming community member-removals applied across all peers + extra tokens (Plan 28 P2). */
  memberRemovals: number;
  /** Incoming opt-in presence beacons stored across all peers (Plan 29 P6). */
  presenceBeacons: number;
  /** Incoming person-group attestation proposals handled across all peers (Plan 52 P1). */
  personGroupProposals: number;
  /** Incoming person-group attestation accepts handled across all peers (Plan 52 P1). */
  personGroupAccepts: number;
  /** Incoming DM-peer person announces applied across all peers (Plan 52 P2). */
  personAnnounces: number;
  perPeer: MailboxDrainPeerResult[];
}

const DEFAULT_DRAIN_WAIT_MS = 250;

function defaultWaitForDrain(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, DEFAULT_DRAIN_WAIT_MS);
    (timer as { unref?: () => void }).unref?.();
  });
}

/**
 * Open+verify a single drained envelope and apply its events fail-closed.
 * Exported so the live channel-message receive path can share the exact same
 * verify+merge logic later (the SEND side already exists; this is its twin).
 */
export function applyDrainedChannelEvents(
  recipient: DeviceIdentity,
  envelopeBytes: Uint8Array,
  applyEvents: ApplyChannelEvents,
): { applied: number; rejected: boolean } {
  const envelope = decodeMailboxEnvelope(envelopeBytes);
  if (!envelope) return { applied: 0, rejected: true };

  const opened = openChannelMessageMailboxDelta(recipient, envelope);
  if (!opened.ok) return { applied: 0, rejected: true };

  // Defense in depth: openChannelMessageMailboxDelta already verifies each
  // event, but never trust a sealed payload's self-claim without re-checking
  // the signature before it touches the database.
  const verified = opened.events.filter((event) => verifyChannelMessage(event));
  if (verified.length === 0) return { applied: 0, rejected: true };

  const merged = applyEvents(verified);
  return { applied: merged.inserted, rejected: merged.inserted === 0 };
}

/**
 * Drain every eligible paired device's mailbox and apply verified deltas.
 * Returns honest counts; it never reports delivery it did not apply.
 */
export async function runMailboxDrainJob(
  options: RunMailboxDrainJobOptions,
): Promise<MailboxDrainJobResult> {
  const waitForDrain = options.waitForDrain ?? defaultWaitForDrain;
  const url = options.relayUrl.trim();

  // Resolve the per-kind handlers ONCE. The legacy applyEvents shape becomes the
  // channel-message handler, so both the foreground and background drains route
  // every kind through the one dispatcher and cannot drift.
  const handlers: MailboxEnvelopeHandlers = options.handlers
    ?? (options.applyEvents ? { channelMessage: options.applyEvents } : {});

  const result: MailboxDrainJobResult = {
    attempted: 0,
    skipped: 0,
    drained: 0,
    applied: 0,
    rejected: 0,
    fileRequests: 0,
    fileGrants: 0,
    historyRequests: 0,
    historyGrants: 0,
    joinRequests: 0,
    joinGrants: 0,
    publicJoinRequests: 0,
    dmMessages: 0,
    dmReceipts: 0,
    dmGroupCommits: 0,
    dmShreds: 0,
    memberRemovals: 0,
    presenceBeacons: 0,
    personGroupProposals: 0,
    personGroupAccepts: 0,
    personAnnounces: 0,
    perPeer: [],
  };

  if (!url) {
    // No relay configured: every peer is skipped, nothing is attempted.
    result.skipped = options.peers.length;
    return result;
  }

  /**
   * Connect a single token, collect what the relay drains on join, route each
   * envelope through the ONE dispatcher, and fold the counts into `into`. Shared
   * by the peer loop and the extra-token loop so the two cannot drift.
   */
  const drainToken = async (
    deviceId: string,
    token: string,
    into: MailboxDrainPeerResult,
  ): Promise<void> => {
    let session;
    try {
      session = await options.backend.connect(url, token, {
        entitlementToken: options.entitlementToken,
      });
    } catch (error) {
      into.error = error instanceof Error ? error.message : String(error);
      return;
    }

    const collected: Uint8Array[] = [];
    session.onMessage((bytes) => collected.push(new Uint8Array(bytes)));

    try {
      await waitForDrain();
    } finally {
      try {
        await session.close();
      } catch {
        // a close failure must not mask what was already drained
      }
    }

    for (const bytes of collected) {
      into.drained += 1;
      let outcome;
      try {
        outcome = await applyMailboxEnvelope(options.identity, bytes, handlers);
      } catch {
        // A handler that throws on one envelope (e.g. malformed remote input) must
        // never abort the whole drain. Count it rejected and keep going.
        into.rejected += 1;
        continue;
      }
      switch (outcome.kind) {
        case 'channel-message':
          into.applied += outcome.applied;
          break;
        case 'file-request':
          into.fileRequests += 1;
          break;
        case 'file-grant':
          into.fileGrants += 1;
          break;
        case 'history-request':
          into.historyRequests += 1;
          break;
        case 'history-grant':
          into.historyGrants += 1;
          break;
        case 'join-request':
          into.joinRequests += 1;
          break;
        case 'join-grant':
          into.joinGrants += 1;
          break;
        case 'public-join-request':
          into.publicJoinRequests += 1;
          break;
        case 'dm-message':
          into.dmMessages += 1;
          break;
        case 'dm-receipt':
          into.dmReceipts += 1;
          break;
        case 'dm-group-commit':
          into.dmGroupCommits += 1;
          break;
        case 'dm-shred':
          into.dmShreds += 1;
          break;
        case 'member-removal':
          into.memberRemovals += 1;
          break;
        case 'presence-beacon':
          into.presenceBeacons += 1;
          break;
        case 'person-group-propose':
          into.personGroupProposals += 1;
          break;
        case 'person-group-accept':
          into.personGroupAccepts += 1;
          break;
        case 'person-group-announce':
          into.personAnnounces += 1;
          break;
        case 'rejected':
          into.rejected += 1;
          break;
        default: {
          const _exhaustive: never = outcome;
          void _exhaustive;
          into.rejected += 1;
        }
      }
    }
    void deviceId;
  };

  const foldInto = (peerResult: MailboxDrainPeerResult): void => {
    result.drained += peerResult.drained;
    result.applied += peerResult.applied;
    result.rejected += peerResult.rejected;
    result.fileRequests += peerResult.fileRequests;
    result.fileGrants += peerResult.fileGrants;
    result.historyRequests += peerResult.historyRequests;
    result.historyGrants += peerResult.historyGrants;
    result.joinRequests += peerResult.joinRequests;
    result.joinGrants += peerResult.joinGrants;
    result.publicJoinRequests += peerResult.publicJoinRequests;
    result.dmMessages += peerResult.dmMessages;
    result.dmReceipts += peerResult.dmReceipts;
    result.dmGroupCommits += peerResult.dmGroupCommits;
    result.dmShreds += peerResult.dmShreds;
    result.memberRemovals += peerResult.memberRemovals;
    result.presenceBeacons += peerResult.presenceBeacons;
    result.personGroupProposals += peerResult.personGroupProposals;
    result.personGroupAccepts += peerResult.personGroupAccepts;
    result.personAnnounces += peerResult.personAnnounces;
    result.perPeer.push(peerResult);
  };

  const emptyPeerResult = (deviceId: string): MailboxDrainPeerResult => ({
    deviceId,
    drained: 0,
    applied: 0,
    rejected: 0,
    fileRequests: 0,
    fileGrants: 0,
    historyRequests: 0,
    historyGrants: 0,
    joinRequests: 0,
    joinGrants: 0,
    publicJoinRequests: 0,
    dmMessages: 0,
    dmReceipts: 0,
    dmGroupCommits: 0,
    dmShreds: 0,
    memberRemovals: 0,
    presenceBeacons: 0,
    personGroupProposals: 0,
    personGroupAccepts: 0,
    personAnnounces: 0,
  });

  for (const peer of options.peers) {
    // Skip-entirely cases: no token derived, no relay join attempted.
    if (peer.revoked || !peer.isActive || !peer.pairSharedSecretHex) {
      result.skipped += 1;
      continue;
    }

    result.attempted += 1;
    const peerResult = emptyPeerResult(peer.deviceId);
    // ONE dispatcher path for every kind (channel-message, file-request/grant,
    // history-request/grant, join-request/grant). An unknown / forged /
    // undecryptable envelope (or a handler that applied nothing, e.g. an
    // all-duplicate batch) is counted rejected, so the caller never overstates
    // delivery. Tokens rotate daily (v2), so the drain covers the current AND
    // previous UTC day bucket: with the 24h relay mailbox TTL that window holds
    // every live parked envelope.
    for (const token of deriveMailboxDrainTokens(
      peer.pairSharedSecretHex,
      options.identity.publicKey,
      options.nowMs ?? Date.now(),
    )) {
      await drainToken(peer.deviceId, token, peerResult);
    }
    foldInto(peerResult);
  }

  // Extra community-derived tokens (join-request / join-grant / notify), drained
  // AFTER the peer loop with the SAME dispatcher. Each token is addressed to THIS
  // device by id, so the relay buffered its envelopes for us; the labeled counts
  // fold into the job result as perPeer-style entries.
  for (const extra of options.extraTokens ?? []) {
    const extraResult = emptyPeerResult(extra.label);
    await drainToken(extra.label, extra.token, extraResult);
    foldInto(extraResult);
  }

  return result;
}

/**
 * Build the drain-peer list from real paired-device rows. The caller resolves
 * the shared secret and revocation status (which live behind the secret store
 * and the revocation table) so this stays a pure transform.
 */
export function toMailboxDrainPeers(
  pairedDevices: readonly PairedDevice[],
  resolve: (device: PairedDevice) => { pairSharedSecretHex: string | null; revoked: boolean },
): MailboxDrainPeer[] {
  return pairedDevices.map((device) => {
    const { pairSharedSecretHex, revoked } = resolve(device);
    return {
      deviceId: device.deviceId,
      pairSharedSecretHex,
      revoked,
      isActive: device.isActive,
    };
  });
}
