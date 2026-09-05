/**
 * Real spawn adapter (Plan 20, Phase 4.1/4.3). Proves makeRealSpawn() produces the
 * SpawnedChild shape the HostSupervisor drives, against a REAL child process.
 *
 * The fixture is a plain `node -e` one-liner (NOT a tsx child -- the relay CLAUDE.md
 * warns tsx-under-tsx background IO starves socket IO in the sandbox). It prints the
 * exact {event:'listening',port} line the real bins log, so the adapter is exercised
 * end to end: stdout 'data' surfaces the line, 'exit' fires, and the supervisor reads
 * the REAL bound port from it before stop() kills the child.
 */

import { describe, it, expect } from 'vitest';
import { makeRealSpawn } from '../spawn';
import { HostSupervisor, type SpawnFn } from '../process-supervisor';

/** A `node -e` source string that logs the listening line, optionally staying alive. */
function listeningFixture(port: number, stayAliveMs = 0): string {
  const line = JSON.stringify(JSON.stringify({ event: 'listening', port }) + '\n');
  const write = `process.stdout.write(${line});`;
  return stayAliveMs > 0 ? `${write}setTimeout(() => {}, ${stayAliveMs});` : write;
}

describe('makeRealSpawn', () => {
  it('surfaces a real child stdout listening line and its exit', async () => {
    const spawn = makeRealSpawn();
    const child = spawn(process.execPath, ['-e', listeningFixture(8788)], { ...process.env });

    const chunks: string[] = [];
    const code = await new Promise<number | null>((resolve) => {
      child.stdout.on('data', (c) => chunks.push(c.toString()));
      child.on('exit', (c) => resolve(c));
    });

    const out = chunks.join('');
    expect(out).toContain('"event":"listening"');
    expect(out).toContain('"port":8788');
    expect(code).toBe(0);
  });

  it('drives the HostSupervisor over the REAL spawn: reads the bound port, then stop() kills it', async () => {
    const real = makeRealSpawn();
    let resolveExit: (code: number | null) => void = () => {};
    const childExited = new Promise<number | null>((r) => {
      resolveExit = r;
    });
    // Wrap the real spawn to also observe the child's exit, so the test can await
    // real termination after stop() (no dangling process, no fabricated state).
    const spawn: SpawnFn = (bin, args, env) => {
      const child = real(bin, args, env);
      child.on('exit', (code) => resolveExit(code));
      return child;
    };

    const sup = new HostSupervisor({
      spawn,
      // counts only ever come from the real /healthz field; here we stub a live probe
      fetchHealthz: async () => ({ ok: true, connections: 0 }),
    });

    const status = await sup.start(
      { name: 'relay', bin: process.execPath, args: ['-e', listeningFixture(8789, 10_000)] },
      { timeoutMs: 8_000 },
    );
    expect(status.state).toBe('live');
    expect(status.port).toBe(8789);

    sup.stop('relay');
    await childExited; // the SIGTERM really terminated the child

    const stopped = sup.statuses().find((s) => s.name === 'relay');
    expect(stopped?.state).toBe('stopped');
    expect(stopped?.port).toBeNull();
  });
});
