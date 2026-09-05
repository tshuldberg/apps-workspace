// The single place where sql.js WASM loading diverges between Node and browser.
//
// sql.js loads `sql-wasm.wasm` at runtime through a `locateFile` callback. In a
// Vite browser build the bundler rewrites the `?url` import to the hashed asset
// URL; in Node (the contract tests) there is no bundler, so the test boot helper
// passes an explicit `locateFile` that resolves the file from node_modules. The
// rest of the codebase never touches this concern.

import type { SqlJsStatic } from 'sql.js';

export type LocateFile = (file: string) => string;

type InitSqlJs = (config?: { locateFile?: LocateFile }) => Promise<SqlJsStatic>;

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/**
 * Resolve sql.js's init factory across module-interop shapes. The factory is
 * imported DYNAMICALLY (never as a top-level `import x from 'sql.js'`): the dev
 * server serves sql.js's browser entry without a clean `default` ESM export, so a
 * static default import throws at module-evaluation time and takes the whole app
 * down before React mounts. A dynamic import keeps any interop quirk inside this
 * function, and `mod.default ?? mod` handles both the bundled (default) and the
 * raw-CJS-namespace shapes. Node tests and the production build resolve different
 * sql.js entries, which is why this only ever bit the browser dev path.
 */
async function importInitSqlJs(): Promise<InitSqlJs> {
  const mod = (await import('sql.js')) as unknown as Record<string, unknown>;
  // sql.js's entry shape varies by resolver/condition: the browser dev entry
  // (sql-wasm-browser.js) exposes the factory as the named export `Module`
  // (`exports.Module = initSqlJs`, no default); Node resolves sql-wasm.js where
  // it lands on `default`; bundlers may nest one under the other. Pick the first
  // CALLABLE candidate across these shapes rather than assuming `default`.
  const m = mod as {
    default?: unknown;
    Module?: unknown;
  } & Record<string, unknown>;
  const nestedDefault = m.default as { default?: unknown; Module?: unknown } | undefined;
  const candidates = [m, m.default, m.Module, nestedDefault?.default, nestedDefault?.Module];
  const factory = candidates.find((c): c is InitSqlJs => typeof c === 'function');
  if (!factory) {
    const shape = `top=${typeof mod}[${Object.keys(mod).join(',')}] default=${typeof m.default}` +
      (m.default && typeof m.default === 'object'
        ? `[${Object.keys(m.default as object).join(',')}]`
        : '');
    throw new Error(`sql.js did not resolve to a callable init factory: ${shape}`);
  }
  return factory;
}

/**
 * Initialize (once) and return the sql.js module. Pass `locateFile` from Node
 * tests; in the browser it is omitted and the bundled wasm URL is used.
 */
export function loadSqlJs(locateFile?: LocateFile): Promise<SqlJsStatic> {
  if (sqlJsPromise) return sqlJsPromise;
  sqlJsPromise = Promise.all([importInitSqlJs(), resolveLocateFile(locateFile)]).then(
    ([initSqlJs, resolved]) => initSqlJs(resolved ? { locateFile: resolved } : undefined),
  );
  return sqlJsPromise;
}

async function resolveLocateFile(locateFile?: LocateFile): Promise<LocateFile | undefined> {
  if (locateFile) return locateFile;
  // Browser path: Vite resolves the bundled wasm asset URL. Guarded so the Node
  // test bundle (which has no `import.meta.env`) never evaluates the `?url`
  // import; tests always pass an explicit `locateFile`.
  if (typeof window !== 'undefined') {
    const wasmUrl = (await import('sql.js/dist/sql-wasm.wasm?url')).default;
    return () => wasmUrl;
  }
  return undefined;
}

/** Test hook: drop the cached module so a fresh `loadSqlJs` runs. */
export function resetSqlJsCache(): void {
  sqlJsPromise = null;
}
