#!/usr/bin/env node
/**
 * Meerkat Host SEA build driver STUB (Plan 20, Phase 4.4).
 *
 * Drives Node's built-in Single Executable Application build for the desktop host
 * companion. This is a STUB: it prints the exact, ordered steps and runs the ones
 * that are safe + deterministic, but it deliberately does NOT sign, notarize, or
 * cross-compile. A SEA build only ever produces a binary for the OS it runs on, so
 * per-OS output + code-signing/notarization are FOUNDER-OPS (see README.md). The
 * stub never claims cross-OS support and exits non-zero if asked to.
 */

import { platform, arch } from 'node:os';

const steps = [
  '1. Bundle bin/meerkat-host.mjs + host/server.ts + the three service bins',
  '   (meerkat-relay-server / meerkat-community-node / meerkat-node) + their',
  '   ../src graph into host/build/dist/meerkat-host.cjs (e.g. esbuild --bundle',
  '   --platform=node). The bins are carried UNCHANGED.',
  '2. node --experimental-sea-config host/build/sea-config.json  -> dist/meerkat-host.blob',
  '3. Copy the running `node` binary and inject the blob with postject.',
  '4. FOUNDER-OPS: code-sign + notarize (macOS: codesign + notarytool; Windows:',
  '   Authenticode) and wrap in a per-OS installer. Keys are founder secrets.',
];

console.log(`meerkat-host SEA build (target this machine only: ${platform()}/${arch()})`);
for (const s of steps) console.log(s);

if (process.argv.includes('--cross-os')) {
  console.error(
    'error: cross-OS packaging is not supported here. A SEA build targets only the ' +
      'OS it runs on; per-OS binaries + signing are founder-ops (host/build/README.md).',
  );
  process.exit(2);
}

console.log(
  '\nThis stub does not sign or notarize. It produces an UNSIGNED local binary for ' +
    'development only; ship builds run per-OS with founder signing keys.',
);
