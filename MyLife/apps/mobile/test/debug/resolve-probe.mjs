// Master-side probe: does vitenode.resolveId settle for externalized RN/Expo
// bare specifiers? Run: node test/debug/resolve-probe.mjs (from apps/mobile).
import { createVitest } from 'vitest/node';

const vitest = await createVitest('test', {
  config: 'vitest.config.ts',
  root: process.cwd(),
  watch: false,
});

const project = vitest.projects[0];
const importer = `${process.cwd()}/test/setup.tsx`;

const targets = [
  'react-native',
  'expo-blur',
  'expo-router',
  'react-native-svg',
  '@mylife/ui',
  '../../hooks/books/use-search',
  'lucide-react-native',
];

for (const id of targets) {
  const started = Date.now();
  const result = await Promise.race([
    project.vitenode.resolveId(id, importer, 'web').then(
      (r) => ({ state: 'resolved', value: r && { id: r.id, external: r.external } }),
      (e) => ({ state: 'rejected', value: String(e).slice(0, 120) }),
    ),
    new Promise((resolve) => setTimeout(() => resolve({ state: 'PENDING>4s' }), 4000)),
  ]);
  console.log(
    `${result.state.padEnd(10)} ${String(Date.now() - started).padStart(5)}ms ${id}`,
    result.value ?? '',
  );
}

await vitest.close();
process.exit(0);
