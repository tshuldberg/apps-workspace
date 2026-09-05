/**
 * Community-node durable join-queue client (Plan 57 W4).
 *
 * The client half of the node's restart-safe join mailbox: park one OPAQUE
 * sealed MailboxEnvelope for a recipient's HKDF join token, list a token's
 * parked envelopes (non-consuming), and ack the ones this device really
 * processed. The node never opens an envelope; only the addressed recipient's
 * X25519 key can. Trust model is the relay mailbox's, verbatim, but durable
 * for days instead of minutes.
 *
 * Fail-closed + honest: every result mirrors the HTTP response; nothing here
 * claims a park/ack the node did not confirm. RN-safe (injected fetch, no Node
 * imports).
 */

import naclUtil from 'tweetnacl-util';
import type { DeviceIdentity } from '../types';
import {
  decodeMailboxEnvelope,
  encodeMailboxEnvelope,
  type MailboxEnvelope,
} from '../protocol/mailbox';
import { signFeedAuth } from '../protocol/feed-auth';
import { applyMailboxEnvelope, type MailboxDispatchOutcome, type MailboxEnvelopeHandlers } from '../protocol/mailbox-dispatch';

const { encodeBase64, decodeBase64 } = naclUtil;

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

function headersFor(entitlementToken: string | undefined, json: boolean): Record<string, string> {
  const headers: Record<string, string> = json ? { 'content-type': 'application/json' } : {};
  if (entitlementToken) headers.authorization = `Bearer ${entitlementToken}`;
  return headers;
}

export interface JoinQueueClientDeps {
  fetchFn?: typeof fetch;
  /** Optional hosted-entitlement bearer (entitlement-gated first-party nodes). */
  entitlementToken?: string;
}

export type ParkJoinOnNodeResult =
  | { ok: true; id: string }
  | { ok: false; reason: string };

/**
 * Park one sealed envelope on a community node's durable join box.
 *
 * Two lanes, mirroring the node's park gate:
 *  - UNAUTHENTICATED (no `identity`): only tokens the node can derive for its
 *    CURRENT roster are accepted (the joiner-to-owner request lane).
 *  - AUTHENTICATED (`identity` set, a roster member): the client runs the
 *    challenge + feed-auth handshake and may park to ANY token -- the lane an
 *    owner uses to park a grant addressed to a joiner not yet in the roster.
 */
export async function parkJoinEnvelopeOnNode(
  input: {
    baseUrl: string;
    communityId: string;
    token: string;
    envelope: MailboxEnvelope;
    /** Roster member identity for the authenticated lane (grant parks). */
    identity?: DeviceIdentity;
    now?: string;
  } & JoinQueueClientDeps,
): Promise<ParkJoinOnNodeResult> {
  const fetchFn = input.fetchFn ?? fetch;
  try {
    let headers = headersFor(input.entitlementToken, true);
    if (input.identity) {
      const challengeRes = await fetchFn(
        `${trimBase(input.baseUrl)}/community/${encodeURIComponent(input.communityId)}/challenge`,
        input.entitlementToken ? { headers: headersFor(input.entitlementToken, false) } : undefined,
      );
      const challengeBody = (await challengeRes.json().catch(() => null)) as { nonce?: unknown; reason?: unknown } | null;
      if (!challengeRes.ok || typeof challengeBody?.nonce !== 'string') {
        return {
          ok: false,
          reason: typeof challengeBody?.reason === 'string' ? challengeBody.reason : 'challenge_failed',
        };
      }
      const ts = input.now ?? new Date().toISOString();
      headers = {
        ...headers,
        'x-mk-device': input.identity.publicKey,
        'x-mk-nonce': challengeBody.nonce,
        'x-mk-ts': ts,
        'x-mk-sig': signFeedAuth(input.identity, { communityId: input.communityId, nonce: challengeBody.nonce, ts }),
      };
    }
    const res = await fetchFn(
      `${trimBase(input.baseUrl)}/community/${encodeURIComponent(input.communityId)}/join/park`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          token: input.token,
          envelope: encodeBase64(encodeMailboxEnvelope(input.envelope)),
        }),
      },
    );
    const body = (await res.json().catch(() => null)) as { id?: unknown; reason?: unknown } | null;
    if (res.ok && typeof body?.id === 'string') return { ok: true, id: body.id };
    return { ok: false, reason: typeof body?.reason === 'string' ? body.reason : `http_${res.status}` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'network_error' };
  }
}

export interface FetchedJoinEntry {
  id: string;
  envelope: MailboxEnvelope;
}

export type FetchJoinBoxResult =
  | { ok: true; entries: FetchedJoinEntry[]; dropped: number }
  | { ok: false; reason: string };

/**
 * List a token's parked envelopes from a community node. Undecodable entries
 * are dropped and counted (fail-closed), never surfaced as envelopes.
 */
export async function fetchJoinBoxFromNode(
  input: {
    baseUrl: string;
    communityId: string;
    token: string;
  } & JoinQueueClientDeps,
): Promise<FetchJoinBoxResult> {
  const fetchFn = input.fetchFn ?? fetch;
  try {
    const res = await fetchFn(
      `${trimBase(input.baseUrl)}/community/${encodeURIComponent(input.communityId)}/join/box/${input.token}`,
      input.entitlementToken ? { headers: headersFor(input.entitlementToken, false) } : undefined,
    );
    const body = (await res.json().catch(() => null)) as { entries?: unknown; reason?: unknown } | null;
    if (!res.ok || !Array.isArray(body?.entries)) {
      return { ok: false, reason: typeof body?.reason === 'string' ? body.reason : `http_${res.status}` };
    }
    const entries: FetchedJoinEntry[] = [];
    let dropped = 0;
    for (const raw of body.entries) {
      const entry = raw as { id?: unknown; envelopeB64?: unknown };
      if (typeof entry?.id !== 'string' || typeof entry?.envelopeB64 !== 'string') {
        dropped += 1;
        continue;
      }
      let envelope: MailboxEnvelope | null = null;
      try {
        envelope = decodeMailboxEnvelope(decodeBase64(entry.envelopeB64));
      } catch {
        envelope = null;
      }
      if (!envelope) {
        dropped += 1;
        continue;
      }
      entries.push({ id: entry.id, envelope });
    }
    return { ok: true, entries, dropped };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'network_error' };
  }
}

export type AckJoinBoxResult =
  | { ok: true; acked: number }
  | { ok: false; reason: string };

/** Delete processed entries from a token's box. */
export async function ackJoinBoxOnNode(
  input: {
    baseUrl: string;
    communityId: string;
    token: string;
    ids: readonly string[];
  } & JoinQueueClientDeps,
): Promise<AckJoinBoxResult> {
  if (input.ids.length === 0) return { ok: true, acked: 0 };
  const fetchFn = input.fetchFn ?? fetch;
  try {
    const res = await fetchFn(
      `${trimBase(input.baseUrl)}/community/${encodeURIComponent(input.communityId)}/join/ack`,
      {
        method: 'POST',
        headers: headersFor(input.entitlementToken, true),
        body: JSON.stringify({ token: input.token, ids: input.ids }),
      },
    );
    const body = (await res.json().catch(() => null)) as { acked?: unknown; reason?: unknown } | null;
    if (res.ok && typeof body?.acked === 'number') return { ok: true, acked: body.acked };
    return { ok: false, reason: typeof body?.reason === 'string' ? body.reason : `http_${res.status}` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'network_error' };
  }
}

export interface DrainJoinBoxResult {
  fetched: number;
  applied: number;
  rejected: number;
  acked: number;
  /** Set when the box fetch itself failed; counts are then all zero. */
  fetchFailed?: string;
}

/**
 * Fetch a token's parked envelopes, dispatch each through the SAME kind-routed
 * handler set the relay mailbox drain uses (applyMailboxEnvelope: verify-open
 * first, unknown/malformed kinds dropped + counted), then ack the APPLIED
 * entries. Rejected entries are acked only when `ackRejected` is true (the
 * default): set it false for boxes where a rejection can be TRANSIENT (an
 * owner's request box, where "rejected" includes a grant park that failed over
 * the network) so the durable request survives for the next drain instead of
 * being deleted with no grant delivered. A rejected-and-kept poison entry is
 * bounded by the box cap and swept by the node's TTL. A crash before the ack
 * leaves entries parked (at-least-once, idempotent handlers, exactly like the
 * relay drain).
 */
export async function drainJoinBoxFromNode(
  input: {
    baseUrl: string;
    communityId: string;
    token: string;
    identity: DeviceIdentity;
    handlers: MailboxEnvelopeHandlers;
    ackRejected?: boolean;
  } & JoinQueueClientDeps,
): Promise<DrainJoinBoxResult> {
  const fetched = await fetchJoinBoxFromNode(input);
  if (!fetched.ok) return { fetched: 0, applied: 0, rejected: 0, acked: 0, fetchFailed: fetched.reason };

  let applied = 0;
  let rejected = fetched.dropped;
  const ackIds: string[] = [];
  for (const entry of fetched.entries) {
    let outcome: MailboxDispatchOutcome;
    try {
      outcome = await applyMailboxEnvelope(
        input.identity,
        encodeMailboxEnvelope(entry.envelope),
        input.handlers,
      );
    } catch {
      outcome = { kind: 'rejected' };
    }
    if (outcome.kind === 'rejected') {
      rejected += 1;
      if (input.ackRejected ?? true) ackIds.push(entry.id);
    } else {
      applied += 1;
      ackIds.push(entry.id);
    }
  }

  let acked = 0;
  if (ackIds.length > 0) {
    const ack = await ackJoinBoxOnNode({ ...input, ids: ackIds });
    if (ack.ok) acked = ack.acked;
  }
  return { fetched: fetched.entries.length, applied, rejected, acked };
}
