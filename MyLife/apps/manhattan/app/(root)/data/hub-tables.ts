// Standalone hub-table bootstrap.
//
// Shared @mylife packages (auth module-lock, subscription entitlement cache)
// assume the hub schema bootstrap ran, but the standalone app owns its own
// database init, so every hub_ table a shared package touches must be created
// here explicitly. Missing entries crash at the first query (see the
// 2026-06-09 production eval, finding F1: hub_module_locks).
import {
  CREATE_HUB_ENTITLEMENT_CACHE,
  CREATE_HUB_MODULE_LOCKS,
  type DatabaseAdapter,
} from '@mylife/db';

// App-owned migration ledger: one current schema version per module.
const CREATE_HUB_MODULE_VERSIONS = `
CREATE TABLE IF NOT EXISTS hub_module_versions (
  module_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export function ensureStandaloneHubTables(db: DatabaseAdapter): void {
  db.execute(CREATE_HUB_MODULE_VERSIONS);
  db.execute(CREATE_HUB_ENTITLEMENT_CACHE);
  db.execute(CREATE_HUB_MODULE_LOCKS);
}
