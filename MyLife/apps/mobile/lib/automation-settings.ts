/**
 * Thin helpers for reading/writing hub_automation_rules.enabled.
 *
 * The rule engine in @mylife/automations owns the audit log table
 * (hub_automation_log). hub_automation_rules is the per-rule on/off flag set
 * and is written directly by Settings UI — no migration helper in the engine
 * yet, so we keep SQL local to the hub shell to avoid leaking SQL into the
 * rule definitions themselves.
 */
import type { DatabaseAdapter } from '@mylife/db';

export function readRuleEnabled(db: DatabaseAdapter, ruleId: string): boolean {
  const rows = db.query<{ enabled: number }>(
    `SELECT enabled FROM hub_automation_rules WHERE id = ?`,
    [ruleId],
  );
  return rows[0]?.enabled === 1;
}

export function setRuleEnabled(
  db: DatabaseAdapter,
  ruleId: string,
  enabled: boolean,
): void {
  db.execute(
    `INSERT INTO hub_automation_rules (id, enabled) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now')`,
    [ruleId, enabled ? 1 : 0],
  );
}
