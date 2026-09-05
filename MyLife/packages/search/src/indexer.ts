/**
 * Search indexer.
 *
 * Builds and maintains the hub_search_index FTS5 table by calling
 * getSearchableContent() on each enabled module's crossModule interface.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleDefinition, SearchableItem } from '@mylife/module-registry';

/**
 * Ensure the search index tables exist.
 * Safe to call multiple times (uses IF NOT EXISTS).
 */
export function ensureSearchTables(db: DatabaseAdapter): void {
  // Inline DDL to avoid circular import with schema.ts re-exports
  db.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS hub_search_index USING fts5(
      module_id,
      item_id,
      item_type,
      title,
      content,
      updated_at UNINDEXED,
      tokenize='porter unicode61'
    );
  `);
  db.execute(`
    CREATE TABLE IF NOT EXISTS hub_search_meta (
      module_id TEXT PRIMARY KEY NOT NULL,
      indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
      item_count INTEGER NOT NULL DEFAULT 0
    );
  `);
}

/**
 * Index all searchable content from a single module.
 * Replaces any existing entries for this module (full re-index).
 */
export function indexModule(
  db: DatabaseAdapter,
  module: ModuleDefinition,
): number {
  const crossModule = module.crossModule;
  if (!crossModule?.getSearchableContent) return 0;

  let items: SearchableItem[];
  try {
    items = crossModule.getSearchableContent(db);
  } catch {
    return 0;
  }

  db.transaction(() => {
    // Remove old entries for this module
    db.execute(
      `DELETE FROM hub_search_index WHERE module_id = ?`,
      [module.id],
    );

    // Insert new entries
    for (const item of items) {
      const content = [item.body ?? '', ...(item.tags ?? [])].join(' ').trim();
      db.execute(
        `INSERT INTO hub_search_index (module_id, item_id, item_type, title, content, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.moduleId, item.itemId, item.type, item.title, content, item.updatedAt],
      );
    }

    // Update meta
    db.execute(
      `INSERT INTO hub_search_meta (module_id, indexed_at, item_count)
       VALUES (?, datetime('now'), ?)
       ON CONFLICT(module_id) DO UPDATE SET indexed_at = datetime('now'), item_count = ?`,
      [module.id, items.length, items.length],
    );
  });

  return items.length;
}

/**
 * Index all enabled modules that implement getSearchableContent.
 * Returns a map of module ID to number of items indexed.
 */
export function indexAllModules(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
): Map<string, number> {
  ensureSearchTables(db);
  const results = new Map<string, number>();
  for (const mod of modules) {
    const count = indexModule(db, mod);
    if (count > 0) {
      results.set(mod.id, count);
    }
  }
  return results;
}

/**
 * Remove all search index entries for a module.
 * Called when a module is disabled.
 */
export function removeModuleFromIndex(
  db: DatabaseAdapter,
  moduleId: string,
): void {
  db.transaction(() => {
    db.execute(`DELETE FROM hub_search_index WHERE module_id = ?`, [moduleId]);
    db.execute(`DELETE FROM hub_search_meta WHERE module_id = ?`, [moduleId]);
  });
}

/**
 * Incrementally update search entries for specific items.
 * More efficient than full re-index for single-item changes.
 */
export function updateSearchEntries(
  db: DatabaseAdapter,
  items: SearchableItem[],
): void {
  if (items.length === 0) return;

  db.transaction(() => {
    for (const item of items) {
      // Remove old entry for this specific item
      db.execute(
        `DELETE FROM hub_search_index WHERE module_id = ? AND item_id = ?`,
        [item.moduleId, item.itemId],
      );

      // Insert updated entry
      const content = [item.body ?? '', ...(item.tags ?? [])].join(' ').trim();
      db.execute(
        `INSERT INTO hub_search_index (module_id, item_id, item_type, title, content, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.moduleId, item.itemId, item.type, item.title, content, item.updatedAt],
      );
    }
  });
}

/**
 * Remove specific items from the search index.
 */
export function removeSearchEntries(
  db: DatabaseAdapter,
  entries: Array<{ moduleId: string; itemId: string }>,
): void {
  if (entries.length === 0) return;

  db.transaction(() => {
    for (const entry of entries) {
      db.execute(
        `DELETE FROM hub_search_index WHERE module_id = ? AND item_id = ?`,
        [entry.moduleId, entry.itemId],
      );
    }
  });
}

/** Result of index coverage validation. */
export interface IndexCoverageResult {
  indexed: string[];
  missing: string[];
  isComplete: boolean;
}

/**
 * Validate that all enabled modules implementing getSearchableContent
 * are present in the search index (R23.4).
 * Returns which modules are indexed vs missing.
 */
export function validateIndexCoverage(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
): IndexCoverageResult {
  const searchable = modules.filter(
    (m) => m.crossModule?.getSearchableContent,
  );

  const metaRows = db.query<Record<string, unknown>>(
    'SELECT module_id FROM hub_search_meta',
  );
  const indexedSet = new Set(metaRows.map((r) => String(r.module_id)));

  const indexed: string[] = [];
  const missing: string[] = [];

  for (const mod of searchable) {
    if (indexedSet.has(mod.id)) {
      indexed.push(mod.id);
    } else {
      missing.push(mod.id);
    }
  }

  return { indexed, missing, isComplete: missing.length === 0 };
}

/**
 * Ensure all enabled modules with getSearchableContent are indexed.
 * Re-indexes any missing modules. Returns the coverage result.
 */
export function ensureFullCoverage(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
): IndexCoverageResult {
  ensureSearchTables(db);
  const coverage = validateIndexCoverage(db, modules);
  if (!coverage.isComplete) {
    const missingSet = new Set(coverage.missing);
    for (const mod of modules) {
      if (missingSet.has(mod.id)) {
        const count = indexModule(db, mod);
        if (count > 0) {
          coverage.indexed.push(mod.id);
        }
      }
    }
    coverage.missing = coverage.missing.filter(
      (id) => !coverage.indexed.includes(id),
    );
    coverage.isComplete = coverage.missing.length === 0;
  }
  return coverage;
}
