import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebRTCManager } from '../signaling/webrtc';
import type { RTCPeerConnectionLike, RTCDataChannelLike } from '../signaling/webrtc';

function createMockChannel(): RTCDataChannelLike {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 'connecting',
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
  };
}

function createMockPC(channel: RTCDataChannelLike): RTCPeerConnectionLike {
  return {
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'test-offer' }),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'test-answer' }),
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

describe('WebRTCManager', () => {
  let channel: RTCDataChannelLike;
  let pc: RTCPeerConnectionLike;
  let onIceCandidate: ReturnType<typeof vi.fn>;
  let onConnected: ReturnType<typeof vi.fn>;
  let onDisconnected: ReturnType<typeof vi.fn>;
  let onMessage: ReturnType<typeof vi.fn>;
  let manager: WebRTCManager;

  beforeEach(() => {
    channel = createMockChannel();
    pc = createMockPC(channel);
    onIceCandidate = vi.fn();
    onConnected = vi.fn();
    onDisconnected = vi.fn();
    onMessage = vi.fn();
    manager = new WebRTCManager({
      createPeerConnection: () => pc,
      onIceCandidate,
      onConnected,
      onDisconnected,
      onMessage,
    });
  });

  it('starts in "new" state', () => {
    expect(manager.state).toBe('new');
  });

  describe('createOffer()', () => {
    it('returns an SDP offer', async () => {
      const offer = await manager.createOffer();
      expect(offer).toEqual({ type: 'offer', sdp: 'test-offer' });
    });

    it('sets state to "connecting"', async () => {
      await manager.createOffer();
      expect(manager.state).toBe('connecting');
    });

    it('creates a data channel', async () => {
      await manager.createOffer();
      expect(pc.createDataChannel).toHaveBeenCalledWith('mylife-sync');
    });
  });

  describe('acceptOffer()', () => {
    it('returns an SDP answer', async () => {
      const answer = await manager.acceptOffer({ type: 'offer', sdp: 'remote-offer' });
      expect(answer).toEqual({ type: 'answer', sdp: 'test-answer' });
    });

    it('sets remote description from the offer', async () => {
      await manager.acceptOffer({ type: 'offer', sdp: 'remote-offer' });
      expect(pc.setRemoteDescription).toHaveBeenCalledWith({
        type: 'offer',
        sdp: 'remote-offer',
      });
    });
  });

  describe('acceptAnswer()', () => {
    it('throws if no offer was created first', async () => {
      await expect(
        manager.acceptAnswer({ type: 'answer', sdp: 'test' }),
      ).rejects.toThrow('No peer connection');
    });

    it('sets remote description from the answer', async () => {
      await manager.createOffer();
      await manager.acceptAnswer({ type: 'answer', sdp: 'remote-answer' });
      expect(pc.setRemoteDescription).toHaveBeenCalledWith({
        type: 'answer',
        sdp: 'remote-answer',
      });
    });
  });

  describe('send()', () => {
    it('throws when data channel is not open', () => {
      expect(() => manager.send('hello')).toThrow('Data channel is not open');
    });

    it('sends data when channel is open', async () => {
      await manager.createOffer();
      // Simulate channel open
      Object.defineProperty(channel, 'readyState', { value: 'open', writable: true });
      manager.send('hello');
      expect(channel.send).toHaveBeenCalledWith('hello');
    });
  });

  describe('close()', () => {
    it('closes channel and peer connection', async () => {
      await manager.createOffer();
      manager.close();
      expect(channel.close).toHaveBeenCalled();
      expect(pc.close).toHaveBeenCalled();
      expect(manager.state).toBe('closed');
    });
  });

  describe('ICE candidates', () => {
    it('forwards ICE candidates to onIceCandidate callback', async () => {
      await manager.createOffer();
      // Simulate ICE candidate
      pc.onicecandidate?.({
        candidate: { candidate: 'test-candidate', sdpMid: '0', sdpMLineIndex: 0 },
      });
      expect(onIceCandidate).toHaveBeenCalledWith({
        candidate: 'test-candidate',
        sdpMid: '0',
        sdpMLineIndex: 0,
      });
    });
  });

  describe('data channel events', () => {
    it('calls onConnected when channel opens', async () => {
      await manager.createOffer();
      channel.onopen?.();
      expect(onConnected).toHaveBeenCalledOnce();
      expect(manager.state).toBe('connected');
    });

    it('calls onMessage when data received', async () => {
      await manager.createOffer();
      channel.onmessage?.({ data: 'test-data' });
      expect(onMessage).toHaveBeenCalledWith('test-data');
    });

    it('calls onDisconnected when channel closes', async () => {
      await manager.createOffer();
      channel.onclose?.();
      expect(onDisconnected).toHaveBeenCalledOnce();
      expect(manager.state).toBe('disconnected');
    });
  });
});
