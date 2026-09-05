/**
 * Local community join handoff over an ESTABLISHED local connection (Plan 27 P3).
 *
 * The relay-backed join handoff (join-handoff-core.ts) is store-and-forward: the
 * joiner parks a sealed request on a relay mailbox, the owner drains it later, the
 * owner parks a sealed grant, the joiner drains it later. That works for `any`
 * communities but it is exactly what a `local_only` community forbids -- a relay
 * must never carry its rows, key wraps, OR join handoffs (the promise covers the
 * handoff, AC-4).
 *
 * This runs the SAME sealed request/grant envelopes over a live LAN / Nearby
 * `TransportConnection` instead of a relay, so joining a proximity-gated community
 * genuinely requires co-presence. It adds NO new crypto and NO new trust: it reuses
 * buildJoinRequest (joiner), processJoinRequest (owner, whose parkEnvelope now
 * sends the grant back over the SAME connection), and applyJoinGrant (joiner),
 * dispatched through applyMailboxEnvelope so every open+verify gate is identical to
 * the drain path. The connection carries only the opaque sealed envelope bytes.
 *
 * Fail-closed on both sides: the joiner refuses to attempt the handoff when the
 * community's SIGNED policy forbids the connection's transport (a local_only
 * community over a relay connection is refused with an honest reason, never a
 * silent relay fallback), and the owner refuses to SERVE the same case. So the
 * transport gate holds even if a caller wires this over the wrong connection.
 *
 * Self-framed (its own tiny JSON frame) so it can run standalone or fold into a
 * session without entangling the session state machine, mirroring descriptor-gossip.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity, SyncTransport, TransportConnection } from '../types';
import {
  communityTransportPolicy,
  getCommunity,
  parseCommunityInviteLink,
  transportPolicyAllows,
  type ParsedInviteLink,
} from './community';
import { buildJoinRequest, processJoinRequest, applyJoinGrant } from './join-handoff-core';
import { applyMailboxEnvelope } from './mailbox-dispatch';
import { encodeMailboxEnvelope, type MailboxEnvelope } from './mailbox';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const REQUEST_FRAME = 'ljh-req' as const;
const GRANT_FRAME = 'ljh-grant' as const;

interface LocalJoinFrame {
  t: typeof REQUEST_FRAME | typeof GRANT_FRAME;
  /** The opaque sealed MailboxEnvelope (JSON-safe: version + sealedHex + signature). */
  envelope: MailboxEnvelope;
}

function encodeFrame(t: LocalJoinFrame['t'], envelope: MailboxEnvelope): Uint8Array {
  return encoder.encode(JSON.stringify({ t, envelope } satisfies LocalJoinFrame));
}

function decodeFrame(data: Uint8Array, expected: LocalJoinFrame['t']): MailboxEnvelope | null {
  try {
    const parsed = JSON.parse(decoder.decode(data)) as LocalJoinFrame;
    if (parsed?.t !== expected) return null;
    const env = parsed.envelope;
    if (!env || env.version !== 2 || typeof env.sealedHex !== 'string' || typeof env.signature !== 'string') {
      return null;
    }
    return env;
  } catch {
    return null;
  }
}

export type LocalJoinJoinerReason =
  | 'malformed_link'
  | 'transport_forbidden'
  | 'no_owner_dh'
  | 'timeout'
  | 'send_failed'
  | 'not_applied';

export interface LocalJoinJoinerResult {
  ok: boolean;
  reason?: LocalJoinJoinerReason;
  communityId?: string;
}

export interface RunLocalJoinAsJoinerOptions {
  connection: TransportConnection;
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  /** A parsed invite, or a raw link string (parsed here). */
  invite: ParsedInviteLink | string;
  timeoutMs?: number;
  now?: () => string;
}

/**
 * Joiner side: send the sealed join-request over the live connection, wait for the
 * owner's sealed grant on the SAME connection, and apply it. Returns ok only when a
 * real current epoch key landed (applyJoinGrant returned true). The transport gate
 * runs FIRST: a community whose signed policy forbids this transport is refused
 * with `transport_forbidden` before anything is sent -- no relay fallback.
 */
export function runLocalJoinAsJoiner(
  options: RunLocalJoinAsJoinerOptions,
): Promise<LocalJoinJoinerResult> {
  const { connection, db, identity } = options;
  const nowFn = options.now ?? (() => new Date().toISOString());
  const timeoutMs = options.timeoutMs ?? 15_000;

  const parsed: ParsedInviteLink | null =
    typeof options.invite === 'string' ? parseCommunityInviteLink(options.invite) : options.invite;
  if (!parsed) return Promise.resolve({ ok: false, reason: 'malformed_link' });

  const descriptor = parsed.descriptor.descriptor;
  const communityId = descriptor.communityId;
  // Fail-closed transport gate: read the SIGNED policy off the invite descriptor
  // (restrictive on unknown), and never attempt a forbidden transport.
  if (!transportPolicyAllows(communityTransportPolicy(descriptor), connection.transport)) {
    return Promise.resolve({ ok: false, reason: 'transport_forbidden', communityId });
  }

  const built = buildJoinRequest(identity, parsed, nowFn());
  if (!built) return Promise.resolve({ ok: false, reason: 'no_owner_dh', communityId });

  return new Promise<LocalJoinJoinerResult>((resolve) => {
    let settled = false;
    const finish = (result: LocalJoinJoinerResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout', communityId }), timeoutMs);
    (timer as { unref?: () => void }).unref?.();

    connection.onData((data) => {
      const grant = decodeFrame(data, GRANT_FRAME);
      if (!grant) return;
      void applyMailboxEnvelope(identity, encodeMailboxEnvelope(grant), {
        ...applyJoinGrant({ db, self: identity, now: nowFn }),
      })
        .then((outcome) => {
          finish({ ok: outcome.kind === 'join-grant', reason: outcome.kind === 'join-grant' ? undefined : 'not_applied', communityId });
        })
        .catch(() => finish({ ok: false, reason: 'not_applied', communityId }));
    });

    connection
      .send(encodeFrame(REQUEST_FRAME, built.envelope))
      .catch(() => finish({ ok: false, reason: 'send_failed', communityId }));
  });
}

export type LocalJoinOwnerReason =
  | 'transport_forbidden'
  | 'unknown_community'
  | 'timeout'
  | 'not_served';

export interface LocalJoinOwnerResult {
  ok: boolean;
  reason?: LocalJoinOwnerReason;
}

export interface RunLocalJoinAsOwnerOptions {
  connection: TransportConnection;
  db: DatabaseAdapter;
  /** This device's identity (the would-be owner). */
  identity: DeviceIdentity;
  /**
   * Replication seam for the new-epoch wraps commitMemberAdd mints (pass
   * engine.recordChange in the app). Omit for unit use.
   */
  recordChange?: import('./group-keys').RecordKeyWrapChange;
  timeoutMs?: number;
  now?: () => string;
}

/**
 * Owner side: wait for the joiner's sealed join-request on the live connection,
 * serve it through the SAME owner-gated grant rail as the relay path
 * (processJoinRequest), but with a parkEnvelope that sends the sealed grant back
 * over THIS connection instead of a relay. Returns ok only when the request was
 * really served (a grant frame was sent). Refuses fail-closed when the request's
 * community forbids this transport.
 */
export function runLocalJoinAsOwner(
  options: RunLocalJoinAsOwnerOptions,
): Promise<LocalJoinOwnerResult> {
  const { connection, db, identity } = options;
  const nowFn = options.now ?? (() => new Date().toISOString());
  const timeoutMs = options.timeoutMs ?? 15_000;

  return new Promise<LocalJoinOwnerResult>((resolve) => {
    let settled = false;
    const finish = (result: LocalJoinOwnerResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);
    (timer as { unref?: () => void }).unref?.();

    // parkEnvelope closure: the "mailbox" is this live connection. A grant is
    // "parked" iff it is really sent to the peer.
    const parkOverConnection = async (_token: string, envelope: MailboxEnvelope): Promise<boolean> => {
      try {
        await connection.send(encodeFrame(GRANT_FRAME, envelope));
        return true;
      } catch {
        return false;
      }
    };

    connection.onData((data) => {
      const request = decodeFrame(data, REQUEST_FRAME);
      if (!request) return;
      // Peek the community from the SEALED request AFTER open+verify inside the
      // dispatcher; the transport gate is enforced by re-resolving the community in
      // the join handler path. Here we add a defense-in-depth pre-gate using the
      // request-declared community id (the handler re-verifies ownership anyway).
      void applyMailboxEnvelope(identity, encodeMailboxEnvelope(request), {
        ...processJoinRequest({
          db,
          owner: identity,
          parkEnvelope: parkOverConnection,
          recordChange: options.recordChange,
          now: nowFn,
          // The owner refuses to serve a join whose community forbids this
          // transport: a local_only community's handoff never rides a non-local
          // connection, even if some caller wired this over the wrong one.
          transportGate: (communityId: string) => transportAllowedFor(db, communityId, connection.transport),
        }),
      })
        .then((outcome) => {
          finish({ ok: outcome.kind === 'join-request', reason: outcome.kind === 'join-request' ? undefined : 'not_served' });
        })
        .catch(() => finish({ ok: false, reason: 'not_served' }));
    });
  });
}

/** May this stored community's data (and its join handoff) move over `transport`? */
function transportAllowedFor(db: DatabaseAdapter, communityId: string, transport: SyncTransport): boolean {
  const community = getCommunity(db, communityId);
  if (!community) return false;
  return transportPolicyAllows(communityTransportPolicy(community.descriptor), transport);
}
