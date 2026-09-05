import { hostname } from 'node:os';
import { promises as fs } from 'node:fs';
import type { Pool } from 'pg';
import { createMeerkatPostgresPool } from '../pool';
import { PostgresStoreContext } from '../store-context';
import {
  preflightCutover,
  executeCutover,
  verifyCutover,
  rollbackCutover,
  getCutover,
  STATE_STORE_IDS,
  isStateStoreId,
  type StateStoreId,
  type StateServiceRoot,
  type StateServiceRoots,
  type CutoverTarget,
} from '../../state-import';

/**
 * Cutover and rollback CLI (Plan 44 WP-3C), migrate-cli NDJSON idiom.
 *
 * The env flip (per-service `MEERKAT_STORE_BACKEND`) + restart are OPERATOR
 * actions between phases (see docs/guides/meerkat-postgres-cutover-runbook.md).
 * This CLI runs the verifiable steps and records a durable, honest proof. It never
 * edits env or compose.
 *
 * Subcommands (exactly one):
 *   --preflight  Verify target schema is current, dry-run enumerate source roots,
 *                require --writers-frozen-by, and probe --probe URLs (a LIVE
 *                service FAILS preflight). Exits 2 on any failed check.
 *   --execute    Final delta import + digest GATE. Exits 2 if any store diverges;
 *                nothing is recorded complete.
 *   --verify     After the env flip: post-boot digest must match. Exits 2 on divergence.
 *   --rollback   Record the rollback window + honest LOSS statement.
 *   --status     Print the current proof.
 *
 * Required: --cutover-id. --release-sha + --writers-frozen-by on --preflight.
 * --expected-version <n> (fencing token printed by the prior phase) on the
 * transitions. Source roots + MEERKAT_POSTGRES_URL as in state-import.
 * A concurrent run of the same cutover id yields a `contended` transition (exit 2).
 */

const output = (value: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

type Mode = 'preflight' | 'execute' | 'verify' | 'rollback' | 'status';

interface ParsedArgs {
  mode: Mode;
  cutoverId: string;
  releaseSha: string;
  operator: string;
  writersFrozenBy: string;
  expectedVersion: number | null;
  reason: string;
  probeUrls: string[];
  roots: StateServiceRoots;
  stores: StateStoreId[];
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
  for (const mode of ['preflight', 'execute', 'verify', 'rollback', 'status'] as const) {
    if (bare.has(mode)) modes.push(mode);
  }
  if (modes.length !== 1) {
    throw new Error('Exactly one of --preflight, --execute, --verify, --rollback, --status is required');
  }

  const cutoverId = flags.get('cutover-id')?.[0]?.trim();
  if (!cutoverId) throw new Error('--cutover-id is required');

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

  const expectedVersionRaw = flags.get('expected-version')?.[0];
  const expectedVersion = expectedVersionRaw === undefined ? null : Number(expectedVersionRaw);
  if (expectedVersion !== null && !Number.isSafeInteger(expectedVersion)) {
    throw new Error('--expected-version must be an integer');
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

  return {
    mode: modes[0]!,
    cutoverId,
    releaseSha: flags.get('release-sha')?.[0]?.trim() ?? '',
    operator: flags.get('operator')?.[0]?.trim() || `cutover@${hostname()}:${process.pid}`,
    writersFrozenBy: flags.get('writers-frozen-by')?.[0]?.trim() ?? '',
    expectedVersion,
    reason: flags.get('reason')?.[0]?.trim() ?? 'operator-initiated',
    probeUrls: (flags.get('probe') ?? []).map((url) => url.trim()).filter(Boolean),
    roots,
    stores,
  };
}

async function openPool(): Promise<Pool> {
  const connectionString = (process.env.MEERKAT_POSTGRES_URL ?? '').trim();
  if (!connectionString) throw new Error('MEERKAT_POSTGRES_URL is required');
  const sslMode = (process.env.MEERKAT_POSTGRES_SSL_MODE ?? '').trim() || 'verify-full';
  const sslCaPath = (process.env.MEERKAT_POSTGRES_SSL_CA_FILE ?? '').trim();
  const sslCa = sslCaPath ? await fs.readFile(sslCaPath, 'utf8') : undefined;
  return createMeerkatPostgresPool({
    connectionString,
    applicationName: 'meerkat-cutover',
    productionMode: process.env.NODE_ENV === 'production',
    sslMode: sslMode as 'disable' | 'require' | 'verify-full',
    ...(sslCa ? { sslCa } : {}),
    maxConnections: 4,
    statementTimeoutMs: 300_000,
    queryTimeoutMs: 301_000,
  });
}

function requireVersion(value: number | null): number {
  if (value === null) throw new Error('--expected-version is required for this phase');
  return value;
}

/** Emit a transition result and set the exit code for anything but a clean advance. */
function reportTransition(
  event: string,
  cutoverId: string,
  transition: { status: string; proof?: { state: string; lifecycleVersion: number } } | undefined,
  extra: Record<string, unknown> = {},
): void {
  if (transition?.status === 'ok' && transition.proof) {
    output({
      event,
      cutoverId,
      state: transition.proof.state,
      lifecycleVersion: transition.proof.lifecycleVersion,
      ...extra,
    });
  } else {
    output({ event: 'transition_rejected', cutoverId, reason: transition?.status ?? 'unknown' });
    process.exitCode = 2;
  }
}

let pool: Pool | undefined;

try {
  const args = parseArgs(process.argv.slice(2));
  output({ event: 'start', mode: args.mode, cutoverId: args.cutoverId });
  pool = await openPool();
  const target: CutoverTarget = { database: new PostgresStoreContext(pool) };

  if (args.mode === 'preflight') {
    if (!args.releaseSha) throw new Error('--release-sha is required for --preflight');
    if (!args.writersFrozenBy) throw new Error('--writers-frozen-by is required for --preflight');
    const result = await preflightCutover(target, args.roots, {
      cutoverId: args.cutoverId,
      releaseSha: args.releaseSha,
      operator: args.operator,
      writersFrozenBy: args.writersFrozenBy,
      probeUrls: args.probeUrls,
    }, args.stores);
    output({
      event: 'preflight_report',
      cutoverId: args.cutoverId,
      schemaVersion: result.report.schemaVersion,
      expectedSchemaVersion: result.report.expectedSchemaVersion,
      dryRunTotal: Object.values(result.report.dryRun).reduce((s, n) => s + n, 0),
      probes: result.report.probes,
    });
    if (!result.ok) {
      output({ event: 'preflight_failed', cutoverId: args.cutoverId, reasons: result.reasons });
      process.exitCode = 2;
    } else {
      reportTransition('preflighted', args.cutoverId, result.transition, {
        writersFrozenBy: args.writersFrozenBy,
      });
    }
  } else if (args.mode === 'execute') {
    const result = await executeCutover(target, args.roots, {
      cutoverId: args.cutoverId,
      operator: args.operator,
      expectedVersion: requireVersion(args.expectedVersion),
    }, args.stores);
    for (const comparison of result.comparisons) {
      if (comparison.status !== 'identical') {
        output({
          event: 'gate_divergence',
          store: comparison.storeId,
          status: comparison.status,
          sourceCount: comparison.sourceCount,
          targetCount: comparison.targetCount,
          missingInTarget: comparison.missingInTarget,
          extraInTarget: comparison.extraInTarget,
          mismatched: comparison.mismatched,
        });
      }
    }
    if (!result.gatePassed) {
      output({ event: 'gate_failed', cutoverId: args.cutoverId, detail: 'digests diverge; DO NOT flip env' });
      process.exitCode = 2;
    } else {
      reportTransition('executed', args.cutoverId, result.transition);
    }
  } else if (args.mode === 'verify') {
    const result = await verifyCutover(target, {
      cutoverId: args.cutoverId,
      operator: args.operator,
      expectedVersion: requireVersion(args.expectedVersion),
    }, args.stores);
    for (const divergence of result.divergences) {
      output({ event: 'post_boot_divergence', store: divergence.storeId, status: divergence.status });
    }
    if (!result.matched) {
      output({ event: 'verify_failed', cutoverId: args.cutoverId, detail: 'post-boot digest diverged; consider rollback' });
      process.exitCode = 2;
    } else {
      reportTransition('verified', args.cutoverId, result.transition);
    }
  } else if (args.mode === 'rollback') {
    const result = await rollbackCutover(target, args.roots, {
      cutoverId: args.cutoverId,
      operator: args.operator,
      expectedVersion: requireVersion(args.expectedVersion),
      reason: args.reason,
    }, args.stores);
    reportTransition('rolled_back', args.cutoverId, result.transition, {
      postgresWritesAfterCutoverPreserved: false,
      authorityAfterRollback: 'file',
      lostStores: result.lostStores,
    });
  } else {
    const proof = await getCutover(target, args.cutoverId);
    if (!proof) {
      output({ event: 'not_found', cutoverId: args.cutoverId });
      process.exitCode = 2;
    } else {
      output({
        event: 'status',
        cutoverId: proof.cutoverId,
        state: proof.state,
        lifecycleVersion: proof.lifecycleVersion,
        writersFrozenBy: proof.writersFrozenBy,
        preflightedAt: proof.preflightedAt,
        executedAt: proof.executedAt,
        flippedAt: proof.flippedAt,
        verifiedAt: proof.verifiedAt,
        rolledBackAt: proof.rolledBackAt,
      });
    }
  }
} catch (error) {
  output({
    event: 'fatal',
    reason: 'cutover_failed',
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
