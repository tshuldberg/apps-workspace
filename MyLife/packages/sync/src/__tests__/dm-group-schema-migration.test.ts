/**
 * sync_workspaces workspace_type CHECK upgrade (Plan 21 Phase 6 review fix).
 *
 * Phase 6 added 'dm_group' to the workspace_type CHECK in the CREATE TABLE DDL,
 * but an install created BEFORE that change already has the old CHECK baked into
 * its sync_workspaces table, and CREATE TABLE IF NOT EXISTS is a no-op on it. On
 * such a device a group DM create/receive throws a constraint violation. Every
 * other test uses a fresh db (new CHECK), so only this upgrade-path test catches
 * it. migrateSyncSchema rebuilds the table, preserving existing rows.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { createSyncTables, migrateSyncSchema } from '../db/schema';

const OLD_SYNC_WORKSPACES = `
CREATE TABLE sync_workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  workspace_type TEXT NOT NULL CHECK (workspace_type IN ('personal','group','community')) DEFAULT 'personal',
  created_by_device_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rotated_at TEXT,
  current_key_version INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT
)`;

const insertDmGroup = (db: InMemoryTestDatabase, id: string): void =>
  db.adapter.execute(
    `INSERT INTO sync_workspaces (id, display_name, workspace_type, created_by_device_id, created_at)
     VALUES (?, 'Trip crew', 'dm_group', 'dev-a', '2026-07-02T00:00:00.000Z')`,
    [id],
  );

describe('migrateSyncSchema: workspace_type dm_group upgrade', () => {
  let db: InMemoryTestDatabase;
  afterEach(() => { db.close(); });

  it('rebuilds a pre-dm_group sync_workspaces, preserving rows, so dm_group inserts', () => {
    db = createInMemoryTestDatabase();
    // Simulate a pre-Phase-6 install: the old CHECK, with a real personal row.
    db.adapter.execute(OLD_SYNC_WORKSPACES);
    db.adapter.execute(
      `INSERT INTO sync_workspaces (id, display_name, workspace_type, created_by_device_id, created_at, current_key_version)
       VALUES ('w1', 'Personal', 'personal', 'dev-a', '2026-07-01T00:00:00.000Z', 3)`,
    );

    // The bug: before the migration, a dm_group insert violates the old CHECK.
    expect(() => insertDmGroup(db, 'w2')).toThrow();

    migrateSyncSchema(db.adapter);

    // The existing row survived the rebuild (id + type + key version preserved).
    const rows = db.adapter.query<{ id: string; workspace_type: string; current_key_version: number }>(
      'SELECT id, workspace_type, current_key_version FROM sync_workspaces',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'w1', workspace_type: 'personal', current_key_version: 3 });

    // The fix: a dm_group workspace now inserts cleanly.
    expect(() => insertDmGroup(db, 'w2')).not.toThrow();
  });

  it('is idempotent: a second run does not drop rows or throw', () => {
    db = createInMemoryTestDatabase();
    db.adapter.execute(OLD_SYNC_WORKSPACES);
    migrateSyncSchema(db.adapter);
    insertDmGroup(db, 'w2');
    // Second run: the CHECK is already current, so it must be a no-op.
    expect(() => migrateSyncSchema(db.adapter)).not.toThrow();
    const after = db.adapter.query<{ c: number }>('SELECT COUNT(*) as c FROM sync_workspaces');
    expect(after[0]!.c).toBe(1);
  });

  it('is a no-op on a fresh createSyncTables db (CHECK already lists dm_group)', () => {
    db = createInMemoryTestDatabase();
    createSyncTables(db.adapter);
    migrateSyncSchema(db.adapter);
    expect(() => insertDmGroup(db, 'w1')).not.toThrow();
  });
});
