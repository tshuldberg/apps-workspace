/**
 * Relay-image dependency invariants (static source inspection).
 *
 * These guard the property that makes the relay container image correct:
 *   1. The slim entrypoint imports everything it needs from ../src/server.ts,
 *      NOT from the ../src/index.ts barrel (the barrel drags in the
 *      seeder/hosted node and their @mylife/sync runtime dependency). Extra
 *      bindings on that one import are fine and are how the orphan watchdog
 *      reaches the slim bin; a SECOND import specifier is not, because the
 *      image build rewrites exactly one line to the compiled dist.
 *   2. server.ts / hub.ts / protocol.ts contain no `@mylife/sync` (or any
 *      @mylife/*) import, so the relay graph needs only ws + zod.
 *   3. The Dockerfile installs only the slim runtime manifest and never the
 *      workspace, and the entrypoint CMD is the slim bin.
 *
 * If any of these breaks, --ignore-workspace / --omit=dev installs would no
 * longer be correct and the image would crash on first require (the original
 * bug this task fixed). Mirrors the source-inspection style of direct-cli.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..', '..');
const read = (rel: string) => readFileSync(join(pkgRoot, rel), 'utf8');

describe('relay image dependency invariants', () => {
  it('the slim entrypoint imports server.ts directly, not the index.ts barrel', () => {
    const bin = read('bin/meerkat-relay-server.mjs');
    expect(bin).toMatch(/import\s*\{[^}]*\bstartRelayServer\b[^}]*\}\s*from\s*'\.\.\/src\/server\.ts'/);
    // It must never import the barrel (which pulls @mylife/sync via seeder/hosted node).
    expect(bin).not.toMatch(/from\s*'\.\.\/src\/index(\.ts)?'/);
  });

  it('server.ts, hub.ts, and protocol.ts carry no @mylife/* runtime import', () => {
    for (const file of ['src/server.ts', 'src/hub.ts', 'src/protocol.ts']) {
      const src = read(file);
      // No import/require/from of any @mylife/* package. (A doc comment that
      // merely mentions the path is fine; an import statement is not.)
      const importLines = src
        .split('\n')
        .filter((l) => /^\s*import\b/.test(l) || /\brequire\(/.test(l));
      for (const line of importLines) {
        expect(line).not.toMatch(/@mylife\//);
      }
    }
  });

  it('the Dockerfile ships only ws + zod and runs the slim entrypoint', () => {
    const df = read('Dockerfile');
    // Runtime install must be the slim manifest, not the workspace.
    expect(df).toMatch(/package\.runtime\.json/);
    expect(df).toMatch(/npm install --omit=dev/);
    // The runtime manifest is built from only ws + zod.
    expect(df).toMatch(/dependencies:\{ws:p\.dependencies\.ws,zod:p\.dependencies\.zod\}/);
    // The container command is the slim entrypoint.
    expect(df).toMatch(/CMD \["node", "bin\/meerkat-relay-server\.mjs"\]/);
    // It must NOT install the workspace into the runtime stage.
    expect(df).not.toMatch(/pnpm install --prod --ignore-workspace/);
  });

  it('ws + zod are real package dependencies (the only two the relay image installs)', () => {
    // The package as a whole also depends on @mylife/sync for the SEPARATE
    // seeder/hosted-node story; that is fine and intentional. The relay IMAGE
    // never installs it because the Dockerfile builds package.runtime.json from
    // only ws + zod (asserted above). Here we just confirm both are declared so
    // the runtime manifest can be derived from them.
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies.ws).toBeDefined();
    expect(pkg.dependencies.zod).toBeDefined();
  });
});
