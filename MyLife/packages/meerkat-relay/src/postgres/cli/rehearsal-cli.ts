import { hostname } from 'node:os';
import { randomBytes, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { Pool } from 'pg';
import { createMeerkatPostgresPool } from '../pool';
import { PostgresStoreContext } from '../store-context';
import {
  isVacuousEvidence,
  PostgresRehearsalStore,
  REHEARSAL_DRILL_KINDS,
  type RehearsalRecordResult,
  type RehearsalDrill,
  type RehearsalDrillKind,
} from '../stores/rehearsal-store';
import { redactErrorDetail } from '../../log-redaction';

/**
 * Rehearsal drill CLI (Plan 44 WP-7A), migrate-cli NDJSON idiom.
 *
 * Recording each production-readiness drill against the durable
 * `ops.rehearsal_proofs` proof table. The CLI NEVER runs a drill: it RECORDS the
 * outcome an operator (or a harness) ALREADY produced out of band, attaching the
 * evidence that justified the verdict. Every event says it records a drill, never
 * that it ran one. A drill that was not run is not a row.
 *
 * Subcommands (exactly one):
 *   --record          Record --kind's outcome (--verdict) for --operator, started
 *                     at --started-at, optionally against --release-id. Evidence is
 *                     attached IN FULL from --evidence (same NDJSON handling as
 *                     promotion-cli). A `passed` verdict REQUIRES an --evidence file:
 *                     a bare passed claim is fatal BEFORE any connection.
 *   --status          Print the latest drill per kind (or just --kind if supplied).
 *   --history         Print recent drills, newest first (--kind / --release-id filters).
 *   --export-evidence Emit the Plan 40 evidence.json FRAGMENT for --release-id:
 *                     the latest PASSED drill per kind (or null), plus a
 *                     missingDrills list for kinds with no passed proof. Reads
 *                     DURABLE rows only; never fabricates an entry.
 *
 * Exit codes: 0 a drill recorded (or a clean status/history/export), 1 a refusal, a
 * contended lease, a duplicate drill id with a DIFFERENT durable outcome, or a
 * fatal/operational error. A duplicate whose durable verdict + evidence digest are
 * IDENTICAL to the re-submitted record exits 0 (idempotent), mirroring release-cli.
 * Each refusal reason is emitted as its own NDJSON event. Connection via
 * MEERKAT_POSTGRES_URL (the meerkat_ops role records; status/history/export read).
 */

const output = (value: Record<string, unknown>): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

type Mode = 'record' | 'status' | 'history' | 'export-evidence';

interface ParsedArgs {
  mode: Mode;
  kind: string;
  verdict: string;
  operator: string;
  drillId: string;
  releaseId: string;
  startedAt: string;
  evidenceFile: string;
  outFile: string;
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
  for (const mode of ['record', 'status', 'history', 'export-evidence'] as const) {
    if (bare.has(mode)) modes.push(mode);
  }
  if (modes.length !== 1) {
    throw new Error('Exactly one of --record, --status, --history, --export-evidence is required');
  }

  return {
    mode: modes[0]!,
    kind: flags.get('kind')?.[0]?.trim() ?? '',
    verdict: flags.get('verdict')?.[0]?.trim() ?? '',
    operator: flags.get('operator')?.[0]?.trim() || `rehearsal@${hostname()}:${process.pid}`,
    drillId: flags.get('drill-id')?.[0]?.trim() ?? '',
    releaseId: flags.get('release-id')?.[0]?.trim() ?? '',
    startedAt: flags.get('started-at')?.[0]?.trim() ?? '',
    evidenceFile: flags.get('evidence')?.[0]?.trim() ?? '',
    outFile: flags.get('out')?.[0]?.trim() ?? '',
    // The pool validator (pool.ts SAFE_APPLICATION_NAME) rejects '[' and ']', so the
    // role is named with a validator-safe ':' separator rather than the bracket suffix.
    applicationName: 'meerkat-rehearsal:meerkat_ops',
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
 * EVERY non-empty line must parse (a harness's full stream). The COMPLETE parsed
 * content is attached under `attachedEvidence` (single value, or the array of all
 * lines in order); nothing is dropped, so a failing early line can never be hidden
 * behind a later one. Malformed evidence is fatal: a drill's justification must be
 * real, never a swallowed parse error.
 */
async function loadEvidence(path: string): Promise<Record<string, unknown>> {
  if (!path) return {};
  const raw = (await fs.readFile(path, 'utf8')).trim();
  if (!raw) throw new Error('--evidence file is empty');
  try {
    const single = JSON.parse(raw) as unknown;
    return { attachedEvidence: single };
  } catch {
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    const parsedLines = lines.map((line, index) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        throw new Error(`--evidence NDJSON line ${index + 1} is not valid JSON`);
      }
    });
    return { attachedEvidence: parsedLines };
  }
}

function makeDrillId(kind: string): string {
  const safeKind = kind.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 40);
  // Millisecond time alone can collide across processes; the random suffix makes the
  // generated primary key practically collision-free.
  return `drill-${safeKind}-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/**
 * The idempotency digest of a record: a sha256 over the canonicalized verdict +
 * evidence. A duplicate drill id whose durable digest matches the re-submitted one
 * is an idempotent replay (exit 0); a duplicate whose durable outcome DIFFERS is a
 * real conflict (exit 1). The store stamps `storeStamped` into the durable evidence,
 * so we strip it before hashing to compare like-for-like. Stripping means the
 * idempotency label deliberately ignores approval-state drift: drillId is the PK
 * and releaseId is fixed per row, so the stamp can only differ if the SAME row is
 * re-submitted after its manifest's approval changed, which is still the same drill.
 */
function recordDigest(verdict: string, evidence: Record<string, unknown>): string {
  const rest: Record<string, unknown> = { ...evidence };
  delete rest.storeStamped;
  return createHash('sha256')
    .update(`${verdict}\0${canonicalJson(rest)}`, 'utf8')
    .digest('hex');
}

/** Deterministic JSON: object keys sorted at every depth so the digest is stable. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(',')}}`;
}

/** Emit the outcome of a store record and set the exit code (0 recorded/idempotent, 1 otherwise). */
function reportResult(
  result: RehearsalRecordResult,
  submitted: { verdict: string; evidence: Record<string, unknown> },
  context: Record<string, unknown>,
): void {
  if (result.status === 'recorded') {
    output({
      event: 'drill_recorded',
      ...context,
      drillId: result.drill.drillId,
      kind: result.drill.drillKind,
      verdict: result.drill.verdict,
      recordedAt: result.drill.recordedAt,
      durable: 'immutable_row',
      note: 'recorded a drill outcome the operator produced; this CLI never runs a drill',
    });
    return;
  }
  if (result.status === 'duplicate') {
    // Idempotent iff the durable verdict + evidence digest equal the re-submitted
    // ones. Same outcome -> exit 0 (a retried record); different -> exit 1 (conflict).
    const durableDigest = recordDigest(result.existing.verdict, result.existing.evidence);
    const submittedDigest = recordDigest(submitted.verdict, submitted.evidence);
    const idempotent = durableDigest === submittedDigest;
    output({
      event: 'drill_duplicate',
      ...context,
      drillId: result.existing.drillId,
      durableVerdict: result.existing.verdict,
      idempotent,
      detail: idempotent
        ? 'drill id already recorded with an identical outcome; the durable row stands'
        : 'drill id already recorded with a DIFFERENT outcome; the durable row stands unmodified',
    });
    if (!idempotent) process.exitCode = 1;
    return;
  }
  if (result.status === 'contended') {
    output({
      event: 'drill_contended',
      ...context,
      detail: 'a concurrent record holds the rehearsal lease; do not proceed',
    });
    process.exitCode = 1;
    return;
  }
  output({ event: 'drill_refused', ...context, reason: result.reason, detail: result.detail });
  process.exitCode = 1;
}

async function runRecord(args: ParsedArgs): Promise<void> {
  if (!args.kind) throw new Error('--kind is required for --record');
  if (!args.verdict) throw new Error('--verdict is required for --record');
  if (!args.startedAt) throw new Error('--started-at <ISO instant> is required for --record');
  // A `passed` verdict is a positive readiness claim: it REQUIRES an evidence file.
  // Refuse the bare passed claim BEFORE opening any connection.
  if (args.verdict === 'passed' && !args.evidenceFile) {
    throw new Error('--evidence <file> is required for a passed verdict; a bare passed claim is refused');
  }
  const attached = await loadEvidence(args.evidenceFile);
  // The file existing is not enough: a passed verdict whose attached content deep-
  // normalizes to nothing ({}, null, [], "", nested empties) is a vacuous claim and
  // is refused BEFORE any connection, mirroring the store's gate.
  if (args.verdict === 'passed' && isVacuousEvidence(attached)) {
    throw new Error('--evidence content is vacuous (empty object/array/null/blank); a passed verdict requires real evidence');
  }
  const drillId = args.drillId || makeDrillId(args.kind);
  const pool = await openPool(args.applicationName);
  try {
    const store = new PostgresRehearsalStore(new PostgresStoreContext(pool));
    const result = await store.recordDrill({
      drillId,
      drillKind: args.kind,
      verdict: args.verdict,
      operator: args.operator,
      startedAt: args.startedAt,
      evidence: attached,
      releaseId: args.releaseId || null,
    });
    reportResult(
      result,
      { verdict: args.verdict, evidence: attached },
      { kind: args.kind, releaseId: args.releaseId || null },
    );
  } finally {
    await pool.end();
  }
}

async function runStatus(args: ParsedArgs): Promise<void> {
  const pool = await openPool('meerkat-rehearsal-status:meerkat_observer');
  try {
    const store = new PostgresRehearsalStore(new PostgresStoreContext(pool));
    const kinds: readonly RehearsalDrillKind[] = args.kind
      ? [assertKnownKind(args.kind)]
      : REHEARSAL_DRILL_KINDS;
    const latest: Record<string, unknown> = {};
    for (const kind of kinds) {
      const drill = await store.latestByKind(kind);
      latest[kind] = drill
        ? {
            drillId: drill.drillId,
            verdict: drill.verdict,
            releaseId: drill.releaseId,
            startedAt: drill.startedAt,
            recordedAt: drill.recordedAt,
            operator: drill.operator,
          }
        : null;
    }
    output({ event: 'status', kinds: kinds.length, latest });
  } finally {
    await pool.end();
  }
}

async function runHistory(args: ParsedArgs): Promise<void> {
  const pool = await openPool('meerkat-rehearsal-history:meerkat_observer');
  try {
    const store = new PostgresRehearsalStore(new PostgresStoreContext(pool));
    const history = await store.listDrills({
      kind: args.kind ? assertKnownKind(args.kind) : undefined,
      releaseId: args.releaseId || undefined,
      max: 200,
    });
    output({ event: 'history', count: history.length, kind: args.kind || null, releaseId: args.releaseId || null });
    for (const drill of history) {
      output({
        event: 'drill',
        drillId: drill.drillId,
        kind: drill.drillKind,
        verdict: drill.verdict,
        releaseId: drill.releaseId,
        startedAt: drill.startedAt,
        recordedAt: drill.recordedAt,
        operator: drill.operator,
      });
    }
  } finally {
    await pool.end();
  }
}

/**
 * Emit the Plan 40 evidence.json FRAGMENT for a release: the latest PASSED drill
 * per kind (or null), and a missingDrills list of kinds with no passed proof. Reads
 * DURABLE rows only; a null means the drill is honestly absent for this release,
 * never a fabricated pass. This fragment covers ONLY rehearsal drills.
 */
async function runExportEvidence(args: ParsedArgs): Promise<void> {
  if (!args.releaseId) throw new Error('--release-id is required for --export-evidence');
  const pool = await openPool('meerkat-rehearsal-export:meerkat_observer');
  try {
    const store = new PostgresRehearsalStore(new PostgresStoreContext(pool));
    const drills: Record<string, unknown> = {};
    const missingDrills: string[] = [];
    for (const kind of REHEARSAL_DRILL_KINDS) {
      const passed = await store.latestPassedForRelease(kind, args.releaseId);
      if (passed) {
        drills[kind] = summarizeDrill(passed);
      } else {
        drills[kind] = null;
        missingDrills.push(kind);
      }
    }
    const generatedAt = await databaseGeneratedAt(pool);
    const fragment = {
      kind: 'meerkat-rehearsal-evidence',
      version: 1,
      releaseId: args.releaseId,
      generatedAt,
      drills,
      missingDrills,
      note:
        'This fragment covers ONLY rehearsal drills. A null entry (and its presence in '
        + 'missingDrills) means no PASSED drill of that kind is recorded for this release; '
        + 'it is honestly absent, never a fabricated pass.',
    };
    if (args.outFile) {
      await fs.writeFile(args.outFile, `${JSON.stringify(fragment, null, 2)}\n`, 'utf8');
      output({
        event: 'evidence_exported',
        releaseId: args.releaseId,
        out: args.outFile,
        recordedKinds: REHEARSAL_DRILL_KINDS.length - missingDrills.length,
        missingCount: missingDrills.length,
      });
    } else {
      output({ event: 'evidence_fragment', ...fragment });
    }
  } finally {
    await pool.end();
  }
}

function summarizeDrill(drill: RehearsalDrill): Record<string, unknown> {
  // releaseApproved is the store-stamped honesty flag: whether the drill ran against
  // an APPROVED candidate. Stamping it and then dropping it here would defeat its
  // one purpose, so the export surfaces it (null = drill had no release binding or
  // predates stamping).
  const stamped = drill.evidence.storeStamped as Record<string, unknown> | undefined;
  return {
    drillId: drill.drillId,
    verdict: drill.verdict,
    startedAt: drill.startedAt,
    recordedAt: drill.recordedAt,
    operator: drill.operator,
    releaseApproved: stamped && typeof stamped === 'object' && 'releaseApproved' in stamped
      ? (stamped.releaseApproved as boolean | null)
      : null,
  };
}

/** The database clock as an ISO instant (never the CLI host clock). */
async function databaseGeneratedAt(pool: Pool): Promise<string> {
  const result = await pool.query<{ now: Date | string }>('SELECT clock_timestamp() AS now');
  const raw = result.rows[0]?.now;
  if (raw === undefined) throw new Error('database clock unavailable');
  return new Date(raw instanceof Date ? raw : String(raw)).toISOString();
}

function assertKnownKind(kind: string): RehearsalDrillKind {
  if (!(REHEARSAL_DRILL_KINDS as readonly string[]).includes(kind)) {
    throw new Error(`--kind must be one of ${REHEARSAL_DRILL_KINDS.join(', ')}`);
  }
  return kind as RehearsalDrillKind;
}

try {
  const args = parseArgs(process.argv.slice(2));
  output({ event: 'start', mode: args.mode });
  if (args.mode === 'record') await runRecord(args);
  else if (args.mode === 'status') await runStatus(args);
  else if (args.mode === 'history') await runHistory(args);
  else await runExportEvidence(args);
} catch (error) {
  output({
    event: 'fatal',
    reason: 'rehearsal_cli_failed',
    detail: redactErrorDetail(error instanceof Error ? error.message : String(error)),
  });
  process.exitCode = 1;
}
