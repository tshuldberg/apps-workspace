// sql.js loader for the hub Next.js web app.
//
// sql.js's UMD entry (dist/sql-wasm.js) references `fs`, `path`, and `crypto`
// at module scope (guarded at runtime, but webpack resolves them statically and
// fails the client bundle). apps/meerkat-web runs under Vite, whose esbuild
// browser platform stubs those refs; Next.js / webpack does not. Rather than
// edit the root next.config (out of this ticket's scope), we keep sql.js OUT of
// the webpack graph entirely: the UMD loader is copied to public/ (see
// scripts/copy-sql-wasm.mjs) and injected as a <script> tag at runtime, which
// attaches a global `initSqlJs`. The loader then fetches its wasm from the same
// public path. No bundler ever parses sql.js, so the fs/path/crypto refs never
// have to resolve.

import type { SqlJsStatic } from 'sql.js';

type LocateFile = (file: string) => string;
type InitSqlJs = (config?: { locateFile?: LocateFile }) => Promise<SqlJsStatic>;

// @types/sql.js declares a global `initSqlJs: InitSqlJsStatic`. We read it off
// globalThis after injecting the UMD loader script.
function readGlobalInit(): InitSqlJs | undefined {
  const candidate = (globalThis as { initSqlJs?: unknown }).initSqlJs;
  return typeof candidate === 'function' ? (candidate as InitSqlJs) : undefined;
}

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

const LOADER_URL = '/sql-wasm.js';
const WASM_URL = '/sql-wasm.wasm';

/** Inject the UMD loader script once and resolve its global `initSqlJs`. */
function loadInitFromScript(): Promise<InitSqlJs> {
  return new Promise<InitSqlJs>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('sql.js script loader requires a browser document.'));
      return;
    }
    const already = readGlobalInit();
    if (already) {
      resolve(already);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-sqljs="true"]`,
    );
    const onReady = () => {
      const init = readGlobalInit();
      if (init) {
        resolve(init);
      } else {
        reject(new Error('sql.js loaded but did not expose a global initSqlJs.'));
      }
    };
    if (existing) {
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener('error', () => reject(new Error('sql.js failed to load.')), {
        once: true,
      });
      // If it already finished loading before we attached, resolve now.
      if (readGlobalInit()) onReady();
      return;
    }
    const script = document.createElement('script');
    script.src = LOADER_URL;
    script.async = true;
    script.dataset.sqljs = 'true';
    script.addEventListener('load', onReady, { once: true });
    script.addEventListener('error', () => reject(new Error('sql.js failed to load.')), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

/**
 * Initialize (once) and return the sql.js module. In the browser the loader is
 * injected from public/ and the wasm is served from `/sql-wasm.wasm`. Node tests
 * pass an explicit `initFactory` (the required sql.js module) and `locateFile`.
 */
export function loadSqlJs(
  locateFile?: LocateFile,
  initFactory?: InitSqlJs,
): Promise<SqlJsStatic> {
  if (sqlJsPromise) return sqlJsPromise;
  sqlJsPromise = (async () => {
    const initSqlJs = initFactory ?? (await loadInitFromScript());
    const resolved = locateFile ?? (() => WASM_URL);
    return initSqlJs({ locateFile: resolved });
  })();
  return sqlJsPromise;
}

/** Test hook: drop the cached module so a fresh load runs. */
export function resetSqlJsCache(): void {
  sqlJsPromise = null;
}
