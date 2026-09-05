/**
 * UTC day bucketing for relay-visible rendezvous tokens (2026-08-25 metadata
 * hardening). A token derived ONLY from the pair secret is a static per-pair
 * pseudonym: the relay cannot read frames, but it can watch the same 64-hex
 * token recur for months and build a long-lived contact graph edge. Folding
 * the UTC day index into the derivation rotates every such token daily.
 *
 * HONEST SCOPE of the rotation: it defeats token-string-only correlation (a
 * log of tokens alone no longer chains a pair across days). It does NOT
 * defeat a relay that correlates concurrent activity on one connection or
 * source address: a receiver holds the current AND previous bucket at once,
 * which lets such an observer link adjacent buckets and chain them. That
 * observer could already chain by connection metadata alone, so rotation
 * raises the bar for weak observers without claiming unlinkability against
 * the relay operator.
 *
 * Boundary rule: a SENDER always derives with its current bucket; a RECEIVER
 * listens/drains on the current AND previous bucket. The relay parks frames
 * for absent tokens in its TTL mailbox (24h in the shipped deploy templates),
 * so the two-bucket window covers every live envelope plus the midnight race:
 * a frame sent moments before a boundary rides the old token and is still
 * heard, and a frame sent moments after parks until the receiver's own clock
 * rolls (seconds later on NTP-synced devices). A sender whose clock runs
 * AHEAD parks in the next bucket the receiver has not derived yet; delivery
 * waits until the receiver rolls, which for mailbox envelopes is a latency
 * cost bounded by the skew (the 24h TTL still holds) and for 30s-TTL WebRTC
 * offers is a loss ONLY when the skew already exceeds the signal skew policy
 * that would reject the frame anyway (the rung fails soft to relay). A relay
 * configured with a TTL beyond 24h ages envelopes out of the receiver window
 * early; the polling backstops and live listeners make this a latency cost,
 * not a loss, for any sender that retries.
 */

const DAY_MS = 86_400_000;

/** The UTC day index for a wall-clock time; throws on a non-finite input. */
export function relayTokenDayBucket(nowMs: number): number {
  if (!Number.isFinite(nowMs)) {
    throw new TypeError('relayTokenDayBucket needs a finite wall-clock ms value');
  }
  return Math.floor(nowMs / DAY_MS);
}

/** ms until the NEXT UTC day boundary (always > 0), for re-listen timers. */
export function msUntilNextDayBucket(nowMs: number): number {
  if (!Number.isFinite(nowMs)) {
    throw new TypeError('msUntilNextDayBucket needs a finite wall-clock ms value');
  }
  const next = (relayTokenDayBucket(nowMs) + 1) * DAY_MS;
  return Math.max(1, next - nowMs);
}
