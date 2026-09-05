import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleLockConfig } from '../types';

// ── Row Mapper ────────────────────────────────────────────────────────

function rowToLockConfig(row: Record<string, unknown>): ModuleLockConfig {
  return {
    isEnabled: (row.is_enabled as number) === 1,
    method: (row.method as ModuleLockConfig['method']) ?? null,
    lockTimeoutSeconds: row.lock_timeout_seconds as number,
    failedAttempts: row.failed_attempts as number,
    lockedUntil: (row.locked_until as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────

export function getLockConfig(db: DatabaseAdapter): ModuleLockConfig | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_module_lock WHERE id = 'singleton'`,
  );
  return rows.length > 0 ? rowToLockConfig(rows[0]) : null;
}

export function setLockConfig(
  db: DatabaseAdapter,
  config: {
    isEnabled: boolean;
    method: string | null;
    lockTimeoutSeconds: number;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO mo_module_lock (id, is_enabled, method, lock_timeout_seconds, created_at, updated_at)
     VALUES ('singleton', ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       is_enabled = excluded.is_enabled,
       method = excluded.method,
       lock_timeout_seconds = excluded.lock_timeout_seconds,
       updated_at = excluded.updated_at`,
    [config.isEnabled ? 1 : 0, config.method, config.lockTimeoutSeconds, now, now],
  );
}

export function incrementFailedAttempts(db: DatabaseAdapter): number {
  const current = getLockConfig(db);
  const newCount = (current?.failedAttempts ?? 0) + 1;
  const now = new Date().toISOString();

  if (!current) {
    db.execute(
      `INSERT INTO mo_module_lock (id, is_enabled, failed_attempts, updated_at, created_at)
       VALUES ('singleton', 0, ?, ?, ?)`,
      [newCount, now, now],
    );
  } else {
    db.execute(
      `UPDATE mo_module_lock SET failed_attempts = ?, updated_at = ? WHERE id = 'singleton'`,
      [newCount, now],
    );
  }

  return newCount;
}

export function resetFailedAttempts(db: DatabaseAdapter): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE mo_module_lock SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = 'singleton'`,
    [now],
  );
}

export function setLockedUntil(db: DatabaseAdapter, lockedUntil: string): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE mo_module_lock SET locked_until = ?, updated_at = ? WHERE id = 'singleton'`,
    [lockedUntil, now],
  );
}

export function disableLock(db: DatabaseAdapter): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE mo_module_lock SET is_enabled = 0, failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = 'singleton'`,
    [now],
  );
}
