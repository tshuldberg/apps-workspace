/**
 * Intercepts SQLite writes and records them to the sync change log.
 *
 * The tracker maps table names to owning modules using prefix matching,
 * generates unique IDs for each change record, and persists them via
 * the database adapter.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleEntitySyncRule, ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { ChangeRecord } from '../types';
import {
  insertChangeRecord,
  getUnsyncedChanges,
  getUnsyncedChangesByModule,
  markChangesSynced,
} from '../db/queries';

export interface ChangeTrackerOptions {
  db: DatabaseAdapter;
  deviceId: string;
  /** Module ID to table prefix mapping (e.g., { books: 'bk_', budget: 'bg_' }) */
  modulePrefixes: Map<string, string>;
  /** Per-module sync policies for scope enforcement and column stripping. */
  modulePolicies?: Map<string, ModuleSyncPolicy>;
  /** Module IDs backed by cloud storage (supabase/drizzle) that must stay device_local. */
  cloudModules?: Set<string>;
  /** Callback when a change is recorded */
  onChangeRecorded?: (record: ChangeRecord) => void;
}

/** Generate a simple ULID-like ID from timestamp + random suffix. */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Tracks SQLite write operations and records them as ChangeRecords
 * for outbound sync. Call recordChange() after every INSERT/UPDATE/DELETE.
 */
export class ChangeTracker {
  private db: DatabaseAdapter;
  private deviceId: string;
  private modulePrefixes: Map<string, string>;
  private modulePolicies: Map<string, ModuleSyncPolicy>;
  private cloudModules: Set<string>;
  private onChangeRecorded?: (record: ChangeRecord) => void;

  constructor(options: ChangeTrackerOptions) {
    this.db = options.db;
    this.deviceId = options.deviceId;
    this.modulePrefixes = options.modulePrefixes;
    this.modulePolicies = options.modulePolicies ?? new Map();
    this.cloudModules = options.cloudModules ?? new Set();
    this.onChangeRecorded = options.onChangeRecorded;
  }

  /**
   * Record a change that was made to SQLite.
   * Call this after every INSERT/UPDATE/DELETE.
   */
  /**
   * Resolve whether a change may leave this device and the column-filtered row
   * that is allowed onto the wire. The SINGLE source of truth for outbound
   * scope/column policy: used both for the change log AND for what the engine
   * reflects into the sync document, so device_local rows and stripColumns
   * columns can never leak through the document layer (closes the 2026-06-12
   * audit outbound-leak finding).
   */
  filterForSync(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    data: Record<string, unknown> | null,
  ): { moduleId: string | null; include: boolean; data: Record<string, unknown> | null } {
    const moduleId = this.resolveModule(table);
    if (!moduleId) return { moduleId: null, include: false, data: null };

    // Cloud modules (supabase/drizzle) must stay device_local only.
    if (this.cloudModules.has(moduleId)) return { moduleId, include: false, data: null };

    const policy = this.modulePolicies.get(moduleId);
    const entityRule = policy ? this.resolveEntityRule(moduleId, table, policy) : null;
    const defaultScope = entityRule?.defaultScope ?? policy?.defaultScope;

    // Entity-level and module-level device_local data never leaves the device.
    if (defaultScope === 'device_local' || entityRule?.maxScope === 'device_local') {
      return { moduleId, include: false, data: null };
    }

    // Strip policy columns before anything is synced.
    let filteredData = data;
    if (policy && filteredData && operation !== 'DELETE'
      && entityRule?.stripColumns && entityRule.stripColumns.length > 0) {
      filteredData = { ...filteredData };
      for (const col of entityRule.stripColumns) {
        delete filteredData[col];
      }
    }

    return { moduleId, include: true, data: filteredData };
  }

  recordChange(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    rowId: string,
    data: Record<string, unknown> | null,
  ): void {
    const { moduleId, include, data: filteredData } = this.filterForSync(table, operation, data);
    if (!moduleId || !include) return;

    const record: ChangeRecord = {
      id: generateId(),
      moduleId,
      tableName: table,
      operation,
      rowId,
      dataJson: filteredData ? JSON.stringify(filteredData) : null,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      synced: false,
      createdAt: new Date().toISOString(),
    };

    insertChangeRecord(this.db, record);

    if (this.onChangeRecorded) {
      this.onChangeRecorded(record);
    }
  }

  /**
   * Resolve which module owns a table by its prefix.
   * Matches the longest prefix first to avoid ambiguity.
   */
  resolveModule(tableName: string): string | null {
    let bestMatch: string | null = null;
    let bestPrefixLength = 0;

    for (const [moduleId, prefix] of this.modulePrefixes) {
      if (tableName.startsWith(prefix) && prefix.length > bestPrefixLength) {
        bestMatch = moduleId;
        bestPrefixLength = prefix.length;
      }
    }

    return bestMatch;
  }

  /**
   * Resolve entity rules against both canonical table names and prefixed
   * physical SQLite names. Module definitions usually use unprefixed names.
   */
  resolveEntityRule(
    moduleId: string,
    tableName: string,
    policy: ModuleSyncPolicy,
  ): ModuleEntitySyncRule | null {
    const prefix = this.modulePrefixes.get(moduleId) ?? '';
    const unprefixed = prefix && tableName.startsWith(prefix)
      ? tableName.slice(prefix.length)
      : tableName;

    return policy.entityRules.find((rule) => (
      rule.tableName === tableName
      || rule.tableName === unprefixed
      || (prefix.length > 0 && `${prefix}${rule.tableName}` === tableName)
    )) ?? null;
  }

  /** Get unsynced changes. */
  getUnsynced(limit?: number): ChangeRecord[] {
    return getUnsyncedChanges(this.db, limit);
  }

  /** Get unsynced changes for a specific module. */
  getUnsyncedByModule(moduleId: string, limit?: number): ChangeRecord[] {
    return getUnsyncedChangesByModule(this.db, moduleId, limit);
  }

  /** Mark changes as synced. */
  markSynced(ids: string[]): void {
    markChangesSynced(this.db, ids);
  }

  /** Get total pending change count. */
  getPendingCount(): number {
    const rows = this.db.query<{ c: number }>(
      'SELECT COUNT(*) as c FROM sync_change_log WHERE synced = 0',
    );
    return rows[0]?.c ?? 0;
  }
}
