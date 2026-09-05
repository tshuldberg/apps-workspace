/**
 * Migration runner for the MyLife hub database.
 *
 * Tracks per-module schema versions in hub_schema_versions.
 * Only runs pending migrations for the specified module.
 * Each module's pending migration batch is wrapped in a transaction.
 */

import type { DatabaseAdapter, Migration } from './adapter';
import { createHubTables } from './hub-schema';
import { disableModule } from './hub-queries';

export interface ModuleMigrationTarget {
  moduleId: string;
  migrations?: Migration[];
}

export interface ModuleMigrationExecutionResult {
  moduleId: string;
  appliedMigrations: number;
  status: 'applied' | 'skipped' | 'failed';
  error?: Error;
}

export interface RunIsolatedModuleMigrationsOptions {
  disableFailedModules?: boolean;
  logger?: Pick<Console, 'error' | 'warn'>;
  onModuleStart?: (context: {
    moduleId: string;
    moduleIndex: number;
    totalModules: number;
    completedModules: number;
  }) => Promise<void> | void;
  onModuleFailed?: (moduleId: string, error: Error) => void;
}

export interface RunIsolatedModuleMigrationsResult {
  results: ModuleMigrationExecutionResult[];
  totalAppliedMigrations: number;
  failedModuleIds: string[];
}

/**
 * Tracks which adapter instances have already had `prepareMigrationInfrastructure`
 * run. Memoizing guards against double-init costs and any race where two
 * concurrent migration callers both attempt PRAGMA + hub table creation
 * against the same adapter. WeakSet drops the reference automatically when the
 * adapter is garbage-collected (e.g. test teardown).
 */
const preparedAdapters = new WeakSet<DatabaseAdapter>();

function prepareMigrationInfrastructure(db: DatabaseAdapter): void {
  if (preparedAdapters.has(db)) return;
  db.execute('PRAGMA foreign_keys = ON;');
  createHubTables(db);
  preparedAdapters.add(db);
}

/**
 * Validate that a module's migrations form a contiguous, strictly increasing
 * version sequence starting at 1. A gap (e.g. versions [1, 3] missing 2) means
 * a migration was deleted or renumbered — silently running [1, 3] would leave
 * the DB in an invalid intermediate state.
 */
function assertMigrationsContiguous(
  moduleId: string,
  migrations: Migration[],
): void {
  if (migrations.length === 0) return;
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  for (let index = 0; index < sorted.length; index += 1) {
    const expected = index + 1;
    const actual = sorted[index].version;
    if (actual !== expected) {
      throw new Error(
        `[MyLife] Migration gap in module "${moduleId}": expected version ${expected} but found ${actual}. ` +
          `Migrations must be contiguous starting at 1. Ensure no migration versions were deleted or renumbered.`,
      );
    }
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Get the current schema version for a module.
 * Returns 0 if no migrations have been applied yet.
 */
function getModuleVersion(db: DatabaseAdapter, moduleId: string): number {
  const rows = db.query<{ version: number }>(
    `SELECT MAX(version) as version FROM hub_schema_versions WHERE module_id = ?`,
    [moduleId],
  );
  return rows[0]?.version ?? 0;
}

/**
 * Record that a migration version was applied for a module.
 */
function recordVersion(
  db: DatabaseAdapter,
  moduleId: string,
  version: number,
): void {
  db.execute(
    `INSERT INTO hub_schema_versions (module_id, version) VALUES (?, ?)`,
    [moduleId, version],
  );
}

/**
 * Run all pending migrations for a specific module.
 *
 * Ensures hub tables exist first, then checks hub_schema_versions
 * to determine which migrations are pending. Each migration is
 * executed inside a transaction.
 *
 * @param db - Database adapter
 * @param moduleId - Module identifier (e.g. 'hub', 'mybooks', 'mybudget')
 * @param migrations - Ordered list of migrations for this module
 * @returns Number of migrations applied
 */
export function runModuleMigrations(
  db: DatabaseAdapter,
  moduleId: string,
  migrations: Migration[],
): number {
  prepareMigrationInfrastructure(db);
  assertMigrationsContiguous(moduleId, migrations);

  const currentVersion = getModuleVersion(db, moduleId);
  const pending = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((left, right) => left.version - right.version);

  if (pending.length === 0) return 0;

  let applied = 0;
  db.transaction(() => {
    for (const migration of pending) {
      for (const sql of migration.up) {
        db.execute(sql);
      }
      recordVersion(db, moduleId, migration.version);
      applied++;
    }
  });

  return applied;
}

/**
 * Run migrations across multiple modules while isolating failures to the
 * affected module. A failed module is disabled in hub_enabled_modules and the
 * remaining module batches continue to run.
 */
export async function runIsolatedModuleMigrations(
  db: DatabaseAdapter,
  modules: readonly ModuleMigrationTarget[],
  options: RunIsolatedModuleMigrationsOptions = {},
): Promise<RunIsolatedModuleMigrationsResult> {
  prepareMigrationInfrastructure(db);

  const runnableModules = modules.filter(
    (
      module,
    ): module is ModuleMigrationTarget & { migrations: Migration[] } =>
      Array.isArray(module.migrations) && module.migrations.length > 0,
  );
  const logger = options.logger ?? console;
  const results: ModuleMigrationExecutionResult[] = [];
  let completedModules = 0;
  let totalAppliedMigrations = 0;

  for (let index = 0; index < runnableModules.length; index += 1) {
    const { moduleId, migrations } = runnableModules[index];
    await options.onModuleStart?.({
      moduleId,
      moduleIndex: index + 1,
      totalModules: runnableModules.length,
      completedModules,
    });

    try {
      const appliedMigrations = runModuleMigrations(db, moduleId, migrations);
      totalAppliedMigrations += appliedMigrations;
      results.push({
        moduleId,
        appliedMigrations,
        status: appliedMigrations > 0 ? 'applied' : 'skipped',
      });
    } catch (error) {
      const normalizedError = toError(error);

      if (options.disableFailedModules ?? true) {
        try {
          disableModule(db, moduleId);
        } catch (disableError) {
          logger.warn(
            `[MyLife] Failed to disable module "${moduleId}" after migration error:`,
            disableError,
          );
        }
      }

      logger.error(
        `[MyLife] Migration failed for module "${moduleId}":`,
        normalizedError,
      );
      options.onModuleFailed?.(moduleId, normalizedError);
      results.push({
        moduleId,
        appliedMigrations: 0,
        status: 'failed',
        error: normalizedError,
      });
    }

    completedModules += 1;
  }

  const failedModuleIds = results
    .filter((result) => result.status === 'failed')
    .map((result) => result.moduleId);

  if (failedModuleIds.length > 0) {
    logger.warn(
      `[MyLife] ${failedModuleIds.length} module migration(s) failed. Affected modules were disabled and the remaining migrations continued.`,
    );
  }

  return {
    results,
    totalAppliedMigrations,
    failedModuleIds,
  };
}

/**
 * Initialize the hub database with its own schema.
 * Hub tables use the module_id 'hub' for version tracking.
 *
 * @returns Object with the final version and number of migrations applied
 */
export function initializeHubDatabase(db: DatabaseAdapter): {
  version: number;
  migrationsApplied: number;
} {
  // Hub tables are created via createHubTables (IF NOT EXISTS),
  // so the "hub" module's migration is just ensuring they exist.
  const HUB_MIGRATION: Migration = {
    version: 1,
    description: 'Create hub infrastructure tables',
    up: [], // Tables created by createHubTables above
    down: [],
  };

  prepareMigrationInfrastructure(db);

  const currentVersion = getModuleVersion(db, 'hub');
  if (currentVersion >= 1) {
    return { version: currentVersion, migrationsApplied: 0 };
  }

  // Record hub v1 in schema_versions
  db.transaction(() => {
    recordVersion(db, 'hub', HUB_MIGRATION.version);
  });

  return { version: 1, migrationsApplied: 1 };
}
