/**
 * Drives the relay healthz-shape synthetic (deploy/observability/synthetics/
 * relay-healthz-shape.mjs) against a stub HTTP server (Plan 44 Phase 4 WP-4C).
 *
 * The critical assertion: a body of EXACTLY {ok, connections} passes (exit 0), and a body
 * with ANY extra field FAILS (exit 2, verdict 'fail', reason 'shape_regression'). That is
 * the zero-knowledge tripwire. We test both the pure evaluator (imported) and the real
 * end-to-end probe against a live stub, so the exit-code contract is proven, not just the
 * helper.
 */
import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error -- importing the .mjs probe for its exported pure evaluator.
import { evaluateHealthzShape } from '../../deploy/observability/synthetics/relay-healthz-shape.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const probeScript = path.resolve(
  here,
  '..',
  '..',
  'deploy',
  'observability',
  'synthetics',
  'relay-healthz-shape.mjs',
);

const servers: http.Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) => new Promise<void>((resolve) => s.close(() => resolve())),
    ),
  );
});

/** Start a stub relay that answers GET /healthz with the given body + headers. */
function startStub(body: unknown, headers: Record<string, string> = { 'Access-Control-Allow-Origin': '*' }): Promise<number> {
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
      res.end(JSON.stringify(body));
      return;
    }
    res.writeHead(404).end();
  });
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
}

/** Run the probe as a child process; resolve { code, line }. */
function runProbe(url: string): Promise<{ code: number; line: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [probeScript, '--url', url, '--timeout', '2000'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      const firstLine = stdout.trim().split('\n')[0] ?? '{}';
      resolve({ code: code ?? -1, line: JSON.parse(firstLine) });
    });
  });
}

describe('evaluateHealthzShape (pure)', () => {
  it('passes the exact {ok, connections} shape', () => {
    const r = evaluateHealthzShape({
      status: 200,
      body: JSON.stringify({ ok: true, connections: 3 }),
      headers: { 'access-control-allow-origin': '*' },
    });
    expect(r.verdict).toBe('ok');
    expect(r.reason).toBe('shape_exact');
  });

  it('FAILS hard on any extra field (zero-knowledge regression)', () => {
    const r = evaluateHealthzShape({
      status: 200,
      body: JSON.stringify({ ok: true, connections: 3, tokenGroups: 7 }),
      headers: { 'access-control-allow-origin': '*' },
    });
    expect(r.verdict).toBe('fail');
    expect(r.reason).toBe('shape_regression');
    expect(r.extraKeys).toEqual(['tokenGroups']);
  });

  it('degrades (not fails) when ok is false', () => {
    const r = evaluateHealthzShape({
      status: 200,
      body: JSON.stringify({ ok: false, connections: 0 }),
      headers: { 'access-control-allow-origin': '*' },
    });
    expect(r.verdict).toBe('degraded');
    expect(r.reason).toBe('ok_false');
  });

  it('degrades when the CORS header the web selector needs is missing', () => {
    const r = evaluateHealthzShape({
      status: 200,
      body: JSON.stringify({ ok: true, connections: 1 }),
      headers: {},
    });
    expect(r.verdict).toBe('degraded');
    expect(r.reason).toBe('missing_cors');
  });

  it('fails on a non-200 status', () => {
    const r = evaluateHealthzShape({ status: 503, body: '{}', headers: {} });
    expect(r.verdict).toBe('fail');
    expect(r.reason).toBe('status_503');
  });
});

describe('relay-healthz-shape.mjs end-to-end against a stub', () => {
  it('exits 0 for the exact correct shape', async () => {
    const port = await startStub({ ok: true, connections: 5 });
    const { code, line } = await runProbe(`http://127.0.0.1:${port}/healthz`);
    expect(code).toBe(0);
    expect(line.verdict).toBe('ok');
  });

  it('exits 2 and names the leaked key when an extra field appears', async () => {
    const port = await startStub({ ok: true, connections: 5, secretHubStat: 42 });
    const { code, line } = await runProbe(`http://127.0.0.1:${port}/healthz`);
    expect(code).toBe(2);
    expect(line.verdict).toBe('fail');
    expect(line.reason).toBe('shape_regression');
    expect(line.extraKeys).toEqual(['secretHubStat']);
  });

  it('exits 2 when the relay is unreachable', async () => {
    // Nothing listening on this port.
    const { code, line } = await runProbe('http://127.0.0.1:1/healthz');
    expect(code).toBe(2);
    expect(line.verdict).toBe('fail');
  });
});
