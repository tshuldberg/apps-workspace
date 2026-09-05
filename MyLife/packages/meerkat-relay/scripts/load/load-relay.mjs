#!/usr/bin/env node
/**
 * Load harness: relay WebSocket path (Plan 44 WP-7B).
 *
 * Speaks the REAL relay wire protocol (src/protocol.ts): each of --connections
 * PAIRS opens two `ws` clients, both `hello` the SAME opaque 64-hex ephemeral
 * token to get paired, then the pair's INITIATOR forwards opaque `env` frames at
 * the configured rate. The relay forwards each `env` verbatim to the peer (it
 * never echoes to the sender), so the RESPONDER echoes it straight back; the
 * initiator matches by an opaque sequence tag embedded in the ciphertext-shaped
 * payload and records the round-trip latency. This exercises the pairing table,
 * the per-connection rate limiter, and the verbatim forwarding path under real
 * concurrency, not a synthetic stub.
 *
 * Bounded memory: latencies go into a fixed-size histogram (or reservoir) estimator
 * (lib/stats.mjs), NEVER an unbounded array of every sample. In-flight sends are
 * capped per pair so a slow relay applies backpressure instead of growing an
 * unbounded outstanding map. Memory is O(connections + buckets), independent of
 * how many frames were forwarded.
 *
 * HONESTY (lib/verdict.mjs): zero completed round-trips or an unreachable relay is
 * a hard FAIL (exit 2); an error rate at/above --error-ceiling is FAIL; a latency
 * percentile over its --p*-budget-ms is degraded (exit 1); otherwise ok (exit 0).
 * The 10x-forecast --rate/--connections/--duration are CONFIG (see the runbook),
 * never hardcoded here.
 *
 * Usage:
 *   node load-relay.mjs --target ws://127.0.0.1:8787 \
 *     --connections 50 --rate 20 --duration 30 \
 *     [--error-ceiling 0.01] [--p95-budget-ms 250] [--p99-budget-ms 500] \
 *     [--estimator histogram|reservoir] [--progress-interval 5] [--timeout 5000]
 *
 * --rate is frames-per-second PER PAIR. --duration is seconds. --target is the
 * relay ws:// URL (a http:// url is normalized to ws://). Exit: 0 ok, 1 degraded,
 * 2 fail. One final NDJSON verdict line: { probe:'load-relay', verdict, attempted,
 * completed, errors, errorRate, p50Ms, p95Ms, p99Ms, ... }.
 */

import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { parseArgs, emit, emitFinal, nowMs } from './lib/args.mjs';
import { makeLatencyEstimator, summarizeLatency } from './lib/stats.mjs';
import { evaluateLoadRun, verdictExitCode, numberOr } from './lib/verdict.mjs';

/** Normalize a target into a ws:// url the `ws` client accepts. */
export function normalizeRelayTarget(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (value.startsWith('ws://') || value.startsWith('wss://')) return value;
  if (value.startsWith('https://')) return `wss://${value.slice('https://'.length)}`;
  if (value.startsWith('http://')) return `ws://${value.slice('http://'.length)}`;
  return `ws://${value}`;
}

/** A fresh 64-hex opaque token, distinct per pair (the relay requires 16+ chars). */
function freshToken() {
  return randomBytes(32).toString('hex');
}

/**
 * Encode/decode an opaque round-trip tag inside the `env` payload. The relay never
 * parses `env`, so the harness owns the byte layout: a base64 string carrying a
 * per-pair sequence number and the send timestamp. The responder echoes the exact
 * bytes back; the initiator decodes to match and compute RTT. Verbatim forwarding
 * is what we are load-testing, so the payload must survive byte-for-byte.
 */
function encodeTag(seq) {
  return Buffer.from(JSON.stringify({ s: seq, t: nowMs() })).toString('base64');
}
function decodeTag(env) {
  try {
    return JSON.parse(Buffer.from(String(env), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function openSocket(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('connect_timeout'));
    }, timeoutMs);
    ws.once('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitForFrame(ws, type, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMsg);
      reject(new Error('frame_timeout'));
    }, timeoutMs);
    function onMsg(raw) {
      let frame;
      try {
        frame = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (frame.t === type) {
        clearTimeout(timer);
        ws.off('message', onMsg);
        resolve(frame);
      }
    }
    ws.on('message', onMsg);
  });
}

/**
 * One load pair: initiator + responder joined on a shared token. The responder
 * echoes every `env` it receives straight back; the initiator times round-trips.
 * Bounded in-flight map (capped) applies backpressure so a slow relay never grows
 * an unbounded outstanding set.
 */
class LoadPair {
  constructor(target, timeoutMs, estimator, stats, maxInFlight) {
    this.target = target;
    this.timeoutMs = timeoutMs;
    this.estimator = estimator;
    this.stats = stats;
    this.maxInFlight = maxInFlight;
    this.seq = 0;
    this.inFlight = new Map(); // seq -> sentAtMs (bounded by maxInFlight)
    this.token = freshToken();
    this.closed = false;
  }

  async connect() {
    this.initiator = await openSocket(this.target, this.timeoutMs);
    this.responder = await openSocket(this.target, this.timeoutMs);
    // Responder echoes any env verbatim back to the initiator (its peer).
    this.responder.on('message', (raw) => {
      let frame;
      try {
        frame = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (frame.t === 'env') {
        if (this.responder.readyState === WebSocket.OPEN) {
          this.responder.send(JSON.stringify({ t: 'env', env: frame.env }));
        }
      }
    });
    // Initiator resolves round-trips by matching the opaque tag. A relay `err`
    // frame (e.g. rate_limited, too_large) is a REAL rejection of a send: the peer
    // never receives that frame, so the corresponding in-flight entry will never
    // resolve. We retire the OLDEST outstanding send as an error immediately rather
    // than waiting for it to be swept at close, so the error signal is timely and a
    // relay that is shedding load is reflected in the live progress lines.
    this.initiator.on('message', (raw) => {
      let frame;
      try {
        frame = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (frame.t === 'env') this._resolveRoundTrip(frame.env);
      else if (frame.t === 'err') this._retireOldestAsError(frame.code);
    });
    // Pair on the shared token; both must reach `ready` before traffic flows.
    this.initiator.send(JSON.stringify({ t: 'hello', token: this.token }));
    this.responder.send(JSON.stringify({ t: 'hello', token: this.token }));
    await Promise.all([
      waitForFrame(this.initiator, 'ready', this.timeoutMs),
      waitForFrame(this.responder, 'ready', this.timeoutMs),
    ]);
  }

  _resolveRoundTrip(env) {
    const tag = decodeTag(env);
    if (!tag || typeof tag.s !== 'number') return;
    const sentAt = this.inFlight.get(tag.s);
    if (sentAt === undefined) return;
    this.inFlight.delete(tag.s);
    const rtt = nowMs() - sentAt;
    this.estimator.record(rtt);
    this.stats.completed += 1;
  }

  /**
   * A relay err frame rejected a send. Retire the oldest outstanding entry as an
   * error (Map preserves insertion order, so the first key is the oldest). The err
   * code is tallied so the verdict line can surface WHY (e.g. rate_limited under a
   * per-connection cap, which is a genuine capacity finding, not a harness bug).
   */
  _retireOldestAsError(code) {
    this.stats.errorCodes[code] = (this.stats.errorCodes[code] ?? 0) + 1;
    const oldest = this.inFlight.keys().next();
    if (!oldest.done) {
      this.inFlight.delete(oldest.value);
      this.stats.errors += 1;
    }
  }

  /** Fire one opaque frame if under the in-flight cap; else count backpressure. */
  send() {
    if (this.closed) return;
    if (this.initiator.readyState !== WebSocket.OPEN) {
      this.stats.errors += 1;
      return;
    }
    // Backpressure: never let outstanding sends grow without bound. A dropped send
    // is a real error (the relay is not keeping up), counted honestly.
    if (this.inFlight.size >= this.maxInFlight) {
      this.stats.errors += 1;
      this.stats.attempted += 1;
      return;
    }
    const seq = this.seq++;
    this.inFlight.set(seq, nowMs());
    this.stats.attempted += 1;
    try {
      this.initiator.send(JSON.stringify({ t: 'env', env: encodeTag(seq) }));
    } catch {
      this.inFlight.delete(seq);
      this.stats.errors += 1;
    }
  }

  /**
   * Close the pair. An outstanding send that has been waiting longer than the round-
   * trip timeout genuinely never came back and is counted as an error (a relay that
   * silently dropped traffic must not inflate the pass rate). A send YOUNGER than
   * the timeout was still legitimately in flight at the measurement boundary; it is
   * neither completed nor errored (counting a boundary artifact as a failure would
   * be dishonest in the other direction). The drain window before close() is what
   * gives real round-trips time to land first.
   */
  close(timeoutMs) {
    this.closed = true;
    const now = nowMs();
    for (const sentAt of this.inFlight.values()) {
      if (now - sentAt > timeoutMs) this.stats.errors += 1;
    }
    this.inFlight.clear();
    try { this.initiator?.terminate(); } catch { /* ignore */ }
    try { this.responder?.terminate(); } catch { /* ignore */ }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = normalizeRelayTarget(args.target);
  const connections = Math.max(1, Math.floor(numberOr(args.connections, 10)));
  const ratePerPair = Math.max(0.001, numberOr(args.rate, 10));
  const durationS = Math.max(1, numberOr(args.duration, 15));
  const timeoutMs = Math.max(100, Math.floor(numberOr(args.timeout, 5000)));
  const progressIntervalS = Math.max(1, numberOr(args['progress-interval'], 5));
  const maxInFlight = Math.max(1, Math.floor(numberOr(args['max-in-flight'], 64)));
  const thresholds = {
    errorRateCeiling: numberOr(args['error-ceiling'], 0.01),
    p50BudgetMs: args['p50-budget-ms'] != null ? numberOr(args['p50-budget-ms'], undefined) : undefined,
    p95BudgetMs: args['p95-budget-ms'] != null ? numberOr(args['p95-budget-ms'], undefined) : undefined,
    p99BudgetMs: args['p99-budget-ms'] != null ? numberOr(args['p99-budget-ms'], undefined) : undefined,
  };
  const estimator = makeLatencyEstimator(args.estimator, numberOr(args['reservoir-size'], 4096));
  const stats = { attempted: 0, completed: 0, errors: 0, errorCodes: {} };

  if (!target) {
    emitFinal(
      { probe: 'load-relay', verdict: 'fail', reason: 'no_target', attempted: 0, completed: 0, errors: 0, errorRate: null },
      verdictExitCode('fail'),
    );
    return;
  }

  emit({ probe: 'load-relay', event: 'start', target, connections, ratePerPair, durationS, maxInFlight });

  // Connect all pairs. A pair that cannot pair is an unreachable/handshake failure;
  // if NONE connect, the relay is unreachable and the whole run fails closed.
  const pairs = [];
  let connectFailures = 0;
  const connectResults = await Promise.allSettled(
    Array.from({ length: connections }, async () => {
      const pair = new LoadPair(target, timeoutMs, estimator, stats, maxInFlight);
      await pair.connect();
      return pair;
    }),
  );
  for (const r of connectResults) {
    if (r.status === 'fulfilled') pairs.push(r.value);
    else connectFailures += 1;
  }

  if (pairs.length === 0) {
    emitFinal(
      {
        probe: 'load-relay',
        verdict: 'fail',
        reason: 'target_unreachable',
        target,
        attempted: 0,
        completed: 0,
        errors: connectFailures,
        errorRate: 1,
        connectFailures,
      },
      verdictExitCode('fail'),
    );
    return;
  }

  emit({ probe: 'load-relay', event: 'connected', pairs: pairs.length, connectFailures });

  // Drive traffic: each pair fires at ratePerPair fps. We tick on a shared interval
  // and fan sends across pairs to keep the timer count bounded regardless of scale.
  const tickMs = 20; // 50 ticks/sec granularity
  const sendsPerTickPerPair = (ratePerPair * tickMs) / 1000;
  let sendCredit = 0;
  const startedAt = nowMs();
  const endAt = startedAt + durationS * 1000;
  let lastProgress = startedAt;

  await new Promise((resolve) => {
    const interval = setInterval(() => {
      const t = nowMs();
      sendCredit += sendsPerTickPerPair;
      const whole = Math.floor(sendCredit);
      if (whole > 0) {
        sendCredit -= whole;
        for (let i = 0; i < whole; i += 1) {
          for (const pair of pairs) pair.send();
        }
      }
      if (t - lastProgress >= progressIntervalS * 1000) {
        lastProgress = t;
        const snap = summarizeLatency(estimator);
        emit({
          probe: 'load-relay',
          event: 'progress',
          elapsedS: Math.round((t - startedAt) / 100) / 10,
          attempted: stats.attempted,
          completed: stats.completed,
          errors: stats.errors,
          p50Ms: snap.p50Ms,
          p95Ms: snap.p95Ms,
          p99Ms: snap.p99Ms,
        });
      }
      if (t >= endAt) {
        clearInterval(interval);
        resolve();
      }
    }, tickMs);
  });

  // Drain: give outstanding round-trips a bounded window to resolve before close.
  await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 2000)));
  for (const pair of pairs) pair.close(timeoutMs);

  const latency = summarizeLatency(estimator);
  const evaluated = evaluateLoadRun({
    attempted: stats.attempted,
    completed: stats.completed,
    errors: stats.errors,
    latency,
    thresholds,
    unreachable: false,
  });

  emitFinal(
    {
      probe: 'load-relay',
      verdict: evaluated.verdict,
      reason: evaluated.reason,
      target,
      connections: pairs.length,
      connectFailures,
      ratePerPair,
      durationS,
      attempted: stats.attempted,
      completed: stats.completed,
      errors: stats.errors,
      errorRate: evaluated.errorRate,
      errorCodes: stats.errorCodes,
      breaches: evaluated.breaches,
      ...latency,
    },
    verdictExitCode(evaluated.verdict),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    emitFinal(
      { probe: 'load-relay', verdict: 'fail', reason: 'harness_error', detail: String(err?.message ?? err) },
      verdictExitCode('fail'),
    );
  });
}
