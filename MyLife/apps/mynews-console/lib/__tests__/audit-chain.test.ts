import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  GENESIS_PREV_HASH,
  canonicalRowString,
  describeChainResult,
  payloadHashOf,
  rowHashOf,
  verifyAuditChain,
  verifyAuditExport,
  type AuditExportRow,
} from '../audit-chain';

/**
 * Console audit chain (plan 48 WP9).
 *
 * The point of the chain is that a tampered audit log cannot be presented as
 * intact, so most of these tests take a VALID chain and break exactly one thing.
 * If any of them passed verification, the audit log would be decorative.
 */

function seg(value: string): string {
  return `${Buffer.byteLength(value, 'utf8')}:${value}`;
}

/** Build a valid row, sealed the way the SQL trigger seals it. */
function row(
  seq: number,
  prevHash: string,
  over: Partial<AuditExportRow> = {},
): AuditExportRow {
  const base = {
    seq,
    createdAtCanonical: `2026-07-30T10:00:0${seq}.000000Z`,
    actorRef: 'mod@example.test',
    actorRole: 'senior',
    action: 'hide_article',
    targetKind: 'article',
    targetId: `article-${seq}`,
    outcome: 'ok',
    reason: 'policy violation',
    payloadText: `{"reportId": "report-${seq}"}`,
    ...over,
  };
  const payloadHash = payloadHashOf(base.payloadText);
  const draft = { ...base, payloadHash, prevHash, rowHash: '' };
  return { ...draft, rowHash: rowHashOf(draft) };
}

/** A whole valid chain of `count` rows starting from genesis. */
function chain(count: number): AuditExportRow[] {
  const rows: AuditExportRow[] = [];
  let prev = GENESIS_PREV_HASH;
  for (let seq = 1; seq <= count; seq += 1) {
    const next = row(seq, prev);
    rows.push(next);
    prev = next.rowHash;
  }
  return rows;
}

describe('canonical encoding', () => {
  it('octet-length prefixes every field, in the order the SQL hashes them', () => {
    const canonical = canonicalRowString({
      prevHash: 'a'.repeat(64),
      seq: 7,
      createdAtCanonical: '2026-07-30T10:00:00.000000Z',
      actorRef: 'mod@example.test',
      actorRole: 'admin',
      action: 'dismiss',
      targetKind: 'report',
      targetId: 'r1',
      outcome: 'ok',
      reason: 'no violation',
      payloadHash: 'b'.repeat(64),
    });
    expect(canonical).toBe(
      seg('a'.repeat(64)) +
        seg('7') +
        seg('2026-07-30T10:00:00.000000Z') +
        seg('mod@example.test') +
        seg('admin') +
        seg('dismiss') +
        seg('report') +
        seg('r1') +
        seg('ok') +
        seg('no violation') +
        seg('b'.repeat(64)),
    );
  });

  it('cannot be forged by moving the separator into a field', () => {
    // Without length prefixes, a reason ending in the next field's value would
    // produce the same canonical string as a different field tuple. With them, the
    // byte counts differ, so the hashes differ.
    const a = canonicalRowString({
      prevHash: 'p',
      seq: 1,
      createdAtCanonical: 't',
      actorRef: 'a',
      actorRole: 'r',
      action: 'x',
      targetKind: 'k',
      targetId: 'id',
      outcome: 'ok',
      reason: 'abc',
      payloadHash: 'h',
    });
    const b = canonicalRowString({
      prevHash: 'p',
      seq: 1,
      createdAtCanonical: 't',
      actorRef: 'a',
      actorRole: 'r',
      action: 'x',
      targetKind: 'k',
      targetId: 'id',
      outcome: 'okab',
      reason: 'c',
      payloadHash: 'h',
    });
    expect(a).not.toBe(b);
  });

  it('counts bytes, not UTF-16 units, so multi-byte reasons still bind', () => {
    const emoji = 'policy 🚫';
    const canonical = canonicalRowString({
      prevHash: 'p',
      seq: 1,
      createdAtCanonical: 't',
      actorRef: 'a',
      actorRole: 'r',
      action: 'x',
      targetKind: 'k',
      targetId: 'id',
      outcome: 'ok',
      reason: emoji,
      payloadHash: 'h',
    });
    expect(canonical).toContain(`${Buffer.byteLength(emoji, 'utf8')}:${emoji}`);
    expect(Buffer.byteLength(emoji, 'utf8')).not.toBe(emoji.length);
  });

  it('hashes the payload as the exact text Postgres produced', () => {
    const text = '{"a": 1, "b": "two"}';
    expect(payloadHashOf(text)).toBe(
      createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex'),
    );
  });
});

describe('verifyAuditChain: intact chains', () => {
  it('accepts a chain from genesis and reports its head', () => {
    const rows = chain(3);
    const result = verifyAuditChain(rows);
    expect(result).toEqual({
      ok: true,
      checked: 3,
      firstSeq: 1,
      lastSeq: 3,
      head: rows[2]!.rowHash,
    });
  });

  it('accepts an empty window without inventing a head', () => {
    expect(verifyAuditChain([])).toEqual({
      ok: true,
      checked: 0,
      firstSeq: null,
      lastSeq: null,
      head: null,
    });
  });

  it('accepts a partial window anchored on the preceding row hash', () => {
    const rows = chain(4);
    const window = rows.slice(2);
    expect(verifyAuditChain(window, rows[1]!.rowHash).ok).toBe(true);
  });

  it('rejects a partial window presented as if it started at genesis', () => {
    const rows = chain(4);
    const result = verifyAuditChain(rows.slice(2));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('prev-hash');
  });
});

describe('verifyAuditChain: tampering', () => {
  it('detects an edited payload', () => {
    const rows = chain(3);
    rows[1] = { ...rows[1]!, payloadText: '{"reportId": "somewhere-else"}' };
    const result = verifyAuditChain(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('payload-hash');
      expect(result.badSeq).toBe(2);
      expect(result.checked).toBe(1);
    }
  });

  it('detects an edited payload whose hash was recomputed to match', () => {
    // A tamperer with the hash function can fix payload_hash, but then the ROW
    // hash no longer matches, because the row hash covers the payload hash.
    const rows = chain(3);
    const forgedText = '{"reportId": "somewhere-else"}';
    rows[1] = {
      ...rows[1]!,
      payloadText: forgedText,
      payloadHash: payloadHashOf(forgedText),
    };
    const result = verifyAuditChain(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('row-hash');
  });

  it('detects an edited payload with payload hash AND row hash recomputed', () => {
    // Resealing one row breaks the NEXT row's prev_hash link, which is the whole
    // reason the rows are chained rather than individually hashed.
    const rows = chain(3);
    const forgedText = '{"reportId": "somewhere-else"}';
    const resealed = { ...rows[1]!, payloadText: forgedText, payloadHash: payloadHashOf(forgedText) };
    rows[1] = { ...resealed, rowHash: rowHashOf(resealed) };
    const result = verifyAuditChain(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('prev-hash');
      expect(result.badSeq).toBe(3);
    }
  });

  it.each([
    ['actorRef', 'someone-else@example.test'],
    ['actorRole', 'admin'],
    ['action', 'dismiss'],
    ['targetKind', 'profile'],
    ['targetId', 'article-999'],
    ['outcome', 'refused:stale-action'],
    ['reason', 'a different reason entirely'],
    ['createdAtCanonical', '2020-01-01T00:00:00.000000Z'],
  ] as const)('detects an edited %s', (field, value) => {
    const rows = chain(2);
    rows[0] = { ...rows[0]!, [field]: value };
    const result = verifyAuditChain(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('row-hash');
  });

  it('detects a removed row', () => {
    const rows = chain(4);
    rows.splice(1, 1);
    const result = verifyAuditChain(rows);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('prev-hash');
      expect(result.badSeq).toBe(3);
    }
  });

  it('detects reordered rows', () => {
    const rows = chain(3);
    const reordered = [rows[0]!, rows[2]!, rows[1]!];
    const result = verifyAuditChain(reordered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('prev-hash');
  });

  it('detects a duplicated row before it can be double-counted', () => {
    const rows = chain(2);
    const result = verifyAuditChain([rows[0]!, rows[0]!, rows[1]!]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('seq-order');
  });

  it('detects a spliced-in row that was never sealed', () => {
    const rows = chain(2);
    const forged: AuditExportRow = {
      seq: 3,
      createdAtCanonical: '2026-07-30T10:00:03.000000Z',
      actorRef: 'attacker@example.test',
      actorRole: 'admin',
      action: 'role_grant',
      targetKind: 'moderator',
      targetId: 'attacker@example.test',
      outcome: 'ok',
      reason: 'promoted myself',
      payloadText: '{}',
      payloadHash: payloadHashOf('{}'),
      prevHash: rows[1]!.rowHash,
      rowHash: 'f'.repeat(64),
    };
    const result = verifyAuditChain([...rows, forged]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('row-hash');
      expect(result.badSeq).toBe(3);
    }
  });

  it('rejects a row missing required fields rather than skipping it', () => {
    const rows = chain(1);
    const result = verifyAuditChain([...rows, { seq: 2, actorRef: 'x' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('bad-row');
      expect(result.badSeq).toBeNull();
    }
  });
});

describe('verifyAuditExport', () => {
  it('verifies a whole export using the anchor it carries', () => {
    const rows = chain(3);
    const doc = {
      chain: 'nw_console_audit',
      hashAlgorithm: 'sha256',
      encoding: 'octet-length-prefixed',
      genesisPrevHash: GENESIS_PREV_HASH,
      exportedAt: '2026-07-30T11:00:00.000000Z',
      fromSeq: 2,
      anchorPrevHash: rows[0]!.rowHash,
      rows: rows.slice(1),
    };
    expect(verifyAuditExport(doc).ok).toBe(true);
  });

  it('fails an export whose anchor does not match its first row', () => {
    const rows = chain(3);
    const doc = { fromSeq: 2, anchorPrevHash: 'c'.repeat(64), rows: rows.slice(1) };
    const result = verifyAuditExport(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('prev-hash');
  });

  it('fails a document with no rows array instead of reporting an empty chain', () => {
    expect(verifyAuditExport({ rows: 'not an array' }).ok).toBe(false);
    expect(verifyAuditExport(null).ok).toBe(false);
    expect(verifyAuditExport('nope').ok).toBe(false);
  });

  it('defaults a missing anchor to genesis rather than accepting anything', () => {
    const rows = chain(2);
    expect(verifyAuditExport({ rows }).ok).toBe(true);
    expect(verifyAuditExport({ rows: rows.slice(1) }).ok).toBe(false);
  });
});

describe('describeChainResult', () => {
  it('names the range on success', () => {
    expect(describeChainResult(verifyAuditChain(chain(3)))).toBe(
      'Chain intact across 3 rows (seq 1 to 3).',
    );
  });

  it('says there are no rows rather than claiming a verified chain', () => {
    expect(describeChainResult(verifyAuditChain([]))).toBe('No audit rows in this window.');
  });

  it('names the failing row and why', () => {
    const rows = chain(2);
    rows[1] = { ...rows[1]!, reason: 'edited' };
    const text = describeChainResult(verifyAuditChain(rows));
    expect(text).toContain('seq 2');
    expect(text).toContain('do not match the row hash');
    expect(text).toContain('Verified 1 rows');
  });
});
