/**
 * End-to-end friend-code rendezvous (plan 14, MK-016) over the real relay.
 *
 * Alice publishes her signed identity bundle under a fresh friend code; Bob --
 * who has never seen Alice -- types the code, resolves the bundle through the
 * relay, and verifies its self-signature. Proves the "code typed on a stranger's
 * phone resolves" acceptance path, plus one-time consumption and bad-code
 * rejection. The relay only ever holds the opaque base64 record.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  generateDeviceIdentity,
  generateFriendCode,
  publishIdentityToRendezvous,
  resolveIdentityFromRendezvous,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../server';

let server: RelayServer | null = null;

afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
});

describe('friend-code rendezvous e2e (MK-016)', () => {
  it('publishes under a friend code and a stranger resolves + verifies the bundle', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const url = `ws://127.0.0.1:${server.port}`;

    const alice = generateDeviceIdentity('Alice');
    const { code, rendezvousId } = generateFriendCode();

    const shared = await publishIdentityToRendezvous({
      url,
      identity: alice,
      rendezvousId,
      relayHints: [url],
    });
    expect(shared).toBe(code); // the code the user shares matches the rendezvous id

    // Bob has never met Alice: he types her code and resolves it cold.
    const result = await resolveIdentityFromRendezvous({ url, code });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.bundle.deviceId).toBe(alice.publicKey);
      expect(result.bundle.bundle.dhPublicKey).toBe(alice.dhPublicKey);
      expect(result.bundle.bundle.displayName).toBe('Alice');
      expect(result.bundle.bundle.relayHints).toEqual([url]);
    }
  });

  it('is one-time: the same code cannot be resolved twice', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const url = `ws://127.0.0.1:${server.port}`;

    const alice = generateDeviceIdentity('Alice');
    const { code, rendezvousId } = generateFriendCode();
    await publishIdentityToRendezvous({ url, identity: alice, rendezvousId });

    const first = await resolveIdentityFromRendezvous({ url, code });
    expect(first.ok).toBe(true);

    const second = await resolveIdentityFromRendezvous({ url, code });
    expect(second).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects a malformed friend code before any network call', async () => {
    let openedNetwork = false;
    type ResolveInput = Parameters<typeof resolveIdentityFromRendezvous>[0];
    const ThrowingWebSocket: NonNullable<ResolveInput['webSocketImpl']> = class {
      readonly readyState = 0;
      constructor(_url: string) {
        openedNetwork = true;
        throw new Error('Network should not open for a malformed friend code.');
      }
      send(_data: string): void {}
      close(_code?: number, _reason?: string): void {}
      addEventListener(
        _type: 'open' | 'close' | 'error' | 'message',
        _handler: (() => void) | ((ev: unknown) => void) | ((ev: { data: unknown }) => void),
      ): void {}
    };

    const result = await resolveIdentityFromRendezvous({
      url: 'ws://127.0.0.1:1',
      code: 'MEER-NOPE!',
      webSocketImpl: ThrowingWebSocket,
    });
    expect(result).toEqual({ ok: false, reason: 'bad_code' });
    expect(openedNetwork).toBe(false);
  });

  it('reports not_found for a valid custom code that was never published', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const url = `ws://127.0.0.1:${server.port}`;
    const result = await resolveIdentityFromRendezvous({ url, code: 'MEER-ZZZZ-ZZZZ-ZZZZ' });
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('reports not_found for a never-published code', async () => {
    server = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const url = `ws://127.0.0.1:${server.port}`;
    const { code } = generateFriendCode();
    const result = await resolveIdentityFromRendezvous({ url, code });
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });
});
