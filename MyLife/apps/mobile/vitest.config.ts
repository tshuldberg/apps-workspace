import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import {
  VITEST_GLOBAL_SETUP_FILE,
  vitestBaseTestConfig,
} from '../../test/vitest/base';

export default defineConfig({
  resolve: {
    alias: {
      // Redirect lucide-react-native to a tiny CJS Proxy stub. The real
      // package ships 3000+ icon files and transitively pulls in
      // react-native-svg -> react-native (Flow-typed index.js), which hangs
      // vitest's transform pipeline before any setupFiles vi.mock can
      // intercept. The stub covers `icons`, `createLucideIcon`, and every
      // named icon import with a no-op component.
      'lucide-react-native': fileURLToPath(
        new URL('./test/stubs/lucide-react-native.cjs', import.meta.url),
      ),
      // expo-linear-gradient ships raw JSX in build/LinearGradient.js, which
      // rollup cannot parse when a vi.mock forces the transform pipeline to
      // crawl it (books suites failed to collect). Stub renders children.
      'expo-linear-gradient': fileURLToPath(
        new URL('./test/stubs/expo-linear-gradient.cjs', import.meta.url),
      ),
    },
  },
  test: {
    ...vitestBaseTestConfig,
    environment: 'jsdom',
    globals: true,
    // `forks` pool: each test file runs in a separate Node process, so any
    // jsdom/RN mock leaks in one file cannot accumulate across the suite.
    // History: `threads` with maxThreads=1 (accidentally reintroduced by
    // 93a712dc0 on 2026-04-05) crams every file into one 4GB heap and hangs
    // at end-of-run cleanup; `vmThreads` with a 512MB recycle deadlocks in
    // uv_cond_wait after ~6 files (workers die from memory pressure and the
    // master loses track). `forks` completes cleanly. Startup is slower per
    // file but reliability matters more — the full mobile suite has been
    // silently broken in CI for weeks under `threads`.
    // See docs/sessions/2026-04-19-modernization-audit.md §Mobile vitest pool.
    // Vitest 4 pool rework: former poolOptions.forks.* are top-level options.
    // apps/mobile runs vitest 4 (rest of the monorepo is on 3.2.6) because
    // 3.2.x's mocker deadlocked this suite: every vi.mock registration did a
    // worker->master resolveId round-trip, and a contiguous block of those
    // RPCs for bare npm specifiers was silently dropped (requests reached
    // the master process, handlers never ran, vite was never entered), so
    // the first import after registration awaited forever. Diagnosed
    // 2026-06-10; see errors_log.md and
    // docs/sessions/2026-06-10-mobile-vitest-hang-root-cause.md.
    pool: 'forks',
    maxWorkers: 2,
    // Forks are reused across files, so jsdom heap accumulates; the heavy
    // hub screens OOM a worker that is already deep into the suite without
    // explicit headroom (hub/settings died at the default limit 2026-06-10).
    execArgv: ['--max-old-space-size=6144'],
    setupFiles: [VITEST_GLOBAL_SETUP_FILE, './test/setup.tsx'],
    include: [
      'app/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'lib/**/__tests__/**/*.{test,spec}.ts',
    ],
    exclude: [
      // Words index test OOMs in isolation (even with 8GB heap) due to
      // a memory leak in the component's jsdom render. Tracked as tech debt.
      'app/(words)/__tests__/index.test.tsx',
      // Books home test fails with ESM/CJS mismatch in @react-native/assets-registry.
      // Pre-existing issue unrelated to module code. Tracked as tech debt.
      'app/(books)/__tests__/home.test.tsx',
      // 2026-06-10: the "collection hang" quarantine is lifted. Root cause
      // was vitest 3.2.x's mocker (a dropped resolveId RPC block, not these
      // files' import graphs); fixed by moving apps/mobile to vitest 4.
      // See errors_log.md 2026-04-19 row (now Resolved) and
      // docs/sessions/2026-06-10-mobile-vitest-hang-root-cause.md.
      // hub/settings + automations stay excluded for a DIFFERENT reason:
      // they share an import graph whose render grinds through a 6 GB heap
      // and OOMs the fork even in isolation (same memory pathology bucket
      // as the words index test above). Tracked as tech debt.
      'app/(hub)/__tests__/settings.test.tsx',
      'app/(hub)/settings/__tests__/automations.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.ts'],
      exclude: ['**/__tests__/**', 'test/**'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 50,
        statements: 50,
        functions: 75,
        branches: 70,
        'app/(hub)/*.tsx': {
          lines: 85,
          statements: 85,
          functions: 90,
          branches: 80,
        },
        'app/(fast)/*.tsx': {
          lines: 85,
          statements: 85,
          functions: 90,
          branches: 70,
        },
        'app/(subs)/*.tsx': {
          lines: 85,
          statements: 85,
          functions: 90,
          branches: 60,
        },
        'app/(surf)/*.tsx': {
          lines: 85,
          statements: 85,
          functions: 75,
          branches: 75,
        },
        'lib/entitlements.ts': {
          lines: 90,
          statements: 90,
          functions: 100,
          branches: 85,
        },
        'lib/server-endpoint.ts': {
          lines: 80,
          statements: 80,
          functions: 100,
          branches: 85,
        },
      },
    },
  },
});
