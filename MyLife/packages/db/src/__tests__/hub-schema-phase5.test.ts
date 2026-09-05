import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '../adapter';
import { createHubTables } from '../hub-schema';
import { createHubTestDatabase, type InMemoryTestDatabase } from '../test-utils';

/**
 * Phase 5-core regression tests.
 *
 * Covers the 2 automation tables + 1 index added to `hub-schema.ts`
 * as the schema foundation for the automation rule engine.
 *
 * Spec: docs/plans/consolidation/06-automation-shortcuts.md
 * Handoff: docs/plans/consolidation/phase-5-core-handoff.md
 */

const PHASE5_AUTOMATION_TABLES = [
  'hub_automation_rules',
  'hub_automation_log',
] as const;

const PHASE5_AUTOMATION_INDEXES = ['hub_automation_log_rule_at_idx'] as const;

function listHubTables(adapter: DatabaseAdapter): string[] {
  return adapter
    .query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hub_%' ORDER BY name",
    )
    .map((row) => row.name);
}

function listHubIndexes(adapter: DatabaseAdapter): string[] {
  return adapter
    .query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'hub_%'",
    )
    .map((row) => row.name);
}

describe('Phase 5-core hub schema', () => {
  let db: InMemoryTestDatabase;
  let adapter: DatabaseAdapter;

  beforeEach(() => {
    db = createHubTestDatabase();
    adapter = db.adapter;
  });

  afterEach(() => {
    db.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test A — automation tables created on fresh install
  // ─────────────────────────────────────────────────────────────────────────

  describe('table creation', () => {
    it('creates both Phase 5-core automation tables', () => {
      const actual = new Set(listHubTables(adapter));
      for (const name of PHASE5_AUTOMATION_TABLES) {
        expect(actual, `missing automation table: ${name}`).toContain(name);
      }
    });

    it('hub_automation_rules has expected columns', () => {
      const cols = adapter
        .query<{ name: string }>('PRAGMA table_info(hub_automation_rules)')
        .map((row) => row.name);
      expect(cols).toEqual(
        expect.arrayContaining([
          'id',
          'enabled',
          'last_fired_at',
          'fire_count',
          'created_at',
          'updated_at',
        ]),
      );
    });

    it('hub_automation_log has expected columns', () => {
      const cols = adapter
        .query<{ name: string }>('PRAGMA table_info(hub_automation_log)')
        .map((row) => row.name);
      expect(cols).toEqual(
        expect.arrayContaining([
          'id',
          'rule_id',
          'at',
          'outcome',
          'payload_sha256',
          'error',
        ]),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test B — index exists for hot read path
  // ─────────────────────────────────────────────────────────────────────────

  describe('indexes', () => {
    it('creates hub_automation_log_rule_at_idx', () => {
      const indexNames = new Set(listHubIndexes(adapter));
      for (const name of PHASE5_AUTOMATION_INDEXES) {
        expect(indexNames, `missing index: ${name}`).toContain(name);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test C — createHubTables is idempotent with the new tables added
  // ─────────────────────────────────────────────────────────────────────────

  describe('idempotency', () => {
    it('calling createHubTables twice does not throw', () => {
      // db already has tables from createHubTestDatabase().
      expect(() => createHubTables(adapter)).not.toThrow();
    });

    it('Phase 5-core tables are still present after repeated calls', () => {
      createHubTables(adapter);
      createHubTables(adapter);
      const actual = new Set(listHubTables(adapter));
      for (const name of PHASE5_AUTOMATION_TABLES) {
        expect(actual).toContain(name);
      }
    });

    it('table count is unchanged between repeated calls', () => {
      const before = listHubTables(adapter);
      createHubTables(adapter);
      const after = listHubTables(adapter);
      expect(after).toEqual(before);
    });
  });
});
