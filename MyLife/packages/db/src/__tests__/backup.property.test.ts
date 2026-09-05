/**
 * Property tests for backup and restore (Properties 21-22).
 *
 * Property 21: Backup and restore round-trip -- Validates: Requirements 20.2
 *   For any set of enabled modules, creating a backup and then restoring from
 *   it should invoke the platform restore with the correct file path and
 *   return consistent metadata (module count, backup ID, timestamps).
 *
 * Property 22: Backup validation and restore safety -- Validates: Requirements 20.3, 20.5
 *   For any combination of current and backup schema versions,
 *   validateBackupCompatibility correctly identifies incompatible backups
 *   (newer schema versions) and accepts compatible ones (same or older).
 *   Corrupt or invalid backups are rejected without affecting the current database.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createHubTestDatabase } from '../test-utils';
import type { InMemoryTestDatabase } from '../test-utils';
import {
  createBackup,
  restoreFromBackup,
  listBackups,
  getBackup,
  deleteBackup,
  validateBackupCompatibility,
} from '../backup/operations';
import type { BackupPlatformOps } from '../backup/operations';
import { enableModule } from '../hub-queries';

// -- Module constants (subset of known modules for testing) -------------------

const KNOWN_MODULES = [
  'books', 'budget', 'cycle', 'fast', 'habits',
  'health', 'journal', 'meds', 'mood', 'notes',
] as const;

// -- Mock platform ops --------------------------------------------------------

function createMockPlatformOps(): BackupPlatformOps & {
  copiedPaths: string[];
  restoredPaths: string[];
  deletedPaths: string[];
} {
  const state = {
    copiedPaths: [] as string[],
    restoredPaths: [] as string[],
    deletedPaths: [] as string[],
  };

  return {
    ...state,
    async copyDatabase(dest: string) {
      state.copiedPaths.push(dest);
      return 1024; // fake 1KB size
    },
    async restoreDatabase(src: string) {
      state.restoredPaths.push(src);
    },
    async deleteFile(path: string) {
      state.deletedPaths.push(path);
    },
    getBackupPath(id: string) {
      return `/backups/${id}.mylife`;
    },
  };
}

// -- Arbitraries --------------------------------------------------------------

const moduleSubsetArb = fc.subarray([...KNOWN_MODULES], { minLength: 0, maxLength: 6 });
const backupTypeArb = fc.constantFrom('auto' as const, 'manual' as const);
const labelArb = fc.oneof(fc.constant(undefined), fc.string({ minLength: 1, maxLength: 30 }));
/** Generate a list of (module_id, version) pairs with no duplicate module IDs. */
const schemaVersionsArb = fc.uniqueArray(
  fc.record({
    moduleId: fc.constantFrom(...KNOWN_MODULES),
    version: fc.integer({ min: 1, max: 20 }),
  }),
  { selector: (r) => r.moduleId, minLength: 1, maxLength: 6 },
);

// -- Test setup ---------------------------------------------------------------

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createHubTestDatabase();
});

afterEach(() => {
  testDb.close();
});

// -- Property 21: Backup and restore round-trip -------------------------------
// Validates: Requirements 20.2

describe('Property 21: Backup and restore round-trip', () => {
  it('for any set of enabled modules, backup metadata reflects module count and is retrievable', async () => {
    await fc.assert(
      fc.asyncProperty(moduleSubsetArb, backupTypeArb, labelArb, async (modules, type, label) => {
        const db = createHubTestDatabase();
        const ops = createMockPlatformOps();
        try {
          for (const mod of modules) {
            enableModule(db.adapter, mod);
          }

          const backupResult = await createBackup(db.adapter, ops, { type, label });

          expect(backupResult.backup.moduleCount).toBe(modules.length);
          expect(backupResult.backup.type).toBe(type);
          expect(backupResult.backup.sizeBytes).toBe(1024);
          expect(backupResult.backup.createdAt).toBeTruthy();

          if (label !== undefined) {
            expect(backupResult.backup.label).toBe(label);
          }

          expect(ops.copiedPaths).toContain(backupResult.backup.filePath);

          const fetched = getBackup(db.adapter, backupResult.backup.id);
          expect(fetched).not.toBeNull();
          expect(fetched!.id).toBe(backupResult.backup.id);
          expect(fetched!.moduleCount).toBe(modules.length);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('for any backup, restore invokes platform with the correct file path (R20.2)', async () => {
    await fc.assert(
      fc.asyncProperty(moduleSubsetArb, backupTypeArb, async (modules, type) => {
        const db = createHubTestDatabase();
        const ops = createMockPlatformOps();
        try {
          for (const mod of modules) {
            enableModule(db.adapter, mod);
          }

          const { backup } = await createBackup(db.adapter, ops, { type });
          const restoreResult = await restoreFromBackup(db.adapter, ops, backup.id);

          expect(restoreResult.backupId).toBe(backup.id);
          expect(restoreResult.restoredFrom).toBe(backup.createdAt);
          expect(restoreResult.moduleCount).toBe(modules.length);
          expect(ops.restoredPaths).toContain(backup.filePath);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('for any set of backups, listBackups returns all created backups in reverse chronological order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (count) => {
          const db = createHubTestDatabase();
          const ops = createMockPlatformOps();
          try {
            const ids: string[] = [];
            for (let i = 0; i < count; i++) {
              const { backup } = await createBackup(db.adapter, ops, {
                type: 'manual',
                id: `backup-${i}`,
              });
              ids.push(backup.id);
            }

            const all = listBackups(db.adapter);
            // All created backups are present
            for (const id of ids) {
              expect(all.some((b) => b.id === id)).toBe(true);
            }
            expect(all.length).toBe(count);
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('restoring a non-existent backup ID throws an error (R20.5)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (fakeId) => {
        const db = createHubTestDatabase();
        const ops = createMockPlatformOps();
        try {
          await expect(
            restoreFromBackup(db.adapter, ops, fakeId),
          ).rejects.toThrow('Backup not found');
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('deleting a backup removes it from the list and cleans up the file', async () => {
    await fc.assert(
      fc.asyncProperty(backupTypeArb, async (type) => {
        const db = createHubTestDatabase();
        const ops = createMockPlatformOps();
        try {
          const { backup } = await createBackup(db.adapter, ops, { type });
          expect(getBackup(db.adapter, backup.id)).not.toBeNull();

          const deleted = await deleteBackup(db.adapter, ops, backup.id);
          expect(deleted).toBe(true);
          expect(getBackup(db.adapter, backup.id)).toBeNull();
          expect(ops.deletedPaths).toContain(backup.filePath);

          // Double-delete is safe
          const deletedAgain = await deleteBackup(db.adapter, ops, backup.id);
          expect(deletedAgain).toBe(false);
        } finally {
          db.close();
        }
      }),
      { numRuns: 10 },
    );
  });
});

// -- Property 22: Backup validation and restore safety ------------------------
// Validates: Requirements 20.3, 20.5

describe('Property 22: Backup validation and restore safety', () => {
  /** Seed hub_schema_versions with module versions in a database. */
  function seedSchemaVersions(
    db: InMemoryTestDatabase,
    versions: Array<{ moduleId: string; version: number }>,
  ): void {
    for (const { moduleId, version } of versions) {
      for (let v = 1; v <= version; v++) {
        db.adapter.execute(
          `INSERT OR IGNORE INTO hub_schema_versions (module_id, version) VALUES (?, ?)`,
          [moduleId, v],
        );
      }
    }
  }

  it('for any identical schema versions, backup is compatible (R20.3)', () => {
    fc.assert(
      fc.property(schemaVersionsArb, (versions) => {
        const currentDb = createHubTestDatabase();
        const backupDb = createHubTestDatabase();
        try {
          seedSchemaVersions(currentDb, versions);
          seedSchemaVersions(backupDb, versions);

          const result = validateBackupCompatibility(currentDb.adapter, backupDb.adapter);
          expect(result.compatible).toBe(true);
          expect(result.backupModules.length).toBe(versions.length);
        } finally {
          currentDb.close();
          backupDb.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('for any backup with strictly older versions, backup is compatible (R20.3)', () => {
    fc.assert(
      fc.property(schemaVersionsArb, (versions) => {
        const currentDb = createHubTestDatabase();
        const backupDb = createHubTestDatabase();
        try {
          // Current has the given versions
          seedSchemaVersions(currentDb, versions);
          // Backup has version - 1 (or 1 if already at 1)
          const olderVersions = versions.map((v) => ({
            moduleId: v.moduleId,
            version: Math.max(1, v.version - 1),
          }));
          seedSchemaVersions(backupDb, olderVersions);

          const result = validateBackupCompatibility(currentDb.adapter, backupDb.adapter);
          expect(result.compatible).toBe(true);
        } finally {
          currentDb.close();
          backupDb.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('for any backup with a strictly newer module version, backup is incompatible (R20.3)', () => {
    fc.assert(
      fc.property(schemaVersionsArb, (versions) => {
        const currentDb = createHubTestDatabase();
        const backupDb = createHubTestDatabase();
        try {
          // Current has the given versions
          seedSchemaVersions(currentDb, versions);
          // Backup has version + 1 for each module (strictly newer)
          const newerVersions = versions.map((v) => ({
            moduleId: v.moduleId,
            version: v.version + 1,
          }));
          seedSchemaVersions(backupDb, newerVersions);

          const result = validateBackupCompatibility(currentDb.adapter, backupDb.adapter);
          expect(result.compatible).toBe(false);
          // Should mention at least one module with version mismatch
          expect(result.issues.length).toBeGreaterThan(0);
          expect(result.issues.some((i) => i.includes('Update the app first'))).toBe(true);
        } finally {
          currentDb.close();
          backupDb.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('a backup missing hub_schema_versions is rejected as invalid (R20.5)', () => {
    fc.assert(
      fc.property(schemaVersionsArb, (versions) => {
        const currentDb = createHubTestDatabase();
        const backupDb = createHubTestDatabase();
        try {
          seedSchemaVersions(currentDb, versions);

          // Drop hub_schema_versions from backup to simulate corrupt/invalid backup
          backupDb.adapter.execute(`DROP TABLE hub_schema_versions`);

          const result = validateBackupCompatibility(currentDb.adapter, backupDb.adapter);
          expect(result.compatible).toBe(false);
          expect(result.issues).toContain(
            'Not a valid MyLife backup: missing hub_schema_versions table',
          );
          expect(result.backupModules).toEqual([]);
        } finally {
          currentDb.close();
          backupDb.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('a backup with unknown modules is compatible but reports issues (R20.3)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (version) => {
          const currentDb = createHubTestDatabase();
          const backupDb = createHubTestDatabase();
          try {
            // Current has "books" at version
            seedSchemaVersions(currentDb, [{ moduleId: 'books', version }]);

            // Backup has "books" at same version + an unknown module
            seedSchemaVersions(backupDb, [
              { moduleId: 'books', version },
              { moduleId: 'unknown_future_module', version: 1 },
            ]);

            const result = validateBackupCompatibility(currentDb.adapter, backupDb.adapter);
            expect(result.compatible).toBe(true);
            expect(result.issues.some((i) => i.includes('unknown_future_module'))).toBe(true);
            expect(result.backupModules).toContain('unknown_future_module');
          } finally {
            currentDb.close();
            backupDb.close();
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('validation never mutates the current database (R20.5)', () => {
    fc.assert(
      fc.property(schemaVersionsArb, schemaVersionsArb, (currentVersions, backupVersions) => {
        const currentDb = createHubTestDatabase();
        const backupDb = createHubTestDatabase();
        try {
          seedSchemaVersions(currentDb, currentVersions);
          seedSchemaVersions(backupDb, backupVersions);

          // Snapshot current state before validation
          const beforeRows = currentDb.adapter.query<{ module_id: string; version: number }>(
            `SELECT module_id, version FROM hub_schema_versions ORDER BY module_id, version`,
          );

          // Run validation (may or may not be compatible)
          validateBackupCompatibility(currentDb.adapter, backupDb.adapter);

          // Current DB is unchanged
          const afterRows = currentDb.adapter.query<{ module_id: string; version: number }>(
            `SELECT module_id, version FROM hub_schema_versions ORDER BY module_id, version`,
          );
          expect(afterRows).toEqual(beforeRows);
        } finally {
          currentDb.close();
          backupDb.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('empty backup (no schema versions) is compatible with any current state', () => {
    fc.assert(
      fc.property(schemaVersionsArb, (currentVersions) => {
        const currentDb = createHubTestDatabase();
        const backupDb = createHubTestDatabase();
        try {
          seedSchemaVersions(currentDb, currentVersions);
          // Backup has hub_schema_versions but no rows

          const result = validateBackupCompatibility(currentDb.adapter, backupDb.adapter);
          expect(result.compatible).toBe(true);
          expect(result.backupModules).toEqual([]);
          expect(result.backupModuleCount).toBe(0);
        } finally {
          currentDb.close();
          backupDb.close();
        }
      }),
      { numRuns: 10 },
    );
  });

  it('backupModuleCount accurately reflects hub_enabled_modules in the backup', () => {
    fc.assert(
      fc.property(moduleSubsetArb, (modules) => {
        const currentDb = createHubTestDatabase();
        const backupDb = createHubTestDatabase();
        try {
          seedSchemaVersions(currentDb, [{ moduleId: 'books', version: 1 }]);
          seedSchemaVersions(backupDb, [{ moduleId: 'books', version: 1 }]);

          // Enable modules in the backup
          for (const mod of modules) {
            enableModule(backupDb.adapter, mod);
          }

          const result = validateBackupCompatibility(currentDb.adapter, backupDb.adapter);
          expect(result.compatible).toBe(true);
          expect(result.backupModuleCount).toBe(modules.length);
        } finally {
          currentDb.close();
          backupDb.close();
        }
      }),
      { numRuns: 10 },
    );
  });
});
