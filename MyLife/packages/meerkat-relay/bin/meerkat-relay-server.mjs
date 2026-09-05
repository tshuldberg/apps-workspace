#!/usr/bin/env node
/**
 * Meerkat relay SLIM entry point (production image).
 *
 * This is the entrypoint the container image runs. It imports startRelayServer
 * DIRECTLY from ../src/server.ts, not from the ../src/index.ts barrel. The
 * barrel re-exports seeder-node.ts and hosted-node.ts, which import
 * @mylife/sync at runtime; the relay itself needs only `ws` + `zod`. Pulling in
 * server.ts alone keeps the relay image free of any workspace dependency, so
 * `npm install --omit=dev` against a ws+zod-only manifest is correct rather than
 * broken. Local dev that has the full workspace can still use bin/meerkat-relay.mjs.
 *
 * Reads PORT (default 8787) and HOST (default 0.0.0.0) from the environment.
 * Logs lifecycle events and counts only to stdout, never envelope contents,
 * tokens, or rendezvous records.
 *
 * The Dockerfile rewrites the import below to ../dist/server.js so the image
 * runs the compiled output under plain node (mirrors bin/meerkat-relay.mjs).
 */

import { startRelayServer, installOrphanWatchdog } from '../src/server.ts';

const out = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
const trustedProxyHops = Number(process.env.MEERKAT_TRUST_PROXY_HOPS ?? 0);
const hostedEntitlementRequired = /^(1|true|yes)$/iu.test(
  process.env.MEERKAT_HOSTED_ENTITLEMENT_REQUIRED ?? '',
);
const entitlementSecret = (process.env.ENTITLEMENT_SECRET ?? '').trim();
if (hostedEntitlementRequired && !entitlementSecret) {
  out({ event: 'fatal', reason: 'entitlement_secret_missing' });
  process.exit(1);
}

const server = await startRelayServer({
  port,
  host,
  trustedProxyHops,
  ...(hostedEntitlementRequired
    ? { hostedEntitlement: { required: true, secret: entitlementSecret } }
    : {}),
  // Counts and connection ids only. Envelopes, tokens, and rendezvous records
  // are never passed to this logger.
  log: (event, detail) => out({ at: new Date().toISOString(), event, ...detail }),
});

out({ at: new Date().toISOString(), event: 'listening', host, port: server.port });

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
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
