// Debug config for the six-file collection hang (errors_log 2026-04-19).
//
// Mirrors vitest.config.ts (alias + setup + forks pool) but with NO exclude
// list, a single-file include driven by MOBILE_DEBUG_TEST, and a CJS load
// logger injected into the fork so the hanging externalized import shows up
// in /tmp/mobile-loadlog.txt. Run:
//
//   MOBILE_DEBUG_TEST='app/(books)/__tests__/add-book.test.tsx' \
//     pnpm --dir apps/mobile exec vitest run --config vitest.debug.config.ts
//
// Not used by CI or the function gate.

import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import {
  VITEST_GLOBAL_SETUP_FILE,
  vitestBaseTestConfig,
} from '../../test/vitest/base';

const target = process.env.MOBILE_DEBUG_TEST ?? 'app/(books)/__tests__/add-book.test.tsx';

const PLUG_LOG = '/tmp/mobile-resolveplug.txt';
function plog(line: string) {
  try {
    appendFileSync(PLUG_LOG, `${line}\n`);
  } catch {
    // best effort
  }
}

// Master-side probe: log entry into pluginContainer.resolveId (pre) and
// whether control ever comes back out past vite:resolve (post), plus the
// state of the environment's deps optimizer for bare specifiers.
const resolveProbePre: Plugin = {
  name: 'mobile-debug-resolve-pre',
  enforce: 'pre',
  configureServer(server) {
    // Wrap the live client container's resolveId entry point. A call that
    // stays pending past 5s dumps the container state: that's the parked
    // layer the RPC handlers sit on.
    const env = (server as unknown as {
      environments: Record<string, {
        pluginContainer: {
          resolveId: (...args: unknown[]) => Promise<unknown>;
          _started?: boolean;
          _closed?: boolean;
          _buildStartPromise?: unknown;
        };
      }>;
    }).environments.client;
    const container = env.pluginContainer;
    const orig = container.resolveId.bind(container);
    container.resolveId = async (...args: unknown[]) => {
      const id = String(args[0] ?? '');
      const importer = String(args[1] ?? '');
      const bare = id && !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0');
      const tag = `${id} <- ${importer.split('/').slice(-2).join('/')}`;
      if (bare) plog(`[ctr>] ${tag}`);
      const timer = bare
        ? setTimeout(() => {
            plog(
              `[STUCK 5s] ${tag} started=${container._started} closed=${container._closed} buildStartPending=${container._buildStartPromise != null}`,
            );
          }, 5000)
        : null;
      try {
        return await orig(...args);
      } finally {
        if (timer) clearTimeout(timer);
        if (bare) plog(`[ctr<] ${tag}`);
      }
    };
  },
  resolveId(id) {
    if (!id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0')) {
      const env = (this as unknown as { environment?: { name?: string; depsOptimizer?: unknown; config?: { optimizeDeps?: { noDiscovery?: boolean } } } }).environment;
      plog(
        `[pre ] ${id} env=${env?.name} optimizer=${env?.depsOptimizer ? 'YES' : 'no'} noDiscovery=${env?.config?.optimizeDeps?.noDiscovery}`,
      );
    }
    return null;
  },
};

const resolveProbePost: Plugin = {
  name: 'mobile-debug-resolve-post',
  enforce: 'post',
  resolveId(id) {
    if (!id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0')) {
      plog(`[post] ${id}`);
    }
    return null;
  },
};

export default defineConfig({
  // Hypothesis under test: vite's bare-specifier resolution awaits the deps
  // optimizer scan, which never completes in vitest run mode, so resolveId
  // RPCs for node_modules ids never settle. Kill discovery entirely.
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
  plugins: [resolveProbePre, resolveProbePost],
  resolve: {
    alias: {
      'lucide-react-native': fileURLToPath(
        new URL('./test/stubs/lucide-react-native.cjs', import.meta.url),
      ),
    },
  },
  test: {
    ...vitestBaseTestConfig,
    environment: 'jsdom',
    globals: true,
    pool: 'forks',
    // Vitest 4 pool rework: former poolOptions.forks.* are top-level.
    maxWorkers: 1,
    execArgv: [
      '--require',
      fileURLToPath(new URL('./test/debug/loadlog.cjs', import.meta.url)),
    ],
    setupFiles: [VITEST_GLOBAL_SETUP_FILE, './test/setup.tsx'],
    include: [target],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
