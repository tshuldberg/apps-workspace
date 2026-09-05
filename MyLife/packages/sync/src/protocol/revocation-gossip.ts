/**
 * Revocation gossip over a session (plan 14, MK-019 -- closing the deferred
 * "gossip transport" seam).
 *
 * MK-019 made revocations signed, stored, and verifiable, but they only spread
 * when a human applied one by hand. This is the epidemic transport: when two
 * devices share a connection, each sends every signed revocation it holds and
 * applies the peer's. A revocation issued anywhere reaches every connected
 * member within a gossip round, and the existing handshake check then locks the
 * revoked device out -- no central revocation list, no server.
 *
 * Composable + self-framed (its own tiny JSON frame, independent of the
 * SyncMessage codec) so it can run on its own connection or be folded into a
 * session without entangling the session state machine. Authorization is the
 * standard one: a recipient applies a revocation only if it is signed by a
 * device the recipient has paired with, or the device revoking itself --
 * gossip spreads records but never lets an untrusted signer evict anyone.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity, TransportConnection } from '../types';
import { getRevocationRecordJsons } from '../db/queries';
import { applySignedRevocation, type SignedRevocation } from './revocation-record';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface GossipFrame {
  t: 'gossip-rev';
  records: SignedRevocation[];
}

function encodeFrame(records: SignedRevocation[]): Uint8Array {
  return encoder.encode(JSON.stringify({ t: 'gossip-rev', records } satisfies GossipFrame));
}

function decodeFrame(data: Uint8Array): GossipFrame | null {
  try {
    const parsed = JSON.parse(decoder.decode(data)) as GossipFrame;
    return parsed?.t === 'gossip-rev' && Array.isArray(parsed.records) ? parsed : null;
  } catch {
    return null;
  }
}

/** The signed revocations this device currently holds, ready to forward. */
export function collectRevocationRecords(db: DatabaseAdapter): SignedRevocation[] {
  const out: SignedRevocation[] = [];
  for (const json of getRevocationRecordJsons(db)) {
    try {
      const signed = JSON.parse(json) as SignedRevocation;
      if (signed?.revocation && typeof signed.signature === 'string') out.push(signed);
    } catch {
      // skip a corrupt row
    }
  }
  return out;
}

/** Apply a batch of gossiped revocations; returns how many newly took effect. */
export function applyGossipedRevocations(
  db: DatabaseAdapter,
  records: readonly SignedRevocation[],
): number {
  let applied = 0;
  for (const signed of records) {
    const result = applySignedRevocation(db, signed);
    if (result.ok && result.applied) applied += 1;
  }
  return applied;
}

export interface RevocationGossipResult {
  sent: number;
  applied: number;
}

export type GossipRole = 'initiate' | 'respond';

export interface GossipRevocationsOptions {
  connection: TransportConnection;
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  role: GossipRole;
  timeoutMs?: number;
}

/**
 * Run one revocation-gossip exchange over a connection. The initiator sends
 * first then applies the peer's reply; the responder applies the peer's batch
 * then sends its own. Each side ends holding the union, so the next session
 * spreads them further. `identity` is accepted for parity with other session
 * helpers (authorization is paired-signer based; self is handled by the store).
 */
export function gossipRevocations(options: GossipRevocationsOptions): Promise<RevocationGossipResult> {
  const { connection, db, role } = options;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const mine = collectRevocationRecords(db);

  return new Promise<RevocationGossipResult>((resolve) => {
    let settled = false;
    const finish = (applied: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ sent: mine.length, applied });
    };
    const timer = setTimeout(() => finish(0), timeoutMs);
    (timer as { unref?: () => void }).unref?.();

    connection.onData((data) => {
      const frame = decodeFrame(data);
      if (!frame) return;
      const applied = applyGossipedRevocations(db, frame.records);
      if (role === 'respond') {
        // We received first; now send ours back to complete the round.
        void connection.send(encodeFrame(mine));
      }
      finish(applied);
    });

    if (role === 'initiate') {
      void connection.send(encodeFrame(mine));
    }
  });
}
