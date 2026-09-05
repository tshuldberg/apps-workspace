import type { PostgresStoreContext } from '../postgres/store-context';
import { readPostgresSchemaState } from '../postgres/schema-guard';
import { MEERKAT_POSTGRES_SCHEMA_VERSION } from '../postgres/migrations';
import {
  PostgresCutoverStore,
  type CutoverDigestMap,
  type CutoverProof,
  type CutoverTransition,
} from '../postgres/stores/cutover-store';
import {
  STATE_STORE_IDS,
  type StateStoreId,
} from './model';
import { fileEnumerator, type StateServiceRoots } from './enumerate-file';
import { postgresEnumerator } from './enumerate-postgres';
import { computeStoreDigest, compareDigests, type StoreCompareResult } from './digest';
import { dryRun, importAll } from './engine';

/**
 * Cutover and rollback orchestration (Plan 44 WP-3C), built on the WP-3A import
 * engine + semantic digest. The env flip (per-service `MEERKAT_STORE_BACKEND`) and
 * service restart are OPERATOR actions performed OUT OF BAND between these phases
 * (per the runbook); this module owns the verifiable steps and the durable,
 * honest proof. It never edits env or compose.
 *
 * Phases:
 *   preflight  verify the target schema is at the current version, dry-run
 *              enumerate every source root, REQUIRE a writer-freeze attestation,
 *              and best-effort liveness-probe the known service ports (a LIVE
 *              service fails preflight). Records the source digest + attestation.
 *   execute    the gate: final delta import, then a digest compare that FAILS
 *              CLOSED unless file and PostgreSQL are identical by semantic digest.
 *   verify     after the operator flips env + restarts on PostgreSQL: capture the
 *              post-boot PostgreSQL digest and require it match the executed digest.
 *   rollback   the operator flipped env back to the UNTOUCHED file state; record
 *              the rollback window and an honest LOSS statement listing the stores
 *              whose PostgreSQL writes since cutover are orphaned.
 */

export interface CutoverTarget {
  database: PostgresStoreContext;
}

/** Build a semantic digest map for one backend across every state store. */
export async function digestAllStores(
  backend: 'file' | 'postgres',
  roots: StateServiceRoots,
  target: CutoverTarget | null,
  storeIds: readonly StateStoreId[] = STATE_STORE_IDS,
): Promise<CutoverDigestMap> {
  const map: CutoverDigestMap = {};
  for (const storeId of storeIds) {
    const enumerator = backend === 'file'
      ? fileEnumerator(storeId, roots)
      : postgresEnumerator(storeId, requireDatabase(target));
    const build = await computeStoreDigest(enumerator, backend);
    map[storeId] = { count: build.digest.count, rollupHex: build.digest.rollupHex };
  }
  return map;
}

function requireDatabase(target: CutoverTarget | null): PostgresStoreContext {
  if (!target) throw new Error('A PostgreSQL target is required to digest the postgres backend');
  return target.database;
}

// --- Preflight --------------------------------------------------------------

export interface ProbeResult {
  url: string;
  /** True when the service answered (still LIVE) -- which FAILS preflight. */
  live: boolean;
  detail: string;
}

/** Injectable probe so tests can drive liveness without a network dependency. */
export type LivenessProbe = (url: string) => Promise<ProbeResult>;

/** Default probe: a short-timeout GET; any answer means the service is still live. */
export const defaultLivenessProbe: LivenessProbe = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { url, live: true, detail: `responded ${response.status}` };
  } catch (error) {
    return { url, live: false, detail: error instanceof Error ? error.message : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
};

export interface PreflightInput {
  cutoverId: string;
  releaseSha: string;
  operator: string;
  /** The operator attestation that writers are frozen. Required; recorded verbatim. */
  writersFrozenBy: string;
  probeUrls?: readonly string[];
}

export interface PreflightResult {
  ok: boolean;
  reasons: string[];
  transition?: CutoverTransition;
  report: {
    schemaVersion: number;
    expectedSchemaVersion: number;
    dryRun: Record<string, number>;
    probes: ProbeResult[];
  };
}

/**
 * Phase 1. Fails (ok:false) without recording a proof if the schema is at the
 * wrong version or any probed service is still live. Requires the writer-freeze
 * attestation (the tool cannot prove writers are stopped; it records the
 * attestation honestly). On success, records the proof in state `preflighted`.
 */
export async function preflightCutover(
  target: CutoverTarget,
  roots: StateServiceRoots,
  input: PreflightInput,
  storeIds: readonly StateStoreId[] = STATE_STORE_IDS,
  probe: LivenessProbe = defaultLivenessProbe,
): Promise<PreflightResult> {
  const reasons: string[] = [];

  if (!input.writersFrozenBy || input.writersFrozenBy.trim().length === 0) {
    reasons.push('missing writer-freeze attestation (--writers-frozen-by)');
  }

  const schema = await readPostgresSchemaState(target.database);
  if (schema.currentVersion !== MEERKAT_POSTGRES_SCHEMA_VERSION) {
    reasons.push(
      `target schema is at version ${schema.currentVersion}, expected ${MEERKAT_POSTGRES_SCHEMA_VERSION}`,
    );
  }

  // Dry-run enumerate every source root (zero writes) so preflight both validates
  // the roots are readable and records the source record counts.
  const dryRunReports = await dryRun(roots, storeIds);
  const dryRunCounts: Record<string, number> = {};
  for (const report of dryRunReports) dryRunCounts[report.storeId] = report.count;

  const probes: ProbeResult[] = [];
  for (const url of input.probeUrls ?? []) {
    const result = await probe(url);
    probes.push(result);
    if (result.live) reasons.push(`service still live at ${url} (${result.detail})`);
  }

  const report = {
    schemaVersion: schema.currentVersion,
    expectedSchemaVersion: MEERKAT_POSTGRES_SCHEMA_VERSION,
    dryRun: dryRunCounts,
    probes,
  };

  if (reasons.length > 0) return { ok: false, reasons, report };

  const sourceDigest = await digestAllStores('file', roots, target, storeIds);
  const store = new PostgresCutoverStore(target.database);
  const transition = await store.preflight({
    cutoverId: input.cutoverId,
    releaseSha: input.releaseSha,
    operator: input.operator,
    writersFrozenBy: input.writersFrozenBy,
    sourceDigest,
    preflightReport: report,
  });
  return { ok: transition.status === 'ok', reasons, transition, report };
}

// --- Execute (the gate) -----------------------------------------------------

export interface ExecuteResult {
  gatePassed: boolean;
  comparisons: StoreCompareResult[];
  transition?: CutoverTransition;
}

/**
 * Phase 2 (the gate): import the final delta, then compare file vs PostgreSQL
 * digests. If ALL stores are identical the gate passes and the proof advances to
 * `executed`; otherwise the gate FAILS, NOTHING is recorded as complete, and the
 * caller must not flip env. The final import is idempotent, so re-running is safe.
 */
export async function executeCutover(
  target: CutoverTarget,
  roots: StateServiceRoots,
  input: { cutoverId: string; operator: string; expectedVersion: number },
  storeIds: readonly StateStoreId[] = STATE_STORE_IDS,
): Promise<ExecuteResult> {
  await importAll(target, roots, input.operator, storeIds);

  const comparisons: StoreCompareResult[] = [];
  const executedDigest: CutoverDigestMap = {};
  for (const storeId of storeIds) {
    const source = await computeStoreDigest(fileEnumerator(storeId, roots), 'file');
    const targetBuild = await computeStoreDigest(postgresEnumerator(storeId, target.database), 'postgres');
    comparisons.push(compareDigests(storeId, source, targetBuild));
    executedDigest[storeId] = { count: source.digest.count, rollupHex: source.digest.rollupHex };
  }

  const gatePassed = comparisons.every((c) => c.status === 'identical');
  if (!gatePassed) return { gatePassed: false, comparisons };

  const store = new PostgresCutoverStore(target.database);
  const transition = await store.recordExecuted({
    cutoverId: input.cutoverId,
    expectedVersion: input.expectedVersion,
    executedDigest,
  }, input.operator);
  return { gatePassed: true, comparisons, transition };
}

// --- Verify -----------------------------------------------------------------

export interface VerifyResult {
  matched: boolean;
  divergences: StoreCompareResult[];
  transition?: CutoverTransition;
}

/**
 * Phase 3: after the env flip + restart on PostgreSQL, capture the post-boot
 * PostgreSQL digest and require it match the executed digest recorded at the gate.
 * Verify only on an exact match; a mismatch means the flip is not sound and the
 * caller should roll back.
 */
export async function verifyCutover(
  target: CutoverTarget,
  input: { cutoverId: string; operator: string; expectedVersion: number },
  storeIds: readonly StateStoreId[] = STATE_STORE_IDS,
): Promise<VerifyResult> {
  const store = new PostgresCutoverStore(target.database);
  const proof = await store.get(input.cutoverId);
  if (!proof || !proof.executedDigest) {
    throw new Error('Cannot verify a cutover that has not passed the execute gate');
  }

  const postBootDigest = await digestAllStores('postgres', {}, target, storeIds);
  const divergences: StoreCompareResult[] = [];
  for (const storeId of storeIds) {
    const executed = proof.executedDigest[storeId];
    const observed = postBootDigest[storeId];
    if (!executed || !observed
      || executed.count !== observed.count
      || executed.rollupHex !== observed.rollupHex) {
      divergences.push({
        storeId,
        status: 'mismatched',
        sourceCount: executed?.count ?? 0,
        targetCount: observed?.count ?? 0,
        missingInTarget: [],
        extraInTarget: [],
        mismatched: [storeId],
        truncated: false,
      });
    }
  }

  if (divergences.length > 0) return { matched: false, divergences };

  const transition = await store.recordVerified({
    cutoverId: input.cutoverId,
    expectedVersion: input.expectedVersion,
    postBootDigest,
  }, input.operator);
  return { matched: true, divergences, transition };
}

// --- Rollback ---------------------------------------------------------------

export interface RollbackResult {
  transition: CutoverTransition;
  delta: Record<string, unknown>;
  /** Stores whose PostgreSQL-side writes since cutover will be orphaned by rollback. */
  lostStores: string[];
}

/**
 * Rollback: the operator has flipped env back to the UNTOUCHED file state. Records
 * the rollback window (cutover proof timestamp -> now) and an honest LOSS delta:
 * the stores whose PostgreSQL digest diverges from the file state are the stores
 * with orphaned post-cutover PostgreSQL writes. It never deletes anything (the
 * file tree was never mutated by import; the orphaned PostgreSQL rows stay for
 * forensics, not served). The wording states plainly that the file tree resumes
 * as authority and post-cutover PostgreSQL writes are orphaned.
 */
export async function rollbackCutover(
  target: CutoverTarget,
  roots: StateServiceRoots,
  input: { cutoverId: string; operator: string; expectedVersion: number; reason: string },
  storeIds: readonly StateStoreId[] = STATE_STORE_IDS,
): Promise<RollbackResult> {
  const store = new PostgresCutoverStore(target.database);
  const proof = await store.get(input.cutoverId);
  if (!proof) throw new Error(`Cutover ${input.cutoverId} not found`);

  const windowStart = proof.verifiedAt ?? proof.executedAt ?? proof.preflightedAt ?? proof.createdAt;
  const abandonedPostgresDigest = await digestAllStores('postgres', {}, target, storeIds);
  const fileDigest = await digestAllStores('file', roots, target, storeIds);

  const perStore: Record<string, unknown> = {};
  const lostStores: string[] = [];
  for (const storeId of storeIds) {
    const pg = abandonedPostgresDigest[storeId];
    const file = fileDigest[storeId];
    const diverged = !pg || !file || pg.count !== file.count || pg.rollupHex !== file.rollupHex;
    if (diverged) lostStores.push(storeId);
    perStore[storeId] = {
      fileCount: file?.count ?? 0,
      postgresCountAtRollback: pg?.count ?? 0,
      diverged,
    };
  }

  const delta: Record<string, unknown> = {
    reason: input.reason,
    windowStart,
    windowEnd: new Date().toISOString(),
    // The honest boundary, encoded in the durable record itself.
    postgresWritesAfterCutoverPreserved: false,
    orphanedPostgresRowsRetainedForForensics: true,
    authorityAfterRollback: 'file',
    verifiedBeforeRollback: proof.state === 'verified',
    // The LOSS statement: exactly which stores have orphaned PostgreSQL writes.
    lostStores,
    perStore,
  };

  const transition = await store.recordRolledBack({
    cutoverId: input.cutoverId,
    expectedVersion: input.expectedVersion,
    rollbackDigestDelta: delta,
  }, input.operator);
  return { transition, delta, lostStores };
}

export async function getCutover(
  target: CutoverTarget,
  cutoverId: string,
): Promise<CutoverProof | null> {
  return new PostgresCutoverStore(target.database).get(cutoverId);
}
