import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '@mylife/bestchef';
import { buildBestChefDataExport, serializeBestChefDataExport } from '../data-export';

describe('BestChef device data export', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('aggregates user content tables and redacts sensitive settings', () => {
    db.execute(`INSERT INTO rc_recipes (id, title, image_uri) VALUES (?, ?, ?)`, [
      'r1',
      'Pad Thai',
      null,
    ]);
    db.execute(`INSERT INTO rc_settings (key, value) VALUES (?, ?)`, ['profile_handle', 'chef']);
    db.execute(`INSERT INTO rc_settings (key, value) VALUES (?, ?)`, ['sync_secret', 'super-secret']);

    const data = buildBestChefDataExport(db, {
      exportedAt: '2026-05-29T00:00:00Z',
      fullAccountExportUrl: 'https://bestchef.app/data-deletion',
    });

    expect(data._meta.app).toBe('BestChef');
    expect(data._meta.exportedAt).toBe('2026-05-29T00:00:00Z');
    expect(data._meta.fullAccountExportUrl).toBe('https://bestchef.app/data-deletion');
    expect(data.tables.rc_recipes).toHaveLength(1);
    expect(data.tables.rc_recipes[0]).toMatchObject({ id: 'r1', title: 'Pad Thai' });
    expect(data.settings.profile_handle).toBe('chef');
    expect(data.settings.sync_secret).toBe('[redacted]');
    // rc_settings is surfaced through `settings`, never dumped as a raw table.
    expect(data.tables.rc_settings).toBeUndefined();
  });

  it('serializes to valid pretty JSON', () => {
    const data = buildBestChefDataExport(db, {
      exportedAt: 'now',
      fullAccountExportUrl: 'https://bestchef.app/data-deletion',
    });
    const json = serializeBestChefDataExport(data);
    expect(() => JSON.parse(json) as unknown).not.toThrow();
    expect(json).toContain('"app": "BestChef"');
  });

  it('exports seeded default settings without redacting non-sensitive keys', () => {
    const data = buildBestChefDataExport(db, {
      exportedAt: 'now',
      fullAccountExportUrl: 'https://bestchef.app/data-deletion',
    });
    expect(data.settings.defaultServings).toBe('4');
    expect(data.settings.measurementSystem).toBe('us');
    expect(typeof data.tables).toBe('object');
  });
});
