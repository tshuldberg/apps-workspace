#!/usr/bin/env node
/**
 * Soak runner (Plan 44 WP-7B). Std-lib only (node:http/https/child_process).
 *
 * Drives the WP-7B load harness at a configured BACKGROUND rate for a configured
 * duration and samples, at a configured interval:
 *   - its OWN process RSS + heapUsed (leak detection on the harness/driver),
 *   - each target's private /metrics endpoint (minimal Prometheus text parse) and
 *   - each target's liveness (/healthz shape or /readyz answer).
 * Every sample is emitted as one NDJSON line, then ONE final verdict line. The
 * WHOLE stream is the evidence an operator attaches to the durable rehearsal proof:
 *
 *   node soak-runner.mjs ... > soak-evidence.ndjson
 *   pnpm --filter @mylife/meerkat-relay rehearsal:postgres --record \
 *     --kind soak --verdict passed --operator you \
 *     --started-at "$(date -u +%FT%TZ)" --evidence soak-evidence.ndjson
 *
 * The verdict is decided by GROWTH THRESHOLDS, fail-closed (lib/soak-eval.mjs):
 * rss/heap growth ceilings, an aggregate error-rate ceiling, per-metric growth
 * ceilings (e.g. a queue-depth gauge), and metric/liveness STALENESS (a target that
 * stops answering is a fail). Zero samples is a hard fail.
 *
 * DURATION IS A PARAMETER. CI proves a minutes-long soak mechanically; the 48-hour
 * production-shaped run (AC-44.12) is FOUNDER-OPS: the same tool, pointed at staging
 * under real traffic forecasts, its stream recorded through the same rehearsal CLI.
 * This file runs the tooling; it does not stand in for that infrastructure run.
 *
 * Usage:
 *   node soak-runner.mjs \
 *     --duration 300 --interval 15 \
 *     --load-relay ws://127.0.0.1:8787 --load-relay-connections 10 --load-relay-rate 5 \
 *     --metrics persona=http://127.0.0.1:9894/metrics \
 *     --liveness relay=http://127.0.0.1:8787/healthz \
 *     --liveness persona=http://127.0.0.1:9894/readyz \
 *     [--rss-growth-ceiling 25] [--heap-growth-ceiling 25] [--error-ceiling 0.01] \
 *     [--metric-growth persona:meerkat_queue_depth=50] [--window 3]
 *
 * NOTE: metric names are PREFIXED by their --metrics target name (target:metric);
 * an unprefixed --metric-growth name will never match and fails closed as
 * metric_missing.
 *
 * --duration/--interval are seconds. --metrics/--liveness/--metric-growth are
 * repeatable. Exit: 0 held steady, 2 fail (any breach or zero samples).
 */

import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, asArray, emit, emitFinal, nowMs } from '../load/lib/args.mjs';
import { parsePrometheusText, aggregateSoak, soakExitCode, readMetric, numberOr } from './lib/soak-eval.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const loadRelayScript = join(here, '..', 'load', 'load-relay.mjs');

/** Parse a repeatable `name=url` spec into { name, url }; null when malformed. */
export function parseNamedUrl(spec) {
  const raw = String(spec ?? '').trim();
  const eq = raw.indexOf('=');
  if (eq === -1) return null;
  const name = raw.slice(0, eq).trim();
  const url = raw.slice(eq + 1).trim();
  if (!name || !url || !(url.startsWith('http://') || url.startsWith('https://'))) return null;
  return { name, url };
}

/** Parse a repeatable `metricName=maxGrowthPct` spec; null when malformed. */
export function parseMetricGrowthSpec(spec) {
  const raw = String(spec ?? '').trim();
  const eq = raw.indexOf('=');
  if (eq === -1) return null;
  const name = raw.slice(0, eq).trim();
  const max = Number(raw.slice(eq + 1).trim());
  if (!name || !Number.isFinite(max)) return null;
  return { name, maxGrowthPct: max };
}

function getBounded(url, timeoutMs) {
  const target = new URL(url);
  const client = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(target, { method: 'GET', timeout: timeoutMs }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size <= 512 * 1024) chunks.push(c); // metrics bodies are larger than health
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

/** Scrape one /metrics endpoint into a name->summed-value map. Null on failure. */
async function scrapeMetrics(url, timeoutMs) {
  try {
    const res = await getBounded(url, timeoutMs);
    if (res.status !== 200) return null;
    return parsePrometheusText(res.body);
  } catch {
    return null;
  }
}

/** Probe one liveness endpoint. /healthz -> shape-lenient (200 + ok:true); /readyz
 *  -> 200 or 503 with a boolean ready is "answering". Returns true when live. */
async function probeLive(url, timeoutMs) {
  try {
    const res = await getBounded(url, timeoutMs);
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        if (body && (body.ok === true || typeof body.ready === 'boolean')) return true;
      } catch {
        return false;
      }
      return false;
    }
    if (res.status === 503) {
      // A service that HONESTLY reports not-ready is still ANSWERING (not stale). The
      // soak's staleness check is about a lost signal, not about readiness state.
      try {
        const body = JSON.parse(res.body);
        return body && typeof body.ready === 'boolean';
      } catch {
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const durationS = Math.max(1, numberOr(args.duration, 300));
  const intervalS = Math.max(1, numberOr(args.interval, 15));
  const probeTimeoutMs = Math.max(200, Math.floor(numberOr(args['probe-timeout'], 3000)));

  const metricsTargets = asArray(args.metrics).map(parseNamedUrl);
  const livenessTargets = asArray(args.liveness).map(parseNamedUrl);
  const metricGrowthCeilings = asArray(args['metric-growth']).map(parseMetricGrowthSpec);
  // A malformed spec is a hard fail (an operator asked for coverage they didn't get).
  for (const [label, list] of [['metrics', metricsTargets], ['liveness', livenessTargets], ['metric-growth', metricGrowthCeilings]]) {
    if (list.some((x) => x === null)) {
      emitFinal({ probe: 'soak', verdict: 'fail', reason: `bad_${label}_spec` }, soakExitCode('fail'));
      return;
    }
  }

  const thresholds = {
    rssGrowthPctCeiling: numberOr(args['rss-growth-ceiling'], 25),
    heapGrowthPctCeiling: numberOr(args['heap-growth-ceiling'], 25),
    errorRateCeiling: numberOr(args['error-ceiling'], 0.01),
    metricGrowthCeilings,
    window: numberOr(args.window, 3),
    requireLiveness: livenessTargets.length > 0,
  };

  emit({
    probe: 'soak',
    event: 'start',
    durationS,
    intervalS,
    metrics: metricsTargets.map((m) => m.name),
    liveness: livenessTargets.map((m) => m.name),
    metricGrowthCeilings: metricGrowthCeilings.map((c) => `${c.name}<=${c.maxGrowthPct}%`),
    thresholds: {
      rssGrowthPctCeiling: thresholds.rssGrowthPctCeiling,
      heapGrowthPctCeiling: thresholds.heapGrowthPctCeiling,
      errorRateCeiling: thresholds.errorRateCeiling,
    },
    note: 'CI proves a minutes-long soak; the 48h production-shaped run is founder-ops through the same tool',
  });

  // Optional background load against the relay for the whole soak. A soak with no
  // load still watches for idle leaks, but real leak detection wants traffic.
  let loadChild = null;
  const loadTally = { attempted: 0, completed: 0, errors: 0 };
  if (args['load-relay']) {
    const connections = String(Math.max(1, Math.floor(numberOr(args['load-relay-connections'], 5))));
    const rate = String(Math.max(0.001, numberOr(args['load-relay-rate'], 2)));
    loadChild = spawn(
      process.execPath,
      [loadRelayScript, '--target', String(args['load-relay']), '--connections', connections, '--rate', rate, '--duration', String(durationS), '--progress-interval', String(intervalS)],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let buf = '';
    loadChild.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let obj;
        try { obj = JSON.parse(line); } catch { continue; }
        // Track the load harness's own progress/verdict counters as the soak's
        // load error signal. The load child's LATEST cumulative counters win.
        if (obj.probe === 'load-relay' && (obj.event === 'progress' || obj.verdict)) {
          loadTally.attempted = numberOr(obj.attempted, loadTally.attempted);
          loadTally.completed = numberOr(obj.completed, loadTally.completed);
          loadTally.errors = numberOr(obj.errors, loadTally.errors);
        }
      }
    });
  }

  const samples = [];
  let prevLoad = { attempted: 0, completed: 0, errors: 0 };
  const startedAt = nowMs();
  const endAt = startedAt + durationS * 1000;

  // Sample loop: one pass per interval until the duration elapses.
  while (nowMs() < endAt) {
    const sampleStart = nowMs();

    const metrics = {};
    for (const target of metricsTargets) {
      const scraped = await scrapeMetrics(target.url, probeTimeoutMs);
      metrics[target.name] = scraped; // Map or null (null -> a stale scrape for this target)
    }
    let live = true;
    const liveness = {};
    for (const target of livenessTargets) {
      const ok = await probeLive(target.url, probeTimeoutMs);
      liveness[target.name] = ok;
      if (!ok) live = false;
    }

    // Flatten scraped metrics into one name->value map for the aggregate growth
    // check; a stale (null) scrape contributes nothing but is recorded as a dead
    // sample so staleness fails closed.
    const flatMetrics = new Map();
    let anyMetricStale = false;
    for (const target of metricsTargets) {
      const m = metrics[target.name];
      if (m === null) { anyMetricStale = true; continue; }
      for (const [k, v] of m) flatMetrics.set(`${target.name}:${k}`, (flatMetrics.get(`${target.name}:${k}`) ?? 0) + v);
    }
    if (metricsTargets.length > 0 && anyMetricStale) live = false;

    const mem = process.memoryUsage();
    const deltaLoad = {
      attempted: loadTally.attempted - prevLoad.attempted,
      completed: loadTally.completed - prevLoad.completed,
      errors: loadTally.errors - prevLoad.errors,
    };
    prevLoad = { ...loadTally };

    const sample = {
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      metrics: flatMetrics,
      live: livenessTargets.length > 0 || metricsTargets.length > 0 ? live : true,
      loadAttempted: Math.max(0, deltaLoad.attempted),
      loadCompleted: Math.max(0, deltaLoad.completed),
      loadErrors: Math.max(0, deltaLoad.errors),
    };
    samples.push(sample);

    // Emit the sample as evidence. metrics-of-interest surfaced explicitly for the
    // reader; the flat map's growth is what the verdict uses.
    const metricSnapshot = {};
    for (const c of metricGrowthCeilings) metricSnapshot[c.name] = readMetric(flatMetrics, c.name);
    emit({
      probe: 'soak',
      event: 'sample',
      index: samples.length,
      elapsedS: Math.round((nowMs() - startedAt) / 100) / 10,
      rssBytes: sample.rssBytes,
      heapUsedBytes: sample.heapUsedBytes,
      live: sample.live,
      liveness,
      metricStale: anyMetricStale,
      loadAttempted: sample.loadAttempted,
      loadCompleted: sample.loadCompleted,
      loadErrors: sample.loadErrors,
      watchedMetrics: metricSnapshot,
    });

    // Sleep the remainder of the interval (never negative).
    const spent = nowMs() - sampleStart;
    const wait = Math.max(0, intervalS * 1000 - spent);
    if (nowMs() + wait < endAt) {
      await new Promise((r) => setTimeout(r, wait));
    } else {
      break;
    }
  }

  if (loadChild) {
    try { loadChild.kill('SIGTERM'); } catch { /* ignore */ }
  }

  const result = aggregateSoak({ samples, thresholds });
  emitFinal(
    {
      probe: 'soak',
      verdict: result.verdict,
      reason: result.reason,
      durationS,
      intervalS,
      samples: samples.length,
      breaches: result.breaches,
      computed: result.computed,
    },
    soakExitCode(result.verdict),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    emitFinal({ probe: 'soak', verdict: 'fail', reason: 'harness_error', detail: String(err?.message ?? err) }, soakExitCode('fail'));
  });
}
