#!/usr/bin/env node
/**
 * Meerkat relay entry point.
 *
 * Reads PORT (default 8787) and HOST (default 0.0.0.0) from the environment
 * and starts the relay. Logs lifecycle events and counts only to stdout, never
 * envelope contents.
 *
 * Run from source with tsx, or compile src/ first. For the published service
 * image this is invoked against the compiled dist/.
 */

import { startRelayServer } from '../src/index.ts';
import { installOrphanWatchdog } from '../src/orphan-watchdog.ts';

const out = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
const trustedProxyHops = Number(process.env.MEERKAT_TRUST_PROXY_HOPS ?? 0);

const server = await startRelayServer({
  port,
  host,
  trustedProxyHops,
  // Counts and connection ids only. Envelopes are never passed here.
  log: (event, detail) => out({ at: new Date().toISOString(), event, ...detail }),
});

out({ at: new Date().toISOString(), event: 'listening', host, port: server.port });

function shutdown(signal) {
  out({ at: new Date().toISOString(), event: 'shutdown', signal });
  server.close().then(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

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
