import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { HEALTH_MODULE } from '../definition';
import { HEALTH_MIGRATION_V1 } from '../db/migrations';

describe('health schema', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('health', HEALTH_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('creates all 21 hl_ tables', () => {
    const tables = adapter
      .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hl_%'")
      .map((r) => r.name)
      .sort();

    expect(tables).toEqual([
      'hl_activity_summaries',
      'hl_alarm_history',
      'hl_body_measurements',
      'hl_breathing_sessions',
      'hl_cbt_entries',
      'hl_documents',
      'hl_emergency_info',
      'hl_goal_progress',
      'hl_goals',
      'hl_import_log',
      'hl_meditation_sessions',
      'hl_readiness_scores',
      'hl_settings',
      'hl_sleep_routines',
      'hl_sleep_sessions',
      'hl_smart_alarms',
      'hl_snore_events',
      'hl_snore_sessions',
      'hl_sos_sessions',
      'hl_sync_log',
      'hl_vitals',
    ]);
  });

  it('creates all indexes', () => {
    const indexes = adapter
      .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'hl_%'")
      .map((r) => r.name);

    expect(indexes.length).toBeGreaterThanOrEqual(11);
  });

  it('seeds default settings', () => {
    const settings = adapter
      .query<{ key: string }>('SELECT key FROM hl_settings')
      .map((r) => r.key);

    expect(settings).toContain('healthSync.enabled');
    expect(settings).toContain('units.weight');
    expect(settings).toContain('sleep.targetHours');
    expect(settings.length).toBe(23);
  });

  it('migration v1 has correct version and description', () => {
    expect(HEALTH_MIGRATION_V1.version).toBe(1);
    expect(HEALTH_MIGRATION_V1.description).toContain('health schema');
  });

  it('enforces vital_type CHECK constraint', () => {
    // Valid vital type
    adapter.execute(
      "INSERT INTO hl_vitals (id, vital_type, value, unit, recorded_at) VALUES ('v1', 'heart_rate', 72, 'bpm', datetime('now'))",
    );

    // Invalid vital type
    expect(() => {
      adapter.execute(
        "INSERT INTO hl_vitals (id, vital_type, value, unit, recorded_at) VALUES ('v2', 'invalid_type', 72, 'bpm', datetime('now'))",
      );
    }).toThrow();
  });

  it('enforces document type CHECK constraint', () => {
    // Valid document type
    adapter.execute(
      "INSERT INTO hl_documents (id, title, type, mime_type, file_size, content) VALUES ('d1', 'Test', 'lab_result', 'application/pdf', 1024, X'00')",
    );

    // Invalid document type
    expect(() => {
      adapter.execute(
        "INSERT INTO hl_documents (id, title, type, mime_type, file_size, content) VALUES ('d2', 'Test', 'invalid', 'application/pdf', 1024, X'00')",
      );
    }).toThrow();
  });

  it('emergency_info uses profile singleton', () => {
    adapter.execute("INSERT INTO hl_emergency_info (id) VALUES ('profile')");

    const rows = adapter.query<{ id: string }>('SELECT id FROM hl_emergency_info');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('profile');
  });
});
