/**
 * Smoke tests for the mobile auto-backup scheduler.
 *
 * Verifies the core scheduling rules:
 * - Dedupe: two back-to-back calls produce exactly one auto-backup.
 * - autoEnabled=false short-circuits.
 * - Retention (maxDaily) is respected across multiple daily cadences.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  createHubTestDatabase,
  createBackup,
  listBackupsByType,
  setBackupConfig,
  type DatabaseAdapter,
  type BackupPlatformOps,
  type InMemoryTestDatabase,
} from '@mylife/db';

// ---------------------------------------------------------------------------
// Mock expo modules before importing anything that transitively imports them.
// The scheduler imports `../backup` which imports `expo-file-system/legacy`,
// `expo-sharing`, `expo-document-picker`, and `expo-sqlite`.
// ---------------------------------------------------------------------------

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
  copyAsync: vi.fn(async () => {}),
  deleteAsync: vi.fn(async () => {}),
  getInfoAsync: vi.fn(async () => ({ exists: true, size: 1024, isDirectory: false })),
  makeDirectoryAsync: vi.fn(async () => {}),
}));

// Mock `../backup` so the scheduler uses an in-memory BackupPlatformOps
// implementation instead of the real expo-file-system wrapper.
const mockFiles = new Map<string, number>();

vi.mock('../backup', () => {
  const createMobileBackupOps = (): BackupPlatformOps => ({
    async copyDatabase(destinationPath: string): Promise<number> {
      const size = 4096;
      mockFiles.set(destinationPath, size);
      return size;
    },
    async restoreDatabase(sourcePath: string): Promise<void> {
      if (!mockFiles.has(sourcePath)) {
        throw new Error(`Backup file not found: ${sourcePath}`);
      }
    },
    async deleteFile(filePath: string): Promise<void> {
      mockFiles.delete(filePath);
    },
    getBackupPath(backupId: string): string {
      return `/mock/backups/${backupId}.db`;
    },
  });
  return { createMobileBackupOps };
});

// Import after mocks are registered.
import { checkAndCreateAutoBackup } from '../backup-scheduler';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mobile auto-backup scheduler', () => {
  let testDb: InMemoryTestDatabase;
  let db: DatabaseAdapter;

  beforeEach(() => {
    testDb = createHubTestDatabase();
    db = testDb.adapter;
    mockFiles.clear();
  });

  afterEach(() => {
    testDb.close();
  });

  it('creates exactly one auto-backup when called twice in a row', async () => {
    setBackupConfig(db, { autoEnabled: true });

    await checkAndCreateAutoBackup(db);
    await checkAndCreateAutoBackup(db);

    const autoBackups = listBackupsByType(db, 'auto');
    expect(autoBackups).toHaveLength(1);
    expect(autoBackups[0]!.type).toBe('auto');
  });

  it('does nothing when autoEnabled is false', async () => {
    setBackupConfig(db, { autoEnabled: false });

    await checkAndCreateAutoBackup(db);

    expect(listBackupsByType(db, 'auto')).toHaveLength(0);
  });

  it('creates the first backup when no prior auto-backups exist', async () => {
    setBackupConfig(db, { autoEnabled: true });
    expect(listBackupsByType(db, 'auto')).toHaveLength(0);

    await checkAndCreateAutoBackup(db);

    const autoBackups = listBackupsByType(db, 'auto');
    expect(autoBackups).toHaveLength(1);
  });

  it('skips when last auto-backup is newer than 24h', async () => {
    setBackupConfig(db, { autoEnabled: true });

    // Insert a recent auto-backup directly into the table.
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    db.execute(
      `INSERT INTO hub_backups (id, created_at, size_bytes, module_count, label, backup_type, file_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['existing-auto', recent, 1024, 0, null, 'auto', '/mock/backups/existing-auto.db'],
    );

    await checkAndCreateAutoBackup(db);

    const autoBackups = listBackupsByType(db, 'auto');
    expect(autoBackups).toHaveLength(1);
    expect(autoBackups[0]!.id).toBe('existing-auto');
  });

  it('respects retention policy (maxDaily) when creating new auto-backups', async () => {
    // Set a tight retention so we can observe pruning behaviour.
    setBackupConfig(db, { autoEnabled: true, maxDaily: 2, maxWeekly: 0 });

    // Seed 3 old auto-backups from previous days so the new one pushes total
    // past maxDaily and forces a prune.
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    for (let i = 0; i < 3; i++) {
      const createdAt = new Date(now - (i + 2) * day).toISOString();
      const id = `old-auto-${i}`;
      db.execute(
        `INSERT INTO hub_backups (id, created_at, size_bytes, module_count, label, backup_type, file_path)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, createdAt, 1024, 0, null, 'auto', `/mock/backups/${id}.db`],
      );
      mockFiles.set(`/mock/backups/${id}.db`, 1024);
    }
    expect(listBackupsByType(db, 'auto')).toHaveLength(3);

    await checkAndCreateAutoBackup(db);

    // After scheduler runs: newest + one older kept, rest pruned => exactly
    // maxDaily entries remain.
    const remaining = listBackupsByType(db, 'auto');
    expect(remaining).toHaveLength(2);
  });

  it('swallows errors from createBackup so caller can fire-and-forget', async () => {
    setBackupConfig(db, { autoEnabled: true });

    // Corrupt the backup table by dropping a required column to force an
    // insert failure inside createBackup.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    db.execute(`DROP TABLE hub_backups`);

    await expect(checkAndCreateAutoBackup(db)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  // Demonstrate that createBackup + platformOps still works for manual flows,
  // so we know the test fixtures mirror production wiring.
  it('harness sanity: createBackup directly produces one manual row', async () => {
    const { createMobileBackupOps } = await import('../backup');
    const ops = createMobileBackupOps();

    const result = await createBackup(db, ops, { type: 'manual' });
    expect(result.backup.type).toBe('manual');
    expect(listBackupsByType(db, 'auto')).toHaveLength(0);
  });
});
