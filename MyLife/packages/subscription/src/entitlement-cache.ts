import type { ModuleId } from '@mylife/module-registry';
import { FREE_MODULES } from '@mylife/module-registry';
import type { EntitlementState } from '@mylife/entitlements';
import { isModuleUnlocked } from '@mylife/entitlements';

// ---------------------------------------------------------------------------
// Entitlement cache backed by hub_entitlement_cache SQLite table
// ---------------------------------------------------------------------------

/** Minimal database adapter (mirrors @mylife/db EntitlementCacheDb). */
export interface EntitlementCacheDb {
  execute(sql: string, params?: unknown[]): void;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  transaction(fn: () => void): void;
}

/** Source of the entitlement decision. */
export type EntitlementSource = 'revenuecat' | 'stripe' | 'free';

/** A single cached entitlement row. */
export interface CachedEntitlement {
  moduleId: string;
  entitled: boolean;
  source: EntitlementSource;
  cachedAt: string;
  expiresAt: string | null;
}

/** Shape of a row from hub_entitlement_cache. */
interface EntitlementCacheRow {
  module_id: string;
  entitled: number;
  source: string;
  cached_at: string;
  expires_at: string | null;
}

/** Default cache TTL: 24 hours. */
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const FREE_MODULE_SET = new Set<ModuleId>(FREE_MODULES);

/**
 * Entitlement cache that persists resolved entitlements to SQLite.
 *
 * This ensures premium modules remain accessible during network outages
 * (R2.5, R2.9). On network failure, the cache is used as a fallback
 * rather than revoking access.
 */
export class EntitlementCache {
  private db: EntitlementCacheDb;
  private cacheTtlMs: number;

  constructor(db: EntitlementCacheDb, cacheTtlMs: number = DEFAULT_CACHE_TTL_MS) {
    this.db = db;
    this.cacheTtlMs = cacheTtlMs;
  }

  /**
   * Persist the resolved entitlement state for all known modules.
   * Called after successfully resolving entitlements from a purchase provider.
   */
  persistState(
    allModuleIds: readonly ModuleId[],
    state: EntitlementState,
    source: EntitlementSource,
  ): void {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.cacheTtlMs).toISOString();

    this.db.transaction(() => {
      for (const moduleId of allModuleIds) {
        const entitled = isModuleUnlocked(moduleId, state);
        const entitlementSource = FREE_MODULE_SET.has(moduleId) ? 'free' : source;

        this.db.execute(
          `INSERT INTO hub_entitlement_cache (module_id, entitled, source, cached_at, expires_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (module_id) DO UPDATE SET
             entitled = excluded.entitled,
             source = excluded.source,
             cached_at = excluded.cached_at,
             expires_at = excluded.expires_at`,
          [moduleId, entitled ? 1 : 0, entitlementSource, now, expiresAt],
        );
      }
    });
  }

  /**
   * Load cached entitlement for a single module.
   * Returns null if no cache entry exists or if it has expired.
   */
  getCachedEntitlement(moduleId: string): CachedEntitlement | null {
    const rows = this.db.query<EntitlementCacheRow>(
      `SELECT module_id, entitled, source, cached_at, expires_at
       FROM hub_entitlement_cache
       WHERE module_id = ?
       LIMIT 1`,
      [moduleId],
    );

    if (rows.length === 0) return null;
    const row = rows[0];

    // Check expiry
    if (row.expires_at && Date.now() > Date.parse(row.expires_at)) {
      return null;
    }

    return {
      moduleId: row.module_id,
      entitled: row.entitled === 1,
      source: row.source as EntitlementSource,
      cachedAt: row.cached_at,
      expiresAt: row.expires_at,
    };
  }

  /**
   * Load all cached entitlements.
   * Excludes expired entries.
   */
  getAllCachedEntitlements(): CachedEntitlement[] {
    const now = new Date().toISOString();
    const rows = this.db.query<EntitlementCacheRow>(
      `SELECT module_id, entitled, source, cached_at, expires_at
       FROM hub_entitlement_cache
       WHERE expires_at IS NULL OR expires_at > ?`,
      [now],
    );

    return rows.map((row) => ({
      moduleId: row.module_id,
      entitled: row.entitled === 1,
      source: row.source as EntitlementSource,
      cachedAt: row.cached_at,
      expiresAt: row.expires_at,
    }));
  }

  /**
   * Build an EntitlementState from cached data.
   * Used as fallback when the purchase provider is unreachable (R2.9).
   */
  buildStateFromCache(): EntitlementState {
    const cached = this.getAllCachedEntitlements();
    const unlockedModules = new Set<ModuleId>();
    let hubUnlocked = false;

    for (const entry of cached) {
      if (entry.entitled) {
        unlockedModules.add(entry.moduleId as ModuleId);
      }
    }

    // If every non-free module in cache is entitled, infer hub unlock
    // This is a heuristic: if 15+ premium modules are cached as entitled,
    // the user almost certainly had hub unlock active.
    const premiumEntitled = cached.filter(
      (e) => e.entitled && e.source !== 'free',
    );
    if (premiumEntitled.length >= 15) {
      hubUnlocked = true;
    }

    return {
      hubUnlocked,
      unlockedModules,
      storageTier: 'free',
      updateEntitled: false,
      purchaseDate: null,
    };
  }

  /** Clear all cached entitlements. */
  clear(): void {
    this.db.execute('DELETE FROM hub_entitlement_cache');
  }
}
