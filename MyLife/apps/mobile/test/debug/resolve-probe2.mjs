// Concurrency probe: reproduce the master-side resolveId park in-process.
// Wraps every client-environment plugin's resolveId hook with entry/exit
// logs, starts the setup.tsx transform storm, then resolves 'react-native'
// mid-storm. The plugin that logs entry without exit is the parker.
// Run from apps/mobile: node test/debug/resolve-probe2.mjs
import { createVitest } from 'vitest/node';

const vitest = await createVitest('test', {
  config: 'vitest.config.ts',
  root: process.cwd(),
  watch: false,
});

const project = vitest.projects[0];
const vn = project.vitenode;
const server = vn.server;
const env = server.environments.client;

const inflight = new Map();
let wrapped = 0;
for (const plugin of env.plugins) {
  const hook = plugin.resolveId;
  const handler = typeof hook === 'function' ? hook : hook?.handler;
  if (!handler) continue;
  const name = plugin.name;
  const make = (orig) =>
    async function patched(...args) {
      const id = String(args[0] ?? '');
      const bare = id && !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0');
      const key = `${name} :: ${id}`;
      if (bare) inflight.set(key, (inflight.get(key) ?? 0) + 1);
      try {
        return await orig.apply(this, args);
      } finally {
        if (bare) {
          const n = (inflight.get(key) ?? 1) - 1;
          if (n <= 0) inflight.delete(key);
          else inflight.set(key, n);
        }
      }
    };
  if (typeof hook === 'function') plugin.resolveId = make(handler);
  else hook.handler = make(handler);
  wrapped += 1;
}
console.log(`wrapped ${wrapped} resolveId hooks`);

const importer = `${process.cwd()}/test/setup.tsx`;

// The exact id set setup.tsx's vi.mocks register, fired the way
// resolveMocks does: one parallel Promise.all burst.
const MOCK_IDS = [
  'expo',
  'expo-sqlite',
  'react-native',
  'expo-router',
  '@expo/vector-icons',
  'expo-blur',
  'expo-linear-gradient',
  'expo-sharing',
  'expo-file-system',
  'expo-document-picker',
  'react-native-svg',
  'react-native-gesture-handler',
  'react-native-safe-area-context',
  'react-native-draggable-flatlist',
];

// Transform storm (do not await): the same graph the worker fetches.
vn.fetchModule(`${process.cwd()}/test/setup.tsx`, 'web').catch(() => {});
vn.fetchModule(`${process.cwd()}/app/(books)/book/add.tsx`, 'web').catch(() => {});
await new Promise((r) => setTimeout(r, 60));

const started = Date.now();
const burst = Promise.all(
  MOCK_IDS.map((id) =>
    vn.resolveId(id, importer, 'web').then(
      (r) => ({ id, state: 'resolved', to: r?.id?.slice(-60) }),
      (e) => ({ id, state: 'rejected', err: String(e).slice(0, 80) }),
    ),
  ),
);
const result = await Promise.race([
  burst.then((all) => ({ state: 'ALL_RESOLVED', count: all.length })),
  new Promise((r) => setTimeout(() => r({ state: 'PENDING>8s' }), 8000)),
]);
console.log(`BURST RESOLVE after ${Date.now() - started}ms:`, result);

if (result.state === 'PENDING>8s') {
  console.log('--- hooks entered but not exited ---');
  for (const [key, n] of inflight) console.log(`STUCK x${n}: ${key}`);
  const settled = await Promise.race([burst, new Promise((r) => setTimeout(() => r(null), 100))]);
  if (settled) for (const row of settled) console.log(row.state, row.id);
}

setTimeout(() => process.exit(0), 300);
