import { hostname } from 'node:os';
import { promises as fs } from 'node:fs';
import type { Pool } from 'pg';
import { createMeerkatPostgresPool } from '../pool';
import { PostgresStoreContext } from '../store-context';
import {
  STATE_STORE_IDS,
  isStateStoreId,
  dryRun,
  importAll,
  digestCompare,
  type StateStoreId,
  type StateServiceRoot,
  type StateServiceRoots,
} from '../../state-import';

/**
 * State import CLI (Plan 44 Phase 3 WP-3A), in the migrate-cli NDJSON idiom.
 *
 * Modes (exactly one):
 *   --dry-run          Enumerate + validate + digest the SOURCE file state. ZERO writes.
 *   --import           Import file state into PostgreSQL (idempotent, resumable).
 *   --digest-compare   Digest both backends through one interface, print a verdict,
 *                      exit nonzero on any divergence.
 *
 * Store selection: --store <id> (repeatable) or --all (default).
 *
 * Env / flags:
 *   MEERKAT_POSTGRES_URL / MEERKAT_POSTGRES_SSL_MODE / MEERKAT_POSTGRES_SSL_CA_FILE  target.
 *   Per-service SOURCE data-dir roots (the bins use DIFFERENT defaults, so each is explicit):
 *     --community-dir / MEERKAT_COMMUNITY_DATA_DIR   community-node DATA_DIR root
 *     --persona-dir   / MEERKAT_PERSONA_DATA_DIR     persona-service DATA_DIR root
 *     --directory-dir / MEERKAT_DIRECTORY_DATA_DIR   directory-node DATA_DIR root
 *     --hosted-dir    / MEERKAT_HOSTED_DATA_DIR      hosted-service DATA_DIR root
 *     --humanity-dir  / MEERKAT_HUMANITY_DATA_DIR    verification-service DATA_DIR root
 *   Only the roots needed by the selected stores are required; a missing root errors
 *   naming the flag and the store that needs it.
 */

const output = (value: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

interface ParsedArgs {
  mode: 'dry-run' | 'import' | 'digest-compare';
  stores: StateStoreId[];
  roots: StateServiceRoots;
  owner: string;
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
      const list = flags.get(name) ?? [];
      list.push(next);
      flags.set(name, list);
      i += 1;
    } else {
      bare.add(name);
    }
  }

  const modes: ParsedArgs['mode'][] = [];
  if (bare.has('dry-run')) modes.push('dry-run');
  if (bare.has('import')) modes.push('import');
  if (bare.has('digest-compare')) modes.push('digest-compare');
  if (modes.length !== 1) {
    throw new Error('Exactly one of --dry-run, --import, --digest-compare is required');
  }

  const requestedStores = flags.get('store') ?? [];
  const stores: StateStoreId[] = [];
  if (bare.has('all') || requestedStores.length === 0) {
    stores.push(...STATE_STORE_IDS);
  } else {
    for (const id of requestedStores) {
      if (!isStateStoreId(id)) throw new Error(`Unknown store id: ${id}`);
      stores.push(id);
    }
  }

  const rootFor = (flag: string, env: string): string | undefined =>
    flags.get(flag)?.[0] ?? (process.env[env]?.trim() || undefined);
  const roots: StateServiceRoots = {};
  const assign = (key: StateServiceRoot, flag: string, env: string): void => {
    const value = rootFor(flag, env);
    if (value) roots[key] = value;
  };
  assign('community', 'community-dir', 'MEERKAT_COMMUNITY_DATA_DIR');
  assign('persona', 'persona-dir', 'MEERKAT_PERSONA_DATA_DIR');
  assign('directory', 'directory-dir', 'MEERKAT_DIRECTORY_DATA_DIR');
  assign('hosted', 'hosted-dir', 'MEERKAT_HOSTED_DATA_DIR');
  assign('humanity', 'humanity-dir', 'MEERKAT_HUMANITY_DATA_DIR');

  const owner = flags.get('owner')?.[0]?.trim()
    || `state-import@${hostname()}:${process.pid}`;

  return { mode: modes[0]!, stores, roots, owner };
}

async function openPool(): Promise<Pool> {
  const connectionString = (process.env.MEERKAT_POSTGRES_URL ?? '').trim();
  if (!connectionString) throw new Error('MEERKAT_POSTGRES_URL is required');
  const sslMode = (process.env.MEERKAT_POSTGRES_SSL_MODE ?? '').trim() || 'verify-full';
  const sslCaPath = (process.env.MEERKAT_POSTGRES_SSL_CA_FILE ?? '').trim();
  const sslCa = sslCaPath ? await fs.readFile(sslCaPath, 'utf8') : undefined;
  return createMeerkatPostgresPool({
    connectionString,
    applicationName: 'meerkat-state-import',
    productionMode: process.env.NODE_ENV === 'production',
    sslMode: sslMode as 'disable' | 'require' | 'verify-full',
    ...(sslCa ? { sslCa } : {}),
    maxConnections: 4,
    statementTimeoutMs: 300_000,
    queryTimeoutMs: 301_000,
  });
}

let pool: Pool | undefined;

try {
  const args = parseArgs(process.argv.slice(2));
  output({ event: 'start', mode: args.mode, stores: args.stores.length });

  if (args.mode === 'dry-run') {
    // A dry run reads file state only; it never opens the PostgreSQL pool.
    const reports = await dryRun(args.roots, args.stores);
    for (const report of reports) {
      output({
        event: 'dry_run_store',
        store: report.storeId,
        count: report.count,
        rollup: report.rollupHex,
        highestRevision: report.highestRevision,
        distinctPrimaryParts: report.distinctPrimaryParts,
        nonImportable: report.nonImportable,
        guarantee: report.guarantee,
      });
    }
    output({
      event: 'dry_run_complete',
      stores: reports.length,
      totalRecords: reports.reduce((sum, r) => sum + r.count, 0),
    });
  } else if (args.mode === 'import') {
    pool = await openPool();
    const database = new PostgresStoreContext(pool);
    const results = await importAll({ database }, args.roots, args.owner, args.stores);
    for (const result of results) {
      output({
        event: 'import_store',
        store: result.storeId,
        imported: result.imported,
        skipped: result.skipped,
        batches: result.batches,
        resumedBatches: result.resumedBatches,
        nonImportable: result.nonImportable,
      });
    }
    output({
      event: 'import_complete',
      stores: results.length,
      imported: results.reduce((sum, r) => sum + r.imported, 0),
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
    });
  } else {
    pool = await openPool();
    const database = new PostgresStoreContext(pool);
    const results = await digestCompare({ database }, args.roots, args.stores);
    let diverged = 0;
    for (const result of results) {
      if (result.status !== 'identical') diverged += 1;
      output({
        event: 'digest_compare_store',
        store: result.storeId,
        status: result.status,
        sourceCount: result.sourceCount,
        targetCount: result.targetCount,
        missingInTarget: result.missingInTarget,
        extraInTarget: result.extraInTarget,
        mismatched: result.mismatched,
        truncated: result.truncated,
      });
    }
    output({ event: 'digest_compare_complete', stores: results.length, diverged });
    if (diverged > 0) process.exitCode = 2;
  }
} catch (error) {
  output({
    event: 'fatal',
    reason: 'state_import_failed',
    detail: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
} finally {
  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      output({
        event: 'fatal',
        reason: 'pool_shutdown_failed',
        detail: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    }
  }
}
