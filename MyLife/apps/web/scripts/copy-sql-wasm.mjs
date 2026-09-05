// Copy sql.js's WebAssembly binary into public/ so the browser sync bootstrap
// can locate it at runtime via `/sql-wasm.wasm` (see lib/sync/load-sqljs.ts).
//
// Next.js (webpack / Turbopack) has no Vite-style `?url` asset import for wasm,
// so the file is served as a plain static asset. Runs on predev + prebuild.

import { createRequire } from 'node:module';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');

try {
  // Resolve sql.js's dist next to its package.json inside node_modules.
  const pkgJson = require.resolve('sql.js/package.json');
  const dist = join(dirname(pkgJson), 'dist');
  // Both the UMD loader (sql-wasm.js) and its wasm binary are served as static
  // assets. The loader is injected as a <script> at runtime (see
  // lib/sync/load-sqljs.ts) so sql.js never enters the webpack graph (its
  // top-level fs/path/crypto refs would otherwise fail to resolve in a browser
  // bundle). The loader fetches the wasm from the same public path.
  const assets = ['sql-wasm.js', 'sql-wasm.wasm'];
  mkdirSync(publicDir, { recursive: true });
  for (const asset of assets) {
    const src = join(dist, asset);
    if (!existsSync(src)) {
      process.stderr.write(`[copy-sql-wasm] sql.js asset not found at ${src}\n`);
      process.exit(0);
    }
    copyFileSync(src, join(publicDir, asset));
    process.stdout.write(`[copy-sql-wasm] copied ${src} -> ${join(publicDir, asset)}\n`);
  }
} catch (err) {
  // Non-fatal: sync is an enhancement; a missing wasm only disables sync, it
  // must never break the build. The provider degrades to honest "unavailable".
  process.stderr.write(`[copy-sql-wasm] skipped: ${err?.message ?? err}\n`);
  process.exit(0);
}
