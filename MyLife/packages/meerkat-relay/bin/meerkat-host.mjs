#!/usr/bin/env node
/**
 * Meerkat Host launcher (Plan 20, Phase 4.1 + 6.4).
 *
 * The double-clickable entry point for the desktop host companion. It:
 *   1. loads (or creates) ~/.meerkat-host/config.json,
 *   2. starts the 127.0.0.1-ONLY control panel (host/server.ts) on a fixed
 *      loopback port,
 *   3. opens the default browser at that localhost URL.
 *
 * It owns no cryptography and never binds a public interface -- the panel is an
 * admin surface. Exposing the actual relay/community node to the internet is the
 * user's explicit choice inside the panel (tunnel / LAN / BYO domain), and a
 * public connection card is surfaced only after a REAL off-host reachability
 * check. The server is reachable only while this process is running and the
 * computer is awake; it is not an always-on node.
 *
 * Run from source with tsx (the monorepo resolves the TS server + bins):
 *   tsx bin/meerkat-host.mjs
 * Packaging bundles this + host/ + the bins into one per-OS executable (see
 * host/build/README.md); that is founder-ops.
 */

import { spawn } from 'node:child_process';
import { platform } from 'node:os';

import { createHostServer } from '../host/server.ts';
import { installOrphanWatchdog } from '../src/orphan-watchdog.ts';

const out = (obj) => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), ...obj }) + '\n');

const port = Number(process.env.MEERKAT_HOST_PORT ?? 7777);

const server = createHostServer();
const bound = await server.listen(port);
const controlUrl = `http://${bound.host}:${bound.port}/`;
out({ event: 'listening', host: bound.host, port: bound.port, url: controlUrl });

// Open the default browser at the localhost control panel (best-effort; a headless
// box just prints the URL). No shell -- the URL is passed as a literal arg.
function openBrowser(url) {
  const os = platform();
  const [cmd, args] =
    os === 'darwin'
      ? ['open', [url]]
      : os === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => out({ event: 'open_browser_skipped', url }));
    child.unref();
  } catch {
    out({ event: 'open_browser_skipped', url });
  }
}

if (process.env.MEERKAT_HOST_NO_OPEN !== '1') openBrowser(controlUrl);

out({ event: 'ready', url: controlUrl, note: 'Open the URL above to configure and start your server.' });

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  out({ event: 'shutdown', signal });
  await server.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Process guards (audit 2026-09-01, R4). Node terminates on an unhandled
// rejection by default, so any request path that leaks one is a one-request
// restart of this service. Log a structured, id-free line and keep serving; an
// uncaught synchronous exception still exits (state may be inconsistent) so the
// supervisor restarts cleanly.
process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : null;
  console.error(JSON.stringify({ event: 'unhandled_rejection', name: error?.name ?? typeof reason, message: String(error?.message ?? reason).slice(0, 200) }));
});
process.on('uncaughtException', (error) => {
  console.error(JSON.stringify({ event: 'uncaught_exception', name: error?.name ?? 'Error', message: String(error?.message ?? error).slice(0, 200) }));
  process.exit(1);
});

// Orphan watchdog (2026-09-02 memory exhaustion incident). When the process that
// spawned this service dies abnormally, leave through the SIGTERM path above
// rather than surviving forever re-parented to init. Never arms in production: a
// container PID 1, or a service adopted by systemd or an init shim, has no
// supervising parent whose death could orphan it.
installOrphanWatchdog({ log: (event) => console.error(JSON.stringify(event)) });
