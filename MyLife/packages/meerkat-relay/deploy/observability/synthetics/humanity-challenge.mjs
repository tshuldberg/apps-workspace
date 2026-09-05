#!/usr/bin/env node
/**
 * Synthetic: humanity challenge/issue reachability (Plan 44 Phase 4 WP-4C).
 *
 * HONESTY BOUNDARY. A full challenge -> issue -> redeem synthetic would require minting a
 * real humanity token. The /humanity/issue step requires a real ATTESTATION from a
 * verifier (proof-of-humanity, e.g. a solved Turnstile), and there is NO synthetic /
 * test-token bypass path in the humanity service (verified against
 * src/humanity-service.ts, src/humanity-service-http.ts, src/humanity-verifiers.ts). We do
 * NOT invent one: a bypass would be a security hole dressed as a probe.
 *
 * So this synthetic proves the challenge MINT PATH is reachable and correctly shaped:
 * POST /humanity/challenge { kind } -> { ok, challengeId, kind, nonce }. That covers the
 * DNS/TLS/route/service-up chain for the humanity API's first hop. It then STOPS and says
 * so in the result line (`stoppedAt: challenge`, `reason: no_synthetic_attestation`), so
 * an operator is never misled into thinking the full issue+redeem loop is being exercised.
 * If a dedicated synthetic attestation path is ever added to the humanity service, extend
 * this probe to continue through issue+redeem; until then it must not pretend to.
 *
 * Usage:
 *   node humanity-challenge.mjs --url http://humanity:8892 [--kind registration] [--timeout 3000]
 *
 * Exit: 0 challenge minted (mint path healthy), 1 answered but rejected the challenge
 * (degraded), 2 fail (unreachable, timeout, or malformed body).
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import {
  parseArgs,
  tryJson,
  emitAndExit,
  EXIT_OK,
  EXIT_DEGRADED,
  EXIT_FAIL,
} from './lib/probe.mjs';

/** Bounded POST of a small JSON body. Std-lib only. Resolves { status, body, elapsedMs }. */
function postJsonBounded(url, payload, timeoutMs) {
  const target = new URL(url);
  const client = target.protocol === 'https:' ? https : http;
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const req = client.request(
      target,
      {
        method: 'POST',
        timeout: timeoutMs,
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size <= 64 * 1024) chunks.push(chunk);
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            elapsedMs: Date.now() - startedAt,
          }),
        );
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err) => reject(err));
    req.end(data);
  });
}

/**
 * Pure evaluator, exported for tests. A minted challenge returns 200 with a challengeId +
 * nonce; we assert the SHAPE only and never echo the nonce value (it is single-use
 * material). A 400 is an honest rejection (degraded: service up, challenge refused). Any
 * other status or a malformed body is a fail.
 */
export function evaluateChallenge({ status, body }) {
  const parsed = tryJson(body);
  if (parsed === null || typeof parsed !== 'object') {
    return { verdict: 'fail', reason: 'malformed_body' };
  }
  if (status === 200) {
    const ok =
      parsed.ok === true &&
      typeof parsed.challengeId === 'string' &&
      parsed.challengeId.length > 0 &&
      typeof parsed.nonce === 'string' &&
      parsed.nonce.length > 0;
    return ok
      ? { verdict: 'ok', reason: 'challenge_minted' }
      : { verdict: 'fail', reason: 'malformed_challenge' };
  }
  if (status === 400) {
    return { verdict: 'degraded', reason: 'challenge_rejected' };
  }
  return { verdict: 'fail', reason: `status_${status}` };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = args.url;
  const kind = args.kind ?? 'registration';
  const timeout = Number(args.timeout ?? 3000);
  if (!base) {
    emitAndExit({ probe: 'humanity-challenge', verdict: 'fail', reason: 'missing_url' }, EXIT_FAIL);
    return;
  }
  const challengeUrl = `${base.replace(/\/$/, '')}/humanity/challenge`;
  let fetched;
  try {
    fetched = await postJsonBounded(challengeUrl, { kind }, timeout);
  } catch (err) {
    emitAndExit(
      {
        probe: 'humanity-challenge',
        verdict: 'fail',
        reason: err && err.message === 'timeout' ? 'timeout' : 'unreachable',
        stoppedAt: 'challenge',
      },
      EXIT_FAIL,
    );
    return;
  }
  const evaluated = evaluateChallenge(fetched);
  emitAndExit(
    {
      probe: 'humanity-challenge',
      verdict: evaluated.verdict,
      reason: evaluated.reason,
      status: fetched.status,
      elapsedMs: fetched.elapsedMs,
      // Stated honestly on EVERY run: this probe does not exercise issue/redeem because no
      // synthetic attestation path exists. It is a mint-path reachability check only.
      stoppedAt: 'challenge',
      coverage: 'challenge_mint_path_only',
      note: 'no_synthetic_attestation: issue+redeem intentionally not exercised',
    },
    evaluated.verdict === 'ok' ? EXIT_OK : evaluated.verdict === 'degraded' ? EXIT_DEGRADED : EXIT_FAIL,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
