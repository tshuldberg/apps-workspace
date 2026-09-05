#!/usr/bin/env node
/**
 * Synthetic: relay /healthz zero-knowledge shape check (Plan 44 Phase 4 WP-4C).
 *
 * The slim relay's ENTIRE public surface is GET /healthz -> {ok, connections}. That two
 * field shape is a hard zero-knowledge guarantee (packages/meerkat-relay/src/server.ts,
 * and the CLAUDE.md invariant "never add a field to /healthz"). This probe is the tripwire
 * for a regression: if any field OTHER than ok/connections ever appears, the probe FAILS
 * (exit 2) so an operator is paged on a metadata-privacy regression, not merely a
 * degradation. It also verifies the cross-origin header the web relay-selector depends on.
 *
 * Usage:
 *   node relay-healthz-shape.mjs --url http://relay:8787/healthz [--timeout 3000]
 *
 * Exit: 0 correct shape, 1 answered but degraded (ok:false / non-200), 2 fail
 * (unreachable, timeout, or SHAPE REGRESSION).
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

/** The EXACT allowed key set. Order-independent; presence-exact. */
const ALLOWED_KEYS = ['connections', 'ok'];

/**
 * Pure shape evaluator, exported for the unit test. Given the fetched status, parsed body,
 * and headers, returns { verdict: 'ok'|'degraded'|'fail', reason, extraKeys }.
 *
 *   - fail  : not a 200, unparseable body, a non-object body, a missing required key, a
 *             wrong-typed field, OR any EXTRA key (the zero-knowledge regression).
 *   - degraded: a well-shaped body whose ok field is false.
 *   - ok    : status 200, body is exactly {ok:true, connections:<number>}.
 *
 * The evaluator never returns any body VALUE in its reason beyond the connection count and
 * the NAMES of unexpected keys (a leaked field name is exactly what we must surface).
 */
export function evaluateHealthzShape({ status, body, headers }) {
  if (status !== 200) {
    return { verdict: 'fail', reason: `status_${status}`, extraKeys: [] };
  }
  const parsed = tryJson(body);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { verdict: 'fail', reason: 'body_not_object', extraKeys: [] };
  }
  const keys = Object.keys(parsed).sort();
  const extraKeys = keys.filter((k) => !ALLOWED_KEYS.includes(k));
  if (extraKeys.length > 0) {
    // A NEW field on /healthz is a zero-knowledge regression. Fail hard and name it.
    return { verdict: 'fail', reason: 'shape_regression', extraKeys };
  }
  if (!('ok' in parsed) || !('connections' in parsed)) {
    return { verdict: 'fail', reason: 'missing_required_key', extraKeys: [] };
  }
  if (typeof parsed.ok !== 'boolean' || typeof parsed.connections !== 'number') {
    return { verdict: 'fail', reason: 'wrong_field_type', extraKeys: [] };
  }
  // The web selector probes this from a different origin; the wildcard CORS header is part
  // of the contract. Its absence is a degradation (the endpoint works but the browser path
  // would break), not a hard privacy fail.
  const cors = headers?.['access-control-allow-origin'];
  if (parsed.ok !== true) {
    return { verdict: 'degraded', reason: 'ok_false', extraKeys: [] };
  }
  if (cors !== '*') {
    return { verdict: 'degraded', reason: 'missing_cors', extraKeys: [] };
  }
  return { verdict: 'ok', reason: 'shape_exact', extraKeys: [] };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url;
  const timeout = Number(args.timeout ?? 3000);
  if (!url) {
    emitAndExit({ probe: 'relay-healthz-shape', verdict: 'fail', reason: 'missing_url' }, EXIT_FAIL);
  }
  let fetched;
  try {
    fetched = await getBounded(url, timeout);
  } catch (err) {
    emitAndExit(
      {
        probe: 'relay-healthz-shape',
        verdict: 'fail',
        reason: err && err.message === 'timeout' ? 'timeout' : 'unreachable',
      },
      EXIT_FAIL,
    );
    return;
  }
  const evaluated = evaluateHealthzShape(fetched);
  const line = {
    probe: 'relay-healthz-shape',
    verdict: evaluated.verdict,
    reason: evaluated.reason,
    status: fetched.status,
    elapsedMs: fetched.elapsedMs,
  };
  if (evaluated.extraKeys.length > 0) line.extraKeys = evaluated.extraKeys;
  emitAndExit(
    line,
    evaluated.verdict === 'ok' ? EXIT_OK : evaluated.verdict === 'degraded' ? EXIT_DEGRADED : EXIT_FAIL,
  );
}

// Only run main() when invoked directly, so the unit test can import evaluateHealthzShape
// without starting a probe.
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
