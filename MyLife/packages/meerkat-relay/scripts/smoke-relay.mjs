#!/usr/bin/env node
/**
 * Production relay smoke harness.
 *
 * Boots the REAL slim entrypoint (bin/meerkat-relay-server.mjs) exactly the way
 * the container image does: compile the relay graph to CommonJS dist, rewrite
 * the bin import to ../dist/server.js, then run it under plain `node` as a child
 * process. Then it verifies the four things that make a relay genuinely ready:
 *
 *   1. readiness     - GET /healthz returns { ok: true, connections: 0 }
 *   2. live session  - two `ws` clients sharing a token exchange a real
 *                      ciphertext envelope through the booted relay (a 200 on
 *                      /healthz is NOT enough; the wire must actually carry bytes)
 *   3. log hygiene   - captured stdout never leaks the envelope, the token, or
 *                      the rendezvous record (counts + events only)
 *   4. clean shutdown- SIGTERM produces a `shutdown` line and exit code 0
 *
 * This needs only `ws` (a relay runtime dep), so it runs standalone with
 * `node scripts/smoke-relay.mjs`. The Vitest wrapper (smoke-relay.test.ts)
 * layers a full NativeSyncEngine round trip on top for CI. Exit non-zero on any
 * failed assertion so CI and ops get a hard pass/fail.
 */

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, symlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

// A known ciphertext envelope, token, rendezvous record, and content-registry
// announce record. None of these may ever appear in the relay's stdout.
const TOKEN = 'a'.repeat(64);
const SECRET_ENVELOPE = 'U01PS0VfRU5WRUxPUEVfU0VDUkVU'; // base64, distinctive
const REND_ID = 'b'.repeat(32);
const SECRET_REC = 'U01PS0VfUkVOREVaVk9VU19SRUNPUkQ='; // base64, distinctive
// Registry verbs (ann/lk): an opaque announce record + its derived rid. The
// relay copies the rec verbatim and never decodes it, exactly like a rendezvous
// record, so neither may ever surface in stdout.
const REG_ID = 'c'.repeat(48);
const SECRET_REG_REC = 'U01PS0VfUkVHSVNUUllfQU5OT1VOQ0U='; // base64, distinctive

function log(...args) {
  process.stdout.write(args.join(' ') + '\n');
}

/**
 * Build the exact production artifact the image runs: compiled CJS dist + the
 * slim bin pointed at it, under a temp root whose package.json is type:module
 * and whose dist/package.json is type:commonjs (mirrors the Dockerfile).
 */
function buildProductionArtifact() {
  const work = mkdtempSync(join(tmpdir(), 'meerkat-relay-smoke-'));
  mkdirSync(join(work, 'dist'), { recursive: true });
  mkdirSync(join(work, 'bin'), { recursive: true });

  const tsc = join(pkgRoot, 'node_modules', '.bin', 'tsc');
  const tscArgs = [
    join(pkgRoot, 'src', 'server.ts'),
    join(pkgRoot, 'src', 'hub.ts'),
    join(pkgRoot, 'src', 'protocol.ts'),
    '--outDir', join(work, 'dist'),
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--target', 'ES2022',
    '--esModuleInterop',
    '--skipLibCheck',
    '--declaration', 'false',
    '--sourceMap', 'false',
    '--types', 'node',
  ];
  // node_modules/.bin/tsc may not exist in a pnpm hoist layout; fall back to the
  // workspace tsc via the package's own resolution.
  try {
    execFileSync(tsc, tscArgs, { stdio: 'pipe' });
  } catch {
    execFileSync('node', [require_resolve_tsc(), ...tscArgs], { stdio: 'pipe' });
  }

  writeFileSync(join(work, 'package.json'), '{"type":"module"}\n');
  writeFileSync(join(work, 'dist', 'package.json'), '{"type":"commonjs"}\n');

  // The slim bin, with the import rewritten to the compiled output (what the
  // Dockerfile's sed does).
  const binSrc = readFileSync(join(pkgRoot, 'bin', 'meerkat-relay-server.mjs'), 'utf8')
    .replace(
      "import { startRelayServer, installOrphanWatchdog } from '../src/server.ts';",
      "import { startRelayServer, installOrphanWatchdog } from '../dist/server.js';",
    );
  writeFileSync(join(work, 'bin', 'meerkat-relay-server.mjs'), binSrc);

  // ws lives in the relay package's node_modules; symlink it so plain node can
  // resolve `ws` from the temp root (the runtime image gets it from npm install).
  symlinkSync(join(pkgRoot, 'node_modules'), join(work, 'node_modules'), 'dir');

  return work;
}

function require_resolve_tsc() {
  return join(pkgRoot, 'node_modules', 'typescript', 'bin', 'tsc');
}

/**
 * Wait for a stdout line matching `predicate`. Relies on a persistent capture
 * buffer (captured.value) populated by a separate always-on data listener, so
 * lines logged AFTER this resolves (join/leave/shutdown) are still captured.
 */
function waitForLine(captured, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for relay stdout line')), 15_000);
    const start = captured.value.length;
    const interval = setInterval(() => {
      const fresh = captured.value.slice(start);
      for (const line of fresh.split('\n')) {
        if (!line.trim()) continue;
        let obj;
        try { obj = JSON.parse(line); } catch { continue; }
        if (predicate(obj)) {
          clearTimeout(timer);
          clearInterval(interval);
          resolve(obj);
          return;
        }
      }
    }, 25);
  });
}

/**
 * Boot the compiled production bin as a child process on an ephemeral port and
 * resolve once it logs its `listening` line. Returns the child, its port, the
 * url, and a live `captured` buffer of all stdout. Used by both the standalone
 * harness and the Vitest wrappers so they exercise the identical artifact.
 */
export async function bootRelay(work) {
  const binPath = join(work, 'bin', 'meerkat-relay-server.mjs');
  const captured = { value: '' };
  const child = spawn(process.execPath, [binPath], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  child.stdout.on('data', (chunk) => { captured.value += chunk.toString(); });
  let exitCode = null;
  child.on('exit', (code) => { exitCode = code; });
  const listening = await waitForLine(captured, (o) => o.event === 'listening');
  return {
    child,
    captured,
    port: listening.port,
    url: `ws://127.0.0.1:${listening.port}`,
    getExitCode: () => exitCode,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) { resolve(); return; }
        const t = setTimeout(resolve, 5_000);
        child.on('exit', () => { clearTimeout(t); resolve(); });
        child.kill('SIGTERM');
      }),
  };
}

export { buildProductionArtifact };

export function connect(url) {
  const ws = new WebSocket(url);
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

export function nextFrame(ws, type) {
  return new Promise((resolve) => {
    function onMsg(raw) {
      const frame = JSON.parse(raw.toString());
      if (frame.t === type) {
        ws.off('message', onMsg);
        resolve(frame);
      }
    }
    ws.on('message', onMsg);
  });
}

// Known secrets the relay must never leak to stdout. Re-exported so the Vitest
// wrappers assert against the exact same values the harness drives.
export const SMOKE_SECRETS = { TOKEN, SECRET_ENVELOPE, REND_ID, SECRET_REC, REG_ID, SECRET_REG_REC };

async function main() {
  const failures = [];
  const assert = (cond, msg) => {
    if (cond) log('  ok  -', msg);
    else { failures.push(msg); log('  FAIL -', msg); }
  };

  log('[1/5] building the production relay artifact (compiled dist + slim bin)...');
  const work = buildProductionArtifact();

  log('[2/5] booting the relay exactly as the container CMD does...');
  const relay = await bootRelay(work);
  const { url, captured } = relay;
  assert(typeof relay.port === 'number' && relay.port > 0, `relay is listening on a real port (${relay.port})`);

  log('[3/5] readiness probe: GET /healthz...');
  const res = await fetch(`http://127.0.0.1:${relay.port}/healthz`);
  const health = await res.json();
  assert(res.ok, 'GET /healthz returns HTTP 200');
  assert(health.ok === true, '/healthz body has ok: true');
  assert(health.connections === 0, '/healthz reports connections: 0 on a fresh relay');
  assert(!('tokens' in health) && !('rec' in health), '/healthz exposes no extra metadata fields');

  log('[4/5] live session: two clients exchange a real ciphertext envelope...');
  const a = await connect(url);
  const b = await connect(url);
  a.send(JSON.stringify({ t: 'hello', token: TOKEN }));
  b.send(JSON.stringify({ t: 'hello', token: TOKEN }));
  await Promise.all([nextFrame(a, 'ready'), nextFrame(b, 'ready')]);

  // Also publish + resolve a rendezvous record so its bytes pass through too.
  a.send(JSON.stringify({ t: 'pub', rid: REND_ID, rec: SECRET_REC }));
  await nextFrame(a, 'pubok');
  b.send(JSON.stringify({ t: 'res', rid: REND_ID }));
  const recFrame = await nextFrame(b, 'rec');
  assert(recFrame.rec === SECRET_REC, 'rendezvous record resolves verbatim through the relay');

  // Also announce + look up a content-registry record so the ann/lk verbs' bytes
  // cross the live relay too (their log hygiene is asserted, not inferred).
  a.send(JSON.stringify({ t: 'ann', rid: REG_ID, rec: SECRET_REG_REC }));
  await nextFrame(a, 'annok');
  b.send(JSON.stringify({ t: 'lk', rid: REG_ID }));
  const hostsFrame = await nextFrame(b, 'hosts');
  assert(
    Array.isArray(hostsFrame.recs) && hostsFrame.recs.includes(SECRET_REG_REC),
    'announce record resolves verbatim through the relay registry (non-consuming lookup)',
  );

  const deliver = nextFrame(b, 'env');
  a.send(JSON.stringify({ t: 'env', env: SECRET_ENVELOPE }));
  const got = await deliver;
  assert(got.env === SECRET_ENVELOPE, 'ciphertext envelope crosses the live relay verbatim');

  // Health now reflects the two live connections (real number, not faked).
  const res2 = await fetch(`http://127.0.0.1:${relay.port}/healthz`);
  const health2 = await res2.json();
  assert(health2.connections === 2, `/healthz reports 2 live connections during the session (${health2.connections})`);

  a.close();
  b.close();

  log('[5/5] log hygiene + clean shutdown...');
  // Give close/leave events a moment to flush to stdout.
  await new Promise((r) => setTimeout(r, 250));
  assert(!captured.value.includes(SECRET_ENVELOPE), 'stdout never leaked the ciphertext envelope');
  assert(!captured.value.includes(SECRET_REC), 'stdout never leaked the rendezvous record');
  assert(!captured.value.includes(SECRET_REG_REC), 'stdout never leaked the registry announce record');
  assert(!captured.value.includes(REG_ID), 'stdout never leaked the registry rid');
  assert(!captured.value.includes(TOKEN), 'stdout never leaked the join token');
  assert(captured.value.includes('"event":"join"'), 'stdout did log join EVENTS (counts/events only)');

  await relay.stop();
  assert(captured.value.includes('"event":"shutdown"'), 'relay logged a shutdown line on SIGTERM');
  assert(relay.getExitCode() === 0, `relay exited cleanly with code 0 (${relay.getExitCode()})`);

  if (failures.length > 0) {
    log(`\nSMOKE FAILED: ${failures.length} assertion(s) failed.`);
    process.exit(1);
  }
  log('\nSMOKE PASSED: relay booted, served a real session, kept logs clean, and shut down cleanly.');
  process.exit(0);
}

// Run as a standalone harness only when invoked directly (node scripts/...),
// not when imported by the Vitest wrappers.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    log('SMOKE ERROR:', err?.stack || String(err));
    process.exit(1);
  });
}
