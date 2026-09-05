/**
 * Shared synthetic-probe helpers (Plan 44 Phase 4 WP-4C). No dependencies beyond the
 * Node standard library: these run in any container that already has node, and adding a
 * fetch/http client would widen the supply chain we are hardening.
 *
 * Probe contract (every script in this directory):
 *   - Bounded: a single --timeout budget caps the whole run; a hung endpoint never hangs
 *     the probe.
 *   - One NDJSON result line on stdout: a single JSON object, newline-terminated, so a
 *     scraper or cron can `tail | jq`. Diagnostics go to stderr, never stdout.
 *   - Exit code is the machine verdict: 0 ok, 1 degraded, 2 fail. `degraded` means the
 *     endpoint answered but is not fully healthy (e.g. 503 not-ready); `fail` means it
 *     did not answer, timed out, or violated an invariant (e.g. a zero-knowledge shape
 *     regression).
 *
 * Zero-knowledge: probes read only PUBLIC surfaces and assert on SHAPE, never on any
 * payload identity. No probe logs a response body field that could carry an identity; the
 * relay shape probe explicitly rejects any field beyond {ok, connections}.
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export const EXIT_OK = 0;
export const EXIT_DEGRADED = 1;
export const EXIT_FAIL = 2;

/** Parse `--flag value` / `--flag=value` args into a plain object. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq !== -1) {
      out[token.slice(2, eq)] = token.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[token.slice(2)] = next;
        i += 1;
      } else {
        out[token.slice(2)] = 'true';
      }
    }
  }
  return out;
}

/**
 * GET a URL under a bounded timeout. Resolves { status, headers, body, elapsedMs }.
 * Rejects on network error or timeout (the timeout aborts the socket). Never follows a
 * redirect: a health/probe endpoint that 3xxes is itself a finding.
 */
export function getBounded(url, timeoutMs) {
  const target = new URL(url);
  const client = target.protocol === 'https:' ? https : http;
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const req = client.request(
      target,
      { method: 'GET', timeout: timeoutMs },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          // Bound the body we buffer: a health body is tiny. Anything large is itself
          // suspicious and we do not need it to make a verdict.
          if (size <= 64 * 1024) chunks.push(chunk);
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
            elapsedMs: Date.now() - startedAt,
          });
        });
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

/** Parse a JSON body, returning null (not throwing) on malformed input. */
export function tryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Emit the single NDJSON result line on stdout and exit with the verdict code. `result`
 * MUST NOT contain any response payload field that could carry an identity; callers build
 * a shape-only summary. `at` is stamped here so every line is timestamped uniformly.
 */
export function emitAndExit(result, exitCode) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...result })}\n`);
  process.exit(exitCode);
}
