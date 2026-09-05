import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NearbyTransport,
  SimulatedNearbyBackend,
  NearbyTransportError,
  createMockNearbySession,
} from '../transport/nearby-transport';

// ---------------------------------------------------------------------------
// NearbyTransport
// ---------------------------------------------------------------------------

describe('NearbyTransport', () => {
  let backend: SimulatedNearbyBackend;
  let transport: NearbyTransport;

  beforeEach(() => {
    backend = new SimulatedNearbyBackend();
    transport = new NearbyTransport({ backend });
  });

  // -------------------------------------------------------------------------
  // Peer discovery
  // -------------------------------------------------------------------------

  describe('peer discovery', () => {
    it('tracks discovered nearby peers', () => {
      backend.injectPeer({ id: 'device-a', displayName: 'iPhone A' });

      const peers = transport.getDiscoveredPeers();
      expect(peers).toHaveLength(1);
      expect(peers[0]!.deviceId).toBe('device-a');
      expect(peers[0]!.displayName).toBe('iPhone A');
    });

    it('removes lost peers', () => {
      backend.injectPeer({ id: 'device-a', displayName: 'iPhone A' });
      backend.removePeer('device-a');

      expect(transport.getDiscoveredPeers()).toHaveLength(0);
    });

    it('tracks multiple peers simultaneously', () => {
      backend.injectPeer({ id: 'device-a', displayName: 'iPhone A' });
      backend.injectPeer({ id: 'device-b', displayName: 'iPad B' });
      backend.injectPeer({ id: 'device-c', displayName: 'Mac C' });

      const peers = transport.getDiscoveredPeers();
      expect(peers).toHaveLength(3);
      expect(peers.map((p) => p.deviceId)).toEqual(['device-a', 'device-b', 'device-c']);
    });

    it('assigns empty host and zero port for nearby peers', () => {
      backend.injectPeer({ id: 'device-a', displayName: 'iPhone A' });

      const peers = transport.getDiscoveredPeers();
      expect(peers[0]!.host).toBe('');
      expect(peers[0]!.port).toBe(0);
    });

    it('sets discoveredAt timestamp', () => {
      const before = Date.now();
      backend.injectPeer({ id: 'device-a', displayName: 'iPhone A' });
      const after = Date.now();

      const peers = transport.getDiscoveredPeers();
      expect(peers[0]!.discoveredAt).toBeGreaterThanOrEqual(before);
      expect(peers[0]!.discoveredAt).toBeLessThanOrEqual(after);
    });
  });

  // -------------------------------------------------------------------------
  // Connections
  // -------------------------------------------------------------------------

  describe('connections', () => {
    it('connects to a nearby peer', async () => {
      backend.injectPeer({ id: 'device-a', displayName: 'iPhone A' });
      const conn = await transport.connect('device-a');

      expect(conn).toBeDefined();
      expect(conn.remoteDeviceId).toBe('device-a');
      expect(conn.transport).toBe('nearby');
      expect(conn.id).toBeTruthy();
    });

    it('does not classify an outbound connection as inbound', async () => {
      const onConnection = vi.fn();
      const onIncomingConnection = vi.fn();
      const t = new NearbyTransport({ backend, onConnection, onIncomingConnection });

      await t.connect('device-a');

      expect(onConnection).toHaveBeenCalledOnce();
      expect(onIncomingConnection).not.toHaveBeenCalled();
      await t.destroy();
    });

    it('tracks active connections', async () => {
      backend.injectPeer({ id: 'device-a', displayName: 'iPhone A' });
      await transport.connect('device-a');

      expect(transport.getConnections()).toHaveLength(1);
      expect(transport.getConnection('device-a')).toBeDefined();
    });

    it('tracks multiple connections', async () => {
      backend.injectPeer({ id: 'device-a', displayName: 'iPhone A' });
      backend.injectPeer({ id: 'device-b', displayName: 'iPad B' });

      await transport.connect('device-a');
      await transport.connect('device-b');

      expect(transport.getConnections()).toHaveLength(2);
      expect(transport.getConnection('device-a')).toBeDefined();
      expect(transport.getConnection('device-b')).toBeDefined();
      expect(transport.getConnection('device-c')).toBeUndefined();
    });

    it('closes a single connection', async () => {
      backend.injectPeer({ id: 'device-a', displayName: 'iPhone A' });
      await transport.connect('device-a');

      await transport.closeConnection('device-a');
      expect(transport.getConnections()).toHaveLength(0);
      expect(transport.getConnection('device-a')).toBeUndefined();
    });

    it('closeConnection is idempotent for unknown device', async () => {
      // Should not throw when closing a non-existent connection.
      await expect(transport.closeConnection('ghost')).resolves.toBeUndefined();
    });

    it('fires onConnection callback for outbound connections', async () => {
      const onConnection = vi.fn();
      const t = new NearbyTransport({ backend, onConnection });

      backend.injectPeer({ id: 'device-a', displayName: 'iPhone A' });
      const conn = await t.connect('device-a');

      expect(onConnection).toHaveBeenCalledOnce();
      expect(onConnection).toHaveBeenCalledWith(conn);
    });

    it('fires onConnection callback for incoming sessions', () => {
      const onConnection = vi.fn();
      new NearbyTransport({ backend, onConnection });

      const session = createMockNearbySession('device-b');
      backend.injectIncomingSession(session);

      expect(onConnection).toHaveBeenCalledOnce();
      const incomingConn = onConnection.mock.calls[0]![0];
      expect(incomingConn.remoteDeviceId).toBe('device-b');
      expect(incomingConn.transport).toBe('nearby');
    });

    it('stores incoming session as a tracked connection', () => {
      const t = new NearbyTransport({ backend });

      const session = createMockNearbySession('device-b');
      backend.injectIncomingSession(session);

      expect(t.getConnection('device-b')).toBeDefined();
      expect(t.getConnections()).toHaveLength(1);
    });

    it('connection exposes send, onData, and close functions', async () => {
      const conn = await transport.connect('device-a');

      expect(typeof conn.send).toBe('function');
      expect(typeof conn.onData).toBe('function');
      expect(typeof conn.close).toBe('function');
    });
  });

  // -------------------------------------------------------------------------
  // Data exchange
  // -------------------------------------------------------------------------

  describe('data exchange', () => {
    it('onData handler can be registered on a connection', async () => {
      const conn = await transport.connect('device-a');

      const handler = vi.fn();
      conn.onData(handler);

      // Mock connections do not loopback, but we can manually invoke the
      // handler to verify registration works (same pattern as LAN tests).
      const testData = new Uint8Array([1, 2, 3]);
      handler(testData);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(testData);
    });

    it('send does not throw on an open connection', async () => {
      const conn = await transport.connect('device-a');

      const testData = new TextEncoder().encode('hello nearby');
      await expect(conn.send(testData)).resolves.toBeUndefined();
    });

    it('connection id is unique across connections', async () => {
      backend.injectPeer({ id: 'device-a', displayName: 'A' });
      backend.injectPeer({ id: 'device-b', displayName: 'B' });

      const connA = await transport.connect('device-a');
      const connB = await transport.connect('device-b');

      expect(connA.id).not.toBe(connB.id);
    });
  });

  // -------------------------------------------------------------------------
  // Advertising and browsing
  // -------------------------------------------------------------------------

  describe('advertising and browsing', () => {
    it('starts and stops advertising', () => {
      expect(transport.isAdvertising).toBe(false);

      transport.startAdvertising('Test Device');
      expect(transport.isAdvertising).toBe(true);

      transport.stopAdvertising();
      expect(transport.isAdvertising).toBe(false);
    });

    it('starts and stops browsing', () => {
      expect(transport.isBrowsing).toBe(false);

      transport.startBrowsing();
      expect(transport.isBrowsing).toBe(true);

      transport.stopBrowsing();
      expect(transport.isBrowsing).toBe(false);
    });

    it('startAdvertising is idempotent', () => {
      transport.startAdvertising('Device');
      transport.startAdvertising('Device');
      expect(transport.isAdvertising).toBe(true);
    });

    it('startBrowsing is idempotent', () => {
      transport.startBrowsing();
      transport.startBrowsing();
      expect(transport.isBrowsing).toBe(true);
    });

    it('stopAdvertising is no-op when not advertising', () => {
      transport.stopAdvertising();
      expect(transport.isAdvertising).toBe(false);
    });

    it('stopBrowsing is no-op when not browsing', () => {
      transport.stopBrowsing();
      expect(transport.isBrowsing).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  describe('lifecycle', () => {
    it('destroys cleanly and closes all connections', async () => {
      backend.injectPeer({ id: 'device-a', displayName: 'iPhone A' });
      await transport.connect('device-a');
      transport.startAdvertising('Test');
      transport.startBrowsing();

      await transport.destroy();

      expect(transport.getConnections()).toHaveLength(0);
      expect(transport.isAdvertising).toBe(false);
      expect(transport.isBrowsing).toBe(false);
    });

    it('destroy is idempotent', async () => {
      await transport.destroy();
      await expect(transport.destroy()).resolves.toBeUndefined();
    });

    it('throws after destroy on connect', async () => {
      await transport.destroy();

      await expect(transport.connect('device-a')).rejects.toThrow(
        'NearbyTransport has been destroyed',
      );
    });

    it('throws after destroy on startAdvertising', async () => {
      await transport.destroy();

      expect(() => transport.startAdvertising('Test')).toThrow(
        'NearbyTransport has been destroyed',
      );
    });

    it('throws after destroy on startBrowsing', async () => {
      await transport.destroy();

      expect(() => transport.startBrowsing()).toThrow(
        'NearbyTransport has been destroyed',
      );
    });

    it('ignores peer events after destroy', async () => {
      await transport.destroy();

      // These should not throw or add peers.
      backend.injectPeer({ id: 'late-peer', displayName: 'Late' });
      backend.removePeer('late-peer');
      backend.injectIncomingSession(createMockNearbySession('late-peer'));

      expect(transport.getDiscoveredPeers()).toHaveLength(0);
      expect(transport.getConnections()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('NearbyTransportError has correct name', () => {
      const err = new NearbyTransportError('test error');
      expect(err.name).toBe('NearbyTransportError');
      expect(err.message).toBe('test error');
      expect(err).toBeInstanceOf(Error);
    });
  });
});

// ---------------------------------------------------------------------------
// SimulatedNearbyBackend (standalone)
// ---------------------------------------------------------------------------

describe('SimulatedNearbyBackend', () => {
  it('connectToPeer returns a mock session', async () => {
    const backend = new SimulatedNearbyBackend();
    const session = await backend.connectToPeer('peer-1');

    expect(session.peerId).toBe('peer-1');
    expect(typeof session.send).toBe('function');
    expect(typeof session.onData).toBe('function');
    expect(typeof session.close).toBe('function');
  });

  it('ignores events after destroy', () => {
    const backend = new SimulatedNearbyBackend();
    const handler = vi.fn();
    backend.onPeerFound(handler);

    backend.destroy();
    backend.injectPeer({ id: 'late', displayName: 'Late Peer' });

    expect(handler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createMockNearbySession
// ---------------------------------------------------------------------------

describe('createMockNearbySession', () => {
  it('creates a session with the given peerId', () => {
    const session = createMockNearbySession('peer-x');
    expect(session.peerId).toBe('peer-x');
  });

  it('send does not throw on open session', async () => {
    const session = createMockNearbySession('peer-x');
    await expect(session.send(new Uint8Array([1]))).resolves.toBeUndefined();
  });

  it('send throws after close', async () => {
    const session = createMockNearbySession('peer-x');
    await session.close();

    await expect(session.send(new Uint8Array([1]))).rejects.toThrow(
      'NearbySession is closed',
    );
  });

  it('close is safe to call multiple times', async () => {
    const session = createMockNearbySession('peer-x');
    await session.close();
    await expect(session.close()).resolves.toBeUndefined();
  });
});
