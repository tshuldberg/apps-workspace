// Shared test helpers: the Node sql.js wasm locator and IndexedDB reset.
//
// In Node there is no bundler, so sql.js cannot find its `.wasm` by URL. We
// resolve it from node_modules and hand it to the adapter via `locateFile`.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { closeMeerkatIdb, resetMeerkatIdbCache } from '../idb';
import { resetSqlJsCache } from '../load-sqljs';
import type { LocateFile } from '../load-sqljs';

const require = createRequire(import.meta.url);

/** Resolve sql.js's bundled wasm directory from node_modules. */
export function nodeLocateFile(): LocateFile {
  const distDir = dirname(require.resolve('sql.js/dist/sql-wasm.js'));
  return (file: string) => join(distDir, file);
}

/**
 * Reset all module-level caches and clear the fake-indexeddb databases so each
 * test starts from a clean durable layer.
 */
export async function resetDurableLayer(): Promise<void> {
  // Close any live connection first so deleteDatabase does not block on it.
  await closeMeerkatIdb();
  resetMeerkatIdbCache();
  resetSqlJsCache();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('meerkat-web');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'));
    req.onblocked = () => resolve();
  });
}
