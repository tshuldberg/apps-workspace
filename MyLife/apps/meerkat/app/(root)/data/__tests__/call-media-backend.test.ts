import { describe, expect, it, vi } from 'vitest';
import type { CallMediaConnectionEvent } from '@mylife/sync';
import { loadCallMediaBackend } from '../call-media-backend';

// A fake @livekit/react-native-webrtc module: records what the adapter drives, and lets a
// test fire the connection-state and ICE callbacks the real SDK would.
function fakeModule() {
  const listeners: Record<string, Array<(e: any) => void>> = {};
  const tracks = [
    { kind: 'audio', enabled: true, stop: vi.fn() },
    { kind: 'video', enabled: true, stop: vi.fn() },
  ];
  const stream = {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
  };
  const pc = {
    connectionState: 'new' as string,
    iceConnectionState: 'new' as string,
    added: [] as string[],
    closed: false,
    statsRows: [] as Record<string, unknown>[],
    addTrack(track: { kind: string }) { pc.added.push(track.kind); return {}; },
    getSenders() { return []; },
    async createOffer(opts?: unknown) { return { type: 'offer', sdp: `offer-sdp${opts ? '-restart' : ''}` }; },
    async createAnswer() { return { type: 'answer', sdp: 'answer-sdp' }; },
    async setLocalDescription() {},
    async setRemoteDescription() {},
    async addIceCandidate() {},
    async getStats() { return { forEach: (cb: (v: Record<string, unknown>) => void) => pc.statsRows.forEach(cb) }; },
    close() { pc.closed = true; },
    addEventListener(type: string, handler: (e: any) => void) { (listeners[type] ??= []).push(handler); },
    fire(type: string, e: any = {}) { (listeners[type] ?? []).forEach((h) => h(e)); },
  };
  const mod = {
    RTCPeerConnection: vi.fn(() => pc) as any,
    RTCIceCandidate: vi.fn((init) => init) as any,
    RTCSessionDescription: vi.fn((init) => init) as any,
    mediaDevices: { getUserMedia: vi.fn(async () => stream) },
  };
  return { mod, pc, tracks, stream };
}

describe('call media backend', () => {
  it('returns null when the WebRTC runtime is absent', () => {
    expect(loadCallMediaBackend({ module: undefined })).toBeNull();
  });

  it('requests audio-only media for a voice call and adds only an audio track', async () => {
    const { mod, pc } = fakeModule();
    // Video track present in the stream but a voice call must not enable it.
    const backend = loadCallMediaBackend({ module: mod as any });
    const session = await backend!.startPeerConnection({ callId: 'c1', media: 'voice', role: 'offerer', localMicOn: true, localCamOn: false });
    expect(mod.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(pc.added).toContain('audio');
    await session.close();
    expect(pc.closed).toBe(true);
  });

  it('offer/answer round trip returns typed SDP from the SDK', async () => {
    const { mod } = fakeModule();
    const backend = loadCallMediaBackend({ module: mod as any });
    const session = await backend!.startPeerConnection({ callId: 'c1', media: 'video', role: 'offerer', localMicOn: true, localCamOn: true });
    expect(await session.createOffer()).toEqual({ type: 'offer', sdp: 'offer-sdp' });
    expect(await session.createOffer({ iceRestart: true })).toEqual({ type: 'offer', sdp: 'offer-sdp-restart' });
    expect(await session.createAnswer()).toEqual({ type: 'answer', sdp: 'answer-sdp' });
  });

  it('forwards a real connected event as connectionState connected (NC-25.1 source)', async () => {
    const { mod, pc } = fakeModule();
    const backend = loadCallMediaBackend({ module: mod as any });
    const session = await backend!.startPeerConnection({ callId: 'c1', media: 'voice', role: 'answerer', localMicOn: true, localCamOn: false });
    const events: CallMediaConnectionEvent[] = [];
    session.onConnectionStateChange((e) => events.push(e));

    pc.connectionState = 'connecting';
    pc.fire('connectionstatechange');
    pc.connectionState = 'connected';
    pc.iceConnectionState = 'connected';
    pc.statsRows = [{ type: 'transport', selectedCandidatePairId: 'pair' }, { id: 'pair', type: 'candidate-pair', localCandidateId: 'local', remoteCandidateId: 'remote' }, { id: 'local', type: 'local-candidate', candidateType: 'host' }, { id: 'remote', type: 'remote-candidate', candidateType: 'host' }];
    pc.fire('connectionstatechange');
    await new Promise((r) => setTimeout(r, 0));

    expect(events.map((e) => e.connectionState)).toContain('connected');
    const connected = events.find((e) => e.connectionState === 'connected' && e.transport !== undefined);
    expect(connected?.transport).toBe('direct');
  });

  it('reports turn transport only when the selected pair relays through a relay candidate', async () => {
    const { mod, pc } = fakeModule();
    const session = await loadCallMediaBackend({ module: mod as any })!.startPeerConnection({ callId: 'c1', media: 'voice', role: 'offerer', localMicOn: true, localCamOn: false });
    const events: CallMediaConnectionEvent[] = [];
    session.onConnectionStateChange((e) => events.push(e));
    pc.connectionState = 'connected';
    pc.statsRows = [{ type: 'transport', selectedCandidatePairId: 'pair' }, { id: 'pair', type: 'candidate-pair', localCandidateId: 'local', remoteCandidateId: 'remote' }, { id: 'local', type: 'local-candidate', candidateType: 'relay' }, { id: 'remote', type: 'remote-candidate', candidateType: 'host' }];
    pc.fire('connectionstatechange');
    await new Promise((r) => setTimeout(r, 0));
    expect(events.find((e) => e.connectionState === 'connected' && e.transport !== undefined)?.transport).toBe('turn');
  });

  it('emits a null ICE candidate at end-of-candidates and a real candidate otherwise', async () => {
    const { mod, pc } = fakeModule();
    const session = await loadCallMediaBackend({ module: mod as any })!.startPeerConnection({ callId: 'c1', media: 'voice', role: 'offerer', localMicOn: true, localCamOn: false });
    const candidates: Array<unknown> = [];
    session.onIceCandidate((c) => candidates.push(c));
    pc.fire('icecandidate', { candidate: { candidate: 'candidate:1 ...', sdpMid: '0', sdpMLineIndex: 0 } });
    pc.fire('icecandidate', { candidate: null });
    expect(candidates[0]).toMatchObject({ candidate: 'candidate:1 ...', sdpMid: '0', sdpMLineIndex: 0 });
    expect(candidates[1]).toBeNull();
  });

  it('mic/cam toggles flip local track enabled flags and close stops all tracks', async () => {
    const { mod, tracks } = fakeModule();
    const session = await loadCallMediaBackend({ module: mod as any })!.startPeerConnection({ callId: 'c1', media: 'video', role: 'offerer', localMicOn: true, localCamOn: true });
    await session.setMicrophoneEnabled?.(false);
    await session.setCameraEnabled?.(false);
    expect(tracks.find((t) => t.kind === 'audio')?.enabled).toBe(false);
    expect(tracks.find((t) => t.kind === 'video')?.enabled).toBe(false);
    await session.close();
    expect(tracks.every((t) => (t.stop as any).mock.calls.length > 0)).toBe(true);
  });

  it('tears down the peer connection when getUserMedia is denied', async () => {
    const { mod, pc } = fakeModule();
    mod.mediaDevices.getUserMedia = vi.fn(async () => { throw new Error('permission_denied'); });
    const backend = loadCallMediaBackend({ module: mod as any });
    await expect(backend!.startPeerConnection({ callId: 'c1', media: 'video', role: 'offerer', localMicOn: true, localCamOn: true })).rejects.toThrow();
    expect(pc.closed).toBe(true);
  });
});


describe('call media teardown', () => {
  it('forwards the real connection state even when diagnostic stats never resolve', async () => {
    const { mod, pc } = fakeModule();
    const session = await loadCallMediaBackend({ module: mod })!.startPeerConnection({ callId: 'c1', media: 'voice', role: 'offerer', localMicOn: true, localCamOn: false });
    pc.getStats = () => new Promise(() => {});
    const events: CallMediaConnectionEvent[] = [];
    session.onConnectionStateChange((event) => events.push(event));
    pc.connectionState = 'connected';
    pc.fire('connectionstatechange');
    expect(events).toEqual([{ connectionState: 'connected', iceState: 'new' }]);
    await session.close();
  });

  it('bounds missing-route refreshes, recovers from real stats and cancels pending refreshes', async () => {
    vi.useFakeTimers();
    const { mod, pc } = fakeModule();
    const session = await loadCallMediaBackend({ module: mod })!.startPeerConnection({ callId: 'c1', media: 'voice', role: 'offerer', localMicOn: true, localCamOn: false });
    try {
      const stats = vi.spyOn(pc, 'getStats');
      const events: CallMediaConnectionEvent[] = [];
      const stop = session.onConnectionStateChange((event) => events.push(event));
      if (typeof stop !== 'function') throw new Error('unsubscribe callback missing');
      pc.connectionState = 'connected';
      pc.fire('connectionstatechange');
      await vi.advanceTimersByTimeAsync(10_000);
      expect(stats).toHaveBeenCalledTimes(5);
      expect(events.every((event) => event.transport === undefined)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      pc.statsRows = [
        { type: 'transport', selectedCandidatePairId: 'pair' },
        { id: 'pair', type: 'candidate-pair', localCandidateId: 'local', remoteCandidateId: 'remote' },
        { id: 'local', type: 'local-candidate', candidateType: 'host' },
        { id: 'remote', type: 'remote-candidate', candidateType: 'host' },
      ];
      pc.fire('connectionstatechange');
      await vi.advanceTimersByTimeAsync(0);
      expect(events.at(-1)?.transport).toBe('direct');
      pc.statsRows = [];
      pc.fire('connectionstatechange');
      await vi.advanceTimersByTimeAsync(0);
      if (typeof stop !== 'function') throw new Error('unsubscribe callback missing');
      stop();
      const count = stats.mock.calls.length;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(stats).toHaveBeenCalledTimes(count);
      expect(vi.getTimerCount()).toBe(0);
    } finally { await session.close(); vi.useRealTimers(); }
  });

  it('stops ICE and in-flight state callbacks after unsubscribe', async () => {
    const { mod, pc } = fakeModule();
    const session = await loadCallMediaBackend({ module: mod })!.startPeerConnection({ callId: 'c1', media: 'voice', role: 'offerer', localMicOn: true, localCamOn: false });
    const ice = vi.fn();
    const state = vi.fn();
    const stopIce = session.onIceCandidate(ice);
    const stopState = session.onConnectionStateChange(state);
    pc.connectionState = 'connected';
    pc.fire('connectionstatechange');
    if (typeof stopIce !== 'function' || typeof stopState !== 'function') throw new Error('unsubscribe callback missing');
    expect(state).toHaveBeenCalledWith({ connectionState: 'connected', iceState: 'new' });
    state.mockClear();
    stopIce(); stopState();
    pc.fire('icecandidate', { candidate: null });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ice).not.toHaveBeenCalled();
    expect(state).not.toHaveBeenCalled();
    await session.close();
  });

  it('ignores callbacks and delayed stats after closing', async () => {
    const { mod, pc } = fakeModule();
    const session = await loadCallMediaBackend({ module: mod })!.startPeerConnection({ callId: 'c1', media: 'voice', role: 'offerer', localMicOn: true, localCamOn: false });
    const state = vi.fn();
    session.onConnectionStateChange(state);
    pc.connectionState = 'connected';
    pc.fire('connectionstatechange');
    state.mockClear();
    await session.close();
    pc.fire('connectionstatechange');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state).not.toHaveBeenCalled();
  });

  it('stops every track even if another stop throws, and closes only once', async () => {
    const { mod, pc, tracks } = fakeModule();
    const session = await loadCallMediaBackend({ module: mod })!.startPeerConnection({ callId: 'c1', media: 'video', role: 'offerer', localMicOn: true, localCamOn: true });
    tracks[0]!.stop.mockImplementation(() => { throw new Error('Track already ended'); });
    const close = vi.spyOn(pc, 'close');
    await session.close();
    await session.close();
    expect(tracks[1]!.stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('stops acquired tracks when adding them to the connection fails', async () => {
    const { mod, pc, tracks } = fakeModule();
    vi.spyOn(pc, 'addTrack').mockImplementation(() => { throw new Error('Add track failed'); });
    await expect(loadCallMediaBackend({ module: mod })!.startPeerConnection({ callId: 'c1', media: 'video', role: 'offerer', localMicOn: true, localCamOn: true })).rejects.toThrow('Add track failed');
    expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(true);
    expect(pc.closed).toBe(true);
  });
});
