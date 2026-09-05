import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ModuleKind, transpileModule } from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import type { RoomEvent } from '../room-view-core';
import type { ConnectRoomInput, RoomLiveKitSession } from '../room-livekit-adapter';

const surfaces = [
  ['mobile', new URL('../room-livekit-adapter.ts', import.meta.url)],
  ['web', new URL('../../../../../meerkat-web/src/lib/room-livekit-adapter.ts', import.meta.url)],
] as const;

function harness(source: URL, bridges: Record<string, unknown> = { WebRTCModule: {}, LivekitReactNativeModule: {} }) {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const events: RoomEvent[] = [];
  const imports: string[] = [];
  const audio = { startAudioSession: vi.fn(async () => {}), stopAudioSession: vi.fn(async () => {}) };
  const room = {
    localParticipant: { identity: 'self' }, remoteParticipants: new Map(),
    connect: vi.fn(async () => {}), disconnect: vi.fn(async () => {}),
    on(event: string, handler: (...args: unknown[]) => void) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    },
    off(event: string, handler: (...args: unknown[]) => void) { handlers.get(event)?.delete(handler); },
  };
  const client = { Room: class { constructor() { return room; } }, RoomEvent: {}, ConnectionState: {} };
  const exports: { connectLiveKitRoom?: (input: ConnectRoomInput) => Promise<RoomLiveKitSession | null> } = {};
  runInNewContext(transpileModule(readFileSync(source, 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText, {
    exports, Map,
    require(name: string): unknown {
      imports.push(name);
      if (name === 'react-native') return { NativeModules: bridges };
      if (name === '@livekit/react-native') return { registerGlobals: vi.fn(), AudioSession: audio };
      if (name === 'livekit-client') return client;
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return {
    room, audio, imports, events,
    connect: () => exports.connectLiveKitRoom!({ livekitWsUrl: 'wss://rooms.example.test', token: 'fixture', onEvent: (event) => events.push(event) }),
    emit: (event: string, ...args: unknown[]) => { for (const handler of handlers.get(event) ?? []) handler(...args); },
  };
}

for (const [surface, source] of surfaces) describe(`${surface} room lifecycle`, () => {
  it('reports disconnection accurately and ignores unknown state strings', async () => {
    const h = harness(source);
    await h.connect();
    for (const state of ['connecting', 'connected', 'disconnected', 'reconnecting', 'signalReconnecting', 'not-connected', 'unexpected-reconnecting']) h.emit('connectionStateChanged', state);
    expect(h.events.filter((event) => event.type === 'connectionState')).toEqual([
      { type: 'connectionState', state: 'connecting' }, { type: 'connectionState', state: 'connected' },
      { type: 'connectionState', state: 'disconnected' }, { type: 'connectionState', state: 'reconnecting' },
      { type: 'connectionState', state: 'reconnecting' },
    ]);
    expect(h.events.filter((event) => event.type === 'participants')).toHaveLength(1);
  });

  it('closes failed joins and ignores late SDK callbacks', async () => {
    const h = harness(source);
    h.room.connect.mockRejectedValue(new Error('Join rejected'));
    expect(await h.connect()).toBeNull();
    expect(h.room.disconnect).toHaveBeenCalledTimes(1);
    if (surface === 'mobile') expect(h.audio.stopAudioSession).toHaveBeenCalledTimes(1);
    h.emit('connectionStateChanged', 'connected');
    h.emit('participantConnected');
    expect(h.events).toEqual([{ type: 'failed', reason: 'connect_failed' }]);
  });

  it('tears down once and refuses media controls after leaving', async () => {
    const h = harness(source);
    const session = (await h.connect())!;
    await Promise.all([session.disconnect(), session.disconnect()]);
    h.emit('connectionStateChanged', 'connected');
    expect(h.room.disconnect).toHaveBeenCalledTimes(1);
    expect(h.events).toEqual([{ type: 'left', reason: 'disconnected' }]);
    await expect(session.setMic(true)).rejects.toThrow('ended');
  });

  it('releases the audio session on a remote disconnection', async () => {
    const h = harness(source);
    const session = (await h.connect())!;
    h.emit('disconnected');
    await session.disconnect();
    expect(h.room.disconnect).toHaveBeenCalledTimes(1);
    if (surface === 'mobile') expect(h.audio.stopAudioSession).toHaveBeenCalledTimes(1);
    expect(h.events).toEqual([{ type: 'left', reason: 'disconnected' }]);
  });

  it('refuses unsupported media controls instead of claiming completion', async () => {
    const h = harness(source);
    const session = (await h.connect())!;
    await expect(session.setCamera(true)).rejects.toThrow('unavailable');
    expect(h.events).toEqual([]);
    await session.disconnect();
  });
});

describe('native room capability probe', () => {
  it.each([{}, { WebRTCModule: {} }, { LivekitReactNativeModule: {} }])('does not import native packages with missing bridges: %j', async (bridges) => {
    const h = harness(surfaces[0][1], bridges);
    expect(await h.connect()).toBeNull();
    expect(h.imports).toEqual(['react-native']);
  });
});
