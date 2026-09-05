/**
 * MK-008 desktop path: MeerkatDirectClient moving an encrypted note between two
 * independent clients across the real relay server over live WebSockets. The
 * client is plain Node here, so this is exactly the macOS <-> Windows desktop
 * transfer the product wants: same binary, same relay, only ciphertext crosses.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  generateDeviceIdentity,
  WebSocketRelayBackend,
  MeerkatDirectClient,
  type ReceivedShare,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../server';

const TOKEN = '7'.repeat(64);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

let server: RelayServer | null = null;
let backend: WebSocketRelayBackend | null = null;

afterEach(async () => {
  backend?.destroy();
  backend = null;
  if (server) {
    await server.close();
    server = null;
  }
});

describe('MeerkatDirectClient over the real relay (MK-008)', () => {
  it('sends an encrypted note from desktop A (Mac) to desktop B (Windows) across the live relay', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    backend = new WebSocketRelayBackend();
    const url = `ws://127.0.0.1:${server.port}`;

    const mac = new MeerkatDirectClient({ identity: generateDeviceIdentity('Mac'), backend });
    const windows = new MeerkatDirectClient({ identity: generateDeviceIdentity('Windows'), backend });
    await mac.connect(url, TOKEN);
    await windows.connect(url, TOKEN);

    const received = new Promise<ReceivedShare>((resolve) => windows.onReceive(resolve));
    const sent = await mac.sendText('cross-platform hello from the Mac', 'note');

    const got = await received;
    const opened = got.open(sent.link);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(dec(opened.content)).toBe('cross-platform hello from the Mac');

    await mac.close();
    await windows.close();
  });

  it('delivers a mailboxed note to a peer that connects after it was sent (store-and-forward)', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    backend = new WebSocketRelayBackend();
    const url = `ws://127.0.0.1:${server.port}`;

    // Sender ships while no peer is present -> the relay mailboxes the envelope.
    const sender = new MeerkatDirectClient({ identity: generateDeviceIdentity('Sender'), backend });
    await sender.connect(url, TOKEN);
    const sent = await sender.sendText('queued while you were away', 'note');

    // Receiver joins later; the relay drains the mailbox on join, and the client
    // buffers the early frame until onReceive is attached.
    const receiver = new MeerkatDirectClient({ identity: generateDeviceIdentity('Receiver'), backend });
    const got = new Promise<ReceivedShare>((resolve) => receiver.onReceive(resolve));
    await receiver.connect(url, TOKEN);

    const received = await got;
    const opened = received.open(sent.link);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(dec(opened.content)).toBe('queued while you were away');

    await sender.close();
    await receiver.close();
  });
});
