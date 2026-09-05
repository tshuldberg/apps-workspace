import { describe, it, expect, vi } from 'vitest';
import { WebRTCTransport, SimulatedWebRTCBackend } from '../transport/webrtc-transport';
import type { WebRTCBackend, WebRTCConnectionState } from '../transport/webrtc-transport';

// A real-marked backend that still moves bytes in-memory but exposes the
// controllable simulateIceConnected/Failed helpers of SimulatedWebRTCBackend.
function realWebRTCBackendDouble(): WebRTCBackend & {
  simulateIceConnected(id: string): void;
  simulateIceFailed(id: string): void;
} {
  const sim = new SimulatedWebRTCBackend();
  return {
    isReal: true,
    connectToPeer: (peerId) => sim.connectToPeer(peerId),
    createPeerConnection: (config) => sim.createPeerConnection(config),
    onPeerFound: (handler) => sim.onPeerFound(handler),
    onIncomingSession: (handler) => sim.onIncomingSession(handler),
    destroy: () => sim.destroy(),
    simulateIceConnected: (id) => sim.simulateIceConnected(id),
    simulateIceFailed: (id) => sim.simulateIceFailed(id),
  };
}

describe('WebRTC connection state honesty', () => {
  it('reports connecting after connect(), never connected on its own', async () => {
    const backend = new SimulatedWebRTCBackend();
    const transport = new WebRTCTransport({ backend });

    await transport.connect('peer-a');

    // The Simulated backend forwards no ICE 'connected' event, so the state
    // must stay 'connecting' -- it never masquerades as connected-for-data.
    expect(transport.getConnectionState('peer-a')).toBe('connecting');

    await transport.destroy();
  });

  it('flips to connected ONLY when a real ICE connected event fires', async () => {
    const backend = new SimulatedWebRTCBackend();
    const transport = new WebRTCTransport({ backend });

    await transport.connect('peer-a');
    expect(transport.getConnectionState('peer-a')).toBe('connecting');

    // Deliver the real ICE 'connected' signal.
    backend.simulateIceConnected('peer-a');
    expect(transport.getConnectionState('peer-a')).toBe('connected');

    await transport.destroy();
  });

  it('no timer advances the state to connected', async () => {
    vi.useFakeTimers();
    const backend = new SimulatedWebRTCBackend();
    const transport = new WebRTCTransport({ backend });

    await transport.connect('peer-b');

    // Advance well past any conceivable optimistic timer; state must not flip.
    await vi.advanceTimersByTimeAsync(4_999);
    expect(transport.getConnectionState('peer-b')).toBe('connecting');

    vi.clearAllTimers();
    vi.useRealTimers();
    await transport.destroy();
  });

  it('emits connecting then connected via onConnectionState in order', async () => {
    const events: Array<[string, WebRTCConnectionState]> = [];
    const backend = new SimulatedWebRTCBackend();
    const transport = new WebRTCTransport({
      backend,
      onConnectionState: (deviceId, state) => events.push([deviceId, state]),
    });

    await transport.connect('peer-c');
    expect(events).toEqual([['peer-c', 'connecting']]);

    backend.simulateIceConnected('peer-c');
    expect(events).toEqual([
      ['peer-c', 'connecting'],
      ['peer-c', 'connected'],
    ]);

    await transport.destroy();
  });

  it('reflects a real ICE failed event', async () => {
    const backend = new SimulatedWebRTCBackend();
    const transport = new WebRTCTransport({ backend });

    await transport.connect('peer-d');
    backend.simulateIceFailed('peer-d');
    expect(transport.getConnectionState('peer-d')).toBe('failed');

    await transport.destroy();
  });

  it('works with a real-marked backend and stays honest', async () => {
    const backend = realWebRTCBackendDouble();
    const transport = new WebRTCTransport({ backend });

    expect(transport.isAvailable).toBe(true);

    await transport.connect('peer-e');
    expect(transport.getConnectionState('peer-e')).toBe('connecting');

    backend.simulateIceConnected('peer-e');
    expect(transport.getConnectionState('peer-e')).toBe('connected');

    await transport.destroy();
  });

  it('a Simulated backend is never available even though connect() resolves', async () => {
    const transport = new WebRTCTransport({ backend: new SimulatedWebRTCBackend() });
    expect(transport.isAvailable).toBe(false);

    // connect() still returns a connection object (mechanism), but availability
    // stays false so the manager/selector never offers or dials this rung.
    const conn = await transport.connect('peer-f');
    expect(conn.transport).toBe('wan_webrtc');
    expect(transport.isAvailable).toBe(false);
    expect(transport.getConnectionState('peer-f')).toBe('connecting');

    await transport.destroy();
  });
});
