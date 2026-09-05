import { beforeEach, describe, expect, it } from 'vitest';
import {
  getRuleFireCount,
  listAutomationLog,
  logAutomationEvent,
} from '../audit';
import { AutomationOutcomeSchema } from '../types';

interface LogRow {
  id: string;
  rule_id: string;
  at: string;
  outcome: 'applied' | 'dismissed' | 'error';
  payload_sha256: string | null;
  error: string | null;
}

interface DbLike {
  execute(sql: string, params?: unknown[]): void;
  query<T = unknown>(sql: string, params?: unknown[]): T[];
}

/**
 * Minimal in-memory fake for hub_automation_log. Recognizes only the
 * handful of statements the audit helpers issue. Uses a monotonically
 * increasing inserted-at timestamp so reverse-chronological ordering is
 * deterministic.
 */
function makeFakeDb(): DbLike {
  const rows: LogRow[] = [];
  let clock = 0;

  function paramString(params: unknown[] | undefined, i: number): string {
    const value = params?.[i];
    if (typeof value !== 'string') {
      throw new Error(`expected string param at ${i}, got ${String(value)}`);
    }
    return value;
  }

  function paramStringOrNull(
    params: unknown[] | undefined,
    i: number,
  ): string | null {
    const value = params?.[i];
    if (value === null) return null;
    if (typeof value === 'string') return value;
    throw new Error(`expected string|null param at ${i}`);
  }

  function paramNumber(params: unknown[] | undefined, i: number): number {
    const value = params?.[i];
    if (typeof value !== 'number') {
      throw new Error(`expected number param at ${i}`);
    }
    return value;
  }

  return {
    execute(sql, params) {
      const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
      if (normalized.startsWith('INSERT INTO HUB_AUTOMATION_LOG')) {
        const outcomeRaw = paramString(params, 2);
        const outcome = AutomationOutcomeSchema.parse(outcomeRaw);
        clock += 1;
        const at = `2026-04-18T00:00:${String(clock).padStart(2, '0')}.000Z`;
        rows.push({
          id: paramString(params, 0),
          rule_id: paramString(params, 1),
          at,
          outcome,
          payload_sha256: paramStringOrNull(params, 3),
          error: paramStringOrNull(params, 4),
        });
        return;
      }
      throw new Error(`unhandled execute: ${sql}`);
    },
    query<T = unknown>(sql: string, params?: unknown[]): T[] {
      const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();

      if (normalized.startsWith('SELECT * FROM HUB_AUTOMATION_LOG WHERE ID =')) {
        const id = paramString(params, 0);
        return rows.filter((r) => r.id === id) as unknown as T[];
      }

      if (
        normalized.startsWith(
          'SELECT * FROM HUB_AUTOMATION_LOG ORDER BY AT DESC LIMIT',
        )
      ) {
        const limit = paramNumber(params, 0);
        const sorted = [...rows].sort((a, b) => (a.at < b.at ? 1 : -1));
        return sorted.slice(0, limit) as unknown as T[];
      }

      if (
        normalized.startsWith(
          'SELECT COUNT(*) AS C FROM HUB_AUTOMATION_LOG WHERE RULE_ID =',
        )
      ) {
        const ruleId = paramString(params, 0);
        const count = rows.filter(
          (r) => r.rule_id === ruleId && r.outcome === 'applied',
        ).length;
        return [{ c: count }] as unknown as T[];
      }

      throw new Error(`unhandled query: ${sql}`);
    },
  };
}

describe('audit log helpers', () => {
  let db: DbLike;

  beforeEach(() => {
    db = makeFakeDb();
  });

  it('logAutomationEvent inserts a row and returns the hydrated entry', () => {
    const entry = logAutomationEvent(db, {
      ruleId: 'receipt-to-budget',
      outcome: 'applied',
    });
    expect(entry.ruleId).toBe('receipt-to-budget');
    expect(entry.outcome).toBe('applied');
    expect(entry.id).toMatch(/^[0-9a-f-]+$/);
    expect(entry.at).toBeTruthy();
    expect(entry.payloadSha256).toBeNull();
    expect(entry.error).toBeNull();
  });

  it('validates the outcome enum at the schema level', () => {
    expect(() =>
      AutomationOutcomeSchema.parse('bogus'),
    ).toThrow();
    for (const outcome of ['applied', 'dismissed', 'error'] as const) {
      expect(AutomationOutcomeSchema.parse(outcome)).toBe(outcome);
    }
  });

  it('listAutomationLog returns entries in reverse-chronological order', () => {
    logAutomationEvent(db, { ruleId: 'a', outcome: 'applied' });
    logAutomationEvent(db, { ruleId: 'b', outcome: 'dismissed' });
    logAutomationEvent(db, { ruleId: 'c', outcome: 'error' });
    const entries = listAutomationLog(db);
    expect(entries.map((e) => e.ruleId)).toEqual(['c', 'b', 'a']);
  });

  it('listAutomationLog respects the limit argument', () => {
    for (let i = 0; i < 5; i++) {
      logAutomationEvent(db, { ruleId: `rule-${i}`, outcome: 'applied' });
    }
    expect(listAutomationLog(db, 2)).toHaveLength(2);
    expect(listAutomationLog(db, 10)).toHaveLength(5);
  });

  it('getRuleFireCount counts only applied outcomes for a given rule', () => {
    logAutomationEvent(db, { ruleId: 'rule-x', outcome: 'applied' });
    logAutomationEvent(db, { ruleId: 'rule-x', outcome: 'applied' });
    logAutomationEvent(db, { ruleId: 'rule-x', outcome: 'dismissed' });
    logAutomationEvent(db, { ruleId: 'rule-x', outcome: 'error' });
    logAutomationEvent(db, { ruleId: 'rule-y', outcome: 'applied' });
    expect(getRuleFireCount(db, 'rule-x')).toBe(2);
    expect(getRuleFireCount(db, 'rule-y')).toBe(1);
    expect(getRuleFireCount(db, 'missing')).toBe(0);
  });

  it('round-trips payloadSha256 and error fields', () => {
    const entry = logAutomationEvent(db, {
      ruleId: 'rule-err',
      outcome: 'error',
      payloadSha256: 'deadbeef',
      error: 'boom',
    });
    expect(entry.payloadSha256).toBe('deadbeef');
    expect(entry.error).toBe('boom');

    const [hydrated] = listAutomationLog(db, 1);
    expect(hydrated!.payloadSha256).toBe('deadbeef');
    expect(hydrated!.error).toBe('boom');
  });
});
