import { describe, expect, it } from 'vitest';
import { MYNEWS_TABLE_NAMES } from './db/schema';
import { MYNEWS_MODULE } from './definition';

describe('MYNEWS_MODULE definition', () => {
  it('matches the registry contract', () => {
    expect(MYNEWS_MODULE.id).toBe('mynews');
    expect(MYNEWS_MODULE.tablePrefix).toBe('nw_');
    expect(MYNEWS_MODULE.schemaVersion).toBe(1);
    expect(MYNEWS_MODULE.migrations).toHaveLength(1);
  });

  it('declares a sync rule for every local table, all capped at personal_replica or below', () => {
    const rules = MYNEWS_MODULE.syncPolicy?.entityRules ?? [];
    const ruleNames = rules.map((r) => r.tableName).sort();
    const bare = MYNEWS_TABLE_NAMES.map((t) => t.replace(/^nw_/, '')).sort();
    expect(ruleNames).toEqual(bare);
    for (const rule of rules) {
      expect(['device_local', 'personal_replica']).toContain(rule.maxScope ?? rule.defaultScope);
    }
  });

  it('never shares at workspace scope in P0', () => {
    expect(MYNEWS_MODULE.syncPolicy?.shareable).toBe(false);
  });
});
