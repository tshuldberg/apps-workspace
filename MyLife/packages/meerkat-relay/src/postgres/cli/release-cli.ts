import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { createMeerkatPostgresPool } from '../pool';
import { PostgresStoreContext } from '../store-context';
import { PostgresOperationsStore } from '../stores/operations-store';
import type { ReleaseManifestRecord } from '../stores/operations-store';
import {
  parseReleaseManifest,
  canonicalizeManifest,
  verifyDeployAgainstManifest,
  type ReleaseManifest,
} from '../../release/release-manifest';
import { redactErrorDetail } from '../../log-redaction';

/**
 * Release manifest CLI (Plan 44 WP-6B), migrate-cli NDJSON idiom.
 *
 * Recording, approving, and verifying a signed release against the durable
 * `ops.release_manifests` store. The CLI never builds, pushes, signs, or deploys
 * anything: WP-6A's CI pipeline builds + signs the images and emits a draft
 * manifest artifact; a founder-operator records that artifact here, approves it
 * after review, and gates a deploy through --verify. Every durable-row semantic
 * (immutable insert, CAS approval, approval-gated verification) is surfaced
 * honestly, never re-labeled.
 *
 * Subcommands (exactly one):
 *   --record   Read --manifest <file>, zod-validate it (NC-44.4: tag-only image
 *              refs rejected), canonicalize to stable-key-order JSON, compute
 *              manifestDigestHex = sha256(canonical JSON), and INSERT immutably via
 *              recordReleaseManifest keyed by --release-id. The durable row is
 *              NEVER re-recorded: an identical replay reports
 *              release_manifest_duplicate_idempotent (exit 0); a DIFFERENT manifest
 *              under an existing release id reports
 *              release_manifest_duplicate_conflict with BOTH digests and exits 1.
 *   --approve  CAS-approve --release-id at --expected-version via
 *              approveReleaseManifest. A version mismatch or an already-approved
 *              manifest refuses the CAS and exits 1 (approval is one-shot).
 *   --verify   The NC-44.4 deploy gate. Load --release-id's manifest row; an
 *              UNAPPROVED manifest FAILS (manifest_not_approved), and a stored
 *              manifest whose recomputed canonical digest no longer equals the
 *              recorded manifestDigestHex FAILS (manifest_digest_mismatch: a
 *              privileged edit after recording is tampering, never trusted). Run
 *              verifyDeployAgainstManifest over every --image <ref>. Exit 0 only
 *              when the manifest is approved, digest-intact, and every ref is
 *              digest-pinned and present; exit 2 on any divergence, each emitted as
 *              its own event. STATED BOUNDARY: the gate proves membership and
 *              digest-pinning; cryptographic signature/attestation verification
 *              runs at deploy time via cosign verify (founder-ops), and the
 *              completeness of the --image list is the operator's attestation.
 *   --status   Print the latest recorded manifests via listReleaseManifests.
 *
 * Exit codes: 0 success, 1 a fatal/operational error (missing config, validation
 * failure, CAS refusal, an unapproved manifest at verify), 2 a --verify that ran
 * against an approved manifest but found deploy divergences (the divergence IS the
 * finding). Connection via MEERKAT_POSTGRES_URL (the meerkat_ops role records +
 * approves; --verify only reads).
 */

const output = (value: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

type Mode = 'record' | 'approve' | 'verify' | 'status';

interface ParsedArgs {
  mode: Mode;
  releaseId: string;
  manifestFile: string;
  supersedesReleaseId: string;
  expectedVersion: number | null;
  images: string[];
  applicationName: string;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const flags = new Map<string, string[]>();
  const bare = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(name, [...(flags.get(name) ?? []), next]);
      i += 1;
    } else {
      bare.add(name);
    }
  }

  const modes: Mode[] = [];
  for (const mode of ['record', 'approve', 'verify', 'status'] as const) {
    if (bare.has(mode)) modes.push(mode);
  }
  if (modes.length !== 1) {
    throw new Error('Exactly one of --record, --approve, --verify, --status is required');
  }

  const expectedVersionRaw = flags.get('expected-version')?.[0];
  const expectedVersion = expectedVersionRaw === undefined ? null : Number(expectedVersionRaw);
  if (expectedVersion !== null && !Number.isSafeInteger(expectedVersion)) {
    throw new Error('--expected-version must be an integer');
  }

  return {
    mode: modes[0]!,
    releaseId: flags.get('release-id')?.[0]?.trim() ?? '',
    manifestFile: flags.get('manifest')?.[0]?.trim() ?? '',
    supersedesReleaseId: flags.get('supersedes-release-id')?.[0]?.trim() ?? '',
    expectedVersion,
    images: (flags.get('image') ?? []).map((ref) => ref.trim()).filter(Boolean),
    applicationName: 'meerkat-release:meerkat_ops',
  };
}

async function readSsl(): Promise<{ sslMode: 'disable' | 'require' | 'verify-full'; sslCa?: string }> {
  const sslMode = ((process.env.MEERKAT_POSTGRES_SSL_MODE ?? '').trim() || 'verify-full') as
    | 'disable'
    | 'require'
    | 'verify-full';
  const sslCaPath = (process.env.MEERKAT_POSTGRES_SSL_CA_FILE ?? '').trim();
  const sslCa = sslCaPath ? await fs.readFile(sslCaPath, 'utf8') : undefined;
  return sslCa ? { sslMode, sslCa } : { sslMode };
}

async function openPool(applicationName: string): Promise<Pool> {
  const connectionString = (process.env.MEERKAT_POSTGRES_URL ?? '').trim();
  if (!connectionString) throw new Error('MEERKAT_POSTGRES_URL is required');
  const ssl = await readSsl();
  return createMeerkatPostgresPool({
    connectionString,
    applicationName,
    productionMode: process.env.NODE_ENV === 'production',
    maxConnections: 4,
    statementTimeoutMs: 300_000,
    queryTimeoutMs: 301_000,
    ...ssl,
  });
}

/** Load + validate the on-disk manifest, returning the parsed value and its canonical digest. */
async function loadManifestFile(path: string): Promise<{ manifest: ReleaseManifest; manifestDigestHex: string }> {
  if (!path) throw new Error('--manifest <file> is required for --record');
  const raw = await fs.readFile(path, 'utf8');
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new Error(`--manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const manifest = parseReleaseManifest(parsedJson);
  const canonical = canonicalizeManifest(manifest);
  const manifestDigestHex = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return { manifest, manifestDigestHex };
}

async function runRecord(args: ParsedArgs): Promise<void> {
  if (!args.releaseId) throw new Error('--release-id is required for --record');
  const { manifest, manifestDigestHex } = await loadManifestFile(args.manifestFile);
  const pool = await openPool(args.applicationName);
  try {
    const store = new PostgresOperationsStore(new PostgresStoreContext(pool));
    const record: ReleaseManifestRecord = {
      releaseId: args.releaseId,
      gitSha: manifest.gitSha,
      manifest: manifest as unknown as Record<string, unknown>,
      manifestDigestHex,
      supersedesReleaseId: args.supersedesReleaseId || null,
    };
    const inserted = await store.recordReleaseManifest(record);
    if (inserted) {
      output({
        event: 'release_manifest_recorded',
        releaseId: args.releaseId,
        gitSha: manifest.gitSha,
        manifestDigestHex,
        images: manifest.images.length,
        migrationRange: manifest.migrationRange,
        durable: 'immutable_row',
      });
    } else {
      // The row already exists (ON CONFLICT DO NOTHING never rewrites it). The event
      // reports the DURABLE digest, and the exit code follows whether this attempt
      // matches it: an identical replay is an idempotent success; a DIFFERENT
      // manifest under the same release id is a conflict that must not exit 0, or
      // automation would proceed believing ITS manifest is the recorded one.
      const durable = await store.getReleaseManifest(args.releaseId);
      if (!durable) throw new Error(`Release ${args.releaseId} vanished between insert and read`);
      const identical = durable.manifestDigestHex === manifestDigestHex;
      output({
        event: identical ? 'release_manifest_duplicate_idempotent' : 'release_manifest_duplicate_conflict',
        releaseId: args.releaseId,
        durableManifestDigestHex: durable.manifestDigestHex,
        attemptedManifestDigestHex: manifestDigestHex,
        detail: identical
          ? 'release id already recorded with this exact manifest; the durable row stands'
          : 'release id already recorded with a DIFFERENT manifest; the durable row stands unmodified',
      });
      if (!identical) process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

async function runApprove(args: ParsedArgs): Promise<void> {
  if (!args.releaseId) throw new Error('--release-id is required for --approve');
  if (args.expectedVersion === null) throw new Error('--expected-version is required for --approve');
  const pool = await openPool(args.applicationName);
  try {
    const store = new PostgresOperationsStore(new PostgresStoreContext(pool));
    const version = await store.approveReleaseManifest(args.releaseId, args.expectedVersion);
    if (version === null) {
      // The CAS refused: wrong expected version, already approved, or unknown release id.
      // Approval is one-shot; a refusal is an operational failure, not a divergence.
      output({
        event: 'release_manifest_approval_refused',
        releaseId: args.releaseId,
        expectedVersion: args.expectedVersion,
        detail: 'CAS refused: version mismatch, already approved, or unknown release id',
      });
      process.exitCode = 1;
      return;
    }
    output({
      event: 'release_manifest_approved',
      releaseId: args.releaseId,
      lifecycleVersion: version,
    });
  } finally {
    await pool.end();
  }
}

async function runVerify(args: ParsedArgs): Promise<void> {
  if (!args.releaseId) throw new Error('--release-id is required for --verify');
  if (args.images.length === 0) throw new Error('at least one --image <ref> is required for --verify');
  const pool = await openPool('meerkat-release-verify:meerkat_observer');
  try {
    const store = new PostgresOperationsStore(new PostgresStoreContext(pool));
    const row = await store.getReleaseManifest(args.releaseId);
    if (!row) {
      output({ event: 'verify_manifest_not_found', releaseId: args.releaseId });
      process.exitCode = 1;
      return;
    }
    if (!row.approvedAt) {
      // NC-44.4: only an APPROVED manifest may gate a deploy. An unapproved row fails
      // verification hard, not as a per-image divergence.
      output({
        event: 'verify_failed',
        releaseId: args.releaseId,
        reason: 'manifest_not_approved',
        detail: 'a deploy may only be verified against an approved manifest',
      });
      process.exitCode = 1;
      return;
    }
    // Tamper check: the stored manifest is re-validated against the schema AND its
    // recomputed canonical digest must equal the digest recorded at --record time. A
    // privileged SQL edit of the jsonb after recording is caught here, not trusted.
    const manifest = parseReleaseManifest(row.manifest);
    const recomputedDigestHex = createHash('sha256')
      .update(canonicalizeManifest(manifest), 'utf8')
      .digest('hex');
    if (recomputedDigestHex !== row.manifestDigestHex) {
      output({
        event: 'verify_failed',
        releaseId: args.releaseId,
        reason: 'manifest_digest_mismatch',
        durableManifestDigestHex: row.manifestDigestHex,
        recomputedManifestDigestHex: recomputedDigestHex,
        detail: 'the stored manifest does not match the digest recorded at --record time; treat as tampering',
      });
      process.exitCode = 1;
      return;
    }
    const result = verifyDeployAgainstManifest(manifest, args.images);
    for (const divergence of result.divergences) {
      output({ event: 'deploy_divergence', ref: divergence.ref, reason: divergence.reason });
    }
    if (!result.ok) {
      output({
        event: 'verify_failed',
        releaseId: args.releaseId,
        reason: 'deploy_diverges_from_manifest',
        divergences: result.divergences.length,
        imagesChecked: args.images.length,
      });
      process.exitCode = 2;
      return;
    }
    output({
      event: 'verify_passed',
      releaseId: args.releaseId,
      imagesChecked: args.images.length,
      approvedAt: row.approvedAt,
    });
  } finally {
    await pool.end();
  }
}

async function runStatus(): Promise<void> {
  const pool = await openPool('meerkat-release-status:meerkat_observer');
  try {
    const store = new PostgresOperationsStore(new PostgresStoreContext(pool));
    const manifests = await store.listReleaseManifests({ limit: 20 });
    output({
      event: 'status',
      count: manifests.length,
      latest: manifests[0]
        ? {
            releaseId: manifests[0].releaseId,
            gitSha: manifests[0].gitSha,
            manifestDigestHex: manifests[0].manifestDigestHex,
            approvedAt: manifests[0].approvedAt ?? null,
            lifecycleVersion: manifests[0].lifecycleVersion ?? null,
          }
        : null,
    });
  } finally {
    await pool.end();
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  output({ event: 'start', mode: args.mode });
  if (args.mode === 'record') await runRecord(args);
  else if (args.mode === 'approve') await runApprove(args);
  else if (args.mode === 'verify') await runVerify(args);
  else await runStatus();
} catch (error) {
  output({
    event: 'fatal',
    reason: 'release_cli_failed',
    detail: redactErrorDetail(error instanceof Error ? error.message : String(error)),
  });
  process.exitCode = 1;
}
