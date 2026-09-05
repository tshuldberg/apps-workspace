import { createHash } from 'node:crypto';
import type { CutoverDigestMap } from './stores/cutover-store';

/**
 * Backup evidence core (Plan 44 WP-5A).
 *
 * PostgreSQL is an external managed database (no compose service), so WAL
 * archiving, base backups, and point-in-time recovery are founder-ops provider
 * configuration. This module owns everything the repository CAN verify and prove:
 * a per-store semantic reference DIGEST SNAPSHOT of a live database, the SMOKE
 * COMPARE of a restored database against that reference, the freshness verdict a
 * synthetic reads from the recorded proof rows, and the object-store inventory
 * rollup used to compare managed bytes before and after a restore.
 *
 * Every function here is pure (no IO, no clock): the CLI and synthetic supply the
 * digests, the database `capturedAt` time, and the thresholds, so the logic is
 * unit-testable without a live PostgreSQL or object store.
 */

/** Bound on the divergence detail recorded into a proof so a large drift never dumps every store. */
export const BACKUP_MAX_DIVERGENCES = 40;

/** The artifact kind stamped into every snapshot file, so a stale or wrong file is rejected on load. */
export const BACKUP_SNAPSHOT_KIND = 'meerkat-backup-snapshot';
export const BACKUP_SNAPSHOT_VERSION = 1;

/**
 * A dated reference snapshot: the per-store semantic digest of one database at one
 * instant, plus the metadata a later restore-smoke needs to compare honestly. It is
 * an ARTIFACT-ON-DISK, never a `backup_restore_proofs` row: nothing was restored to
 * produce it, so recording it as a proof (even unverified) would misrepresent an
 * un-restored reference digest as recovery evidence and would pollute the freshness
 * query, which reads only verified proofs. The restore-smoke consumes this file and
 * records the proof.
 */
export interface BackupSnapshot {
  kind: typeof BACKUP_SNAPSHOT_KIND;
  version: typeof BACKUP_SNAPSHOT_VERSION;
  /** Database `clock_timestamp()` at capture (ISO), NOT the CLI host wall clock. */
  capturedAt: string;
  /** The release SHA the snapshot was captured against, supplied by the operator/CI env. */
  releaseSha: string;
  /** Which store role the snapshot was digested with (recorded for the audit trail). */
  digestRole: string;
  /** The number of stores digested; a compare against a different set is rejected. */
  storeCount: number;
  /** The per-store semantic digest map (count + rollupHex), backend-independent. */
  perStore: CutoverDigestMap;
}

/** One store's divergence between the reference snapshot and the restored database. */
export interface BackupStoreDivergence {
  storeId: string;
  reason: 'missing_in_restore' | 'extra_in_restore' | 'count_mismatch' | 'rollup_mismatch';
  referenceCount: number | null;
  restoredCount: number | null;
  referenceRollupHex: string | null;
  restoredRollupHex: string | null;
}

/** The verdict of comparing a restored database's digest map against a reference snapshot. */
export interface BackupRestoreComparison {
  verified: boolean;
  storeCount: number;
  identicalStores: number;
  divergences: BackupStoreDivergence[];
  /** True when the divergence list was truncated to BACKUP_MAX_DIVERGENCES. */
  truncated: boolean;
}

/**
 * The digest role recorded into a snapshot is the ACTUAL connection role
 * (`current_user`), never an unverified claim. An explicitly asserted role that does
 * not match the connection is an error: an evidence artifact must not carry a false
 * audit trail.
 */
export function resolveDigestRole(claimed: string, actual: string): string {
  const actualRole = actual.trim();
  if (!actualRole) throw new Error('digest connection role is required');
  const claimedRole = claimed.trim();
  if (claimedRole && claimedRole !== actualRole) {
    throw new Error(`--digest-role ${claimedRole} does not match the connection role ${actualRole}`);
  }
  return actualRole;
}

function assertNonEmpty(name: string, value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${name} is required`);
  return normalized;
}

function assertIso(name: string, value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${name} must be an ISO timestamp`);
  return parsed.toISOString();
}

/**
 * Build a dated reference snapshot from a per-store digest map (the same
 * `CutoverDigestMap` `digestAllStores` produces) plus the database capture time and
 * release SHA. Pure: the caller supplies the already-computed digests and the
 * database `clock_timestamp()`.
 */
export function buildBackupSnapshot(input: {
  capturedAt: string;
  releaseSha: string;
  digestRole: string;
  perStore: CutoverDigestMap;
}): BackupSnapshot {
  const perStore = input.perStore;
  const storeIds = Object.keys(perStore);
  if (storeIds.length === 0) throw new Error('Backup snapshot must cover at least one store');
  for (const storeId of storeIds) {
    const digest = perStore[storeId]!;
    if (!Number.isSafeInteger(digest.count) || digest.count < 0) {
      throw new Error(`Store ${storeId} has an invalid digest count`);
    }
    if (!/^[a-f0-9]{64}$/.test(digest.rollupHex)) {
      throw new Error(`Store ${storeId} has an invalid digest rollup`);
    }
  }
  return {
    kind: BACKUP_SNAPSHOT_KIND,
    version: BACKUP_SNAPSHOT_VERSION,
    capturedAt: assertIso('capturedAt', input.capturedAt),
    releaseSha: assertNonEmpty('releaseSha', input.releaseSha),
    digestRole: assertNonEmpty('digestRole', input.digestRole),
    storeCount: storeIds.length,
    perStore,
  };
}

/** Serialize a snapshot to the on-disk artifact form (stable key order, trailing newline). */
export function serializeSnapshot(snapshot: BackupSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/** Parse and validate a snapshot artifact, rejecting a wrong kind/version or a malformed digest map. */
export function parseSnapshot(text: string): BackupSnapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new Error(`Backup snapshot is not valid JSON: ${error instanceof Error ? error.message : 'unknown'}`);
  }
  if (!raw || typeof raw !== 'object') throw new Error('Backup snapshot must be an object');
  const value = raw as Record<string, unknown>;
  if (value.kind !== BACKUP_SNAPSHOT_KIND) throw new Error('Backup snapshot has the wrong kind');
  if (value.version !== BACKUP_SNAPSHOT_VERSION) throw new Error('Backup snapshot has an unsupported version');
  if (!value.perStore || typeof value.perStore !== 'object' || Array.isArray(value.perStore)) {
    throw new Error('Backup snapshot perStore must be a map');
  }
  const perStore: CutoverDigestMap = {};
  for (const [storeId, digest] of Object.entries(value.perStore as Record<string, unknown>)) {
    if (!digest || typeof digest !== 'object') throw new Error(`Store ${storeId} digest is malformed`);
    const entry = digest as Record<string, unknown>;
    const count = entry.count;
    const rollupHex = entry.rollupHex;
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Store ${storeId} has an invalid digest count`);
    }
    if (typeof rollupHex !== 'string' || !/^[a-f0-9]{64}$/.test(rollupHex)) {
      throw new Error(`Store ${storeId} has an invalid digest rollup`);
    }
    perStore[storeId] = { count, rollupHex };
  }
  // Re-run the builder validation so a hand-edited file is held to the same bar.
  return buildBackupSnapshot({
    capturedAt: String(value.capturedAt ?? ''),
    releaseSha: String(value.releaseSha ?? ''),
    digestRole: String(value.digestRole ?? ''),
    perStore,
  });
}

/**
 * Compare a restored database's per-store digest map against a reference snapshot.
 * `verified` is true ONLY when EVERY store in the reference is present in the restore
 * with an IDENTICAL count and rollup, and the restore carries no extra store. Any
 * divergence is recorded (bounded), never swallowed. The comparison is symmetric:
 * a store present in only one side is a divergence.
 */
export function compareRestoreAgainstSnapshot(
  reference: BackupSnapshot,
  restored: CutoverDigestMap,
): BackupRestoreComparison {
  const divergences: BackupStoreDivergence[] = [];
  let truncated = false;
  let identicalStores = 0;

  const push = (divergence: BackupStoreDivergence): void => {
    if (divergences.length < BACKUP_MAX_DIVERGENCES) divergences.push(divergence);
    else truncated = true;
  };

  const referenceIds = Object.keys(reference.perStore);
  const restoredIds = new Set(Object.keys(restored));

  for (const storeId of referenceIds) {
    const ref = reference.perStore[storeId]!;
    const got = restored[storeId];
    if (!got) {
      push({
        storeId,
        reason: 'missing_in_restore',
        referenceCount: ref.count,
        restoredCount: null,
        referenceRollupHex: ref.rollupHex,
        restoredRollupHex: null,
      });
      continue;
    }
    if (got.count !== ref.count) {
      push({
        storeId,
        reason: 'count_mismatch',
        referenceCount: ref.count,
        restoredCount: got.count,
        referenceRollupHex: ref.rollupHex,
        restoredRollupHex: got.rollupHex,
      });
      continue;
    }
    if (got.rollupHex !== ref.rollupHex) {
      push({
        storeId,
        reason: 'rollup_mismatch',
        referenceCount: ref.count,
        restoredCount: got.count,
        referenceRollupHex: ref.rollupHex,
        restoredRollupHex: got.rollupHex,
      });
      continue;
    }
    identicalStores += 1;
  }

  for (const storeId of restoredIds) {
    if (!(storeId in reference.perStore)) {
      const got = restored[storeId]!;
      push({
        storeId,
        reason: 'extra_in_restore',
        referenceCount: null,
        restoredCount: got.count,
        referenceRollupHex: null,
        restoredRollupHex: got.rollupHex,
      });
    }
  }

  return {
    verified: divergences.length === 0 && identicalStores === referenceIds.length,
    storeCount: referenceIds.length,
    identicalStores,
    divergences,
    truncated,
  };
}

/**
 * The `semantic_digests` jsonb body recorded into a `backup_restore_proofs` row. On a
 * verified restore it is the exact per-store digest map that matched (the durable
 * evidence of WHAT restored). On a divergence it additionally carries the bounded
 * mismatch detail, so a failed proof records precisely why it failed and is never a
 * bare `verified:false`. The comparison is RECOMPUTED here from the reference and the
 * restored digests, never trusted from the caller, so the recorded evidence can never
 * be inconsistent with the digest maps it embeds. The recorded `rtoMeasures` field
 * states exactly what the rto covers (the digest verification, the only part this
 * tooling can measure), so the number is never mistaken for provider restore time.
 */
export function buildProofDigests(
  reference: BackupSnapshot,
  restored: CutoverDigestMap,
): { digests: Record<string, unknown>; comparison: BackupRestoreComparison } {
  const comparison = compareRestoreAgainstSnapshot(reference, restored);
  return {
    comparison,
    digests: {
      referenceCapturedAt: reference.capturedAt,
      referenceReleaseSha: reference.releaseSha,
      storeCount: comparison.storeCount,
      identicalStores: comparison.identicalStores,
      rtoMeasures: 'digest_verification_only',
      perStore: reference.perStore,
      restored,
      ...(comparison.verified
        ? {}
        : { divergences: comparison.divergences, divergencesTruncated: comparison.truncated }),
    },
  };
}

/**
 * Recovery point objective in whole seconds: the window of data at risk between the
 * backup instant and the reference capture instant. A reference captured AFTER the
 * backup means writes in that window are not in the backup; the RPO is that gap. A
 * backup taken at or after the reference yields 0 (no data is newer than the backup).
 */
export function computeRpoSeconds(referenceCapturedAt: string, backupTimestamp: string): number {
  const reference = new Date(assertIso('referenceCapturedAt', referenceCapturedAt)).getTime();
  const backup = new Date(assertIso('backupTimestamp', backupTimestamp)).getTime();
  const seconds = Math.round((reference - backup) / 1000);
  return seconds > 0 ? seconds : 0;
}

/** Recovery time objective in whole seconds from a measured elapsed millisecond duration. */
export function computeRtoSeconds(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('elapsedMs must be a non-negative number');
  return Math.max(0, Math.round(elapsedMs / 1000));
}

// ---------------------------------------------------------------------------
// Object-store backup inventory rollup.
// ---------------------------------------------------------------------------

/** One inventory entry as the object store yields it (only what the rollup needs). */
export interface InventoryEntryForRollup {
  key: string;
  checksumSha256: string;
  sizeBytes: number;
  versionId: string;
  state: string;
}

/** A per-prefix inventory rollup: a count, a total byte size, and a digest over the entries. */
export interface InventoryPrefixRollup {
  prefix: string;
  count: number;
  totalBytes: number;
  /** A deterministic rollup over the entries (sorted by key), independent of paging order. */
  rollupHex: string;
}

/**
 * Fold one paged batch of inventory entries into a running rollup accumulator. The
 * digest chains per-entry hashes sorted by key, so the rollup is independent of the
 * order pages arrive in. Bounded paging (the caller stops at the object store's page
 * limit and resumes by cursor) keeps this from ever holding an unbounded set: only
 * the per-entry hash and a running total are retained, not the entries themselves.
 */
export function foldInventoryBatch(
  accumulator: { count: number; totalBytes: number; entryHashes: string[] },
  entries: readonly InventoryEntryForRollup[],
): void {
  for (const entry of entries) {
    if (!/^[a-f0-9]{64}$/.test(entry.checksumSha256)) {
      throw new Error(`Inventory entry ${entry.key} has an invalid checksum`);
    }
    if (!Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0) {
      throw new Error(`Inventory entry ${entry.key} has an invalid size`);
    }
    const hash = createHash('sha256');
    hash.update(entry.key, 'utf8');
    hash.update('\0', 'utf8');
    hash.update(entry.checksumSha256, 'utf8');
    hash.update('\0', 'utf8');
    hash.update(String(entry.sizeBytes), 'utf8');
    hash.update('\0', 'utf8');
    hash.update(entry.versionId, 'utf8');
    hash.update('\0', 'utf8');
    hash.update(entry.state, 'utf8');
    accumulator.count += 1;
    accumulator.totalBytes += entry.sizeBytes;
    accumulator.entryHashes.push(hash.digest('hex'));
  }
}

/** Finalize a prefix accumulator into an order-independent rollup. */
export function finalizeInventoryRollup(
  prefix: string,
  accumulator: { count: number; totalBytes: number; entryHashes: string[] },
): InventoryPrefixRollup {
  const rollup = createHash('sha256');
  for (const hex of [...accumulator.entryHashes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    rollup.update(hex, 'utf8');
  }
  return {
    prefix,
    count: accumulator.count,
    totalBytes: accumulator.totalBytes,
    rollupHex: rollup.digest('hex'),
  };
}

// ---------------------------------------------------------------------------
// Backup freshness verdict (read by the synthetic).
// ---------------------------------------------------------------------------

/** The minimal proof shape the freshness verdict needs from the latest verified proof row. */
export interface LatestProofForFreshness {
  proofId: string;
  restoredAt: string;
  verified: boolean;
  rpoSeconds: number;
  rtoSeconds: number;
}

export interface BackupFreshnessThresholds {
  /** Max age (seconds) of the newest VERIFIED restore proof before the backup is stale. */
  maxProofAgeSeconds: number;
  /** Max acceptable recorded RPO (seconds); a verified proof whose RPO exceeds this is degraded. */
  maxRpoSeconds: number;
}

export type BackupFreshnessVerdict = 'ok' | 'degraded' | 'fail';

export interface BackupFreshnessResult {
  verdict: BackupFreshnessVerdict;
  reason:
    | 'fresh'
    | 'no_verified_proof'
    | 'proof_stale'
    | 'proof_in_future'
    | 'rpo_exceeded';
  ageSeconds: number | null;
  proofId: string | null;
}

/** Clock-skew allowance before a future-dated proof is rejected outright. */
export const BACKUP_FUTURE_SKEW_SECONDS = 300;

/**
 * Evaluate backup freshness from the latest VERIFIED restore proof (or its absence)
 * against the SLO thresholds. NC-44.3: a backup is not healthy without a recent
 * restore proof, so a missing verified proof is a hard FAIL, never a pass. A proof
 * older than the window is stale (fail). A fresh proof whose recorded RPO exceeds the
 * budget is degraded (the backup restores, but the data-loss window is too wide).
 * Pure: the caller supplies `now` (its own clock) and the fetched proof. A proof
 * dated in the FUTURE beyond clock-skew allowance is a hard fail, never clamped to
 * age zero: a mis-dated (or fabricated-date) row must not stay "fresh" until wall
 * time catches up with it.
 */
export function evaluateBackupFreshness(input: {
  latest: LatestProofForFreshness | null;
  now: string;
  thresholds: BackupFreshnessThresholds;
}): BackupFreshnessResult {
  const { latest, thresholds } = input;
  if (!latest || !latest.verified) {
    return { verdict: 'fail', reason: 'no_verified_proof', ageSeconds: null, proofId: null };
  }
  const nowMs = new Date(assertIso('now', input.now)).getTime();
  const restoredMs = new Date(assertIso('restoredAt', latest.restoredAt)).getTime();
  if (restoredMs - nowMs > BACKUP_FUTURE_SKEW_SECONDS * 1000) {
    return { verdict: 'fail', reason: 'proof_in_future', ageSeconds: null, proofId: latest.proofId };
  }
  const ageSeconds = Math.max(0, Math.round((nowMs - restoredMs) / 1000));
  if (ageSeconds > thresholds.maxProofAgeSeconds) {
    return { verdict: 'fail', reason: 'proof_stale', ageSeconds, proofId: latest.proofId };
  }
  if (latest.rpoSeconds > thresholds.maxRpoSeconds) {
    return { verdict: 'degraded', reason: 'rpo_exceeded', ageSeconds, proofId: latest.proofId };
  }
  return { verdict: 'ok', reason: 'fresh', ageSeconds, proofId: latest.proofId };
}
