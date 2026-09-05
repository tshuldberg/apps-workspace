import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P2PProvider } from '../providers/p2p';
import type { P2PProviderOptions, SignalingTransport, SignalingMessage } from '../providers/p2p';
import type { RTCPeerConnectionLike, RTCDataChannelLike } from '../signaling/webrtc';

function createMockDataChannel(): RTCDataChannelLike {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 'open',
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
  };
}

function createMockPeerConnection(): RTCPeerConnectionLike {
  const channel = createMockDataChannel();
  return {
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer' }),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer' }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    createDataChannel: vi.fn().mockReturnValue(channel),
    close: vi.fn(),
    localDescription: null,
    connectionState: 'new',
    ondatachannel: null,
    onicecandidate: null,
    onconnectionstatechange: null,
  };
}

function createMockSignaling(): SignalingTransport & { handlers: Map<string, (msg: SignalingMessage) => void> } {
  const handlers = new Map<string, (msg: SignalingMessage) => void>();
  return {
    handlers,
    send: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn((code: string, handler: (msg: SignalingMessage) => void) => {
      handlers.set(code, handler);
      return () => { handlers.delete(code); };
    }),
  };
}

describe('P2PProvider', () => {
  let provider: P2PProvider;
  let mockSignaling: ReturnType<typeof createMockSignaling>;
  let mockPeerConnection: RTCPeerConnectionLike;
  let options: P2PProviderOptions;

  beforeEach(() => {
    mockSignaling = createMockSignaling();
    mockPeerConnection = createMockPeerConnection();

    options = {
      deviceId: 'test-device',
      createPeerConnection: () => mockPeerConnection,
      signalingTransport: mockSignaling,
      getOutboundChangeset: vi.fn().mockResolvedValue({
        id: 'cs-1',
        sourceDeviceId: 'test-device',
        createdAt: new Date().toISOString(),
        changes: [],
      }),
      onInboundChangeset: vi.fn().mockResolvedValue(undefined),
    };

    provider = new P2PProvider(options);
  });

  it('has tier "p2p"', () => {
    expect(provider.tier).toBe('p2p');
  });

  it('initialize() resolves without connecting', async () => {
    await provider.initialize();
    expect(provider.connected).toBe(false);
  });

  describe('startPairing()', () => {
    it('creates a pairing session with a valid code', () => {
      const session = provider.startPairing();
      expect(session.code).toMatch(/^\d{6}$/);
      expect(session.deviceId).toBe('test-device');
    });

    it('registers for signaling messages', () => {
      const session = provider.startPairing();
      expect(mockSignaling.onMessage).toHaveBeenCalledWith(
        session.code,
        expect.any(Function),
      );
    });
  });

  describe('joinPairing()', () => {
    it('rejects invalid pairing codes', async () => {
      await expect(provider.joinPairing('abc')).rejects.toThrow(
        'Invalid pairing code',
      );
    });

    it('establishes a connection during pairing', async () => {
      await provider.joinPairing('123456');
      expect(provider.getStatus().connected).toBe(true);
    });
  });

  describe('getStatus()', () => {
    it('returns p2p status', () => {
      const status = provider.getStatus();
      expect(status.tier).toBe('p2p');
      expect(status.connected).toBe(false);
      expect(status.storageLimitBytes).toBe(Infinity);
    });
  });

  describe('sync()', () => {
    it('is a no-op when not connected', async () => {
      await provider.sync();
      expect(options.getOutboundChangeset).not.toHaveBeenCalled();
    });
  });

  describe('destroy()', () => {
    it('clears connection state', async () => {
      provider.startPairing();
      await provider.destroy();
      expect(provider.connected).toBe(false);
      expect(provider.pairingSession).toBeNull();
    });
  });
});
