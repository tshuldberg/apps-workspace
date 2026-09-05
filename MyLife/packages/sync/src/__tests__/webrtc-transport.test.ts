import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WebRTCTransport,
  SimulatedWebRTCBackend,
  WebRTCTransportError,
} from '../transport/webrtc-transport';
import type { SignalingFn, WebRTCPeerSession } from '../transport/webrtc-transport';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a simple in-memory signaling pair. Messages sent by side A
 * are delivered to side B's handler, and vice versa.
 */
function createSignalingPair(): [SignalingFn, SignalingFn] {
  const handlersA: Array<(data: string) => void> = [];
  const handlersB: Array<(data: string) => void> = [];

  const sigA: SignalingFn = {
    async send(data: string) {
      for (const h of handlersB) h(data);
    },
    onMessage(handler) {
      handlersA.push(handler);
      return () => {
        const idx = handlersA.indexOf(handler);
        if (idx >= 0) handlersA.splice(idx, 1);
      };
    },
  };

  const sigB: SignalingFn = {
    async send(data: string) {
      for (const h of handlersA) h(data);
    },
    onMessage(handler) {
      handlersB.push(handler);
      return () => {
        const idx = handlersB.indexOf(handler);
        if (idx >= 0) handlersB.splice(idx, 1);
      };
    },
  };

  return [sigA, sigB];
}

/**
 * Access the internal signaling sessions list from the simulated backend.
 * Used to wire session pairs for the signaling-driven path tests.
 */
function getSignalingSessions(backend: SimulatedWebRTCBackend): unknown[] {
  return (backend as unknown as { _signalingSessionsList: unknown[] })._signalingSessionsList;
}

// ---------------------------------------------------------------------------
// WebRTCTransport -- simple connect path (backend-driven)
// ---------------------------------------------------------------------------

describe('WebRTCTransport', () => {
  let backend: SimulatedWebRTCBackend;
  let transport: WebRTCTransport;

  beforeEach(() => {
    backend = new SimulatedWebRTCBackend();
    transport = new WebRTCTransport({ backend });
  });

  afterEach(async () => {
    await transport.destroy();
  });

  // -------------------------------------------------------------------------
  // Simple connect (backend-driven, same as NearbyTransport pattern)
  // -------------------------------------------------------------------------

  describe('peer connection (simple path)', () => {
    it('creates connection via simple connect', async () => {
      const conn = await transport.connect('peer-a');

      expect(conn).toBeDefined();
      expect(conn.remoteDeviceId).toBe('peer-a');
      expect(conn.transport).toBe('wan_webrtc');
      expect(conn.id).toBeTruthy();
    });

    it('accepts incoming connection from backend', () => {
      const onConnection = vi.fn();
      const t = new WebRTCTransport({ backend, onConnection });

      const mockSession: WebRTCPeerSession = {
        peerId: 'remote-peer',
        async send() {},
        onData() {},
        async close() {},
        createDataChannel: () => ({ readyState: 'closed', send() {}, onMessage() {}, onOpen() {}, onClose() {}, close() {} }),
        onDataChannel() {},
        async createOffer() { return ''; },
        async createAnswer() { return ''; },
        async setRemoteDescription() {},
        onIceCandidate() {},
        async addIceCandidate() {},
        onConnectionStateChange() {},
      };
      backend.injectIncomingSession(mockSession);

      expect(onConnection).toHaveBeenCalledOnce();
      const incomingConn = onConnection.mock.calls[0]![0];
      expect(incomingConn.remoteDeviceId).toBe('remote-peer');
      expect(incomingConn.transport).toBe('wan_webrtc');

      void t.destroy();
    });

    it('does not classify an outbound connection as inbound', async () => {
      const onConnection = vi.fn();
      const onIncomingConnection = vi.fn();
      const t = new WebRTCTransport({ backend, onConnection, onIncomingConnection });

      await t.connect('remote-peer');

      expect(onConnection).toHaveBeenCalledOnce();
      expect(onIncomingConnection).not.toHaveBeenCalled();
      await t.destroy();
    });

    it('times out ICE after 5 seconds', async () => {
      vi.useFakeTimers();

      backend.setConnectDelay(10_000);

      // Capture the rejection so it is handled immediately. The promise
      // rejects via a fake-timer setTimeout; marking it as handled prevents
      // the "unhandled rejection" noise from leaking after the test ends.
      let caughtError: Error | null = null;
      const connectPromise = transport.connect('stalled-peer').catch((err) => {
        caughtError = err as Error;
      });

      await vi.advanceTimersByTimeAsync(6_000);
      await connectPromise;

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError!.message).toContain('ICE gathering timed out');

      // Flush the remaining backend delay timer so it does not dangle.
      await vi.advanceTimersByTimeAsync(10_000);
      vi.useRealTimers();
    });

    it('tracks active connections', async () => {
      await transport.connect('peer-a');
      await transport.connect('peer-b');

      expect(transport.getConnections()).toHaveLength(2);
      expect(transport.getConnection('peer-a')).toBeDefined();
      expect(transport.getConnection('peer-b')).toBeDefined();
      expect(transport.getConnection('peer-c')).toBeUndefined();
    });

    it('closes connections cleanly', async () => {
      await transport.connect('peer-a');

      expect(transport.getConnections()).toHaveLength(1);

      await transport.closeConnection('peer-a');
      expect(transport.getConnections()).toHaveLength(0);
      expect(transport.getConnection('peer-a')).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Signaling-driven connection paths
  // -------------------------------------------------------------------------

  describe('signaling-driven connection', () => {
    it('connectToPeer with signaling establishes a connection', async () => {
      const [sigA, sigB] = createSignalingPair();

      // Start both offerer and answerer in parallel.
      const transport2 = new WebRTCTransport({ backend });
      const offererPromise = transport.connectToPeer('peer-b', sigA);
      const acceptPromise = transport2.acceptConnection('peer-a', 'offer-sdp', sigB);

      // Wire the two signaling sessions so data channels open.
      const sessions = getSignalingSessions(backend);
      if (sessions.length >= 2) {
        backend.wireSessionPair(
          sessions[sessions.length - 2]! as WebRTCPeerSession,
          sessions[sessions.length - 1]! as WebRTCPeerSession,
        );
      }

      const [connA, connB] = await Promise.all([offererPromise, acceptPromise]);

      expect(connA).toBeDefined();
      expect(connA.remoteDeviceId).toBe('peer-b');
      expect(connA.transport).toBe('wan_webrtc');

      expect(connB).toBeDefined();
      expect(connB.remoteDeviceId).toBe('peer-a');
      expect(connB.transport).toBe('wan_webrtc');

      await transport2.destroy();
    });

    it('acceptConnection returns connection with correct transport', async () => {
      const [sigA, sigB] = createSignalingPair();
      const onConnection = vi.fn();
      const responder = new WebRTCTransport({ backend, onConnection });

      const offererPromise = transport.connectToPeer('responder-device', sigA);
      const acceptPromise = responder.acceptConnection('offerer-device', 'offer-sdp', sigB);

      const sessions = getSignalingSessions(backend);
      if (sessions.length >= 2) {
        backend.wireSessionPair(
          sessions[sessions.length - 2]! as WebRTCPeerSession,
          sessions[sessions.length - 1]! as WebRTCPeerSession,
        );
      }

      const [, connB] = await Promise.all([offererPromise, acceptPromise]);

      expect(onConnection).toHaveBeenCalledOnce();
      expect(connB.remoteDeviceId).toBe('offerer-device');
      expect(connB.transport).toBe('wan_webrtc');

      await responder.destroy();
    });

    it('closes the prior session for a peer before a new dial replaces it (no orphan leak)', async () => {
      // Regression for the glare / repeated-offer resource leak: a second
      // connect for the same deviceId used to overwrite the map entry and orphan
      // the prior RTCPeerConnection unreachably. It must be closed instead.
      const closed: string[] = [];
      let n = 0;
      const trackingSession = (): WebRTCPeerSession => {
        const id = `s${++n}`;
        return {
          peerId: 'peer-x',
          async send() {},
          onData() {},
          async close() { closed.push(id); },
          createDataChannel: () => ({ readyState: 'open', send() {}, onMessage() {}, onOpen() {}, onClose() {}, close() {} }),
          onDataChannel() {},
          async createOffer() { return 'offer'; },
          async createAnswer() { return 'answer'; },
          async setRemoteDescription() {},
          onIceCandidate() {},
          async addIceCandidate() {},
          onConnectionStateChange() {},
        };
      };
      const trackingBackend = {
        isReal: true as const,
        connectToPeer: async () => trackingSession(),
        createPeerConnection: () => trackingSession(),
        onPeerFound() {},
        onIncomingSession() {},
        destroy() {},
      };
      const t = new WebRTCTransport({ backend: trackingBackend });
      const deadSig: SignalingFn = { async send() {}, onMessage() { return () => {}; } };

      // Two dials for the same peer, neither awaited (they hang without wiring).
      void t.connectToPeer('peer-x', deadSig).catch(() => {});
      void t.connectToPeer('peer-x', deadSig).catch(() => {});
      // The second dial must have closed the first session synchronously.
      expect(closed).toContain('s1');

      await t.destroy();
    });

    it('connectToPeer times out ICE after 5 seconds', async () => {
      vi.useFakeTimers();

      const deadSig: SignalingFn = {
        async send() {},
        onMessage() { return () => {}; },
      };

      // No wireSessionPair means the channel never opens.
      const connectPromise = transport.connectToPeer('stalled-peer', deadSig);
      // Attach the rejection observer before advancing fake time so Node never
      // sees the expected timeout as an asynchronously handled rejection.
      const rejection = expect(connectPromise).rejects.toThrow('ICE gathering timed out');

      await vi.advanceTimersByTimeAsync(6_000);
      await rejection;

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('two peers exchange data through wired sessions', async () => {
      const [sigA, sigB] = createSignalingPair();
      const transport2 = new WebRTCTransport({ backend });

      const p1 = transport.connectToPeer('peer-b', sigA);
      const p2 = transport2.acceptConnection('peer-a', 'offer', sigB);

      const sessions = getSignalingSessions(backend);
      backend.wireSessionPair(
        sessions[sessions.length - 2]! as WebRTCPeerSession,
        sessions[sessions.length - 1]! as WebRTCPeerSession,
      );

      const [connA, connB] = await Promise.all([p1, p2]);

      const receivedByB: Uint8Array[] = [];
      connB.onData((data) => receivedByB.push(data));

      const testData = new Uint8Array([10, 20, 30]);
      await connA.send(testData);

      // Allow microtask delivery.
      await new Promise((r) => setTimeout(r, 10));

      expect(receivedByB).toHaveLength(1);
      expect(receivedByB[0]).toEqual(testData);

      await transport2.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // Data exchange
  // -------------------------------------------------------------------------

  describe('data exchange via DataChannel', () => {
    it('connection has transport type wan_webrtc', async () => {
      const conn = await transport.connect('peer-a');
      expect(conn.transport).toBe('wan_webrtc');
    });

    it('send does not throw on an open connection', async () => {
      const conn = await transport.connect('peer-a');
      const testData = new TextEncoder().encode('hello webrtc');
      await expect(conn.send(testData)).resolves.toBeUndefined();
    });

    it('connection id is unique across connections', async () => {
      const connA = await transport.connect('peer-a');
      const connB = await transport.connect('peer-b');

      expect(connA.id).not.toBe(connB.id);
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  describe('lifecycle', () => {
    it('destroys cleanly and closes all connections', async () => {
      await transport.connect('peer-a');
      expect(transport.getConnections()).toHaveLength(1);

      await transport.destroy();
      expect(transport.getConnections()).toHaveLength(0);
    });

    it('destroy is idempotent', async () => {
      await transport.destroy();
      await expect(transport.destroy()).resolves.toBeUndefined();
    });

    it('throws after destroy on connect', async () => {
      await transport.destroy();

      await expect(transport.connect('peer-a')).rejects.toThrow(
        'WebRTCTransport has been destroyed',
      );
    });

    it('throws after destroy on connectToPeer', async () => {
      await transport.destroy();
      const [sigA] = createSignalingPair();

      await expect(transport.connectToPeer('peer-a', sigA)).rejects.toThrow(
        'WebRTCTransport has been destroyed',
      );
    });

    it('throws after destroy on acceptConnection', async () => {
      await transport.destroy();
      const [, sigB] = createSignalingPair();

      await expect(transport.acceptConnection('peer-a', 'sdp', sigB)).rejects.toThrow(
        'WebRTCTransport has been destroyed',
      );
    });

    it('closeConnection is idempotent for unknown device', async () => {
      await expect(transport.closeConnection('ghost')).resolves.toBeUndefined();
    });

    it('ignores incoming sessions after destroy', async () => {
      const onConnection = vi.fn();
      const t = new WebRTCTransport({ backend, onConnection });
      await t.destroy();

      const mockSession: WebRTCPeerSession = {
        peerId: 'late-peer',
        async send() {},
        onData() {},
        async close() {},
        createDataChannel: () => ({ readyState: 'closed', send() {}, onMessage() {}, onOpen() {}, onClose() {}, close() {} }),
        onDataChannel() {},
        async createOffer() { return ''; },
        async createAnswer() { return ''; },
        async setRemoteDescription() {},
        onIceCandidate() {},
        async addIceCandidate() {},
        onConnectionStateChange() {},
      };
      backend.injectIncomingSession(mockSession);

      expect(onConnection).not.toHaveBeenCalled();
      expect(t.getConnections()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('WebRTCTransportError has correct name', () => {
      const err = new WebRTCTransportError('test error');
      expect(err.name).toBe('WebRTCTransportError');
      expect(err.message).toBe('test error');
      expect(err).toBeInstanceOf(Error);
    });
  });
});

// ---------------------------------------------------------------------------
// SimulatedWebRTCBackend (standalone)
// ---------------------------------------------------------------------------

describe('SimulatedWebRTCBackend', () => {
  it('connectToPeer returns a mock session', async () => {
    const backend = new SimulatedWebRTCBackend();
    const session = await backend.connectToPeer('peer-1');

    expect(session.peerId).toBe('peer-1');
    expect(typeof session.send).toBe('function');
    expect(typeof session.onData).toBe('function');
    expect(typeof session.close).toBe('function');
  });

  it('createPeerConnection returns a valid signaling session', () => {
    const backend = new SimulatedWebRTCBackend();
    const session = backend.createPeerConnection();

    expect(session).toBeDefined();
    expect(typeof session.createDataChannel).toBe('function');
    expect(typeof session.createOffer).toBe('function');
    expect(typeof session.createAnswer).toBe('function');
    expect(typeof session.close).toBe('function');
  });

  it('wireSessionPair connects two sessions and opens channels', () => {
    const backend = new SimulatedWebRTCBackend();
    const offerer = backend.createPeerConnection();
    const answerer = backend.createPeerConnection();

    const channel = offerer.createDataChannel('test');
    backend.wireSessionPair(offerer, answerer);

    expect(channel.readyState).toBe('open');
  });

  it('ignores events after destroy', () => {
    const backend = new SimulatedWebRTCBackend();
    const handler = vi.fn();
    backend.onPeerFound(handler);

    backend.destroy();
    backend.injectPeer({ id: 'late', displayName: 'Late Peer' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('injectIncomingSession delivers session to handler', () => {
    const backend = new SimulatedWebRTCBackend();
    const handler = vi.fn();
    backend.onIncomingSession(handler);

    const session: WebRTCPeerSession = {
      peerId: 'remote',
      async send() {},
      onData() {},
      async close() {},
      createDataChannel: () => ({ readyState: 'closed', send() {}, onMessage() {}, onOpen() {}, onClose() {}, close() {} }),
      onDataChannel() {},
      async createOffer() { return ''; },
      async createAnswer() { return ''; },
      async setRemoteDescription() {},
      onIceCandidate() {},
      async addIceCandidate() {},
      onConnectionStateChange() {},
    };
    backend.injectIncomingSession(session);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(session);
  });

  it('setConnectDelay slows connection', async () => {
    const backend = new SimulatedWebRTCBackend();
    backend.setConnectDelay(50);

    const start = Date.now();
    await backend.connectToPeer('slow-peer');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it('throws after destroy on connectToPeer', async () => {
    const backend = new SimulatedWebRTCBackend();
    backend.destroy();

    await expect(backend.connectToPeer('peer')).rejects.toThrow('Backend is destroyed');
  });

  it('throws after destroy on createPeerConnection', () => {
    const backend = new SimulatedWebRTCBackend();
    backend.destroy();

    expect(() => backend.createPeerConnection()).toThrow('Backend is destroyed');
  });

  it('createOffer returns JSON SDP string', async () => {
    const backend = new SimulatedWebRTCBackend();
    const session = backend.createPeerConnection();
    const offer = await session.createOffer();

    const parsed = JSON.parse(offer) as { type: string; sdp: string };
    expect(parsed.type).toBe('offer');
    expect(parsed.sdp).toContain('sim-offer');
  });

  it('createAnswer returns JSON SDP string', async () => {
    const backend = new SimulatedWebRTCBackend();
    const session = backend.createPeerConnection();
    const answer = await session.createAnswer('remote-offer');

    const parsed = JSON.parse(answer) as { type: string; sdp: string };
    expect(parsed.type).toBe('answer');
    expect(parsed.sdp).toContain('sim-answer');
  });
});
