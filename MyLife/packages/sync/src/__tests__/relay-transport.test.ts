import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RelayTransport,
  SimulatedRelayBackend,
  deriveRelayEphemeralToken,
  RelayTransportError,
} from '../transport/relay-transport';

// ---------------------------------------------------------------------------
// RelayTransport
// ---------------------------------------------------------------------------

describe('RelayTransport', () => {
  let backend: SimulatedRelayBackend;
  let transport: RelayTransport;

  beforeEach(() => {
    backend = new SimulatedRelayBackend();
    transport = new RelayTransport({ backend });
  });

  afterEach(async () => {
    await transport.destroy();
  });

  // -------------------------------------------------------------------------
  // Connection via relay
  // -------------------------------------------------------------------------

  describe('connection via relay', () => {
    it('connects using ephemeral session token', async () => {
      const conn = await transport.connectToPeer('peer-a', 'token-abc-123');

      expect(conn).toBeDefined();
      expect(conn.remoteDeviceId).toBe('peer-a');
      expect(conn.id).toBeTruthy();
    });

    it('sends ciphertext envelopes keyed by token', async () => {
      // Two peers connect with the same token through the same simulated relay.
      const connA = await transport.connectToPeer('peer-b', 'shared-token');

      // Second transport instance for the other peer.
      const transport2 = new RelayTransport({ backend });
      const connB = await transport2.connectToPeer('peer-a', 'shared-token');

      // Register a data handler on B's connection.
      const receivedByB: Uint8Array[] = [];
      connB.onData((data) => receivedByB.push(data));

      // A sends to B through the relay.
      const payload = new Uint8Array([1, 2, 3, 4, 5]);
      await connA.send(payload);

      // Allow microtask delivery.
      await new Promise((r) => setTimeout(r, 10));

      expect(receivedByB).toHaveLength(1);
      expect(receivedByB[0]).toEqual(payload);

      await transport2.destroy();
    });

    it('connection has transport type wan_relay', async () => {
      const conn = await transport.connectToPeer('peer-a', 'token-xyz');

      expect(conn.transport).toBe('wan_relay');
    });

    it('rejects empty relay tokens', async () => {
      await expect(transport.connectToPeer('peer-a', '')).rejects.toThrow(RelayTransportError);
      await expect(transport.connectToPeer('peer-a', '   ')).rejects.toThrow(RelayTransportError);
    });

    it('fires onConnection callback', async () => {
      const onConnection = vi.fn();
      const t = new RelayTransport({ backend, onConnection });

      const conn = await t.connectToPeer('peer-a', 'token-123');

      expect(onConnection).toHaveBeenCalledOnce();
      expect(onConnection).toHaveBeenCalledWith(conn);

      await t.destroy();
    });

    it('enforces max envelope size', async () => {
      const smallTransport = new RelayTransport({
        backend,
        maxEnvelopeBytes: 16,
      });

      const conn = await smallTransport.connectToPeer('peer-a', 'token-123');

      // Within limit should work.
      await expect(conn.send(new Uint8Array(16))).resolves.toBeUndefined();

      // Exceeding limit should throw.
      await expect(conn.send(new Uint8Array(17))).rejects.toThrow(
        'Envelope size 17 exceeds max 16 bytes',
      );

      await smallTransport.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // Token management
  // -------------------------------------------------------------------------

  describe('token management', () => {
    it('tokens rotate per session', async () => {
      const tokenA = transport.createTokenMetadata('ws-1', 'peer-a');
      const tokenB = transport.createTokenMetadata('ws-1', 'peer-a');

      // Each call generates distinct token metadata.
      expect(tokenA.ephemeralToken).not.toBe(tokenB.ephemeralToken);
      // Both target the same peer and workspace.
      expect(tokenA.peerDeviceId).toBe(tokenB.peerDeviceId);
      expect(tokenA.workspaceId).toBe(tokenB.workspaceId);
    });

    it('derives opaque relay tokens from session seed and metadata', () => {
      const seed = new Uint8Array(32).fill(7);
      const token = deriveRelayEphemeralToken('ws-1', 'peer-a', seed);

      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(token).not.toContain('peer-a');
      expect(token).not.toContain('ws-1');
    });

    it('expired tokens are detected', () => {
      const token = transport.createTokenMetadata('ws-1', 'peer-a', 'token-1');

      // Fresh token should not be expired.
      expect(transport.isTokenExpired(token)).toBe(false);

      // Manually set expiresAt to the past.
      const expired = {
        ...token,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      expect(transport.isTokenExpired(expired)).toBe(true);
    });

    it('token metadata includes correct TTL', () => {
      const before = Date.now();
      const token = transport.createTokenMetadata('ws-1', 'peer-a', 'token-1');
      const after = Date.now();

      const createdMs = new Date(token.createdAt).getTime();
      const expiresMs = new Date(token.expiresAt).getTime();

      // Created time should be within the test window.
      expect(createdMs).toBeGreaterThanOrEqual(before);
      expect(createdMs).toBeLessThanOrEqual(after);

      // Expiry should be createdAt + 24h (default TTL).
      const expectedTtl = 24 * 60 * 60 * 1000;
      expect(expiresMs - createdMs).toBe(expectedTtl);
    });

    it('custom TTL is respected', async () => {
      const customTransport = new RelayTransport({
        backend,
        tokenTtlMs: 60_000, // 1 minute
      });

      const token = customTransport.createTokenMetadata('ws-1', 'peer-a', 'tok');
      const createdMs = new Date(token.createdAt).getTime();
      const expiresMs = new Date(token.expiresAt).getTime();

      expect(expiresMs - createdMs).toBe(60_000);

      await customTransport.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // Relay server contract
  // -------------------------------------------------------------------------

  describe('relay server contract', () => {
    it('relay cannot read plaintext (ciphertext only)', async () => {
      // Two peers connect with matching tokens.
      const connA = await transport.connectToPeer('peer-b', 'opaque-token');
      const transport2 = new RelayTransport({ backend });
      const connB = await transport2.connectToPeer('peer-a', 'opaque-token');

      const receivedByB: Uint8Array[] = [];
      connB.onData((data) => receivedByB.push(data));

      // Send opaque binary (simulating ciphertext).
      const ciphertext = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);
      await connA.send(ciphertext);

      await new Promise((r) => setTimeout(r, 10));

      // The relay delivered raw bytes unchanged; it does not interpret them.
      expect(receivedByB).toHaveLength(1);
      expect(receivedByB[0]).toEqual(ciphertext);

      await transport2.destroy();
    });

    it('relay routes by token not device identity', async () => {
      // Connect two peers with token-A.
      const connA1 = await transport.connectToPeer('peer-b', 'token-A');
      const transport2 = new RelayTransport({ backend });
      const connB1 = await transport2.connectToPeer('peer-a', 'token-A');

      // Connect two different peers with token-B.
      const transport3 = new RelayTransport({ backend });
      const connC = await transport3.connectToPeer('peer-d', 'token-B');
      const transport4 = new RelayTransport({ backend });
      const connD = await transport4.connectToPeer('peer-c', 'token-B');

      const receivedByB: Uint8Array[] = [];
      connB1.onData((data) => receivedByB.push(data));
      const receivedByD: Uint8Array[] = [];
      connD.onData((data) => receivedByD.push(data));

      // Send from A to B (token-A route).
      await connA1.send(new Uint8Array([1]));
      // Send from C to D (token-B route).
      await connC.send(new Uint8Array([2]));

      await new Promise((r) => setTimeout(r, 10));

      // Each receives only the message for its own token.
      expect(receivedByB).toHaveLength(1);
      expect(receivedByB[0]).toEqual(new Uint8Array([1]));
      expect(receivedByD).toHaveLength(1);
      expect(receivedByD[0]).toEqual(new Uint8Array([2]));

      await transport2.destroy();
      await transport3.destroy();
      await transport4.destroy();
    });

    it('connection id is unique across relay connections', async () => {
      const connA = await transport.connectToPeer('peer-a', 'tok-1');
      const connB = await transport.connectToPeer('peer-b', 'tok-2');

      expect(connA.id).not.toBe(connB.id);
    });
  });

  // -------------------------------------------------------------------------
  // Connection tracking
  // -------------------------------------------------------------------------

  describe('connection tracking', () => {
    it('tracks connections by device ID', async () => {
      await transport.connectToPeer('peer-a', 'tok-1');
      await transport.connectToPeer('peer-b', 'tok-2');

      expect(transport.getConnections()).toHaveLength(2);
      expect(transport.getConnection('peer-a')).toBeDefined();
      expect(transport.getConnection('peer-b')).toBeDefined();
      expect(transport.getConnection('peer-c')).toBeUndefined();
    });

    it('closeConnection removes a single connection', async () => {
      await transport.connectToPeer('peer-a', 'tok-1');
      expect(transport.getConnections()).toHaveLength(1);

      await transport.closeConnection('peer-a');
      expect(transport.getConnections()).toHaveLength(0);
    });

    it('closeConnection is idempotent for unknown device', async () => {
      await expect(transport.closeConnection('ghost')).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  describe('lifecycle', () => {
    it('destroys cleanly and closes all connections', async () => {
      await transport.connectToPeer('peer-a', 'tok-1');
      await transport.connectToPeer('peer-b', 'tok-2');

      await transport.destroy();

      expect(transport.getConnections()).toHaveLength(0);
    });

    it('destroy is idempotent', async () => {
      await transport.destroy();
      await expect(transport.destroy()).resolves.toBeUndefined();
    });

    it('throws after destroy on connectToPeer', async () => {
      await transport.destroy();

      await expect(transport.connectToPeer('peer-a', 'tok')).rejects.toThrow(
        'RelayTransport has been destroyed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('RelayTransportError has correct name', () => {
      const err = new RelayTransportError('test error');
      expect(err.name).toBe('RelayTransportError');
      expect(err.message).toBe('test error');
      expect(err).toBeInstanceOf(Error);
    });
  });
});

// ---------------------------------------------------------------------------
// SimulatedRelayBackend (standalone)
// ---------------------------------------------------------------------------

describe('SimulatedRelayBackend', () => {
  it('connect returns a session', async () => {
    const backend = new SimulatedRelayBackend();
    const session = await backend.connect('wss://relay.test', 'token-1');

    expect(session).toBeDefined();
    expect(typeof session.send).toBe('function');
    expect(typeof session.onMessage).toBe('function');
    expect(typeof session.close).toBe('function');
  });

  it('wires two sessions with the same token', async () => {
    const backend = new SimulatedRelayBackend();
    const sessionA = await backend.connect('wss://relay.test', 'shared-token');
    const sessionB = await backend.connect('wss://relay.test', 'shared-token');

    const received: Uint8Array[] = [];
    sessionB.onMessage((data) => received.push(data));

    await sessionA.send(new Uint8Array([42]));
    await new Promise((r) => setTimeout(r, 10));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(new Uint8Array([42]));
  });

  it('tracks session count', async () => {
    const backend = new SimulatedRelayBackend();
    expect(backend.sessionCount).toBe(0);

    await backend.connect('wss://relay.test', 'tok-1');
    expect(backend.sessionCount).toBe(1);

    await backend.connect('wss://relay.test', 'tok-2');
    expect(backend.sessionCount).toBe(2);
  });

  it('throws after destroy', async () => {
    const backend = new SimulatedRelayBackend();
    backend.destroy();

    await expect(backend.connect('wss://relay.test', 'tok')).rejects.toThrow(
      'Backend is destroyed',
    );
  });
});
