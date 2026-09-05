#!/usr/bin/env node
/**
 * Synthetic: stateful-service /readyz probe (Plan 44 Phase 4 WP-4C).
 *
 * Each stateful service (humanity, persona, hosted, directory, community) exposes
 * GET /readyz -> { ready: boolean, checks: [{ name, ok, detailClass }] } on its PUBLIC
 * port (see packages/meerkat-relay/src/service-health.ts). This probe fetches that
 * endpoint and reports readiness. The response is already zero-knowledge (detailClass is
 * a bounded enum: ok|unavailable|timeout|faulted|not_configured, never a message), so the
 * probe surfaces which dependency is not-ready by NAME + CLASS to drive the runbook,
 * without ever carrying an identity or an error string.
 *
 * Usage (probe one service):
 *   node service-readyz.mjs --url http://persona:8894/readyz [--timeout 3000]
 *   node service-readyz.mjs --service persona --host persona --port 8894
 *
 * Exit: 0 ready (200), 1 not-ready (503 with a well-formed body), 2 fail (unreachable,
 * timeout, or a malformed readiness body).
 */

import {
  parseArgs,
  getBounded,
  tryJson,
  emitAndExit,
  EXIT_OK,
  EXIT_DEGRADED,
  EXIT_FAIL,
} from './lib/probe.mjs';

/** Default public port per service, matching deploy/compose.production.yml. */
const SERVICE_PORTS = {
  community: 8890,
  directory: 8891,
  humanity: 8892,
  hosted: 8893,
  persona: 8894,
};

/**
 * Pure evaluator, exported for tests. Classifies a fetched /readyz response.
 *   - ok       : status 200 and body.ready === true.
 *   - degraded : status 503 with a well-formed { ready:false, checks:[...] } body (a real,
 *                honest not-ready; the caller pages via the readyz-down runbook if this
 *                persists, but a single not-ready during boot is expected).
 *   - fail     : anything malformed, or a status that is neither 200 nor 503.
 * Returns the non-identifying names of the failing checks so the alert can point at the
 * right dependency (postgres / object_store / data_dir) without any payload leak.
 */
export function evaluateReadyz({ status, body }) {
  const parsed = tryJson(body);
  const wellFormed =
    parsed !== null &&
    typeof parsed === 'object' &&
    typeof parsed.ready === 'boolean' &&
    Array.isArray(parsed.checks);
  if (!wellFormed) {
    return { verdict: 'fail', reason: 'malformed_body', failing: [] };
  }
  const failing = parsed.checks
    .filter((c) => c && c.ok === false)
    .map((c) => ({ name: String(c.name ?? 'unknown'), detailClass: String(c.detailClass ?? 'unknown') }));
  if (status === 200 && parsed.ready === true) {
    return { verdict: 'ok', reason: 'ready', failing: [] };
  }
  if (status === 503 && parsed.ready === false) {
    return { verdict: 'degraded', reason: 'not_ready', failing };
  }
  // A 200 that says ready:false, or a 503 that says ready:true, is an inconsistent contract.
  return { verdict: 'fail', reason: 'status_body_mismatch', failing };
}

function resolveUrl(args) {
  if (args.url) return { url: args.url, service: args.service ?? 'unknown' };
  const service = args.service;
  if (!service || !(service in SERVICE_PORTS)) return null;
  const host = args.host ?? '127.0.0.1';
  const port = Number(args.port ?? SERVICE_PORTS[service]);
  return { url: `http://${host}:${port}/readyz`, service };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const timeout = Number(args.timeout ?? 3000);
  const resolved = resolveUrl(args);
  if (!resolved) {
    emitAndExit(
      { probe: 'service-readyz', verdict: 'fail', reason: 'missing_url_or_known_service' },
      EXIT_FAIL,
    );
    return;
  }
  let fetched;
  try {
    fetched = await getBounded(resolved.url, timeout);
  } catch (err) {
    emitAndExit(
      {
        probe: 'service-readyz',
        service: resolved.service,
        verdict: 'fail',
        reason: err && err.message === 'timeout' ? 'timeout' : 'unreachable',
      },
      EXIT_FAIL,
    );
    return;
  }
  const evaluated = evaluateReadyz(fetched);
  const line = {
    probe: 'service-readyz',
    service: resolved.service,
    verdict: evaluated.verdict,
    reason: evaluated.reason,
    status: fetched.status,
    ready: evaluated.verdict === 'ok',
    elapsedMs: fetched.elapsedMs,
  };
  if (evaluated.failing.length > 0) line.failing = evaluated.failing;
  emitAndExit(
    line,
    evaluated.verdict === 'ok' ? EXIT_OK : evaluated.verdict === 'degraded' ? EXIT_DEGRADED : EXIT_FAIL,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
