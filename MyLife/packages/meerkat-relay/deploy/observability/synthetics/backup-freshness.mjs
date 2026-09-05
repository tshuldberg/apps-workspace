#!/usr/bin/env node
/**
 * Synthetic: backup freshness probe (Plan 44 WP-5A).
 *
 * NC-44.3: a backup is NOT healthy without a recent restore proof. This probe reads the
 * latest VERIFIED `ops.backup_restore_proofs` row (a bounded, indexed, read-only query)
 * and compares its age and recorded RPO against the thresholds in slo-definitions.json.
 * A missing verified proof is a hard FAIL, never a pass: a backup no restore has proven
 * is a false sense of safety.
 *
 * Dependency-free in the sense the synthetics contract means: it adds NO new dependency.
 * It reads the SLO JSON with the Node standard library and connects with `pg`, which is
 * already this package's core dependency (the same driver every service bin uses). The
 * proof-provisioning (the founder-ops backup job that RECORDS proofs) stays founder-ops;
 * this probe only READS what has been recorded, with the read-only observer credential.
 *
 * Usage:
 *   MEERKAT_OBSERVER_URL=postgres://meerkat_observer:...@host/db \
 *     node backup-freshness.mjs [--slo <path>] [--now <iso>]
 *
 * Exit: 0 fresh (a recent verified proof within budget), 1 degraded (a verified proof
 * whose recorded RPO exceeds budget), 2 fail (no verified proof, or a stale one, or a
 * read/connection error). One NDJSON result line on stdout.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, emitAndExit, EXIT_OK, EXIT_DEGRADED, EXIT_FAIL } from './lib/probe.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SLO = path.join(here, '..', 'slo-definitions.json');

/** Clock-skew allowance before a future-dated proof is rejected outright. */
const FUTURE_SKEW_SECONDS = 300;

/**
 * Pure freshness evaluator, exported for the unit test. NC-44.3 encoded: a missing or
 * unverified latest proof is a hard fail. A proof older than maxProofAgeSeconds is stale
 * (fail). A proof dated in the FUTURE beyond clock-skew allowance is a hard fail, never
 * clamped to age zero: a mis-dated row must not stay "fresh" until wall time catches up.
 * A verified in-window proof whose recorded RPO exceeds maxRpoSeconds is degraded (it
 * restores, but the data-loss window is too wide). Otherwise fresh.
 */
export function evaluateFreshness({ latest, now, thresholds }) {
  if (!latest || latest.verified !== true) {
    return { verdict: 'fail', reason: 'no_verified_proof', ageSeconds: null, proofId: null };
  }
  const nowMs = new Date(now).getTime();
  const restoredMs = new Date(latest.restoredAt).getTime();
  if (!Number.isFinite(nowMs) || !Number.isFinite(restoredMs)) {
    return { verdict: 'fail', reason: 'malformed_timestamp', ageSeconds: null, proofId: latest.proofId };
  }
  if (restoredMs - nowMs > FUTURE_SKEW_SECONDS * 1000) {
    return { verdict: 'fail', reason: 'proof_in_future', ageSeconds: null, proofId: latest.proofId };
  }
  const ageSeconds = Math.max(0, Math.round((nowMs - restoredMs) / 1000));
  if (ageSeconds > thresholds.maxProofAgeSeconds) {
    return { verdict: 'fail', reason: 'proof_stale', ageSeconds, proofId: latest.proofId };
  }
  if (Number(latest.rpoSeconds) > thresholds.maxRpoSeconds) {
    return { verdict: 'degraded', reason: 'rpo_exceeded', ageSeconds, proofId: latest.proofId };
  }
  return { verdict: 'ok', reason: 'fresh', ageSeconds, proofId: latest.proofId };
}

/**
 * Read the backup-freshness thresholds from the SLO file. STRICT: a missing,
 * unreadable, or malformed SLO file, or an objective without numeric thresholds,
 * returns null and the probe FAILS (exit 2). Broken alerting configuration must
 * never soften into permissive defaults that let a stale backup pass.
 */
export function readThresholds(sloPath) {
  try {
    const slo = JSON.parse(readFileSync(sloPath, 'utf8'));
    const objective = (slo.objectives ?? []).find((o) => o.id === 'backup-freshness');
    const configured = objective && objective.thresholds;
    if (
      configured &&
      Number.isFinite(configured.maxProofAgeSeconds) &&
      Number.isFinite(configured.maxRpoSeconds) &&
      configured.maxProofAgeSeconds > 0 &&
      configured.maxRpoSeconds > 0
    ) {
      return { maxProofAgeSeconds: configured.maxProofAgeSeconds, maxRpoSeconds: configured.maxRpoSeconds };
    }
  } catch {
    // Fall through to null: the probe fails hard on unreadable configuration.
  }
  return null;
}

/** Fetch the latest VERIFIED proof row through a bounded read-only connection. */
async function fetchLatestVerifiedProof(connectionString) {
  const { Client } = await import('pg');
  const client = new Client({
    connectionString,
    application_name: 'meerkat-backup-freshness',
    statement_timeout: 5000,
    query_timeout: 5000,
  });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT proof_id, restored_at, verified, rpo_seconds, rto_seconds
         FROM ops.backup_restore_proofs
        WHERE verified = true
        ORDER BY restored_at DESC, proof_id DESC
        LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      proofId: String(row.proof_id),
      restoredAt: row.restored_at instanceof Date ? row.restored_at.toISOString() : String(row.restored_at),
      verified: row.verified === true,
      rpoSeconds: Number(row.rpo_seconds),
      rtoSeconds: Number(row.rto_seconds),
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sloPath = args.slo ?? DEFAULT_SLO;
  const now = args.now ?? new Date().toISOString();
  const thresholds = readThresholds(sloPath);
  if (!thresholds) {
    emitAndExit(
      { probe: 'backup-freshness', verdict: 'fail', reason: 'slo_unreadable', slo: sloPath },
      EXIT_FAIL,
    );
    return;
  }
  const connectionString = (process.env.MEERKAT_OBSERVER_URL ?? process.env.MEERKAT_POSTGRES_URL ?? '').trim();
  if (!connectionString) {
    emitAndExit({ probe: 'backup-freshness', verdict: 'fail', reason: 'missing_connection' }, EXIT_FAIL);
    return;
  }
  let latest;
  try {
    latest = await fetchLatestVerifiedProof(connectionString);
  } catch (err) {
    emitAndExit(
      { probe: 'backup-freshness', verdict: 'fail', reason: 'query_error', detail: err && err.message },
      EXIT_FAIL,
    );
    return;
  }
  const evaluated = evaluateFreshness({ latest, now, thresholds });
  const line = {
    probe: 'backup-freshness',
    verdict: evaluated.verdict,
    reason: evaluated.reason,
    ageSeconds: evaluated.ageSeconds,
    maxProofAgeSeconds: thresholds.maxProofAgeSeconds,
  };
  if (evaluated.proofId) line.proofId = evaluated.proofId;
  emitAndExit(
    line,
    evaluated.verdict === 'ok' ? EXIT_OK : evaluated.verdict === 'degraded' ? EXIT_DEGRADED : EXIT_FAIL,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
