import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHubTestDatabase,
  type DatabaseAdapter,
  createBackup,
  restoreFromBackup,
  listBackups,
  listBackupsByType,
  getBackup,
  deleteBackup,
  getBackupConfig,
  setBackupConfig,
  type BackupPlatformOps,
} from '@mylife/db';
import {
  createWebBackupOps,
  getBackupDir,
  getDatabasePath,
  readBackupFile,
  saveUploadedBackup,
} from '../backup';

// ---------------------------------------------------------------------------
// In-memory platform ops for pure DB-layer testing
// ---------------------------------------------------------------------------

function createMockPlatformOps(): BackupPlatformOps & {
  files: Map<string, number>;
} {
  const files = new Map<string, number>();

  return {
    files,
    async copyDatabase(destinationPath: string): Promise<number> {
      const size = 4096 + Math.floor(Math.random() * 10000);
      files.set(destinationPath, size);
      return size;
    },
    async restoreDatabase(sourcePath: string): Promise<void> {
      if (!files.has(sourcePath)) {
        throw new Error(`Backup file not found: ${sourcePath}`);
      }
    },
    async deleteFile(filePath: string): Promise<void> {
      files.delete(filePath);
    },
    getBackupPath(backupId: string): string {
      return `/mock/backups/${backupId}.db`;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('web backup', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;
  let ops: ReturnType<typeof createMockPlatformOps>;

  beforeEach(() => {
    const testDb = createHubTestDatabase();
    db = testDb.adapter;
    closeDb = testDb.close;
    ops = createMockPlatformOps();
  });

  afterEach(() => {
    closeDb();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createBackup
  // ─────────────────────────────────────────────────────────────────────────

  describe('createBackup', () => {
    it('creates a manual backup and records metadata', async () => {
      const result = await createBackup(db, ops, {
        type: 'manual',
        label: 'Pre-deploy snapshot',
      });

      expect(result.backup.type).toBe('manual');
      expect(result.backup.label).toBe('Pre-deploy snapshot');
      expect(result.backup.sizeBytes).toBeGreaterThan(0);
      expect(result.backup.moduleCount).toBe(0);
      expect(result.backup.filePath).toContain('.db');
      expect(result.pruned).toBe(0);
      expect(ops.files.has(result.backup.filePath)).toBe(true);
    });

    it('creates an auto backup with module count', async () => {
      db.execute(
        `INSERT INTO hub_enabled_modules (module_id) VALUES ('books'), ('budget'), ('meds')`,
      );

      const result = await createBackup(db, ops, { type: 'auto' });

      expect(result.backup.type).toBe('auto');
      expect(result.backup.moduleCount).toBe(3);
      expect(result.backup.label).toBeNull();
    });

    it('generates unique IDs for each backup', async () => {
      const r1 = await createBackup(db, ops, { type: 'manual' });
      const r2 = await createBackup(db, ops, { type: 'manual' });

      expect(r1.backup.id).not.toBe(r2.backup.id);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // listBackups
  // ─────────────────────────────────────────────────────────────────────────

  describe('listBackups', () => {
    it('returns empty array when no backups exist', () => {
      expect(listBackups(db)).toEqual([]);
    });

    it('returns all backups regardless of type', async () => {
      await createBackup(db, ops, { type: 'manual', id: 'man-1' });
      await createBackup(db, ops, { type: 'auto', id: 'auto-1' });
      await createBackup(db, ops, { type: 'manual', id: 'man-2' });

      const backups = listBackups(db);
      expect(backups).toHaveLength(3);
      const ids = backups.map((b) => b.id).sort();
      expect(ids).toEqual(['auto-1', 'man-1', 'man-2']);
    });

    it('filters by type', async () => {
      await createBackup(db, ops, { type: 'manual', id: 'man-1' });
      await createBackup(db, ops, { type: 'auto', id: 'auto-1' });
      await createBackup(db, ops, { type: 'manual', id: 'man-2' });

      const manualOnly = listBackupsByType(db, 'manual');
      expect(manualOnly).toHaveLength(2);
      expect(manualOnly.every((b) => b.type === 'manual')).toBe(true);

      const autoOnly = listBackupsByType(db, 'auto');
      expect(autoOnly).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getBackup
  // ─────────────────────────────────────────────────────────────────────────

  describe('getBackup', () => {
    it('returns null for non-existent backup', () => {
      expect(getBackup(db, 'nonexistent')).toBeNull();
    });

    it('returns metadata for existing backup', async () => {
      await createBackup(db, ops, { type: 'manual', id: 'web-1' });

      const backup = getBackup(db, 'web-1');
      expect(backup).not.toBeNull();
      expect(backup!.id).toBe('web-1');
      expect(backup!.type).toBe('manual');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteBackup
  // ─────────────────────────────────────────────────────────────────────────

  describe('deleteBackup', () => {
    it('returns false for non-existent backup', async () => {
      expect(await deleteBackup(db, ops, 'nonexistent')).toBe(false);
    });

    it('deletes backup record and file', async () => {
      await createBackup(db, ops, { type: 'manual', id: 'to-delete' });

      const deleted = await deleteBackup(db, ops, 'to-delete');
      expect(deleted).toBe(true);
      expect(getBackup(db, 'to-delete')).toBeNull();
      expect(ops.files.has('/mock/backups/to-delete.db')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // restoreFromBackup
  // ─────────────────────────────────────────────────────────────────────────

  describe('restoreFromBackup', () => {
    it('throws for non-existent backup ID', async () => {
      await expect(
        restoreFromBackup(db, ops, 'nonexistent'),
      ).rejects.toThrow('Backup not found: nonexistent');
    });

    it('restores from a valid backup and returns metadata', async () => {
      db.execute(
        `INSERT INTO hub_enabled_modules (module_id) VALUES ('books')`,
      );
      await createBackup(db, ops, { type: 'manual', id: 'restore-me' });

      const result = await restoreFromBackup(db, ops, 'restore-me');

      expect(result.backupId).toBe('restore-me');
      expect(result.moduleCount).toBe(1);
      expect(result.restoredFrom).toBeTruthy();
    });

    it('throws when backup file is missing from disk', async () => {
      await createBackup(db, ops, { type: 'manual', id: 'orphaned' });
      ops.files.delete('/mock/backups/orphaned.db');

      await expect(
        restoreFromBackup(db, ops, 'orphaned'),
      ).rejects.toThrow('Backup file not found');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // backup config
  // ─────────────────────────────────────────────────────────────────────────

  describe('backup config', () => {
    it('returns defaults when no config is set', () => {
      const config = getBackupConfig(db);
      expect(config.maxDaily).toBe(7);
      expect(config.maxWeekly).toBe(4);
      expect(config.autoEnabled).toBe(true);
    });

    it('persists partial config updates', () => {
      setBackupConfig(db, { autoEnabled: false });
      const config = getBackupConfig(db);

      expect(config.autoEnabled).toBe(false);
      expect(config.maxDaily).toBe(7);
    });

    it('updates config on repeated writes', () => {
      setBackupConfig(db, { maxDaily: 3 });
      setBackupConfig(db, { maxWeekly: 2 });

      const config = getBackupConfig(db);
      expect(config.maxDaily).toBe(3);
      expect(config.maxWeekly).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // retention pruning
  // ─────────────────────────────────────────────────────────────────────────

  describe('retention pruning', () => {
    it('prunes auto backups beyond maxDaily limit', async () => {
      setBackupConfig(db, { maxDaily: 3, maxWeekly: 0 });

      for (let i = 0; i < 5; i++) {
        await createBackup(db, ops, { type: 'auto', id: `auto-${i}` });
      }

      const remaining = listBackupsByType(db, 'auto');
      expect(remaining.length).toBeLessThanOrEqual(3);
    });

    it('never prunes manual backups', async () => {
      setBackupConfig(db, { maxDaily: 1, maxWeekly: 0 });

      for (let i = 0; i < 10; i++) {
        await createBackup(db, ops, { type: 'manual', id: `manual-${i}` });
      }

      const manuals = listBackupsByType(db, 'manual');
      expect(manuals).toHaveLength(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createWebBackupOps (Node.js fs integration)
  // ─────────────────────────────────────────────────────────────────────────

  describe('createWebBackupOps', () => {
    let tmpDir: string;
    let dbFilePath: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mylife-backup-test-'));
      dbFilePath = path.join(tmpDir, 'mylife-hub.db');
      // Create a dummy database file
      fs.writeFileSync(dbFilePath, 'mock-sqlite-data');
      vi.stubEnv('MYLIFE_DB_PATH', dbFilePath);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('getDatabasePath respects MYLIFE_DB_PATH env var', () => {
      expect(getDatabasePath()).toBe(dbFilePath);
    });

    it('getBackupDir places backups next to the database', () => {
      expect(getBackupDir()).toBe(path.join(tmpDir, 'backups'));
    });

    it('generates backup path under backups directory', () => {
      const webOps = createWebBackupOps();
      const backupPath = webOps.getBackupPath('abc-123');
      expect(backupPath).toBe(path.join(tmpDir, 'backups', 'abc-123.db'));
    });

    it('copyDatabase copies the db file and returns size', async () => {
      const webOps = createWebBackupOps();
      const dest = path.join(tmpDir, 'backups', 'copy-test.db');
      const size = await webOps.copyDatabase(dest);

      expect(size).toBeGreaterThan(0);
      expect(fs.existsSync(dest)).toBe(true);
      expect(fs.readFileSync(dest, 'utf-8')).toBe('mock-sqlite-data');
    });

    it('restoreDatabase copies backup over live db', async () => {
      // Create a backup file
      const backupPath = path.join(tmpDir, 'backup-for-restore.db');
      fs.writeFileSync(backupPath, 'restored-data');

      const webOps = createWebBackupOps();
      await webOps.restoreDatabase(backupPath);

      expect(fs.readFileSync(dbFilePath, 'utf-8')).toBe('restored-data');
    });

    it('restoreDatabase throws when backup file is missing', async () => {
      const webOps = createWebBackupOps();
      await expect(
        webOps.restoreDatabase(path.join(tmpDir, 'nonexistent.db')),
      ).rejects.toThrow('Backup file not found');
    });

    it('deleteFile removes a file', async () => {
      const filePath = path.join(tmpDir, 'to-delete.db');
      fs.writeFileSync(filePath, 'data');

      const webOps = createWebBackupOps();
      await webOps.deleteFile(filePath);

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('deleteFile is a no-op for non-existent files', async () => {
      const webOps = createWebBackupOps();
      await expect(
        webOps.deleteFile(path.join(tmpDir, 'nope.db')),
      ).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // readBackupFile / saveUploadedBackup helpers
  // ─────────────────────────────────────────────────────────────────────────

  describe('file helpers', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mylife-backup-helpers-'));
      vi.stubEnv('MYLIFE_DB_PATH', path.join(tmpDir, 'mylife-hub.db'));
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('readBackupFile returns null for missing file', () => {
      expect(readBackupFile(path.join(tmpDir, 'missing.db'))).toBeNull();
    });

    it('readBackupFile returns Buffer for existing file', () => {
      const filePath = path.join(tmpDir, 'exists.db');
      fs.writeFileSync(filePath, 'backup-content');

      const buf = readBackupFile(filePath);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf!.toString()).toBe('backup-content');
    });

    it('saveUploadedBackup writes file and returns path', () => {
      const data = Buffer.from('uploaded-backup-data');
      const filePath = saveUploadedBackup('upload-123', data);

      expect(filePath).toContain('upload-123.db');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath).toString()).toBe('uploaded-backup-data');
    });
  });
});
