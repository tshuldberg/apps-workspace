/**
 * Replay protection for the session receive loop (MK-012).
 *
 * An attacker who captures a valid encrypted frame (e.g. a SYNC_DATA batch)
 * must not be able to re-inject it later. Two independent checks:
 *
 * - Frame dedup: a sliding window of recently-seen frame hashes. An identical
 *   re-delivered frame is rejected. Legitimate consecutive messages differ in
 *   payload bytes (and timestamp), so their hashes differ.
 * - Timestamp skew: every frame carries its creation time on the wire; frames
 *   older or newer than the skew budget are rejected, bounding how long a
 *   captured frame stays replayable once it falls out of the dedup window.
 *
 * Session-scoped: create one guard per session. RN-safe, pure.
 */

import { sha512Hex } from '../node/hkdf';

export type ReplayRejectReason = 'replayed_frame' | 'timestamp_skew';

export type ReplayVerdict = { ok: true } | { ok: false; reason: ReplayRejectReason };

export interface ReplayGuardOptions {
  /** How many recent frame hashes to remember. Default 512. */
  windowSize?: number;
  /** Max |now - frame timestamp| in ms. Default 5 minutes. */
  maxSkewMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

export class ReplayGuard {
  private readonly windowSize: number;
  private readonly maxSkewMs: number;
  private readonly now: () => number;
  private readonly seen = new Set<string>();
  private readonly order: string[] = [];

  constructor(options: ReplayGuardOptions = {}) {
    this.windowSize = options.windowSize ?? 512;
    this.maxSkewMs = options.maxSkewMs ?? 5 * 60 * 1000;
    this.now = options.now ?? (() => Date.now());
  }

  /** Check a raw frame + its decoded timestamp. Records accepted frames. */
  check(frame: Uint8Array, timestamp: number): ReplayVerdict {
    if (!Number.isFinite(timestamp) || Math.abs(this.now() - timestamp) > this.maxSkewMs) {
      return { ok: false, reason: 'timestamp_skew' };
    }

    const hash = sha512Hex(frame);
    if (this.seen.has(hash)) {
      return { ok: false, reason: 'replayed_frame' };
    }

    this.seen.add(hash);
    this.order.push(hash);
    while (this.order.length > this.windowSize) {
      const evicted = this.order.shift();
      if (evicted) this.seen.delete(evicted);
    }
    return { ok: true };
  }
}
