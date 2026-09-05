/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Resolve @mylife/sync's CRDT document manager to its NATIVE (plain-JSON LWW)
// variant, mirroring what Metro does on device (it resolves
// document-manager.native.ts). The default document-manager.ts pulls in
// @automerge/automerge's WASM, which (a) Vite cannot bundle without extra wasm
// plugins and (b) we deliberately do NOT use: the web node speaks the SAME LWW
// wire format as native Meerkat nodes so they interoperate over the relay. This
// alias keeps Automerge entirely out of the web bundle.
const lwwDocumentManager = fileURLToPath(
  new URL(
    '../../packages/sync/src/crdt/document-manager.native.ts',
    import.meta.url,
  ),
);

// @mylife/sync's package `main` is index.ts, which statically re-exports the
// Node-only modules (filesystem BlobStore, torrent crypto) and the Automerge
// DocumentManager. The web node is the SAME RN-safe profile as native: relay
// only, LWW document manager, no Node fs. Resolve @mylife/sync to its
// react-native entry (index.native.ts), the exact mobile-safe subset, so the
// web bundle never pulls Node builtins or Automerge. This is the honest web
// profile (it matches what the native Meerkat app ships).
const syncNativeEntry = fileURLToPath(
  new URL('../../packages/sync/src/index.native.ts', import.meta.url),
);

// Phase 1B: Vite + React shell with the MeerkatProvider UI. The browser storage
// adapters, the engine wiring, MK-001 durability, and a real relay session are
// exercised by the Node tests (incl. web-node-relay-e2e + identity-durability).
//
// sql.js ships its WebAssembly binary separately. In the browser the boot module
// resolves the bundled `.wasm` URL via `import 'sql.js/dist/sql-wasm.wasm?url'`
// (see src/lib/storage/load-sqljs.ts), so no special Vite asset config is needed.
// In Node, the tests pass an explicit `locateFile` pointing at node_modules.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Web uses the mobile-safe @mylife/sync surface (relay-only, no Node fs).
      { find: /^@mylife\/sync$/, replacement: syncNativeEntry },
      // Keep Automerge out of the web bundle: use the LWW document manager.
      // Match the whole relative specifier (./ or ../ prefixes) ending in
      // crdt/document-manager so the replacement is the full absolute path, not
      // a fragment appended to the leading dot.
      {
        find: /^(\.\.?\/)+crdt\/document-manager$/,
        replacement: lwwDocumentManager,
      },
    ],
  },
  // PRE-BUNDLE sql.js (do NOT exclude it). sql.js's browser entry assigns its
  // factory with bracket CJS (`exports["Module"] = initSqlJs`) inside a UMD
  // wrapper. If sql.js is excluded from optimizeDeps, Vite's on-the-fly CJS
  // interop cannot see that export and serves an EMPTY module namespace in dev,
  // so the app throws at boot ("not a callable init factory") even though the
  // production rollup build interops it fine. Letting esbuild pre-bundle it
  // produces a proper ESM module (default + the factory) the dev server can use.
  // The `fs`/`path`/`crypto` refs sql.js guards at runtime are stubbed by
  // esbuild's browser platform, so pre-bundling does not choke.
  optimizeDeps: {
    include: ['sql.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/packages/sync/')) return 'sync-core';
          if (id.includes('/sql.js/')) return 'sqljs-runtime';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-runtime';
          if (id.includes('/tweetnacl') || id.includes('/zod/')) return 'crypto-validation';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts'],
    setupFiles: ['./src/lib/storage/__tests__/setup.ts'],
  },
});
