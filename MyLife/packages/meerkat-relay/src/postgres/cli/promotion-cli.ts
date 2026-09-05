import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { Pool } from 'pg';
import { createMeerkatPostgresPool } from '../pool';
import { PostgresStoreContext } from '../store-context';
import {
  PostgresPromotionStore,
  type PromotionResult,
  type PromotionState,
} from '../stores/promotion-store';
import { redactErrorDetail } from '../../log-redaction';

/**
 * Release promotion CLI (Plan 44 WP-6C), migrate-cli NDJSON idiom.
 *
 * Recording each rung of the deploy ladder against the durable
 * `ops.release_promotions` proof table. The CLI NEVER performs a deploy: it RECORDS
 * a transition the operator ALREADY performed out of band (pulled the pinned
 * images, restarted the stack), attaching the canary/probe evidence that justified
 * it. Every event says it records a transition, never that it deployed.
 *
 * Subcommands (exactly one):
 *   --promote   Record a forward transition for --release-id up to --to <state>.
 *               from_state is DERIVED from the release's current state (the operator
 *               cannot skip a rung). The release must be a recorded, APPROVED
 *               manifest (NC-44.4); an illegal jump or a stale from-state is refused.
 *               EVIDENCE GATE: --to staging accepts optional notes evidence, but the
 *               canary rungs (staging_canary, production_canary, production) REQUIRE
 *               --evidence whose final line is a canary verdict object with
 *               verdict "ok" -- a missing, non-verdict, degraded, or failed verdict
 *               refuses the record. NDJSON evidence is attached IN FULL (every
 *               parsed line, in order), never just the last line.
 *   --rollback  Record a rollback of --release-id to --rollback-to <releaseId> (an
 *               EARLIER approved manifest). The store stamps the honest non-reversal
 *               markers (dataReversalClaimed=false, postgresWritesAfterFlipReversed=
 *               false, NC-44.5): a rollback re-points images, it never un-writes the
 *               database. Evidence claiming reversal is refused.
 *   --status    Print --release-id's current state and its recent transitions.
 *   --history   Print --release-id's full recent promotion history (newest first).
 *
 * Exit codes: 0 a transition recorded (or a clean status/history), 1 a refusal, a
 * contended lease, a duplicate promotion id, or a fatal/operational error. Each
 * refusal reason is emitted as its own NDJSON event. Connection via
 * MEERKAT_POSTGRES_URL (the meerkat_ops role records; status/history only read).
 */

const output = (value: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

type Mode = 'promote' | 'rollback' | 'status' | 'history';

const FORWARD_STATES: readonly Exclude<PromotionState, 'rolled_back'>[] = [
  'staging',
  'staging_canary',
  'production_canary',
  'production',
];

interface ParsedArgs {
  mode: Mode;
  releaseId: string;
  promotionId: string;
  toState: string;
  rollbackTo: string;
  operator: string;
  evidenceFile: string;
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
  for (const mode of ['promote', 'rollback', 'status', 'history'] as const) {
    if (bare.has(mode)) modes.push(mode);
  }
  if (modes.length !== 1) {
    throw new Error('Exactly one of --promote, --rollback, --status, --history is required');
  }

  return {
    mode: modes[0]!,
    releaseId: flags.get('release-id')?.[0]?.trim() ?? '',
    promotionId: flags.get('promotion-id')?.[0]?.trim() ?? '',
    toState: flags.get('to')?.[0]?.trim() ?? '',
    rollbackTo: flags.get('rollback-to')?.[0]?.trim() ?? '',
    operator: flags.get('operator')?.[0]?.trim() || `promotion@${hostname()}:${process.pid}`,
    evidenceFile: flags.get('evidence')?.[0]?.trim() ?? '',
    applicationName: 'meerkat-promotion:meerkat_ops',
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

/**
 * Load the operator-supplied evidence file: a single JSON value, or NDJSON where
 * EVERY non-empty line must parse (a probe's full stream). The COMPLETE parsed
 * content is attached under `attachedEvidence` (single value, or the array of all
 * lines in order); nothing is dropped, so a failing early line can never be hidden
 * behind a later one. `verdictLine` is the FINAL parsed line (a probe emits its
 * aggregate verdict last), which the canary gate reads. Malformed evidence is
 * fatal: a promotion's justification must be real, never a swallowed parse error.
 */
async function loadEvidence(
  path: string,
): Promise<{ evidence: Record<string, unknown>; verdictLine: unknown }> {
  if (!path) return { evidence: {}, verdictLine: null };
  const raw = (await fs.readFile(path, 'utf8')).trim();
  if (!raw) throw new Error('--evidence file is empty');
  try {
    const single = JSON.parse(raw) as unknown;
    return { evidence: { attachedEvidence: single }, verdictLine: single };
  } catch {
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    const parsedLines = lines.map((line, index) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        throw new Error(`--evidence NDJSON line ${index + 1} is not valid JSON`);
      }
    });
    return { evidence: { attachedEvidence: parsedLines }, verdictLine: parsedLines.at(-1) ?? null };
  }
}

/**
 * The canary gate for evidence-gated rungs: the attached evidence's final line must
 * be a real verdict object whose verdict is `ok`. A missing file, a non-verdict
 * payload, or a degraded/failed verdict refuses the promotion: recording a canary
 * rung without a passing canary is exactly the lie this gate exists to stop.
 */
function assertOkVerdict(verdictLine: unknown, toState: string): void {
  if (!verdictLine || typeof verdictLine !== 'object' || Array.isArray(verdictLine)) {
    throw new Error(`--evidence for --to ${toState} must end in a canary verdict object`);
  }
  const verdict = (verdictLine as Record<string, unknown>).verdict;
  if (verdict !== 'ok') {
    throw new Error(
      `--evidence verdict is ${JSON.stringify(verdict ?? null)}, not "ok"; a ${toState} promotion requires a passing canary verdict`,
    );
  }
}

function makePromotionId(releaseId: string, toState: string): string {
  const safeRelease = releaseId.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 64);
  // Millisecond time alone can collide across processes and truncated release ids;
  // the random suffix makes the generated primary key practically collision-free.
  return `promote-${safeRelease}-${toState}-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/** Emit the outcome of a store result and set the exit code (0 recorded, 1 otherwise). */
function reportResult(result: PromotionResult, context: Record<string, unknown>): void {
  if (result.status === 'recorded') {
    output({
      event: 'promotion_recorded',
      ...context,
      promotionId: result.promotion.promotionId,
      fromState: result.promotion.fromState,
      toState: result.promotion.toState,
      recordedAt: result.promotion.recordedAt,
      durable: 'immutable_row',
      note: 'recorded a transition the operator performed; this CLI never deploys',
    });
    return;
  }
  if (result.status === 'duplicate') {
    output({
      event: 'promotion_duplicate',
      ...context,
      promotionId: result.existing.promotionId,
      durableToState: result.existing.toState,
      detail: 'promotion id already recorded; the durable row stands unmodified',
    });
    process.exitCode = 1;
    return;
  }
  if (result.status === 'contended') {
    output({
      event: 'promotion_contended',
      ...context,
      detail: 'a concurrent transition holds the release-promotion lease; do not proceed',
    });
    process.exitCode = 1;
    return;
  }
  output({ event: 'promotion_refused', ...context, reason: result.reason, detail: result.detail });
  process.exitCode = 1;
}

async function runPromote(args: ParsedArgs): Promise<void> {
  if (!args.releaseId) throw new Error('--release-id is required for --promote');
  if (!FORWARD_STATES.includes(args.toState as Exclude<PromotionState, 'rolled_back'>)) {
    throw new Error(`--to must be one of ${FORWARD_STATES.join(', ')}`);
  }
  // Canary-gated rungs (everything past the first staging deploy) REQUIRE a real
  // passing canary verdict as evidence. Recording staging_canary/production_canary/
  // production with no verdict (or a failing one) would imply a canary that never
  // passed; only the initial staging record may carry notes-only evidence.
  const evidenceGated = args.toState !== 'staging';
  if (evidenceGated && !args.evidenceFile) {
    throw new Error(`--evidence <canary-verdict file> is required for --to ${args.toState}`);
  }
  const { evidence, verdictLine } = await loadEvidence(args.evidenceFile);
  if (evidenceGated) assertOkVerdict(verdictLine, args.toState);
  const promotionId = args.promotionId || makePromotionId(args.releaseId, args.toState);
  const pool = await openPool(args.applicationName);
  try {
    const store = new PostgresPromotionStore(new PostgresStoreContext(pool));
    const result = await store.recordForwardPromotion({
      promotionId,
      releaseId: args.releaseId,
      toState: args.toState as Exclude<PromotionState, 'rolled_back'>,
      operator: args.operator,
      evidence,
    });
    reportResult(result, { releaseId: args.releaseId, to: args.toState });
  } finally {
    await pool.end();
  }
}

async function runRollback(args: ParsedArgs): Promise<void> {
  if (!args.releaseId) throw new Error('--release-id is required for --rollback');
  if (!args.rollbackTo) throw new Error('--rollback-to <releaseId> is required for --rollback');
  // A rollback needs no PASSING verdict (it is usually justified by a failing one);
  // whatever evidence exists is attached in full.
  const { evidence } = await loadEvidence(args.evidenceFile);
  const promotionId = args.promotionId || makePromotionId(args.releaseId, 'rolled_back');
  const pool = await openPool(args.applicationName);
  try {
    const store = new PostgresPromotionStore(new PostgresStoreContext(pool));
    const result = await store.recordRollback({
      promotionId,
      releaseId: args.releaseId,
      rollbackToReleaseId: args.rollbackTo,
      operator: args.operator,
      evidence,
    });
    reportResult(result, { releaseId: args.releaseId, rollbackTo: args.rollbackTo });
  } finally {
    await pool.end();
  }
}

async function runStatus(args: ParsedArgs): Promise<void> {
  if (!args.releaseId) throw new Error('--release-id is required for --status');
  const pool = await openPool('meerkat-promotion-status:meerkat_observer');
  try {
    const store = new PostgresPromotionStore(new PostgresStoreContext(pool));
    const current = await store.currentPromotionState(args.releaseId);
    const recent = await store.listPromotions(args.releaseId, 10);
    output({
      event: 'status',
      releaseId: args.releaseId,
      currentState: current,
      transitions: recent.length,
      recent: recent.map((p) => ({
        promotionId: p.promotionId,
        fromState: p.fromState,
        toState: p.toState,
        operator: p.operator,
        recordedAt: p.recordedAt,
      })),
    });
  } finally {
    await pool.end();
  }
}

async function runHistory(args: ParsedArgs): Promise<void> {
  if (!args.releaseId) throw new Error('--release-id is required for --history');
  const pool = await openPool('meerkat-promotion-history:meerkat_observer');
  try {
    const store = new PostgresPromotionStore(new PostgresStoreContext(pool));
    const history = await store.listPromotions(args.releaseId, 200);
    output({ event: 'history', releaseId: args.releaseId, count: history.length });
    for (const p of history) {
      output({
        event: 'promotion',
        promotionId: p.promotionId,
        fromState: p.fromState,
        toState: p.toState,
        operator: p.operator,
        recordedAt: p.recordedAt,
      });
    }
  } finally {
    await pool.end();
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  output({ event: 'start', mode: args.mode });
  if (args.mode === 'promote') await runPromote(args);
  else if (args.mode === 'rollback') await runRollback(args);
  else if (args.mode === 'status') await runStatus(args);
  else await runHistory(args);
} catch (error) {
  output({
    event: 'fatal',
    reason: 'promotion_cli_failed',
    detail: redactErrorDetail(error instanceof Error ? error.message : String(error)),
  });
  process.exitCode = 1;
}
