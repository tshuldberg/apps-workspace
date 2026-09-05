#!/usr/bin/env node
/**
 * Synthetic: canary verdict aggregator (Plan 44 WP-6C).
 *
 * A promotion up the deploy ladder is justified by EVIDENCE, and the honest form of
 * that evidence is a real synthetic run against the canary host set. This probe RUNS
 * the real underlying probes it can against the hosts it is given:
 *   - the relay /healthz zero-knowledge shape check (inline, bounded GET asserting the
 *     body is EXACTLY {ok, connections}), reusing the sibling probe's pure evaluator,
 *   - each stateful service /readyz walk, reusing the sibling readyz evaluator,
 * then emits ONE NDJSON verdict line aggregating every check.
 *
 * HONESTY (this is the whole point of a canary gate):
 *   - A check that was NOT requested is reported `skipped`, NEVER `pass`. The verdict
 *     never counts a check that did not run.
 *   - ZERO requested checks is a FAIL (exit 2), never a vacuous pass: "I checked
 *     nothing and everything is fine" is exactly the lie a promotion gate must not tell.
 *   - The aggregate verdict is the WORST check verdict: any fail -> fail (exit 2), else
 *     any degraded -> degraded (exit 1), else ok (exit 0). Skipped checks do not
 *     improve the verdict; they are recorded so the operator sees coverage.
 *
 * Zero-knowledge: this only runs the existing public-surface probes, which read SHAPE
 * only and never a payload identity. It adds NO field to /healthz and logs no body value.
 *
 * Usage:
 *   node canary-verdict.mjs \
 *     --relay-url http://relay-canary:8787/healthz \
 *     --service persona:persona-canary:8894 --service humanity:humanity-canary:8892 \
 *     [--timeout 3000] [--slo ../slo-definitions.json]
 *
 * `--service` is `<name>:<host>:<port>` and repeatable. --slo is accepted for
 * parity with the other probes (thresholds are not needed for shape/readyz, but the
 * flag is recorded so a caller can point at a non-default file); zero services + no
 * relay url is the zero-requested-checks fail.
 *
 * Exit: 0 ok, 1 degraded, 2 fail (worst check, or zero requested checks).
 */

import { parseArgs, getBounded, emitAndExit, EXIT_OK, EXIT_DEGRADED, EXIT_FAIL } from './lib/probe.mjs';
// Reuse the sibling probes' PURE evaluators so this aggregator asserts the exact same
// invariants (the /healthz shape tripwire, the readyz status/body contract).
import { evaluateHealthzShape } from './relay-healthz-shape.mjs';
import { evaluateReadyz } from './service-readyz.mjs';

/** Known stateful service default ports, matching service-readyz.mjs / compose. */
const SERVICE_PORTS = {
  community: 8890,
  directory: 8891,
  humanity: 8892,
  hosted: 8893,
  persona: 8894,
};

/**
 * Aggregate a set of individual check results into one canary verdict. PURE and
 * exported for the unit test. Encodes the honesty rules:
 *   - zero checks -> fail (reason 'no_checks_requested'),
 *   - otherwise verdict = worst of the RAN checks (skipped never counts as pass and
 *     never lifts the verdict).
 * A check is { name, verdict: 'ok'|'degraded'|'fail'|'skipped', detail }.
 */
export function aggregateVerdict(checks) {
  if (!Array.isArray(checks) || checks.length === 0) {
    return { verdict: 'fail', reason: 'no_checks_requested', checks: [] };
  }
  const ran = checks.filter((c) => c.verdict !== 'skipped');
  if (ran.length === 0) {
    // Every requested check was skipped: nothing was actually verified.
    return { verdict: 'fail', reason: 'no_checks_ran', checks };
  }
  // FAIL-CLOSED on anything that is not an explicit ok/degraded: an unknown verdict
  // value (evaluator contract drift, a malformed imported result) must never read
  // as green.
  if (ran.some((c) => c.verdict !== 'ok' && c.verdict !== 'degraded')) {
    return { verdict: 'fail', reason: 'check_failed', checks };
  }
  if (ran.some((c) => c.verdict === 'degraded')) return { verdict: 'degraded', reason: 'check_degraded', checks };
  return { verdict: 'ok', reason: 'all_ran_checks_ok', checks };
}

/** Map a verdict string to its exit code (ok 0, degraded 1, fail 2). */
export function verdictExitCode(verdict) {
  if (verdict === 'ok') return EXIT_OK;
  if (verdict === 'degraded') return EXIT_DEGRADED;
  return EXIT_FAIL;
}

/**
 * Parse a repeatable --service arg into { name, host, port }. Accepts `name:host:port`
 * or `name:host` (default port from SERVICE_PORTS). PURE and exported for tests.
 * Returns null for a malformed or unknown-service spec, which the caller records as
 * a FAILED check: an operator who typos a canary host must get a stop signal, not a
 * silently reduced coverage set that still exits 0.
 */
export function parseServiceSpec(spec) {
  const parts = String(spec).split(':');
  // Exactly name:host or name:host:port -- extra components are a malformed
  // (likely generated) spec and must not be silently truncated into a probe.
  if (parts.length < 2 || parts.length > 3) return null;
  const name = parts[0];
  if (!name || !(name in SERVICE_PORTS)) return null;
  const host = parts[1];
  if (!host) return null;
  const port = parts[2] !== undefined ? Number(parts[2]) : SERVICE_PORTS[name];
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return { name, host, port };
}

/** Normalize --service into an array (0, 1, or many). */
function collectServiceArgs(raw) {
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** Run the relay /healthz shape check against one url. Returns a check result. */
async function runRelayCheck(url, timeoutMs) {
  let fetched;
  try {
    fetched = await getBounded(url, timeoutMs);
  } catch (err) {
    return {
      name: 'relay-healthz-shape',
      verdict: 'fail',
      detail: err && err.message === 'timeout' ? 'timeout' : 'unreachable',
    };
  }
  const evaluated = evaluateHealthzShape({ status: fetched.status, body: fetched.body, headers: fetched.headers });
  return { name: 'relay-healthz-shape', verdict: evaluated.verdict, detail: evaluated.reason };
}

/** Run a /readyz walk against one service. Returns a check result. */
async function runReadyzCheck(service, timeoutMs) {
  const url = `http://${service.host}:${service.port}/readyz`;
  let fetched;
  try {
    fetched = await getBounded(url, timeoutMs);
  } catch (err) {
    return {
      name: `readyz:${service.name}`,
      verdict: 'fail',
      detail: err && err.message === 'timeout' ? 'timeout' : 'unreachable',
    };
  }
  const evaluated = evaluateReadyz({ status: fetched.status, body: fetched.body });
  return { name: `readyz:${service.name}`, verdict: evaluated.verdict, detail: evaluated.reason };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const timeout = Number(args.timeout ?? 3000);
  const checks = [];

  // Relay check: run it only if a url was requested; otherwise record it skipped
  // (honest coverage), never a silent pass.
  if (args['relay-url']) {
    checks.push(await runRelayCheck(args['relay-url'], timeout));
  } else {
    checks.push({ name: 'relay-healthz-shape', verdict: 'skipped', detail: 'no --relay-url requested' });
  }

  // Service checks: one per --service spec. A malformed/unknown spec is a FAILED
  // check: the operator asked for coverage they did not get, and a typo must stop
  // the promotion, not shrink the coverage set while still exiting 0.
  const serviceArgs = collectServiceArgs(args.service);
  for (const spec of serviceArgs) {
    const parsed = parseServiceSpec(spec);
    if (!parsed) {
      checks.push({ name: `readyz:${String(spec)}`, verdict: 'fail', detail: 'bad_service_spec' });
      continue;
    }
    checks.push(await runReadyzCheck(parsed, timeout));
  }
  if (serviceArgs.length === 0) {
    checks.push({ name: 'readyz', verdict: 'skipped', detail: 'no --service requested' });
  }

  const aggregate = aggregateVerdict(checks);
  emitAndExit(
    {
      probe: 'canary-verdict',
      verdict: aggregate.verdict,
      reason: aggregate.reason,
      slo: args.slo ?? '../slo-definitions.json',
      checks: aggregate.checks,
    },
    verdictExitCode(aggregate.verdict),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
