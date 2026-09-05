import { hostname } from 'node:os';
import { promises as fs } from 'node:fs';
import type { Pool } from 'pg';
import { createMeerkatPostgresPool } from '../pool';
import { PostgresStoreContext } from '../store-context';
import { PostgresBackupStore } from '../backup-store';
import {
  buildBackupSnapshot,
  resolveDigestRole,
  serializeSnapshot,
  parseSnapshot,
  buildProofDigests,
  computeRpoSeconds,
  computeRtoSeconds,
  foldInventoryBatch,
  finalizeInventoryRollup,
  type InventoryPrefixRollup,
} from '../backup-evidence';
import { S3ObjectStore } from '../../object-store-s3';
import { FileObjectStore } from '../../object-store-file';
import type { MeerkatObjectStore, ObjectInventoryCursor } from '../../object-store';
import { digestAllStores, STATE_STORE_IDS } from '../../state-import';
import { redactErrorDetail } from '../../log-redaction';
import { digestPostgresBackupProofStores } from '../backup-proof-inventory';

/**
 * Backup evidence CLI (Plan 44 WP-5A), migrate-cli NDJSON idiom.
 *
 * PostgreSQL is an external managed database, so WAL archiving, base backups, and
 * PITR are founder-ops provider configuration (see the disaster-recovery-drill
 * runbook). This CLI runs the verifiable, provable steps: a per-store reference
 * digest snapshot, the restore smoke that compares a restored database against it
 * and records a proof, and the object-store inventory rollup. It never configures a
 * provider backup and never fabricates a drill that was not run.
 *
 * Subcommands (exactly one):
 *   --digest-snapshot   Digest every portable store and PostgreSQL-only durable
 *                       proof table, then write a dated reference snapshot
 *                       (JSON: {capturedAt from database time, releaseSha, perStore
 *                       digests}) to --out. The recorded digestRole is the connection's
 *                       ACTUAL `current_user`, never an unverified claim; passing
 *                       --digest-role asserts the expected role and fails fast on a
 *                       mismatch. The snapshot is an artifact-on-disk, NOT a proof row
 *                       (nothing was restored to make it; recording it as a proof
 *                       would misrepresent it).
 *   --restore-smoke     Point --restored-url at a scratch RESTORED database, load the
 *                       --reference snapshot, re-digest every store on the restored DB,
 *                       compare, measure restore-verification time, compute RPO from the
 *                       reference capture vs --backup-timestamp, and record a proof on
 *                       the PRIMARY --ops-url with verified=true ONLY on all-identical
 *                       digests. Fenced per proof id so two smokes cannot interleave.
 *   --object-inventory  Page listInventory per prefix (tenants/, --archive-prefix, total)
 *                       into per-prefix counts + digest rollups, written to --out.
 *   --status            Print the latest recorded restore proofs.
 *
 * Exit codes: 0 success (a restore smoke with verified=true, or a clean snapshot /
 * inventory / status), 1 a fatal/operational error, 2 a restore smoke that recorded a
 * proof with verified=false (the divergence IS the finding, recorded honestly).
 */

const output = (value: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

type Mode = 'digest-snapshot' | 'restore-smoke' | 'object-inventory' | 'status';

interface ParsedArgs {
  mode: Mode;
  digestRole: string;
  releaseSha: string;
  operator: string;
  out: string;
  reference: string;
  restoredUrl: string;
  opsUrl: string;
  sourceBackupId: string;
  backupTimestamp: string;
  proofId: string;
  archivePrefix: string;
  tenantsPrefix: string;
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
  for (const mode of ['digest-snapshot', 'restore-smoke', 'object-inventory', 'status'] as const) {
    if (bare.has(mode)) modes.push(mode);
  }
  if (modes.length !== 1) {
    throw new Error(
      'Exactly one of --digest-snapshot, --restore-smoke, --object-inventory, --status is required',
    );
  }

  return {
    mode: modes[0]!,
    digestRole: flags.get('digest-role')?.[0]?.trim() ?? '',
    releaseSha: flags.get('release-sha')?.[0]?.trim() ?? (process.env.MEERKAT_RELEASE_SHA?.trim() ?? ''),
    operator: flags.get('operator')?.[0]?.trim() || `backup@${hostname()}:${process.pid}`,
    out: flags.get('out')?.[0]?.trim() ?? '',
    reference: flags.get('reference')?.[0]?.trim() ?? '',
    restoredUrl: flags.get('restored-url')?.[0]?.trim() ?? '',
    opsUrl: flags.get('ops-url')?.[0]?.trim() ?? '',
    sourceBackupId: flags.get('source-backup-id')?.[0]?.trim() ?? '',
    backupTimestamp: flags.get('backup-timestamp')?.[0]?.trim() ?? '',
    proofId: flags.get('proof-id')?.[0]?.trim() ?? '',
    archivePrefix: flags.get('archive-prefix')?.[0]?.trim() ?? 'archive/',
    tenantsPrefix: flags.get('tenants-prefix')?.[0]?.trim() ?? 'tenants/',
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

async function openPool(connectionString: string, applicationName: string): Promise<Pool> {
  const trimmed = connectionString.trim();
  if (!trimmed) throw new Error(`${applicationName} connection string is required`);
  const ssl = await readSsl();
  return createMeerkatPostgresPool({
    connectionString: trimmed,
    applicationName,
    productionMode: process.env.NODE_ENV === 'production',
    maxConnections: 4,
    statementTimeoutMs: 300_000,
    queryTimeoutMs: 301_000,
    ...ssl,
  });
}

async function databaseNow(database: PostgresStoreContext): Promise<string> {
  const result = await database.query<{ now: Date | string }>('SELECT clock_timestamp() AS now');
  const value = result.rows[0]?.now;
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) throw new Error('Could not read database time');
  return parsed.toISOString();
}

/** The connection's actual role, so the snapshot audit trail is never a claim. */
async function currentRole(database: PostgresStoreContext): Promise<string> {
  const result = await database.query<{ role: string }>('SELECT current_user AS role');
  return String(result.rows[0]?.role ?? '');
}

/** host:port/db with NO credentials, for the same-target guard and the audit trail. */
function connectionTarget(connectionString: string): string {
  const url = new URL(connectionString);
  return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
}

/** Build the FIRST-PARTY object store from env (s3 or file), for the inventory job. */
async function openObjectStore(): Promise<MeerkatObjectStore> {
  const backend = (process.env.MEERKAT_OBJECT_STORE_BACKEND ?? '').trim() || 'file';
  if (backend === 'file') {
    const root = (process.env.MEERKAT_OBJECT_STORE_DIR ?? '').trim();
    if (!root) throw new Error('MEERKAT_OBJECT_STORE_DIR is required for the file object-store backend');
    return new FileObjectStore(root);
  }
  if (backend === 's3') {
    const readFile = async (label: string, envName: string): Promise<string> => {
      const path = (process.env[envName] ?? '').trim();
      if (!path) throw new Error(`${envName} is required for the s3 object-store backend`);
      const value = (await fs.readFile(path, 'utf8')).trim();
      if (!value) throw new Error(`${label} secret file is empty`);
      return value;
    };
    const endpoint = (process.env.MEERKAT_OBJECT_STORE_ENDPOINT ?? '').trim();
    const region = (process.env.MEERKAT_OBJECT_STORE_REGION ?? '').trim();
    const bucket = (process.env.MEERKAT_OBJECT_STORE_BUCKET ?? '').trim();
    if (!endpoint || !region || !bucket) {
      throw new Error('MEERKAT_OBJECT_STORE_ENDPOINT/REGION/BUCKET are required for the s3 backend');
    }
    return new S3ObjectStore({
      endpoint,
      region,
      bucket,
      accessKeyId: await readFile('object-store access key id', 'MEERKAT_OBJECT_STORE_ACCESS_KEY_FILE'),
      secretAccessKey: await readFile('object-store secret access key', 'MEERKAT_OBJECT_STORE_SECRET_KEY_FILE'),
      forcePathStyle: (process.env.MEERKAT_OBJECT_STORE_FORCE_PATH_STYLE ?? '').trim() === 'true',
      productionMode: process.env.NODE_ENV === 'production',
      allowInsecureHttp: (process.env.MEERKAT_OBJECT_STORE_ALLOW_INSECURE_HTTP ?? '').trim() === 'true',
    });
  }
  throw new Error(`Unknown object-store backend: ${backend}`);
}

const INVENTORY_PAGE = 500;

/** Page listInventory for one prefix into a bounded, order-independent rollup. */
async function rollupPrefix(store: MeerkatObjectStore, prefix: string): Promise<InventoryPrefixRollup> {
  const accumulator = { count: 0, totalBytes: 0, entryHashes: [] as string[] };
  let after: ObjectInventoryCursor | undefined;
  for (;;) {
    const page = await store.listInventory({ limit: INVENTORY_PAGE, ...(prefix ? { prefix } : {}), ...(after ? { after } : {}) });
    foldInventoryBatch(accumulator, page.entries);
    if (!page.nextCursor) break;
    after = page.nextCursor;
  }
  return finalizeInventoryRollup(prefix, accumulator);
}

async function writeArtifact(path: string, body: string): Promise<void> {
  if (!path) throw new Error('--out is required for this subcommand');
  await fs.writeFile(path, body, 'utf8');
}

async function digestBackupState(database: PostgresStoreContext) {
  const [portableStores, postgresOnlyStores] = await Promise.all([
    digestAllStores('postgres', {}, { database }, STATE_STORE_IDS),
    digestPostgresBackupProofStores(database),
  ]);
  return { ...portableStores, ...postgresOnlyStores };
}

async function runDigestSnapshot(args: ParsedArgs): Promise<void> {
  if (!args.releaseSha) throw new Error('--release-sha (or MEERKAT_RELEASE_SHA) is required for --digest-snapshot');
  const url = (process.env.MEERKAT_POSTGRES_URL ?? '').trim();
  const pool = await openPool(url, 'meerkat-backup-digest');
  try {
    const database = new PostgresStoreContext(pool);
    const digestRole = resolveDigestRole(args.digestRole, await currentRole(database));
    const capturedAt = await databaseNow(database);
    const perStore = await digestBackupState(database);
    const snapshot = buildBackupSnapshot({
      capturedAt,
      releaseSha: args.releaseSha,
      digestRole,
      perStore,
    });
    await writeArtifact(args.out, serializeSnapshot(snapshot));
    output({
      event: 'snapshot_written',
      out: args.out,
      capturedAt: snapshot.capturedAt,
      releaseSha: snapshot.releaseSha,
      digestRole: snapshot.digestRole,
      storeCount: snapshot.storeCount,
      durable: 'artifact_on_disk',
      note: 'a reference snapshot is not a restore proof; nothing was restored to produce it',
    });
  } finally {
    await pool.end();
  }
}

async function runRestoreSmoke(args: ParsedArgs): Promise<void> {
  if (!args.reference) throw new Error('--reference <snapshot file> is required for --restore-smoke');
  if (!args.restoredUrl) throw new Error('--restored-url is required for --restore-smoke');
  if (!args.opsUrl) throw new Error('--ops-url (the PRIMARY ops database) is required for --restore-smoke');
  if (!args.sourceBackupId) throw new Error('--source-backup-id is required for --restore-smoke');
  if (!args.releaseSha) throw new Error('--release-sha (or MEERKAT_RELEASE_SHA) is required for --restore-smoke');
  if (!args.backupTimestamp) throw new Error('--backup-timestamp (the backup instant, ISO) is required');

  // A restore smoke proves a RESTORED copy, never the live ops database itself. The
  // tooling cannot verify a scratch database came from a provider backup (that
  // provenance is founder-ops attested via --source-backup-id / --backup-timestamp),
  // but it refuses the one fabrication it CAN detect: digesting the ops database and
  // recording that as a restore.
  const restoredTarget = connectionTarget(args.restoredUrl);
  const opsTarget = connectionTarget(args.opsUrl);
  if (restoredTarget === opsTarget) {
    throw new Error(
      `--restored-url and --ops-url point at the same database (${restoredTarget}); a restore smoke must digest a scratch restore, not the ops database`,
    );
  }

  const reference = parseSnapshot(await fs.readFile(args.reference, 'utf8'));
  if (args.releaseSha !== reference.releaseSha) {
    throw new Error(
      `--release-sha ${args.releaseSha} does not match the reference snapshot's releaseSha ${reference.releaseSha}; a proof must attribute the release the reference was captured against`,
    );
  }
  const proofId = args.proofId || `restore-${reference.releaseSha}-${Date.now()}`;

  const restoredPool = await openPool(args.restoredUrl, 'meerkat-backup-digest');
  const opsPool = await openPool(args.opsUrl, 'meerkat-backup-proof:meerkat_ops');
  try {
    const opsDatabase = new PostgresStoreContext(opsPool);
    // The backup instant is operator-attested, but a FUTURE instant is detectably
    // false and would zero the RPO; reject it against the ops database clock.
    const opsNowMs = new Date(await databaseNow(opsDatabase)).getTime();
    const backupMs = new Date(args.backupTimestamp).getTime();
    if (!Number.isFinite(backupMs)) throw new Error('--backup-timestamp must be an ISO timestamp');
    if (backupMs - opsNowMs > 5 * 60 * 1000) {
      throw new Error('--backup-timestamp is in the future; a backup instant cannot postdate the ops database clock');
    }

    const restoredDatabase = new PostgresStoreContext(restoredPool);
    const startedAt = Date.now();
    const restoredDigests = await digestBackupState(restoredDatabase);
    const elapsedMs = Date.now() - startedAt;

    const { digests, comparison } = buildProofDigests(reference, restoredDigests);
    const restoredAt = await databaseNow(opsDatabase);
    const proof = {
      proofId,
      sourceBackupId: args.sourceBackupId,
      releaseSha: args.releaseSha,
      restoredAt,
      rpoSeconds: computeRpoSeconds(reference.capturedAt, args.backupTimestamp),
      rtoSeconds: computeRtoSeconds(elapsedMs),
      semanticDigests: { ...digests, restoredTarget },
      verified: comparison.verified,
    };

    const store = new PostgresBackupStore(opsDatabase);
    const result = await store.recordRestoreProof(proof, args.operator);

    for (const divergence of comparison.divergences) {
      output({ event: 'restore_divergence', store: divergence.storeId, reason: divergence.reason });
    }
    if (result.status === 'contended') {
      output({ event: 'restore_contended', proofId, detail: 'a concurrent smoke holds or reclaimed this proof id' });
      process.exitCode = 1;
      return;
    }
    if (result.status === 'duplicate') {
      // The durable row is the evidence; this attempt's comparison never re-labels it.
      output({
        event: 'restore_proof_duplicate',
        proofId,
        durableVerified: result.existing.verified,
        attemptVerified: comparison.verified,
        detail: 'proof id already recorded; the durable row stands unmodified',
      });
      if (!result.existing.verified) process.exitCode = 2;
      return;
    }
    output({
      event: 'restore_proof_recorded',
      proofId,
      verified: comparison.verified,
      storeCount: comparison.storeCount,
      identicalStores: comparison.identicalStores,
      divergences: comparison.divergences.length,
      truncated: comparison.truncated,
      rpoSeconds: proof.rpoSeconds,
      rtoSeconds: proof.rtoSeconds,
      rtoMeasures: 'digest_verification_only',
    });
    if (!comparison.verified) process.exitCode = 2;
  } finally {
    await restoredPool.end().catch(() => undefined);
    await opsPool.end().catch(() => undefined);
  }
}

async function runObjectInventory(args: ParsedArgs): Promise<void> {
  const store = await openObjectStore();
  const tenants = await rollupPrefix(store, args.tenantsPrefix);
  const archive = await rollupPrefix(store, args.archivePrefix);
  const total = await rollupPrefix(store, '');
  const artifact = {
    kind: 'meerkat-object-inventory',
    version: 1,
    capturedAt: new Date().toISOString(),
    releaseSha: args.releaseSha || null,
    prefixes: { tenants, archive, total },
  };
  await writeArtifact(args.out, `${JSON.stringify(artifact, null, 2)}\n`);
  output({
    event: 'inventory_written',
    out: args.out,
    tenants: { count: tenants.count, totalBytes: tenants.totalBytes, rollupHex: tenants.rollupHex },
    archive: { count: archive.count, totalBytes: archive.totalBytes, rollupHex: archive.rollupHex },
    total: { count: total.count, totalBytes: total.totalBytes, rollupHex: total.rollupHex },
  });
}

async function runStatus(args: ParsedArgs): Promise<void> {
  const url = (args.opsUrl || process.env.MEERKAT_POSTGRES_URL || '').trim();
  const pool = await openPool(url, 'meerkat-backup-status:meerkat_observer');
  try {
    const store = new PostgresBackupStore(new PostgresStoreContext(pool));
    const proofs = await store.listRecentProofs(20);
    output({
      event: 'status',
      count: proofs.length,
      latest: proofs[0]
        ? {
            proofId: proofs[0].proofId,
            restoredAt: proofs[0].restoredAt,
            verified: proofs[0].verified,
            rpoSeconds: proofs[0].rpoSeconds,
            rtoSeconds: proofs[0].rtoSeconds,
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
  if (args.mode === 'digest-snapshot') await runDigestSnapshot(args);
  else if (args.mode === 'restore-smoke') await runRestoreSmoke(args);
  else if (args.mode === 'object-inventory') await runObjectInventory(args);
  else await runStatus(args);
} catch (error) {
  output({
    event: 'fatal',
    reason: 'backup_cli_failed',
    detail: redactErrorDetail(error instanceof Error ? error.message : String(error)),
  });
  process.exitCode = 1;
}
