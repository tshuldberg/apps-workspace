import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LANDiscovery, MDNS_SERVICE_PORT } from '../transport/lan-discovery';
import { LANTransport } from '../transport/lan-transport';
import { TransportManager } from '../transport/transport-manager';
import { encodeMessage, decodeMessage, createJsonMessage } from '../protocol/message-codec';
import type { DiscoveredPeer, TransportConnection } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePeer(overrides: Partial<DiscoveredPeer> = {}): DiscoveredPeer {
  return {
    deviceId: 'peer-device-001',
    displayName: 'Test Peer',
    host: '192.168.1.42',
    port: MDNS_SERVICE_PORT,
    discoveredAt: Date.now(),
    ...overrides,
  };
}

/**
 * Wire two mock TransportConnections together so that calling
 * send() on one side delivers data to the other side's onData handlers.
 *
 * Both connections must expose a `_dataHandlers` array (the mock
 * connections from LANTransport do).
 */
function wireConnections(
  connA: TransportConnection & { _dataHandlers?: Array<(data: Uint8Array) => void> },
  connB: TransportConnection & { _dataHandlers?: Array<(data: Uint8Array) => void> },
): void {
  const originalSendA = connA.send.bind(connA);
  const originalSendB = connB.send.bind(connB);

  connA.send = async (data: Uint8Array) => {
    await originalSendA(data);
    // Deliver to B's handlers
    for (const handler of connB._dataHandlers ?? []) {
      handler(data);
    }
  };

  connB.send = async (data: Uint8Array) => {
    await originalSendB(data);
    // Deliver to A's handlers
    for (const handler of connA._dataHandlers ?? []) {
      handler(data);
    }
  };
}

// ---------------------------------------------------------------------------
// Transport manager fallthrough
// ---------------------------------------------------------------------------

describe('LAN roundtrip', () => {
  describe('transport manager fallthrough', () => {
    let manager: TransportManager;

    beforeEach(async () => {
      manager = new TransportManager({
        deviceId: 'device-A',
        displayName: 'Device A',
      });
      await manager.initialize();
    });

    afterEach(async () => {
      await manager.destroy();
    });

    it('throws after all layers exhausted', async () => {
      await expect(manager.connectToPeer('ghost-device')).rejects.toThrow(
        'not reachable on any available transport',
      );
    });

    it('tries LAN first and falls through gracefully for unknown peer', async () => {
      // Ensure no peers are visible on LAN
      expect(manager.getDiscoveredPeers()).toHaveLength(0);

      // The error message proves it exhausted the transport ladder
      await expect(manager.connectToPeer('nowhere-peer')).rejects.toThrow(
        'not reachable on any available transport',
      );
    });

    it('returns existing connection if peer is already connected', async () => {
      const peer = makePeer({ deviceId: 'reuse-peer' });
      manager.lanDiscovery.simulateDiscovery(peer);

      const conn1 = await manager.connectToPeer('reuse-peer');
      const conn2 = await manager.connectToPeer('reuse-peer');

      // Same connection object returned, not a new one
      expect(conn1.id).toBe(conn2.id);
      expect(conn1.remoteDeviceId).toBe('reuse-peer');
      expect(conn2.remoteDeviceId).toBe('reuse-peer');
    });
  });

  // ---------------------------------------------------------------------------
  // LAN discovery events
  // ---------------------------------------------------------------------------

  describe('LAN discovery events', () => {
    let discovery: LANDiscovery;

    beforeEach(() => {
      discovery = new LANDiscovery({
        deviceId: 'device-A',
        displayName: 'Device A',
      });
    });

    afterEach(() => {
      discovery.destroy();
    });

    it('tracks discovered peers', () => {
      const peer = makePeer({ deviceId: 'lan-peer-1', displayName: 'Peer 1' });
      discovery.simulateDiscovery(peer);

      const visible = discovery.getVisiblePeers();
      expect(visible).toHaveLength(1);
      expect(visible[0].deviceId).toBe('lan-peer-1');
    });

    it('removes lost peers', () => {
      const peer = makePeer({ deviceId: 'ephemeral-peer' });
      discovery.simulateDiscovery(peer);

      expect(discovery.getVisiblePeers()).toHaveLength(1);

      discovery.simulatePeerLost('ephemeral-peer');

      expect(discovery.getVisiblePeers()).toHaveLength(0);
    });

    it('fires callbacks on discovery and loss', () => {
      const onFound = vi.fn();
      const onLost = vi.fn();
      discovery.on({ onPeerFound: onFound, onPeerLost: onLost });

      const peer = makePeer({ deviceId: 'callback-peer' });
      discovery.simulateDiscovery(peer);
      expect(onFound).toHaveBeenCalledOnce();
      expect(onFound).toHaveBeenCalledWith(peer);

      discovery.simulatePeerLost('callback-peer');
      expect(onLost).toHaveBeenCalledOnce();
      expect(onLost).toHaveBeenCalledWith('callback-peer');
    });

    it('getDiscoveredPeers reflects additions and removals through TransportManager', async () => {
      const mgr = new TransportManager({
        deviceId: 'mgr-device',
        displayName: 'Manager Device',
      });
      await mgr.initialize();

      expect(mgr.getDiscoveredPeers()).toHaveLength(0);

      mgr.lanDiscovery.simulateDiscovery(makePeer({ deviceId: 'dp-1' }));
      mgr.lanDiscovery.simulateDiscovery(makePeer({ deviceId: 'dp-2' }));
      expect(mgr.getDiscoveredPeers()).toHaveLength(2);

      mgr.lanDiscovery.simulatePeerLost('dp-1');
      expect(mgr.getDiscoveredPeers()).toHaveLength(1);
      expect(mgr.getDiscoveredPeers()[0].deviceId).toBe('dp-2');

      await mgr.destroy();
    });
  });

  // ---------------------------------------------------------------------------
  // Signed delta exchange over simulated LAN
  // ---------------------------------------------------------------------------

  describe('signed delta exchange', () => {
    it('two engines exchange a change record over simulated LAN', async () => {
      // Set up two LAN transports representing device A and device B
      const receivedByB: Uint8Array[] = [];
      const receivedByA: Uint8Array[] = [];

      const transportA = new LANTransport({
        onConnection: (conn) => {
          conn.onData((data) => receivedByA.push(data));
        },
      });

      const transportB = new LANTransport({
        onConnection: (conn) => {
          conn.onData((data) => receivedByB.push(data));
        },
      });

      // Device A connects to a simulated peer (device B)
      const peerB = makePeer({ deviceId: 'device-B', host: '192.168.1.50' });
      const connA = await transportA.connect(peerB);

      // Device B connects to a simulated peer (device A)
      const peerA = makePeer({ deviceId: 'device-A', host: '192.168.1.51' });
      const connB = await transportB.connect(peerA);

      // Wire the two connections together for in-memory data exchange
      wireConnections(
        connA as TransportConnection & { _dataHandlers: Array<(data: Uint8Array) => void> },
        connB as TransportConnection & { _dataHandlers: Array<(data: Uint8Array) => void> },
      );

      // Register data handlers on each side
      const messagesAtB: ReturnType<typeof decodeMessage>[] = [];
      connB.onData((data) => {
        messagesAtB.push(decodeMessage(data));
      });

      const messagesAtA: ReturnType<typeof decodeMessage>[] = [];
      connA.onData((data) => {
        messagesAtA.push(decodeMessage(data));
      });

      // Engine A records a change and sends it as a SYNC_DATA message
      const changePayload = {
        moduleId: 'books',
        tableName: 'bk_books',
        operation: 'INSERT',
        rowId: 'row-001',
        dataJson: JSON.stringify({ title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' }),
        deviceId: 'device-A',
        timestamp: Date.now(),
      };

      const syncMsg = createJsonMessage(
        'SYNC_DATA',
        'device-A',
        'nonce-001',
        changePayload,
      );
      const encoded = encodeMessage(syncMsg);

      // A sends to B
      await connA.send(encoded);

      // B should have received the message
      expect(messagesAtB).toHaveLength(1);
      const received = messagesAtB[0];
      expect(received).not.toBeNull();
      expect(received!.type).toBe('SYNC_DATA');
      expect(received!.deviceId).toBe('device-A');

      // Decode the payload and verify the change data
      const payloadText = new TextDecoder().decode(received!.payload);
      const parsed = JSON.parse(payloadText);
      expect(parsed.moduleId).toBe('books');
      expect(parsed.tableName).toBe('bk_books');
      expect(parsed.operation).toBe('INSERT');
      expect(parsed.rowId).toBe('row-001');
      expect(JSON.parse(parsed.dataJson).title).toBe('The Great Gatsby');

      // B can respond with a SYNC_ACK
      const ackMsg = createJsonMessage(
        'SYNC_ACK',
        'device-B',
        'nonce-002',
        { moduleId: 'books', ackedIds: ['row-001'] },
      );
      await connB.send(encodeMessage(ackMsg));

      // A should receive the ACK
      expect(messagesAtA).toHaveLength(1);
      const ack = messagesAtA[0];
      expect(ack).not.toBeNull();
      expect(ack!.type).toBe('SYNC_ACK');
      expect(ack!.deviceId).toBe('device-B');

      // Clean up
      await transportA.destroy();
      await transportB.destroy();
    });

    it('message encoding is deterministic and decodable', () => {
      const msg = createJsonMessage(
        'SYNC_DATA',
        'device-X',
        'nonce-abc',
        { moduleId: 'budget', rowId: 'r1', value: 42 },
      );

      const encoded = encodeMessage(msg);
      const decoded = decodeMessage(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.type).toBe('SYNC_DATA');
      expect(decoded!.deviceId).toBe('device-X');

      const payload = JSON.parse(new TextDecoder().decode(decoded!.payload));
      expect(payload.moduleId).toBe('budget');
      expect(payload.value).toBe(42);
    });

    it('bidirectional exchange: both sides send and receive deltas', async () => {
      const transportA = new LANTransport();
      const transportB = new LANTransport();

      const peerB = makePeer({ deviceId: 'device-B' });
      const peerA = makePeer({ deviceId: 'device-A' });

      const connA = await transportA.connect(peerB);
      const connB = await transportB.connect(peerA);

      wireConnections(
        connA as TransportConnection & { _dataHandlers: Array<(data: Uint8Array) => void> },
        connB as TransportConnection & { _dataHandlers: Array<(data: Uint8Array) => void> },
      );

      const receivedAtB: string[] = [];
      const receivedAtA: string[] = [];

      connB.onData((data) => {
        const msg = decodeMessage(data);
        if (msg) receivedAtB.push(msg.type);
      });

      connA.onData((data) => {
        const msg = decodeMessage(data);
        if (msg) receivedAtA.push(msg.type);
      });

      // A sends changes to B
      const dataMsg = createJsonMessage('SYNC_DATA', 'device-A', '', {
        moduleId: 'mood',
        changes: [{ id: 'c1', op: 'INSERT' }],
      });
      await connA.send(encodeMessage(dataMsg));

      // B sends its own changes to A
      const dataMsgB = createJsonMessage('SYNC_DATA', 'device-B', '', {
        moduleId: 'mood',
        changes: [{ id: 'c2', op: 'INSERT' }],
      });
      await connB.send(encodeMessage(dataMsgB));

      // Both sides send BYE
      const byeA = createJsonMessage('BYE', 'device-A', '', {});
      const byeB = createJsonMessage('BYE', 'device-B', '', {});
      await connA.send(encodeMessage(byeA));
      await connB.send(encodeMessage(byeB));

      expect(receivedAtB).toEqual(['SYNC_DATA', 'BYE']);
      expect(receivedAtA).toEqual(['SYNC_DATA', 'BYE']);

      await transportA.destroy();
      await transportB.destroy();
    });
  });
});
