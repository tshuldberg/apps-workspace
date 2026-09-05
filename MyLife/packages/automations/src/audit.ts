import type { AutomationOutcome, AutomationLogEntry } from './types';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface DbLike {
  execute(sql: string, params?: unknown[]): void;
  query<T = unknown>(sql: string, params?: unknown[]): T[];
}

export interface LogAutomationEventInput {
  ruleId: string;
  outcome: AutomationOutcome;
  payloadSha256?: string | null;
  error?: string | null;
}

interface AutomationLogRow {
  id: string;
  rule_id: string;
  at: string;
  outcome: AutomationOutcome;
  payload_sha256: string | null;
  error: string | null;
}

function hydrate(row: AutomationLogRow): AutomationLogEntry {
  return {
    id: row.id,
    ruleId: row.rule_id,
    at: row.at,
    outcome: row.outcome,
    payloadSha256: row.payload_sha256,
    error: row.error,
  };
}

export function logAutomationEvent(
  db: DbLike,
  input: LogAutomationEventInput,
): AutomationLogEntry {
  const id = generateId();
  db.execute(
    `INSERT INTO hub_automation_log (id, rule_id, outcome, payload_sha256, error) VALUES (?, ?, ?, ?, ?)`,
    [id, input.ruleId, input.outcome, input.payloadSha256 ?? null, input.error ?? null],
  );
  const rows = db.query<AutomationLogRow>(
    `SELECT * FROM hub_automation_log WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) {
    throw new Error(`failed to record automation event ${id}`);
  }
  return hydrate(rows[0]!);
}

export function listAutomationLog(
  db: DbLike,
  limit: number = 50,
): AutomationLogEntry[] {
  const rows = db.query<AutomationLogRow>(
    `SELECT * FROM hub_automation_log ORDER BY at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(hydrate);
}

export function getRuleFireCount(db: DbLike, ruleId: string): number {
  const rows = db.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM hub_automation_log WHERE rule_id = ? AND outcome = 'applied'`,
    [ruleId],
  );
  return rows[0]?.c ?? 0;
}
