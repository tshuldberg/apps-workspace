import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';

describe('manhattan migrations', () => {
  it('creates all mh_ tables', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const rows = adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'mh_%' ORDER BY name`,
    );
    expect(rows.map((r) => r.name)).toEqual([
      'mh_event_facets',
      'mh_events',
      'mh_pins',
      'mh_plan_members',
      'mh_plans',
      'mh_settings',
      'mh_source_cache',
      'mh_sources',
    ]);
    close();
  });

  it('seeds default settings', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const row = adapter.query<{ value: string }>(
      `SELECT value FROM mh_settings WHERE key = 'defaultCity'`,
    );
    expect(row[0]?.value).toBe('New York');
    close();
  });

  it('applies migration v2 partial unique index for external upserts', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const idx = adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='index' AND name = 'mh_events_source_ext_idx'`,
    );
    expect(idx).toHaveLength(1);
    close();
  });
});
