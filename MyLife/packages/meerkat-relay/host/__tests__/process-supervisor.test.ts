/**
 * Host process supervisor lifecycle (Plan 20, Phase 4). TC-8 / AC-10.
 *
 * Uses an injected fake spawn + fetchHealthz so the spawn -> read-real-port ->
 * liveness -> kill -> offline lifecycle is deterministic (no real child process,
 * sidestepping the sandbox tsx-IO gotcha). The behaviour proven here is exactly
 * what the control panel drives against the real bins.
 */

import { describe, it, expect, vi } from 'vitest';
import { HostSupervisor, type SpawnedChild, type SpawnFn } from '../process-supervisor';

/** A fake child that lets the test push stdout lines + an exit. */
function makeFakeChild(): SpawnedChild & {
  emitData: (s: string) => void;
  emitExit: () => void;
  killed: boolean;
} {
  const dataCbs: ((c: string) => void)[] = [];
  const exitCbs: ((c: number | null) => void)[] = [];
  return {
    killed: false,
    stdout: { on: (_e, cb) => dataCbs.push(cb) },
    on(event, cb) {
      if (event === 'exit') exitCbs.push(cb as (c: number | null) => void);
    },
    kill() {
      this.killed = true;
      for (const cb of exitCbs) cb(0);
    },
    emitData: (s) => dataCbs.forEach((cb) => cb(s)),
    emitExit: () => exitCbs.forEach((cb) => cb(0)),
  };
}

describe('HostSupervisor', () => {
  it('TC-8: spawns, reads the REAL bound port from the listening log, and reports live via /healthz', async () => {
    const child = makeFakeChild();
    const spawn: SpawnFn = () => child;
    const sup = new HostSupervisor({
      spawn,
      fetchHealthz: async () => ({ ok: true, connections: 3 }),
    });

    const starting = sup.start({ name: 'relay', bin: 'bin/meerkat-relay-server.mjs' });
    // The real bin logs this once it binds; the supervisor must read the port from it.
    child.emitData('{"event":"limits"}\n{"event":"listening","port":8787}\n');
    const status = await starting;
    expect(status.state).toBe('live');
    expect(status.port).toBe(8787);

    const health = await sup.checkHealth('relay');
    expect(health?.state).toBe('live');
    expect(health?.connections).toBe(3);
  });

  it('AC-10: stopping a service flips it offline (kills the child, clears the port)', async () => {
    const child = makeFakeChild();
    const sup = new HostSupervisor({ spawn: () => child, fetchHealthz: async () => ({ ok: true, connections: 0 }) });
    const p = sup.start({ name: 'relay', bin: 'b' });
    child.emitData('{"event":"listening","port":9000}\n');
    await p;
    sup.stop('relay');
    expect(child.killed).toBe(true);
    const s = sup.statuses().find((x) => x.name === 'relay');
    expect(s?.state).toBe('stopped');
    expect(s?.port).toBeNull();
  });

  it('reports error when a child exits before it is ready', async () => {
    const child = makeFakeChild();
    const sup = new HostSupervisor({ spawn: () => child, fetchHealthz: async () => null });
    const p = sup.start({ name: 'relay', bin: 'b' });
    child.emitExit();
    const status = await p;
    expect(status.state).toBe('error');
  });

  it('reports error when no listening port arrives before the timeout', async () => {
    vi.useFakeTimers();
    try {
      const child = makeFakeChild();
      const sup = new HostSupervisor({ spawn: () => child, fetchHealthz: async () => null });
      const p = sup.start({ name: 'relay', bin: 'b' }, { timeoutMs: 1000 });
      await vi.advanceTimersByTimeAsync(1001);
      const status = await p;
      expect(status.state).toBe('error');
      expect(status.error).toMatch(/listening port/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a failing /healthz marks the service errored (never a fabricated live)', async () => {
    const child = makeFakeChild();
    const sup = new HostSupervisor({ spawn: () => child, fetchHealthz: async () => null });
    const p = sup.start({ name: 'relay', bin: 'b' });
    child.emitData('{"event":"listening","port":7000}\n');
    await p;
    const health = await sup.checkHealth('relay');
    expect(health?.state).toBe('error');
  });
});
