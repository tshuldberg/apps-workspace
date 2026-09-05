/**
 * Plan 53 P1: the ceremony adapter, driven against a fake native module.
 *
 * Two fakes are wired to each other so the tests run a REAL ceremony between
 * two simulated phones, protocol and all, with no device. What is asserted here
 * is everything the pure protocol tests cannot see: that the right frames go
 * out in the right order, that teardown never touches the shared module's
 * lifecycle, and that a native refusal fails honestly rather than quietly
 * running without a fresh advertised id.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureSyncPrngFromGlobalCrypto,
  createSignedIdentityBundle,
  generateDeviceIdentity,
  CEREMONY_SERVICE_TYPE,
  CEREMONY_WINDOW_MS,
  type DeviceIdentity,
} from '@mylife/sync';
import type {
  NativeNearbyModule,
  NativeNearbySession,
} from '@mylife/meerkat-native-transport';
import { startProximityCeremony } from '../(root)/data/proximity-ceremony-adapter';

/** A session whose sends land in the paired session's data handler. */
class FakeSession implements NativeNearbySession {
  peerId = 'peer';
  peer: FakeSession | null = null;
  closed = false;
  private handler: ((bytes: Uint8Array) => void) | null = null;
  /**
   * Bytes that arrived before a handler was attached. A real transport buffers
   * for an open session, so dropping them here would invent a race the
   * substrate does not have and would make these tests fail for the wrong
   * reason.
   */
  private pending: Uint8Array[] = [];

  async send(bytes: Uint8Array): Promise<void> {
    if (this.closed) throw new Error('closed');
    this.peer?.deliver(bytes);
  }

  onData(handler: (bytes: Uint8Array) => void): void {
    this.handler = handler;
    const queued = this.pending;
    this.pending = [];
    for (const bytes of queued) handler(bytes);
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  deliver(bytes: Uint8Array): void {
    if (this.handler) this.handler(bytes);
    else this.pending.push(bytes);
  }
}

class FakeNearbyModule implements NativeNearbyModule {
  advertised: Array<{ serviceType: string; handle: string }> = [];
  browsed: string[] = [];
  stoppedAdvertising = 0;
  stoppedBrowsing = 0;
  destroyed = 0;
  session = new FakeSession();
  incoming: ((s: NativeNearbySession) => void) | null = null;
  peerFound: ((p: { id: string; displayName: string }) => void) | null = null;
  /** Set to throw from advertise(), as the native ERR_IDENTITY_BUSY path does. */
  advertiseThrows = false;

  advertise(serviceType: string, handle: string): void {
    if (this.advertiseThrows) throw new Error('ERR_IDENTITY_BUSY');
    this.advertised.push({ serviceType, handle });
  }

  browse(serviceType: string): void { this.browsed.push(serviceType); }
  stopAdvertising(): void { this.stoppedAdvertising += 1; }
  stopBrowsing(): void { this.stoppedBrowsing += 1; }
  async connect(): Promise<NativeNearbySession> { return this.session; }
  onPeerFound(handler: (p: { id: string; displayName: string }) => void): void {
    this.peerFound = handler;
  }
  onPeerLost(): void { /* unused here */ }
  onIncomingSession(handler: (s: NativeNearbySession) => void): void {
    this.incoming = handler;
  }
  destroy(): void { this.destroyed += 1; }
}

describe('proximity ceremony adapter (plan 53 P1)', () => {
  let alice: DeviceIdentity;
  let bob: DeviceIdentity;

  beforeEach(() => {
    configureSyncPrngFromGlobalCrypto();
    alice = generateDeviceIdentity('Alice');
    bob = generateDeviceIdentity('Bob');
  });

  /** Two adapters wired through paired fake sessions. */
  function pairOfPhones() {
    const aMod = new FakeNearbyModule();
    const bMod = new FakeNearbyModule();
    aMod.session.peer = bMod.session;
    bMod.session.peer = aMod.session;

    const aCommitted: unknown[] = [];
    const bCommitted: unknown[] = [];

    const a = startProximityCeremony({
      mod: aMod,
      identity: alice,
      selfBundle: createSignedIdentityBundle(alice),
      onState: () => undefined,
      onCommitted: (peer) => aCommitted.push(peer),
      setTimer: () => null,
      clearTimer: () => undefined,
    });
    const b = startProximityCeremony({
      mod: bMod,
      identity: bob,
      selfBundle: createSignedIdentityBundle(bob),
      onState: () => undefined,
      onCommitted: (peer) => bCommitted.push(peer),
      setTimer: () => null,
      clearTimer: () => undefined,
    });
    return { aMod, bMod, a, b, aCommitted, bCommitted };
  }

  /**
   * Open the wired sessions the way the substrate really does it: both phones
   * advertise and browse, ONE of them discovers the other and connects, and the
   * other receives an incoming session. Modelling both as incoming would
   * deadlock, because neither side initiates.
   */
  async function connect(h: ReturnType<typeof pairOfPhones>): Promise<void> {
    h.bMod.incoming!(h.bMod.session);
    h.aMod.peerFound!({ id: 'b', displayName: '' });
    await Promise.resolve();
    await Promise.resolve();
  }

  it('advertises the ephemeral id on the ceremony service type, then browses', () => {
    const mod = new FakeNearbyModule();
    startProximityCeremony({
      mod,
      identity: alice,
      selfBundle: createSignedIdentityBundle(alice),
      onState: () => undefined,
      onCommitted: () => undefined,
      setTimer: () => null,
      clearTimer: () => undefined,
    });

    expect(mod.advertised).toHaveLength(1);
    expect(mod.advertised[0]!.serviceType).toBe(CEREMONY_SERVICE_TYPE);
    // A fresh 8-byte hex handle, and nothing identifying.
    expect(mod.advertised[0]!.handle).toMatch(/^[0-9a-f]{16}$/);
    expect(mod.advertised[0]!.handle).not.toContain(alice.publicKey);
    expect(mod.browsed).toEqual([CEREMONY_SERVICE_TYPE]);
  });

  it('two ceremonies on the same phone advertise different ids (AC-3)', () => {
    const mod = new FakeNearbyModule();
    const opts = {
      mod,
      identity: alice,
      selfBundle: createSignedIdentityBundle(alice),
      onState: () => undefined,
      onCommitted: () => undefined,
      setTimer: () => null,
      clearTimer: () => undefined,
    };
    startProximityCeremony(opts).cancel();
    startProximityCeremony(opts).cancel();
    expect(mod.advertised[0]!.handle).not.toBe(mod.advertised[1]!.handle);
  });

  it('runs a full ceremony: both reach the SAS, and commit only after both confirm', async () => {
    const h = pairOfPhones();
    await connect(h);

    expect(h.a.state().phase).toBe('awaiting_confirm');
    expect(h.b.state().phase).toBe('awaiting_confirm');
    expect(h.a.state().transcriptHash).toBe(h.b.state().transcriptHash);
    expect(h.a.state().peerBundle?.bundle.displayName).toBe('Bob');

    h.a.confirm();
    // Alice alone is not enough.
    expect(h.a.state().phase).toBe('awaiting_peer');
    expect(h.aCommitted).toHaveLength(0);

    h.b.confirm();
    expect(h.a.state().phase).toBe('committed');
    expect(h.b.state().phase).toBe('committed');
    expect(h.aCommitted).toHaveLength(1);
    expect(h.bCommitted).toHaveLength(1);
  });

  it('whoever confirms SECOND still commits, in either order', async () => {
    // The reducer ignores an accept that arrives before the local confirm, so
    // that a confirm never stops being a precondition. Without the adapter
    // holding and replaying that accept, the second confirmer would sit at
    // awaiting_peer forever while the first one committed.
    for (const firstIsAlice of [true, false]) {
      const h = pairOfPhones();
      await connect(h);
      const [first, second] = firstIsAlice ? [h.a, h.b] : [h.b, h.a];
      first.confirm();
      expect(first.state().phase).toBe('awaiting_peer');
      second.confirm();
      expect(first.state().phase).toBe('committed');
      expect(second.state().phase).toBe('committed');
      expect(h.aCommitted).toHaveLength(1);
      expect(h.bCommitted).toHaveLength(1);
    }
  });

  it('hands the caller the peer bundle exactly once, only on commit', async () => {
    const h = pairOfPhones();
    await connect(h);
    h.a.confirm();
    h.b.confirm();
    expect(h.aCommitted).toHaveLength(1);
    // A late duplicate accept cannot produce a second commit.
    h.bMod.session.deliver(new TextEncoder().encode(JSON.stringify({
      kind: 'ceremony-accept', version: 1, deviceId: alice.publicKey,
      transcriptHash: h.a.state().transcriptHash, signature: 'ab'.repeat(64),
    })));
    expect(h.bCommitted).toHaveLength(1);
  });

  it('tears down transport on commit WITHOUT destroying the shared module', async () => {
    const h = pairOfPhones();
    await connect(h);
    h.a.confirm();
    h.b.confirm();

    expect(h.aMod.stoppedAdvertising).toBe(1);
    expect(h.aMod.stoppedBrowsing).toBe(1);
    expect(h.aMod.session.closed).toBe(true);
    // The sync rung shares this module; destroying it would kill its sessions.
    expect(h.aMod.destroyed).toBe(0);
    expect(h.bMod.destroyed).toBe(0);
  });

  it('cancelling tears down, commits nothing, and never destroys the module', async () => {
    const h = pairOfPhones();
    await connect(h);
    h.a.cancel();

    expect(h.a.state().phase).toBe('cancelled');
    expect(h.aCommitted).toHaveLength(0);
    expect(h.aMod.stoppedAdvertising).toBe(1);
    expect(h.aMod.stoppedBrowsing).toBe(1);
    expect(h.aMod.destroyed).toBe(0);
  });

  it('expiring tears down and commits nothing', () => {
    const mod = new FakeNearbyModule();
    let clock = 1_780_000_000_000;
    let fire: (() => void) | null = null;
    const runner = startProximityCeremony({
      mod,
      identity: alice,
      selfBundle: createSignedIdentityBundle(alice),
      onState: () => undefined,
      onCommitted: () => { throw new Error('must not commit'); },
      // The clock must ADVANCE between start and tick, or the elapsed window is
      // zero and the test would prove nothing.
      now: () => clock,
      setTimer: (fn) => { fire = fn; return 1; },
      clearTimer: () => undefined,
    });
    expect(fire).not.toBeNull();
    clock += CEREMONY_WINDOW_MS;
    fire!();
    expect(runner.state().phase).toBe('expired');
    expect(mod.stoppedAdvertising).toBe(1);
    expect(mod.destroyed).toBe(0);
  });

  it('a native refusal to adopt a fresh id fails the ceremony honestly', () => {
    // ERR_IDENTITY_BUSY. Running anyway would advertise a STALE handle, which
    // silently breaks the privacy guarantee, so it must fail instead.
    const mod = new FakeNearbyModule();
    mod.advertiseThrows = true;
    const states: string[] = [];
    const runner = startProximityCeremony({
      mod,
      identity: alice,
      selfBundle: createSignedIdentityBundle(alice),
      onState: (s) => states.push(s.phase),
      onCommitted: () => { throw new Error('must not commit'); },
      setTimer: () => null,
      clearTimer: () => undefined,
    });
    expect(runner.state().phase).toBe('failed');
    expect(states).toContain('failed');
    // And it never went on to browse under the stale identity.
    expect(mod.browsed).toEqual([]);
  });

  it('a later incoming session is neither adopted nor closed', async () => {
    // It could be the SYNC rung's, since the native module is shared and its
    // session events fan out to every bridge. Closing it would kill live sync
    // work, so a session we did not adopt is left completely alone.
    const h = pairOfPhones();
    await connect(h);
    const other = new FakeSession();
    h.aMod.incoming!(other);
    await Promise.resolve();
    expect(other.closed).toBe(false);
    expect(h.a.state().phase).toBe('awaiting_confirm');
  });

  it('an incoming session that never speaks the ceremony is left completely alone', async () => {
    // The sync rung's traffic surfaces here too. It must not be adopted (which
    // would make it OUR session and close it at teardown) and must not be
    // closed on the spot either.
    const mod = new FakeNearbyModule();
    const runner = startProximityCeremony({
      mod,
      identity: alice,
      selfBundle: createSignedIdentityBundle(alice),
      onState: () => undefined,
      onCommitted: () => undefined,
      setTimer: () => null,
      clearTimer: () => undefined,
    });
    const syncSession = new FakeSession();
    mod.incoming!(syncSession);
    syncSession.deliver(new TextEncoder().encode(JSON.stringify({ kind: 'sync-frame' })));
    await Promise.resolve();

    expect(syncSession.closed).toBe(false);
    expect(runner.state().phase).toBe('discovering');
    // And teardown still does not touch it.
    runner.cancel();
    expect(syncSession.closed).toBe(false);
    expect(mod.destroyed).toBe(0);
  });

  it('garbage and unknown frames are ignored, not crashed on', async () => {
    const h = pairOfPhones();
    await connect(h);
    const before = h.a.state().phase;
    for (const junk of ['not json', '{}', '{"kind":"nope"}', '[]']) {
      h.aMod.session.deliver(new TextEncoder().encode(junk));
    }
    expect(h.a.state().phase).toBe(before);
  });

  it('a transport failure while sending the accept fails honestly', async () => {
    const h = pairOfPhones();
    await connect(h);
    h.aMod.session.send = () => Promise.reject(new Error('gone'));
    h.a.confirm();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.a.state().phase).toBe('failed');
    expect(h.aCommitted).toHaveLength(0);
  });

  it('NC-1: a full ceremony completes with ZERO relay dials (WebSocket spy)', async () => {
    // The static half of NC-1 is the NC-53.1 gate (no ceremony surface may
    // reference the relay machinery). This is the behavioral half: any code
    // path that tried to open a WebSocket during the ceremony would both
    // count a dial and blow up, and the ceremony must still complete purely
    // over the injected Nearby sessions.
    const g = globalThis as { WebSocket?: unknown };
    const original = g.WebSocket;
    let dials = 0;
    g.WebSocket = class {
      constructor() {
        dials += 1;
        throw new Error('NC-1 violated: relay dial during a ceremony');
      }
    };
    try {
      const h = pairOfPhones();
      await connect(h);
      h.a.confirm();
      h.b.confirm();
      expect(h.a.state().phase).toBe('committed');
      expect(h.b.state().phase).toBe('committed');
      expect(dials).toBe(0);
    } finally {
      g.WebSocket = original;
    }
  });

  it('the accept is sent exactly once, not on every later state change', async () => {
    const h = pairOfPhones();
    await connect(h);
    const sent = vi.spyOn(h.aMod.session, 'send');
    h.a.confirm();
    h.a.confirm();
    expect(sent).toHaveBeenCalledTimes(1);
  });
});
