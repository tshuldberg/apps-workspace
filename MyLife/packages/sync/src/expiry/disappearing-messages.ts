import type { DatabaseAdapter } from '@mylife/db';
import type { ChangeRecord, SyncExpiringEntity } from '../types';
import {
  deleteExpiringEntity,
  getExpiredEntities,
  upsertExpiringEntity,
} from '../db/queries';

export const DEFAULT_DISAPPEARING_MESSAGE_TABLES = new Set([
  'hub_friend_messages',
  'fr_messages_cache',
  'fr_direct_messages',
  'mk_messages',
  'mk_messages_cache',
  'mk_secure_messages',
  'rv_messages',
]);

export interface PruneExpiredEntitiesOptions {
  nowIso?: string;
  allowedTables?: ReadonlySet<string>;
  primaryKeyColumns?: Record<string, string>;
}

function isSqlIdentifier(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function addSeconds(iso: string, seconds: number): string {
  const base = new Date(iso);
  const start = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
  return new Date(start + seconds * 1000).toISOString();
}

export function isDisappearingMessageTable(
  tableName: string,
  allowedTables: ReadonlySet<string> = DEFAULT_DISAPPEARING_MESSAGE_TABLES,
): boolean {
  return allowedTables.has(tableName);
}

export function createExpiringEntityFromChange(
  change: Pick<ChangeRecord, 'moduleId' | 'tableName' | 'rowId' | 'createdAt' | 'operation'>,
  disappearAfterSeconds: number,
): SyncExpiringEntity | null {
  if (change.operation === 'DELETE') return null;
  if (!isDisappearingMessageTable(change.tableName)) return null;
  if (!Number.isFinite(disappearAfterSeconds) || disappearAfterSeconds <= 0) return null;

  return {
    moduleId: change.moduleId,
    tableName: change.tableName,
    rowId: change.rowId,
    expiresAt: addSeconds(change.createdAt, Math.floor(disappearAfterSeconds)),
    deleteAfterSync: true,
    createdAt: new Date().toISOString(),
  };
}

export function recordExpiringEntitiesForChanges(
  db: DatabaseAdapter,
  changes: Array<Pick<ChangeRecord, 'moduleId' | 'tableName' | 'rowId' | 'createdAt' | 'operation'>>,
  disappearAfterSeconds: number | null,
): number {
  if (!disappearAfterSeconds) return 0;

  let recorded = 0;
  for (const change of changes) {
    const entity = createExpiringEntityFromChange(change, disappearAfterSeconds);
    if (!entity) continue;
    upsertExpiringEntity(db, entity);
    recorded += 1;
  }
  return recorded;
}

export function pruneExpiredEntities(
  db: DatabaseAdapter,
  options: PruneExpiredEntitiesOptions = {},
): { deleted: number; skipped: number } {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const allowedTables = options.allowedTables ?? DEFAULT_DISAPPEARING_MESSAGE_TABLES;
  const primaryKeyColumns = options.primaryKeyColumns ?? {};
  const expired = getExpiredEntities(db, nowIso);

  let deleted = 0;
  let skipped = 0;

  for (const entity of expired) {
    const primaryKeyColumn = primaryKeyColumns[entity.tableName] ?? 'id';
    const canDelete = entity.deleteAfterSync
      && allowedTables.has(entity.tableName)
      && isSqlIdentifier(entity.tableName)
      && isSqlIdentifier(primaryKeyColumn);

    if (!canDelete) {
      skipped += 1;
      continue;
    }

    db.transaction(() => {
      db.execute(`DELETE FROM ${entity.tableName} WHERE ${primaryKeyColumn} = ?`, [entity.rowId]);
      deleteExpiringEntity(db, entity.moduleId, entity.tableName, entity.rowId);
    });
    deleted += 1;
  }

  return { deleted, skipped };
}
