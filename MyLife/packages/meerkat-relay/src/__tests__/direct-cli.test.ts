/**
 * meerkat-direct CLI regression guard (audit P0).
 *
 * The audit found `send` connected with the sha512-derived relay token while
 * `open` connected with the RAW phrase, so the two sides joined different
 * rendezvous groups and could never meet. The CLI runs argv on import, so it
 * cannot be imported directly; instead we (1) assert the source derives the
 * token once and uses that SAME derived value on both code paths, and (2)
 * prove a round trip succeeds when both sides derive from a short human phrase
 * exactly the way the CLI does.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  generateDeviceIdentity,
  WebSocketRelayBackend,
  MeerkatDirectClient,
  sha512Hex,
  type ReceivedShare,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../server';

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = join(here, '..', '..', 'bin', 'meerkat-direct.mjs');
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

let server: RelayServer | null = null;
let backend: WebSocketRelayBackend | null = null;
afterEach(async () => {
  backend?.destroy();
  backend = null;
  if (server) { await server.close(); server = null; }
});

describe('meerkat-direct CLI token derivation (audit P0 regression)', () => {
  it('derives the relay token once and uses it on BOTH send and open', () => {
    const src = readFileSync(cliPath, 'utf8');

    // The derived token: sha512Hex(...).slice(0, 64).
    expect(src).toMatch(/relayToken\s*=\s*sha512Hex\(.*\)\.slice\(0,\s*64\)/);

    // Every client.connect(...) call must pass relayToken, never the raw token.
    const connectArgs = [...src.matchAll(/client\.connect\(\s*relayUrl\s*,\s*(\w+)\s*\)/g)]
      .map((m) => m[1]);
    expect(connectArgs.length).toBeGreaterThanOrEqual(2); // send + open
    for (const arg of connectArgs) {
      expect(arg).toBe('relayToken');
    }
    // And the raw phrase is never handed to connect directly (the bug).
    expect(src).not.toMatch(/client\.connect\(\s*relayUrl\s*,\s*token\s*\)/);
  });

  it('round-trips a sealed note when both sides derive the token from a short phrase', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    backend = new WebSocketRelayBackend();
    const url = `ws://127.0.0.1:${server.port}`;

    // A short human phrase (< 16 chars) is exactly the case that also tripped
    // the relay's min-token gate; both sides derive identically, as the CLI does.
    const phrase = 'otter-7';
    const relayToken = sha512Hex(new TextEncoder().encode(phrase)).slice(0, 64);
    expect(relayToken).toHaveLength(64);

    const mac = new MeerkatDirectClient({ identity: generateDeviceIdentity('Mac'), backend });
    const pc = new MeerkatDirectClient({ identity: generateDeviceIdentity('Windows'), backend });

    await mac.connect(url, relayToken);
    await pc.connect(url, relayToken);

    const received = new Promise<ReceivedShare>((resolve) => pc.onReceive(resolve));
    const sent = await mac.sendText('handoff across machines', 'note');

    const got = await received;
    const opened = got.open(sent.link);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(dec(opened.content)).toBe('handoff across machines');

    await mac.close();
    await pc.close();
  });
});
