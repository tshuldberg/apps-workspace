import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '../adapter';
import { createHubTables } from '../hub-schema';
import { createHubTestDatabase, type InMemoryTestDatabase } from '../test-utils';

/**
 * Phase 1a regression tests.
 *
 * Covers the 17 shared-entity tables + 3 AI-permission tables added to
 * `hub-schema.ts`, plus the supporting FKs and indexes.
 *
 * Spec: docs/plans/consolidation/01-shared-data-layer.md
 *       docs/plans/consolidation/05-ai-agent-layer.md
 */

const PHASE1A_SHARED_TABLES = [
  'hub_attachments',
  'hub_attachment_links',
  'hub_tags',
  'hub_tag_bindings',
  'hub_reminders',
  'hub_goals',
  'hub_goal_progress',
  'hub_people',
  'hub_person_module_roles',
  'hub_body_metrics',
  'hub_places',
  'hub_gps_tracks',
  'hub_events',
  'hub_foods',
  'hub_books',
  'hub_cost_events',
  'hub_timeline',
] as const;

const PHASE1A_AI_TABLES = [
  'hub_ai_permissions',
  'hub_ai_table_permissions',
  'hub_ai_audit_log',
] as const;

const ALL_PHASE1A_TABLES = [...PHASE1A_SHARED_TABLES, ...PHASE1A_AI_TABLES];

interface ForeignKeyRow {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
}

function listHubTables(adapter: DatabaseAdapter): string[] {
  return adapter
    .query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hub_%' ORDER BY name",
    )
    .map((row) => row.name);
}

function listForeignKeys(adapter: DatabaseAdapter, tableName: string): ForeignKeyRow[] {
  return adapter.query<ForeignKeyRow>(`PRAGMA foreign_key_list(${tableName})`);
}

describe('Phase 1a hub schema', () => {
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
  // Test A — all 20 new tables created on fresh install
  // ─────────────────────────────────────────────────────────────────────────

  describe('table creation', () => {
    it('creates all 17 shared-entity tables', () => {
      const actual = new Set(listHubTables(adapter));
      for (const name of PHASE1A_SHARED_TABLES) {
        expect(actual, `missing shared-entity table: ${name}`).toContain(name);
      }
    });

    it('creates all 3 AI-permission tables', () => {
      const actual = new Set(listHubTables(adapter));
      for (const name of PHASE1A_AI_TABLES) {
        expect(actual, `missing AI-permission table: ${name}`).toContain(name);
      }
    });

    it('creates all 20 Phase 1a tables in one pass', () => {
      const actual = new Set(listHubTables(adapter));
      for (const name of ALL_PHASE1A_TABLES) {
        expect(actual).toContain(name);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test B — FK relationships wired
  // ─────────────────────────────────────────────────────────────────────────

  describe('foreign key relationships', () => {
    it('hub_attachment_links references hub_attachments', () => {
      const fks = listForeignKeys(adapter, 'hub_attachment_links');
      const ref = fks.find((fk) => fk.table === 'hub_attachments');
      expect(ref, 'hub_attachment_links must FK to hub_attachments').toBeDefined();
      expect(ref!.from).toBe('attachment_id');
      expect(ref!.to).toBe('id');
      expect(ref!.on_delete).toBe('CASCADE');
    });

    it('hub_goal_progress references hub_goals', () => {
      const fks = listForeignKeys(adapter, 'hub_goal_progress');
      const ref = fks.find((fk) => fk.table === 'hub_goals');
      expect(ref, 'hub_goal_progress must FK to hub_goals').toBeDefined();
      expect(ref!.from).toBe('goal_id');
      expect(ref!.to).toBe('id');
      expect(ref!.on_delete).toBe('CASCADE');
    });

    it('hub_person_module_roles references hub_people', () => {
      const fks = listForeignKeys(adapter, 'hub_person_module_roles');
      const ref = fks.find((fk) => fk.table === 'hub_people');
      expect(ref, 'hub_person_module_roles must FK to hub_people').toBeDefined();
      expect(ref!.from).toBe('person_id');
      expect(ref!.to).toBe('id');
      expect(ref!.on_delete).toBe('CASCADE');
    });

    it('hub_events references hub_places on place_id', () => {
      const fks = listForeignKeys(adapter, 'hub_events');
      const ref = fks.find((fk) => fk.table === 'hub_places');
      expect(ref, 'hub_events must FK to hub_places').toBeDefined();
      expect(ref!.from).toBe('place_id');
      expect(ref!.to).toBe('id');
    });

    it('hub_books references hub_attachments on cover_attachment_id', () => {
      const fks = listForeignKeys(adapter, 'hub_books');
      const ref = fks.find((fk) => fk.from === 'cover_attachment_id');
      expect(ref, 'hub_books must FK cover_attachment_id to hub_attachments').toBeDefined();
      expect(ref!.table).toBe('hub_attachments');
      expect(ref!.to).toBe('id');
    });

    it('hub_people references hub_attachments on avatar_attachment_id', () => {
      const fks = listForeignKeys(adapter, 'hub_people');
      const ref = fks.find((fk) => fk.from === 'avatar_attachment_id');
      expect(ref, 'hub_people must FK avatar_attachment_id to hub_attachments').toBeDefined();
      expect(ref!.table).toBe('hub_attachments');
      expect(ref!.to).toBe('id');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test C — createHubTables is idempotent
  // ─────────────────────────────────────────────────────────────────────────

  describe('idempotency', () => {
    it('calling createHubTables twice does not throw', () => {
      // db already has tables from createHubTestDatabase().
      expect(() => createHubTables(adapter)).not.toThrow();
    });

    it('table count is unchanged between repeated calls', () => {
      const before = listHubTables(adapter);
      createHubTables(adapter);
      const after = listHubTables(adapter);
      expect(after).toEqual(before);
    });

    it('Phase 1a tables are still present after repeated calls', () => {
      createHubTables(adapter);
      createHubTables(adapter);
      const actual = new Set(listHubTables(adapter));
      for (const name of ALL_PHASE1A_TABLES) {
        expect(actual).toContain(name);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bonus — indexes exist for hot read paths
  // ─────────────────────────────────────────────────────────────────────────

  describe('indexes', () => {
    const EXPECTED_INDEXES = [
      'hub_attachment_links_entity_idx',
      'hub_reminders_fire_idx',
      'hub_body_metrics_at_idx',
      'hub_places_geo_idx',
      'hub_events_range_idx',
      'hub_cost_events_at_idx',
      'hub_timeline_at_idx',
      'hub_timeline_mod_idx',
      'hub_ai_audit_log_at_idx',
    ];

    it('creates all Phase 1a hub_%_idx indexes', () => {
      const indexNames = new Set(
        adapter
          .query<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'hub_%_idx'",
          )
          .map((row) => row.name),
      );
      for (const name of EXPECTED_INDEXES) {
        expect(indexNames, `missing index: ${name}`).toContain(name);
      }
    });
  });
});
