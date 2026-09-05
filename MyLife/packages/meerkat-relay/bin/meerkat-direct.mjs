#!/usr/bin/env node
/**
 * Meerkat direct send -- encrypted, relay-routed "AirDrop for any two devices".
 *
 * One side seals a message and ships it through a relay; the other opens it with
 * the out-of-band share link. The relay only ever forwards opaque ciphertext.
 * Plain Node, so it runs identically on macOS, Windows, and Linux.
 *
 * Run from source with tsx (the package's TS entry is resolved by the monorepo):
 *   tsx bin/meerkat-direct.mjs send  <relayUrl> <token> "<text>" [name]
 *   tsx bin/meerkat-direct.mjs open  <relayUrl> <token> <meerkat-link>
 */

import {
  generateDeviceIdentity,
  WebSocketRelayBackend,
  MeerkatDirectClient,
  parseShareLink,
  sha512Hex,
} from '@mylife/sync';
import { installOrphanWatchdog } from '../src/orphan-watchdog.ts';

const [cmd, relayUrl, token, arg, nameArg] = process.argv.slice(2);
const dec = (b) => new TextDecoder().decode(b);

function usage() {
  process.stdout.write(`Meerkat direct send (end-to-end encrypted, relay-routed)

Start a relay on one machine (or point at a shared one):
  pnpm --filter @mylife/meerkat-relay start            # listens on 0.0.0.0:8787

Send (machine A, e.g. the Mac):
  tsx bin/meerkat-direct.mjs send <relayUrl> <token> "<text>" [name]
    -> prints a meerkat:// link. Copy it to machine B (out of band).

Open (machine B, e.g. the Windows PC):
  tsx bin/meerkat-direct.mjs open <relayUrl> <token> <meerkat-link>

  <relayUrl>  ws://<host-ip>:8787   (LAN or public; wss:// for TLS)
  <token>     any shared secret string both sides agree on (the rendezvous id)
`);
}

if (!cmd || (cmd !== 'send' && cmd !== 'open') || !relayUrl || !token) {
  usage();
  process.exit(cmd ? 1 : 0);
}

// Derive a valid 64-hex relay rendezvous token from any shared phrase, so both
// sides can agree on a friendly secret. The relay only ever sees this hash.
const relayToken = sha512Hex(new TextEncoder().encode(token)).slice(0, 64);

const backend = new WebSocketRelayBackend();
const client = new MeerkatDirectClient({ identity: generateDeviceIdentity(`cli-${cmd}`), backend });

function fail(msg) {
  process.stderr.write(msg + '\n');
  backend.destroy();
  process.exit(1);
}

if (cmd === 'send') {
  if (!arg) fail('send requires <text>');
  await client.connect(relayUrl, relayToken);
  const sent = await client.sendText(arg, nameArg ?? 'note');
  process.stdout.write('\nSent. Only ciphertext crossed the relay.\nShare link (deliver out of band to the other device):\n\n');
  process.stdout.write('  ' + sent.link + '\n\n');
  process.stdout.write('Staying connected so the other device can fetch it. Press Ctrl-C when done.\n');
  const shutdown = () => { client.close().finally(() => { backend.destroy(); process.exit(0); }); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await new Promise(() => {}); // park until interrupted
}

// open
if (!arg) fail('open requires <meerkat-link>');
const parts = parseShareLink(arg);
if (!parts) fail('invalid meerkat link');

function done(code) {
  client.close().finally(() => { backend.destroy(); process.exit(code); });
}

const timeout = setTimeout(() => fail('timed out waiting for the share on this token'), 30_000);

client.onReceive((share) => {
  if (share.share.manifest.contentId !== parts.contentId) return; // not the one we asked for
  clearTimeout(timeout);
  const opened = share.open(arg); // the link carries the key + the trusted author
  if (!opened.ok) { fail('failed to open: ' + opened.reason); return; }
  process.stdout.write(`\nReceived "${share.name}" from ${share.authorPublicKey.slice(0, 16)}...\n\n`);
  process.stdout.write(dec(opened.content) + '\n\n');
  done(0);
});

await client.connect(relayUrl, relayToken);
process.stdout.write('Listening for the share on the relay...\n');

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
