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
  createMobileBackupOps,
  getBackupDir,
  getDatabasePath,
} from '../backup';

// ---------------------------------------------------------------------------
// Mock expo-file-system so we can test createMobileBackupOps without a device
// ---------------------------------------------------------------------------

const mockFileSystem: Record<string, { size: number; content: string }> = {};

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(async () => {}),
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(async () => ({ canceled: true, assets: [] })),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseSync: vi.fn(() => ({
    getAllSync: vi.fn(() => []),
    runSync: vi.fn(),
    withTransactionSync: vi.fn((fn: () => void) => fn()),
    closeSync: vi.fn(),
  })),
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/documents/',
  copyAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
    const source = mockFileSystem[from];
    if (!source) throw new Error(`File not found: ${from}`);
    mockFileSystem[to] = { ...source };
  }),
  deleteAsync: vi.fn(async (path: string) => {
    delete mockFileSystem[path];
  }),
  getInfoAsync: vi.fn(async (path: string) => {
    const file = mockFileSystem[path];
    if (file) return { exists: true, size: file.size, isDirectory: false };
    return { exists: false, size: 0, isDirectory: false };
  }),
  makeDirectoryAsync: vi.fn(async () => {}),
}));

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

describe('mobile backup', () => {
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
    Object.keys(mockFileSystem).forEach((k) => delete mockFileSystem[k]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createBackup
  // ─────────────────────────────────────────────────────────────────────────

  describe('createBackup', () => {
    it('creates a manual backup and records metadata', async () => {
      const result = await createBackup(db, ops, {
        type: 'manual',
        label: 'Before big change',
      });

      expect(result.backup.type).toBe('manual');
      expect(result.backup.label).toBe('Before big change');
      expect(result.backup.sizeBytes).toBeGreaterThan(0);
      expect(result.backup.moduleCount).toBe(0); // no modules enabled
      expect(result.backup.filePath).toContain('.db');
      expect(result.pruned).toBe(0);

      // File should exist in mock ops
      expect(ops.files.has(result.backup.filePath)).toBe(true);
    });

    it('creates an auto backup with module count', async () => {
      // Enable some modules
      db.execute(
        `INSERT INTO hub_enabled_modules (module_id) VALUES ('books'), ('budget')`,
      );

      const result = await createBackup(db, ops, { type: 'auto' });

      expect(result.backup.type).toBe('auto');
      expect(result.backup.moduleCount).toBe(2);
      expect(result.backup.label).toBeNull();
    });

    it('generates unique IDs for each backup', async () => {
      const r1 = await createBackup(db, ops, { type: 'manual' });
      const r2 = await createBackup(db, ops, { type: 'manual' });

      expect(r1.backup.id).not.toBe(r2.backup.id);
    });

    it('uses a provided ID when given', async () => {
      const result = await createBackup(db, ops, {
        type: 'manual',
        id: 'custom-id-123',
      });

      expect(result.backup.id).toBe('custom-id-123');
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
      await createBackup(db, ops, { type: 'manual', id: 'first' });
      await createBackup(db, ops, { type: 'auto', id: 'second' });
      await createBackup(db, ops, { type: 'manual', id: 'third' });

      const backups = listBackups(db);
      expect(backups).toHaveLength(3);
      const ids = backups.map((b) => b.id).sort();
      expect(ids).toEqual(['first', 'second', 'third']);
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
      expect(autoOnly[0]!.type).toBe('auto');
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
      await createBackup(db, ops, { type: 'manual', id: 'test-1' });

      const backup = getBackup(db, 'test-1');
      expect(backup).not.toBeNull();
      expect(backup!.id).toBe('test-1');
      expect(backup!.type).toBe('manual');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteBackup
  // ─────────────────────────────────────────────────────────────────────────

  describe('deleteBackup', () => {
    it('returns false for non-existent backup', async () => {
      const deleted = await deleteBackup(db, ops, 'nonexistent');
      expect(deleted).toBe(false);
    });

    it('deletes backup record and file', async () => {
      await createBackup(db, ops, { type: 'manual', id: 'to-delete' });
      expect(ops.files.size).toBeGreaterThan(0);

      const deleted = await deleteBackup(db, ops, 'to-delete');
      expect(deleted).toBe(true);
      expect(getBackup(db, 'to-delete')).toBeNull();
      // File removed from mock fs
      expect(ops.files.has('/mock/backups/to-delete.db')).toBe(false);
    });

    it('removes only the target backup, not others', async () => {
      await createBackup(db, ops, { type: 'manual', id: 'keep' });
      await createBackup(db, ops, { type: 'manual', id: 'remove' });

      await deleteBackup(db, ops, 'remove');

      expect(getBackup(db, 'keep')).not.toBeNull();
      expect(getBackup(db, 'remove')).toBeNull();
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
        `INSERT INTO hub_enabled_modules (module_id) VALUES ('books'), ('meds')`,
      );
      await createBackup(db, ops, { type: 'manual', id: 'restore-me' });

      const result = await restoreFromBackup(db, ops, 'restore-me');

      expect(result.backupId).toBe('restore-me');
      expect(result.moduleCount).toBe(2);
      expect(result.restoredFrom).toBeTruthy();
    });

    it('throws when backup file is missing from disk', async () => {
      await createBackup(db, ops, { type: 'manual', id: 'orphaned' });
      // Remove the file but keep the DB record
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
      expect(config.maxDaily).toBe(7); // unchanged default
      expect(config.maxWeekly).toBe(4); // unchanged default
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
  // retention / pruning
  // ─────────────────────────────────────────────────────────────────────────

  describe('retention pruning', () => {
    it('prunes auto backups beyond maxDaily limit', async () => {
      setBackupConfig(db, { maxDaily: 3, maxWeekly: 0 });

      // Create 5 auto backups
      for (let i = 0; i < 5; i++) {
        await createBackup(db, ops, { type: 'auto', id: `auto-${i}` });
      }

      const remaining = listBackupsByType(db, 'auto');
      expect(remaining.length).toBeLessThanOrEqual(3);
    });

    it('never prunes manual backups', async () => {
      setBackupConfig(db, { maxDaily: 1, maxWeekly: 0 });

      // Create many manual backups
      for (let i = 0; i < 10; i++) {
        await createBackup(db, ops, { type: 'manual', id: `manual-${i}` });
      }

      const manuals = listBackupsByType(db, 'manual');
      expect(manuals).toHaveLength(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createMobileBackupOps (expo-file-system integration)
  // ─────────────────────────────────────────────────────────────────────────

  describe('createMobileBackupOps', () => {
    it('generates backup path under documents/backups/', () => {
      const mobileOps = createMobileBackupOps();
      const path = mobileOps.getBackupPath('abc-123');
      expect(path).toBe('/mock/documents/backups/abc-123.db');
    });

    it('getBackupDir returns documents/backups/', () => {
      expect(getBackupDir()).toBe('/mock/documents/backups/');
    });

    it('getDatabasePath returns SQLite subdirectory path', () => {
      expect(getDatabasePath()).toBe('/mock/documents/SQLite/mylife-hub.db');
    });

    it('copyDatabase copies the db file and returns size', async () => {
      // Seed a mock source file at the database path
      mockFileSystem['/mock/documents/SQLite/mylife-hub.db'] = {
        size: 8192,
        content: 'mock-db',
      };

      const mobileOps = createMobileBackupOps();
      const size = await mobileOps.copyDatabase('/mock/documents/backups/test.db');

      expect(size).toBe(8192);
    });

    it('restoreDatabase copies backup over live db', async () => {
      mockFileSystem['/mock/documents/backups/restore.db'] = {
        size: 4096,
        content: 'backup-data',
      };

      const mobileOps = createMobileBackupOps();
      await expect(
        mobileOps.restoreDatabase('/mock/documents/backups/restore.db'),
      ).resolves.toBeUndefined();
    });

    it('restoreDatabase throws when backup file is missing', async () => {
      const mobileOps = createMobileBackupOps();
      await expect(
        mobileOps.restoreDatabase('/mock/documents/backups/missing.db'),
      ).rejects.toThrow('Backup file not found');
    });

    it('deleteFile removes a file', async () => {
      mockFileSystem['/mock/documents/backups/old.db'] = {
        size: 1024,
        content: 'old',
      };

      const mobileOps = createMobileBackupOps();
      await mobileOps.deleteFile('/mock/documents/backups/old.db');

      expect(mockFileSystem['/mock/documents/backups/old.db']).toBeUndefined();
    });

    it('deleteFile is a no-op for non-existent files', async () => {
      const mobileOps = createMobileBackupOps();
      await expect(
        mobileOps.deleteFile('/mock/documents/backups/nope.db'),
      ).resolves.toBeUndefined();
    });
  });
});
