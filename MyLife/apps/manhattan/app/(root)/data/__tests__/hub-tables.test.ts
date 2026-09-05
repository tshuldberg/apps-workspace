import { describe, expect, it } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '@mylife/manhattan';
import { attemptUnlock, enableModuleLock, getModuleLock } from '@mylife/auth';
import { ensureStandaloneHubTables } from '../hub-tables';

function openDb() {
  return createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
}

describe('ensureStandaloneHubTables', () => {
  it('creates every hub table the standalone app touches', () => {
    const { adapter, close } = openDb();
    ensureStandaloneHubTables(adapter);
    const names = adapter
      .query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hub_%' ORDER BY name`,
      )
      .map((r) => r.name);
    expect(names).toContain('hub_module_versions');
    expect(names).toContain('hub_entitlement_cache');
    expect(names).toContain('hub_module_locks');
    close();
  });

  it('is idempotent', () => {
    const { adapter, close } = openDb();
    ensureStandaloneHubTables(adapter);
    expect(() => ensureStandaloneHubTables(adapter)).not.toThrow();
    close();
  });

  // Regression for the production-eval Critical (F1): getModuleLock ran a bare
  // SELECT against hub_module_locks, which the standalone DatabaseProvider
  // never created, crashing ManhattanLockGuard the moment the app unlocked.
  it('lets getModuleLock run without throwing when no lock is configured', () => {
    const { adapter, close } = openDb();
    ensureStandaloneHubTables(adapter);
    expect(getModuleLock(adapter, 'manhattan')).toBeNull();
    close();
  });

  it('supports the full PIN lock lifecycle', { timeout: 30000 }, async () => {
    const { adapter, close } = openDb();
    ensureStandaloneHubTables(adapter);

    await enableModuleLock(adapter, 'manhattan', '1234');
    expect(getModuleLock(adapter, 'manhattan')).not.toBeNull();

    const wrong = await attemptUnlock(adapter, 'manhattan', '9999');
    expect(wrong.status).toBe('invalid');

    const right = await attemptUnlock(adapter, 'manhattan', '1234');
    expect(right.status).toBe('unlocked');
    close();
  });
});
