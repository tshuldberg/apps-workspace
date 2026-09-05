/**
 * MK-008 -- MeerkatDirectClient: encrypted "AirDrop-style" direct send over a
 * relay. Verified in-memory here (SimulatedRelayBackend); the same client runs
 * on desktop (Node/macOS/Windows), browser, and phone against a real relay via
 * WebSocketRelayBackend.
 */

import { describe, it, expect } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import { SimulatedRelayBackend } from '../transport/relay-transport';
import { MeerkatDirectClient, type ReceivedShare } from '../node/direct-client';

const TOKEN = 'a'.repeat(64);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);
const tick = () => new Promise((r) => setTimeout(r, 10));

async function peer(backend: SimulatedRelayBackend, name: string) {
  const client = new MeerkatDirectClient({ identity: generateDeviceIdentity(name), backend });
  await client.connect('sim://relay', TOKEN);
  return client;
}

describe('MeerkatDirectClient (MK-008 encrypted direct send)', () => {
  it('sends an end-to-end encrypted note from A to B, opened with the raw key', async () => {
    const backend = new SimulatedRelayBackend();
    const alice = await peer(backend, 'Alice');
    const bob = await peer(backend, 'Bob');

    const inbox: ReceivedShare[] = [];
    bob.onReceive((s) => inbox.push(s));

    const sent = await alice.sendText('meet at the docks at noon', 'note');
    await tick();

    expect(inbox).toHaveLength(1);
    expect(inbox[0]!.name).toBe('note');
    const opened = inbox[0]!.open(sent.linkKey);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(dec(opened.content)).toBe('meet at the docks at noon');
  });

  it('opens via the out-of-band share link (authorship verified from the link)', async () => {
    const backend = new SimulatedRelayBackend();
    const alice = await peer(backend, 'Alice');
    const bob = await peer(backend, 'Bob');

    let received: ReceivedShare | null = null;
    bob.onReceive((s) => { received = s; });

    const sent = await alice.sendText('secret payload', 'doc');
    await tick();

    const opened = received!.open(sent.link);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(dec(opened.content)).toBe('secret payload');
  });

  it('only ciphertext crosses the relay -- the plaintext is never on the wire', async () => {
    const backend = new SimulatedRelayBackend();
    const alice = await peer(backend, 'Alice');
    const bob = await peer(backend, 'Bob');

    let received: ReceivedShare | null = null;
    bob.onReceive((s) => { received = s; });

    const secret = 'TOP-SECRET-PLAINTEXT-MARKER';
    await alice.sendText(secret, 'note');
    await tick();

    // The transmitted envelope is the JSON of the sealed share: manifest +
    // signature + ciphertext blocks. The plaintext must not appear in it.
    const wire = JSON.stringify(received!.share);
    expect(wire).not.toContain(secret);
  });

  it('rejects opening with the wrong key (fail closed)', async () => {
    const backend = new SimulatedRelayBackend();
    const alice = await peer(backend, 'Alice');
    const bob = await peer(backend, 'Bob');

    let received: ReceivedShare | null = null;
    bob.onReceive((s) => { received = s; });

    await alice.sendText('private', 'note');
    await tick();

    const wrongKey = new Uint8Array(32); // all zeros
    expect(received!.open(wrongKey).ok).toBe(false);
  });

  it('throws when sending before connect', async () => {
    const client = new MeerkatDirectClient({
      identity: generateDeviceIdentity('X'),
      backend: new SimulatedRelayBackend(),
    });
    await expect(client.sendText('x', 'n')).rejects.toThrow(/not connected/i);
  });
});
