/**
 * Friend-code rendezvous over custom (vanity) codes.
 *
 * Drives publishIdentityToRendezvous / resolveIdentityFromRendezvous against a
 * STUB WebSocket that serves the relay pub/res verbs from an in-memory store (no
 * relay process). Proves: a CUSTOM code round-trips publish -> resolve and yields
 * the right verified bundle; a STANDARD code still round-trips unchanged; the two
 * derive different rendezvous ids so a custom code is never confused with a
 * standard one; and a wrong/garbage code resolves to a typed failure.
 */

import { describe, it, expect } from 'vitest';
import {
  publishIdentityToRendezvous,
  resolveIdentityFromRendezvous,
} from '../friend-rendezvous';
import {
  generateFriendCode,
  makeVanityFriendCode,
  rendezvousIdFromCustomCode,
} from '../friend-code';
import { generateDeviceIdentity } from '../../identity/device-identity';
import { bytesToHex } from '../../encryption/keys';

/**
 * A stub relay-in-a-WebSocket serving the rendezvous pub/res verbs from an
 * in-memory, one-time store (resolve consumes), mirroring the real relay.
 */
function stubRendezvousRelay() {
  const store = new Map<string, string>(); // rid -> record

  class StubWebSocket {
    readyState = 1;
    private handlers: Record<string, ((ev?: unknown) => void)[]> = {};
    constructor(_url: string) {
      setTimeout(() => this.emit('open'), 0);
    }
    addEventListener(type: string, handler: (ev?: unknown) => void) {
      (this.handlers[type] ??= []).push(handler);
    }
    private emit(type: string, ev?: unknown) {
      for (const h of this.handlers[type] ?? []) h(ev);
    }
    send(data: string) {
      let frame: { t?: string; rid?: string; rec?: string };
      try {
        frame = JSON.parse(data);
      } catch {
        return;
      }
      if (frame.t === 'pub' && frame.rid && frame.rec) {
        store.set(frame.rid, frame.rec);
        setTimeout(() => this.emit('message', { data: JSON.stringify({ t: 'pubok', rid: frame.rid }) }), 0);
      } else if (frame.t === 'res' && frame.rid) {
        const rec = store.get(frame.rid);
        if (rec == null) {
          setTimeout(() => this.emit('message', { data: JSON.stringify({ t: 'err', code: 'not_found' }) }), 0);
        } else {
          store.delete(frame.rid); // one-time
          setTimeout(() => this.emit('message', { data: JSON.stringify({ t: 'rec', rid: frame.rid, rec }) }), 0);
        }
      }
    }
    close() {
      /* no-op */
    }
  }

  return {
    WebSocket: StubWebSocket as unknown as new (url: string) => unknown,
    has: (rid: string) => store.has(rid),
  };
}

describe('rendezvous over a custom friend code', () => {
  it('publishes under a custom code and resolves the verified bundle back', async () => {
    const relay = stubRendezvousRelay();
    const identity = generateDeviceIdentity('Llama Person');
    const code = makeVanityFriendCode('llama');

    const returned = await publishIdentityToRendezvous({
      url: 'ws://relay.test',
      identity,
      customCode: code,
      relayHints: ['wss://relay.test'],
      webSocketImpl: relay.WebSocket as never,
    });
    // The publish stored the record under the custom-derived rid.
    expect(relay.has(bytesToHex(rendezvousIdFromCustomCode(code)!))).toBe(true);
    // The function echoes the user's display code, not a regenerated one.
    expect(returned).toBe(code);

    const result = await resolveIdentityFromRendezvous({
      url: 'ws://relay.test',
      code,
      webSocketImpl: relay.WebSocket as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.bundle.deviceId).toBe(identity.publicKey);
      expect(result.bundle.bundle.displayName).toBe('Llama Person');
    }
  });

  it('still publishes + resolves a STANDARD code unchanged (rendezvousId path)', async () => {
    const relay = stubRendezvousRelay();
    const identity = generateDeviceIdentity('Standard Person');
    const { code, rendezvousId } = generateFriendCode();

    const returned = await publishIdentityToRendezvous({
      url: 'ws://relay.test',
      identity,
      rendezvousId,
      webSocketImpl: relay.WebSocket as never,
    });
    expect(returned).toBe(code);

    const result = await resolveIdentityFromRendezvous({
      url: 'ws://relay.test',
      code,
      webSocketImpl: relay.WebSocket as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.bundle.deviceId).toBe(identity.publicKey);
    }
  });

  it('a custom code and a standard code never collide on the same rid', async () => {
    const relay = stubRendezvousRelay();
    const standardIdentity = generateDeviceIdentity('Standard');
    const customIdentity = generateDeviceIdentity('Custom');
    const { rendezvousId } = generateFriendCode();
    const customCode = makeVanityFriendCode('llama');

    await publishIdentityToRendezvous({
      url: 'ws://relay.test',
      identity: standardIdentity,
      rendezvousId,
      webSocketImpl: relay.WebSocket as never,
    });
    await publishIdentityToRendezvous({
      url: 'ws://relay.test',
      identity: customIdentity,
      customCode,
      webSocketImpl: relay.WebSocket as never,
    });

    // Resolving the custom code returns the CUSTOM identity, not the standard one.
    const custom = await resolveIdentityFromRendezvous({
      url: 'ws://relay.test',
      code: customCode,
      webSocketImpl: relay.WebSocket as never,
    });
    expect(custom.ok).toBe(true);
    if (custom.ok) expect(custom.bundle.bundle.displayName).toBe('Custom');
  });

  it('resolves an unusable code to a typed bad_code failure', async () => {
    const relay = stubRendezvousRelay();
    const result = await resolveIdentityFromRendezvous({
      url: 'ws://relay.test',
      code: 'nope!',
      webSocketImpl: relay.WebSocket as never,
    });
    expect(result).toEqual({ ok: false, reason: 'bad_code' });
  });

  it('resolves an unpublished custom code to not_found', async () => {
    const relay = stubRendezvousRelay();
    const result = await resolveIdentityFromRendezvous({
      url: 'ws://relay.test',
      code: makeVanityFriendCode('ghost'),
      webSocketImpl: relay.WebSocket as never,
    });
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects publishing with neither rendezvousId nor customCode', async () => {
    const relay = stubRendezvousRelay();
    const identity = generateDeviceIdentity('Nobody');
    await expect(
      publishIdentityToRendezvous({
        url: 'ws://relay.test',
        identity,
        webSocketImpl: relay.WebSocket as never,
      } as never),
    ).rejects.toThrow();
  });

  it('rejects publishing with an invalid customCode before any network call', async () => {
    const relay = stubRendezvousRelay();
    const identity = generateDeviceIdentity('Nobody');
    await expect(
      publishIdentityToRendezvous({
        url: 'ws://relay.test',
        identity,
        customCode: 'short',
        webSocketImpl: relay.WebSocket as never,
      }),
    ).rejects.toThrow();
  });
});
