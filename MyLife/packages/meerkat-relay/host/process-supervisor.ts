/**
 * Host process supervisor (Plan 20, Phase 4). TC-8.
 *
 * Spawns the REAL bin/* entrypoints (relay, community node, seeder) as child
 * processes with the chosen preset env, reads each one's REAL bound port from
 * its `{event:'listening',port}` stdout log, and reports per-process liveness
 * from each /healthz. Counts and ports only -- never envelopes/tokens. The spawn
 * + healthz fetch are injected so the lifecycle is deterministically testable
 * without real child processes (the relay CLAUDE.md warns backgrounded tsx
 * starves socket IO in sandboxes; injection sidesteps that).
 */

export type HostServiceName = 'relay' | 'communityNode' | 'seeder';

export interface SpawnedChild {
  stdout: { on(event: 'data', cb: (chunk: Buffer | string) => void): void };
  on(event: 'exit', cb: (code: number | null) => void): void;
  kill(signal?: string): void;
}

export type SpawnFn = (
  bin: string,
  args: string[],
  env: Record<string, string | undefined>,
) => SpawnedChild;

export interface SupervisorDeps {
  spawn: SpawnFn;
  /** Returns the /healthz body, or null when unreachable. */
  fetchHealthz: (url: string) => Promise<{ ok: boolean; connections: number } | null>;
}

export interface ServiceSpec {
  name: HostServiceName;
  bin: string;
  args?: string[];
  env?: Record<string, string>;
}

export type ServiceState = 'starting' | 'live' | 'stopped' | 'error';

export interface ServiceStatus {
  name: HostServiceName;
  state: ServiceState;
  port: number | null;
  connections: number | null;
  error?: string;
}

export class HostSupervisor {
  private readonly children = new Map<
    HostServiceName,
    { child: SpawnedChild; status: ServiceStatus }
  >();

  constructor(private readonly deps: SupervisorDeps) {}

  /** Spawn a service and resolve once it logs a real bound port (or errors/times out). */
  async start(spec: ServiceSpec, opts?: { timeoutMs?: number }): Promise<ServiceStatus> {
    const child = this.deps.spawn(spec.bin, spec.args ?? [], { ...process.env, ...spec.env });
    const status: ServiceStatus = { name: spec.name, state: 'starting', port: null, connections: null };
    this.children.set(spec.name, { child, status });

    child.on('exit', () => {
      // A clean stop sets 'stopped'; an unexpected exit before 'live' is an error.
      if (status.state === 'starting') {
        status.state = 'error';
        status.error = status.error ?? 'process exited before it was ready';
      } else if (status.state === 'live') {
        status.state = 'stopped';
      }
      status.port = null;
      status.connections = null;
    });

    const port = await this.awaitListeningPort(child, opts?.timeoutMs ?? 10_000);
    if (port == null) {
      if (status.state === 'starting') {
        status.state = 'error';
        status.error = status.error ?? 'did not report a listening port in time';
      }
      return status;
    }
    if (status.state === 'starting') {
      status.port = port;
      status.state = 'live';
    }
    return status;
  }

  private awaitListeningPort(child: SpawnedChild, timeoutMs: number): Promise<number | null> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: number | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      (timer as { unref?: () => void }).unref?.();
      child.on('exit', () => finish(null));
      child.stdout.on('data', (chunk) => {
        for (const line of chunk.toString().split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const obj = JSON.parse(trimmed) as { event?: string; port?: number };
            if (obj.event === 'listening' && typeof obj.port === 'number') {
              finish(obj.port);
              return;
            }
          } catch {
            // not a JSON log line; ignore
          }
        }
      });
    });
  }

  /** Refresh a service's liveness from its real /healthz (counts only). */
  async checkHealth(name: HostServiceName): Promise<ServiceStatus | null> {
    const entry = this.children.get(name);
    if (!entry) return null;
    if (entry.status.port == null) return entry.status;
    const health = await this.deps.fetchHealthz(`http://127.0.0.1:${entry.status.port}/healthz`);
    if (health?.ok) {
      entry.status.state = 'live';
      entry.status.connections = health.connections;
    } else {
      entry.status.state = 'error';
      entry.status.connections = null;
      entry.status.error = 'health check did not answer';
    }
    return entry.status;
  }

  stop(name: HostServiceName): void {
    const entry = this.children.get(name);
    if (!entry) return;
    entry.child.kill('SIGTERM');
    entry.status.state = 'stopped';
    entry.status.port = null;
    entry.status.connections = null;
  }

  stopAll(): void {
    for (const name of this.children.keys()) this.stop(name);
  }

  statuses(): ServiceStatus[] {
    return [...this.children.values()].map((e) => ({ ...e.status }));
  }
}
