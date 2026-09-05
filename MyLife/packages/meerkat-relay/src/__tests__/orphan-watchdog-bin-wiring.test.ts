/**
 * The wiring lock. A long-running bin is one that installs a SIGTERM shutdown;
 * every such bin MUST also install the orphan watchdog, or it can be stranded by
 * an abnormal parent death exactly as 536 processes were on 2026-09-02.
 *
 * This is a rule about the SHAPE of a bin rather than a hardcoded file list, so
 * a service binary added later is covered the day it is written.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const binDir = fileURLToPath(new URL('../../bin/', import.meta.url));

async function readBins(): Promise<Array<{ name: string; source: string }>> {
  const names = (await fs.readdir(binDir)).filter((name) => name.endsWith('.mjs')).sort();
  return Promise.all(names.map(async (name) => ({
    name,
    source: await fs.readFile(path.join(binDir, name), 'utf8'),
  })));
}

/** A bin that handles SIGTERM is a bin that expects to run until told to stop. */
const isLongRunning = (source: string): boolean => source.includes("process.on('SIGTERM'");

describe('orphan watchdog bin wiring', () => {
  it('every long-running bin installs the watchdog', async () => {
    const bins = await readBins();
    const longRunning = bins.filter((bin) => isLongRunning(bin.source));

    // Guard the guard: if this ever reaches zero the assertion below passes
    // vacuously and the lock silently stops protecting anything.
    expect(longRunning.length).toBeGreaterThanOrEqual(15);

    const missing = longRunning
      .filter((bin) => !bin.source.includes('installOrphanWatchdog('))
      .map((bin) => bin.name);
    expect(missing).toEqual([]);
  });

  it('every long-running bin imports the watchdog it calls', async () => {
    // Any binding form is fine (its own import, or folded into an existing
    // list); what matters is that the name is actually imported somewhere.
    const bound = /import\s*\{[^}]*\binstallOrphanWatchdog\b[^}]*\}\s*from\s*'[^']+'/u;
    const bins = await readBins();
    const unimported = bins
      .filter((bin) => bin.source.includes('installOrphanWatchdog('))
      .filter((bin) => !bound.test(bin.source))
      .map((bin) => bin.name);
    expect(unimported).toEqual([]);
  });

  it('installs the watchdog after the SIGTERM handler it depends on', async () => {
    const bins = await readBins();
    for (const bin of bins.filter((candidate) => isLongRunning(candidate.source))) {
      const sigterm = bin.source.indexOf("process.on('SIGTERM'");
      const install = bin.source.indexOf('installOrphanWatchdog(', bin.source.indexOf('\n', bin.source.indexOf('import')));
      // The watchdog fires by raising SIGTERM on itself. Registering it before
      // the handler exists would leave a window where the signal kills the
      // process outright instead of running the clean shutdown.
      expect(sigterm, `${bin.name}: SIGTERM handler not found`).toBeGreaterThan(-1);
      expect(install, `${bin.name}: install call not found`).toBeGreaterThan(sigterm);
    }
  });

  /**
   * The slim production entrypoint is the ONE bin that runs under plain `node`
   * against compiled CommonJS (every other container runs its bin under tsx).
   * The image builds it by rewriting a single import line with `sed`, so that
   * line is a contract between three files. Adding a second local import to this
   * bin silently breaks the production artifact: it boots, fails to resolve a
   * `.ts` path, and dies before its first log line. That is exactly what the
   * first cut of the watchdog wiring did, and what this test now prevents.
   */
  it('the slim entrypoint keeps one local import, and the image rewrite matches it', async () => {
    const binSource = await fs.readFile(path.join(binDir, 'meerkat-relay-server.mjs'), 'utf8');
    const expected = "import { startRelayServer, installOrphanWatchdog } from '../src/server.ts';";

    expect(binSource).toContain(expected);

    // No OTHER relative import: everything the slim bin needs comes through the
    // one specifier the build rewrites.
    const localImports = [...binSource.matchAll(/^import .* from '(\.[^']*)';$/gmu)].map((m) => m[1]);
    expect(localImports).toEqual(['../src/server.ts']);

    // The Dockerfile's sed and the smoke harness's replace must both target the
    // exact line above, or the compiled artifact keeps a `.ts` import.
    const dockerfile = await fs.readFile(fileURLToPath(new URL('../../Dockerfile', import.meta.url)), 'utf8');
    expect(dockerfile).toContain(`s#^${expected}#`);

    const harness = await fs.readFile(
      fileURLToPath(new URL('../../scripts/smoke-relay.mjs', import.meta.url)),
      'utf8',
    );
    expect(harness).toContain(expected);
  });

  it('one-shot CLIs are deliberately left alone', async () => {
    const bins = await readBins();
    const oneShot = bins.filter((bin) => !isLongRunning(bin.source)).map((bin) => bin.name);
    // These exit on their own, so a watchdog would add a poll for nothing.
    expect(oneShot).toEqual([
      'meerkat-postgres-backup.mjs',
      'meerkat-postgres-cutover.mjs',
      'meerkat-postgres-migrate.mjs',
      'meerkat-postgres-role-grants.mjs',
      'meerkat-postgres-state-import.mjs',
      'meerkat-promotion.mjs',
      'meerkat-rehearsal.mjs',
      'meerkat-release.mjs',
      'run-local-tsx.mjs',
    ]);
  });
});
