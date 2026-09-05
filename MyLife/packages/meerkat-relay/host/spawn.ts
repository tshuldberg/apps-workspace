/**
 * Real node:child_process spawn adapter for the HostSupervisor (Plan 20, Phase 4.1/4.3).
 *
 * The tested supervisor core (process-supervisor.ts) takes its `spawn` INJECTED so
 * the lifecycle stays deterministic without real children (the relay CLAUDE.md warns
 * that backgrounded tsx starves socket IO in sandboxes). This is the production
 * wiring: a thin, faithful adapter over node:child_process.spawn that surfaces
 * exactly the SpawnedChild shape the supervisor consumes -- stdout 'data' chunks (so
 * it can read the REAL {event:'listening',port} line the bins log), the 'exit'
 * event, and kill(). It owns no cryptography, spawns the real bin/* entrypoints
 * unchanged, and never parses, transforms, or fabricates the child's output.
 */

import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import type { SpawnFn, SpawnedChild } from './process-supervisor';

/**
 * Wrap a live ChildProcess in the SpawnedChild shape the supervisor consumes.
 * stdout may be null if the child was spawned without a pipe; the optional chain
 * keeps the adapter honest (no data surfaces rather than a throw).
 */
export function adaptChild(child: ChildProcess): SpawnedChild {
  return {
    stdout: {
      on(_event: 'data', cb: (chunk: Buffer | string) => void): void {
        child.stdout?.on('data', cb);
      },
    },
    on(_event: 'exit', cb: (code: number | null) => void): void {
      child.on('exit', (code) => cb(code));
    },
    kill(signal?: string): void {
      child.kill(signal as NodeJS.Signals | undefined);
    },
  };
}

/**
 * The production SpawnFn: launch `bin args` with the supervisor-provided env, pipe
 * stdout (so the {event:'listening',port} line is readable), inherit stderr for host
 * logs, and ignore stdin. No shell -- args are passed literally, so a bin path or an
 * env value can never be re-interpreted as a command. Returns the SpawnedChild
 * adapter the supervisor drives.
 */
export function makeRealSpawn(): SpawnFn {
  return (bin, args, env) => {
    const child = nodeSpawn(bin, args, {
      env,
      stdio: ['ignore', 'pipe', 'inherit'],
      shell: false,
    });
    return adaptChild(child);
  };
}
