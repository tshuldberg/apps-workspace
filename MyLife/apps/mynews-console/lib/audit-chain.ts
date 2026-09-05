import { createHash } from 'node:crypto';

/**
 * Console audit chain verifier (plan 48 WP9).
 *
 * nw_console_audit is hash-chained in SQL: each row hashes the previous row's
 * hash together with its own fields, and the table refuses UPDATE, DELETE, and
 * TRUNCATE. This module recomputes the same hashes from an export, so the chain
 * can be verified by someone who does not have database access and does not have
 * to trust the database that produced it.
 *
 * Two rules make cross-language agreement possible:
 *   1. Fields are octet-length prefixed (`<bytes>:<value>`), so free text
 *      containing the separator cannot forge a different field split.
 *   2. The payload is hashed as the exact `jsonb::text` Postgres produced, which
 *      the export carries verbatim as `payloadText`. Nothing here re-serializes
 *      JSON, so jsonb key ordering and whitespace never enter the picture.
 *
 * Pure and dependency-light on purpose: this is the piece that has to be
 * auditable by hand.
 */

export const GENESIS_PREV_HASH = '0'.repeat(64);

export interface AuditExportRow {
  seq: number;
  createdAtCanonical: string;
  actorRef: string;
  actorRole: string;
  action: string;
  targetKind: string;
  targetId: string;
  outcome: string;
  reason: string;
  payloadText: string;
  payloadHash: string;
  prevHash: string;
  rowHash: string;
  actionToken?: string | null;
}

export interface AuditExport {
  chain: string;
  hashAlgorithm: string;
  encoding: string;
  genesisPrevHash: string;
  exportedAt: string;
  fromSeq: number;
  anchorPrevHash: string;
  rows: AuditExportRow[];
  sqlVerification?: unknown;
}

export type AuditChainFailureReason =
  | 'payload-hash'
  | 'row-hash'
  | 'prev-hash'
  | 'seq-order'
  | 'bad-row';

export type AuditChainResult =
  | { ok: true; checked: number; firstSeq: number | null; lastSeq: number | null; head: string | null }
  | { ok: false; checked: number; badSeq: number | null; reason: AuditChainFailureReason };

function segment(value: string): string {
  return `${Buffer.byteLength(value, 'utf8')}:${value}`;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');
}

/** sha256 of the exact bytes Postgres hashed for the payload. */
export function payloadHashOf(payloadText: string): string {
  return sha256Hex(payloadText);
}

/**
 * The canonical bytes a row hash covers. Twin of nw_console_audit_row_hash;
 * field order is load-bearing and pinned by a drift test against the migration.
 */
export function canonicalRowString(row: {
  prevHash: string;
  seq: number;
  createdAtCanonical: string;
  actorRef: string;
  actorRole: string;
  action: string;
  targetKind: string;
  targetId: string;
  outcome: string;
  reason: string;
  payloadHash: string;
}): string {
  return [
    row.prevHash,
    String(row.seq),
    row.createdAtCanonical,
    row.actorRef,
    row.actorRole,
    row.action,
    row.targetKind,
    row.targetId,
    row.outcome,
    row.reason,
    row.payloadHash,
  ]
    .map(segment)
    .join('');
}

export function rowHashOf(row: Parameters<typeof canonicalRowString>[0]): string {
  return sha256Hex(canonicalRowString(row));
}

function isAuditRow(value: unknown): value is AuditExportRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const strings = [
    'createdAtCanonical',
    'actorRef',
    'actorRole',
    'action',
    'targetKind',
    'targetId',
    'outcome',
    'reason',
    'payloadText',
    'payloadHash',
    'prevHash',
    'rowHash',
  ];
  return (
    typeof row.seq === 'number' &&
    Number.isFinite(row.seq) &&
    strings.every((key) => typeof row[key] === 'string')
  );
}

/**
 * Walk a chain window and recompute every hash.
 *
 * `anchorPrevHash` is the row hash immediately before the first row in the
 * window (the genesis zero hash when the window starts at the beginning), so a
 * partial export still proves its incoming link and a dropped row is caught.
 */
export function verifyAuditChain(
  rows: readonly unknown[],
  anchorPrevHash: string = GENESIS_PREV_HASH,
): AuditChainResult {
  let expectedPrev = anchorPrevHash;
  let checked = 0;
  let firstSeq: number | null = null;
  let lastSeq: number | null = null;
  let previousSeq: number | null = null;

  for (const candidate of rows) {
    if (!isAuditRow(candidate)) {
      return { ok: false, checked, badSeq: null, reason: 'bad-row' };
    }
    const row = candidate;
    // Rows must arrive in ascending seq order: a verifier that sorted or
    // reordered them could be shown a valid chain built from a different history.
    if (previousSeq !== null && row.seq <= previousSeq) {
      return { ok: false, checked, badSeq: row.seq, reason: 'seq-order' };
    }
    if (row.prevHash !== expectedPrev) {
      return { ok: false, checked, badSeq: row.seq, reason: 'prev-hash' };
    }
    if (payloadHashOf(row.payloadText) !== row.payloadHash) {
      return { ok: false, checked, badSeq: row.seq, reason: 'payload-hash' };
    }
    if (rowHashOf(row) !== row.rowHash) {
      return { ok: false, checked, badSeq: row.seq, reason: 'row-hash' };
    }
    if (firstSeq === null) firstSeq = row.seq;
    lastSeq = row.seq;
    previousSeq = row.seq;
    expectedPrev = row.rowHash;
    checked += 1;
  }

  return {
    ok: true,
    checked,
    firstSeq,
    lastSeq,
    head: checked === 0 ? null : expectedPrev,
  };
}

/** Verify a whole export document, using the anchor it carries. */
export function verifyAuditExport(value: unknown): AuditChainResult {
  if (!value || typeof value !== 'object') {
    return { ok: false, checked: 0, badSeq: null, reason: 'bad-row' };
  }
  const doc = value as Partial<AuditExport>;
  if (!Array.isArray(doc.rows)) {
    return { ok: false, checked: 0, badSeq: null, reason: 'bad-row' };
  }
  const anchor = typeof doc.anchorPrevHash === 'string' ? doc.anchorPrevHash : GENESIS_PREV_HASH;
  return verifyAuditChain(doc.rows, anchor);
}

/** Human summary for the console's export screen. */
export function describeChainResult(result: AuditChainResult): string {
  if (result.ok) {
    if (result.checked === 0) return 'No audit rows in this window.';
    return `Chain intact across ${result.checked} rows (seq ${result.firstSeq} to ${result.lastSeq}).`;
  }
  const where = result.badSeq === null ? 'an unreadable row' : `seq ${result.badSeq}`;
  const why: Record<AuditChainFailureReason, string> = {
    'payload-hash': 'the recorded payload does not match its hash',
    'row-hash': 'the row fields do not match the row hash',
    'prev-hash': 'the link to the previous row is broken (a row was changed or removed)',
    'seq-order': 'rows are out of sequence order',
    'bad-row': 'the row is missing required fields',
  };
  return `Chain broken at ${where}: ${why[result.reason]}. Verified ${result.checked} rows before that.`;
}
