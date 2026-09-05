/**
 * Transaction rule CRUD operations.
 *
 * Rules auto-categorize transactions by matching payee patterns
 * to envelope assignments. Simpler than the engine's rule evaluator --
 * this is the DB persistence layer.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  TransactionRule,
  TransactionRuleInsert,
  TransactionRuleUpdate,
} from '../types';

const TRANSACTION_RULE_COLUMNS = new Set([
  'payee_pattern', 'match_type', 'envelope_id', 'is_enabled', 'priority',
]);

export function createTransactionRule(
  db: DatabaseAdapter,
  id: string,
  input: TransactionRuleInsert,
): TransactionRule {
  const now = new Date().toISOString();
  const rule: TransactionRule = {
    id,
    payee_pattern: input.payee_pattern,
    match_type: input.match_type,
    envelope_id: input.envelope_id,
    is_enabled: input.is_enabled ?? 1,
    priority: input.priority ?? 0,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bg_transaction_rules (id, payee_pattern, match_type, envelope_id, is_enabled, priority, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [rule.id, rule.payee_pattern, rule.match_type, rule.envelope_id, rule.is_enabled, rule.priority, rule.created_at],
  );

  return rule;
}

export function getTransactionRuleById(
  db: DatabaseAdapter,
  id: string,
): TransactionRule | null {
  const rows = db.query<TransactionRule>(
    `SELECT * FROM bg_transaction_rules WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getTransactionRules(
  db: DatabaseAdapter,
): TransactionRule[] {
  return db.query<TransactionRule>(
    `SELECT * FROM bg_transaction_rules ORDER BY priority ASC, created_at ASC`,
  );
}

export function getEnabledTransactionRules(
  db: DatabaseAdapter,
): TransactionRule[] {
  return db.query<TransactionRule>(
    `SELECT * FROM bg_transaction_rules WHERE is_enabled = 1 ORDER BY priority ASC, created_at ASC`,
  );
}

export function updateTransactionRule(
  db: DatabaseAdapter,
  id: string,
  updates: TransactionRuleUpdate,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && TRANSACTION_RULE_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;
  values.push(id);

  db.execute(
    `UPDATE bg_transaction_rules SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteTransactionRule(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM bg_transaction_rules WHERE id = ?`, [id]);
}
