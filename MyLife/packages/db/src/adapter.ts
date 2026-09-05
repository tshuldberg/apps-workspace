/**
 * Database adapter interface and migration types for the MyLife hub.
 *
 * The DatabaseAdapter interface mirrors MyBooks' pattern so that
 * module-level code can share the same adapter across hub and module databases.
 * Both expo-sqlite (mobile) and better-sqlite3 (web) implement this interface.
 */

/**
 * Minimal database adapter interface.
 * Implementations wrap expo-sqlite or better-sqlite3.
 */
export interface DatabaseAdapter {
  /** Execute a single SQL statement with optional parameters. */
  execute(sql: string, params?: unknown[]): void;
  /** Execute a SQL query and return all rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  /** Run a function inside a transaction. Rolls back on error. */
  transaction(fn: () => void): void;
}

/**
 * A single migration for a module (or the hub itself).
 * Each migration has an incrementing version and up/down SQL statements.
 */
export interface Migration {
  version: number;
  description: string;
  /** SQL statements to apply this migration. */
  up: string[];
  /** SQL statements to revert this migration. */
  down: string[];
}
