import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer, type AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const packageRoot = fileURLToPath(new URL('../../', import.meta.url));

const directoryBin = path.join(packageRoot, 'bin/meerkat-public-directory-node.mjs');
const verificationBin = path.join(packageRoot, 'bin/meerkat-verification-service.mjs');

/** A humanity signing seed and a turnstile secret so the verification bin can boot. */
const HUMANITY_SIGNING_KEY = 'a'.repeat(64);

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

interface BootedService {
  child: ChildProcess;
  url: string;
  metricsUrl: string | null;
  ready: Record<string, unknown>;
}

const running: ChildProcess[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  for (const child of running.splice(0)) {
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

/** Boot a bin in file mode on a fixed port, resolve once its ready log lands. */
function boot(bin: string, env: NodeJS.ProcessEnv, port: number, metricsPort?: number): Promise<BootedService> {
  const child = spawn(process.execPath, [tsxCli, bin], {
    cwd: packageRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      HOST: '127.0.0.1',
      MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
      MEERKAT_STORE_BACKEND: 'file',
      ...(metricsPort ? { MEERKAT_METRICS_PORT: String(metricsPort), MEERKAT_METRICS_HOST: '127.0.0.1' } : {}),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  running.push(child);
  let stdout = '';
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timed out waiting for ready; stdout=\n${stdout}`));
    }, 20_000);
    child.stdout!.setEncoding('utf8');
    child.stdout!.on('data', (chunk: string) => {
      stdout += chunk;
      const line = stdout.split('\n').find((l) => l.includes('"event":"ready"'));
      if (line) {
        clearTimeout(timeout);
        const ready = JSON.parse(line) as Record<string, unknown>;
        resolve({
          child,
          url: `http://127.0.0.1:${port}`,
          metricsUrl: metricsPort ? `http://127.0.0.1:${metricsPort}` : null,
          ready,
        });
      }
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`bin exited ${code} before ready; stdout=\n${stdout}`));
      }
    });
  });
}

async function tmp(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe('directory node observability bin', () => {
  it('serves /livez + /readyz and reports honest file-mode readiness', async () => {
    const dataDir = await tmp('meerkat-dir-obs-');
    const port = await freePort();
    const svc = await boot(directoryBin, { DATA_DIR: dataDir }, port);

    const livez = await fetch(`${svc.url}/livez`);
    expect(livez.status).toBe(200);
    expect(await livez.json()).toMatchObject({ ok: true, service: 'directory' });

    const readyz = await fetch(`${svc.url}/readyz`);
    expect(readyz.status).toBe(200);
    const body = (await readyz.json()) as { ready: boolean; checks: Array<Record<string, unknown>> };
    expect(body.ready).toBe(true);
    expect(body.checks).toContainEqual({ name: 'data_dir', ok: true, detailClass: 'ok' });
    // No free-form strings escape the readiness body.
    for (const check of body.checks) {
      expect(Object.keys(check).sort()).toEqual(['detailClass', 'name', 'ok']);
    }

    // The existing zero-knowledge /healthz is preserved alongside the new endpoints.
    const healthz = await fetch(`${svc.url}/healthz`);
    expect(healthz.status).toBe(200);
    expect(await healthz.json()).toMatchObject({ ok: true });
  }, 30_000);

  it('reports metrics disabled without MEERKAT_METRICS_PORT', async () => {
    const dataDir = await tmp('meerkat-dir-nometrics-');
    const port = await freePort();
    const svc = await boot(directoryBin, { DATA_DIR: dataDir }, port);
    expect(svc.ready.metrics).toBe('disabled');
    // No metrics listener means /metrics is simply not reachable on the public port
    // (the public port serves the ws directory + health only).
    const res = await fetch(`${svc.url}/metrics`).catch(() => null);
    // The public listener bounces non-health GETs to a 426 ws-upgrade, never /metrics text.
    if (res) expect(res.headers.get('content-type') ?? '').not.toContain('version=0.0.4');
  }, 30_000);

  it('starts an opt-in private metrics listener and serves Prometheus text', async () => {
    const dataDir = await tmp('meerkat-dir-metrics-');
    const port = await freePort();
    const metricsPort = await freePort();
    const svc = await boot(directoryBin, { DATA_DIR: dataDir }, port, metricsPort);
    expect(svc.ready.metrics).toBe(`listening on 127.0.0.1:${metricsPort}`);

    const metrics = await fetch(`${svc.metricsUrl}/metrics`);
    expect(metrics.status).toBe(200);
    expect(metrics.headers.get('content-type')).toContain('version=0.0.4');
    const text = await metrics.text();
    expect(text).toContain('meerkat_directory_records{');
    // Readiness is also reachable on the private listener (compose can use it).
    const readyz = await fetch(`${svc.metricsUrl}/readyz`);
    expect(readyz.status).toBe(200);
  }, 30_000);
});

describe('verification service observability bin', () => {
  it('serves /livez + /readyz and exports bounded humanity counts', async () => {
    const dataDir = await tmp('meerkat-humanity-obs-');
    const port = await freePort();
    const metricsPort = await freePort();
    const svc = await boot(
      verificationBin,
      { DATA_DIR: dataDir, HUMANITY_SIGNING_KEY, TURNSTILE_SECRET: 'test-secret' },
      port,
      metricsPort,
    );

    const livez = await fetch(`${svc.url}/livez`);
    expect(livez.status).toBe(200);
    expect(await livez.json()).toMatchObject({ ok: true, service: 'humanity' });

    const readyz = await fetch(`${svc.url}/readyz`);
    expect(readyz.status).toBe(200);
    expect((await readyz.json()) as { ready: boolean }).toMatchObject({ ready: true });

    const metrics = await fetch(`${svc.metricsUrl}/metrics`);
    const text = await metrics.text();
    expect(text).toContain('meerkat_humanity_store{');
    expect(text).toContain('kind="spent"');
  }, 30_000);
});
